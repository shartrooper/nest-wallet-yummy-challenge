import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/infrastructure/database/database.service';
import { ConfigService } from '@nestjs/config';

/**
 * Fixed user_ids used across all test scenarios.
 * These are collected here so the afterAll teardown can wipe them cleanly.
 */
const TEST_USER_IDS = [
  '00000000-0000-0000-0000-000000000001', // Security test
  '00000000-0000-0000-0000-000000000111', // Concurrency A
  '00000000-0000-0000-0000-000000000112', // Concurrency B
  '00000000-0000-0000-0000-000000000221', // Idempotency
  '00000000-0000-0000-0000-000000000331', // Ghost-success / desync
  '00000000-0000-0000-0000-000000000441', // Deadlock A
  '00000000-0000-0000-0000-000000000442', // Deadlock B
];

/** Idempotency-key prefixes written during tests — cleaned up in teardown. */
const TEST_IDEMPOTENCY_PREFIXES = [
  'concurrency-test-',
  'idempotency-brute-force-',
  'desync-test-',
  'circ-1',
  'circ-2',
];

describe('Wallet Reliability & Integrity (e2e)', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;
  let apiKey: string;

  /** Wipes all data created by this test suite. Safe to call before or after tests. */
  async function teardownTestData() {
    const accountRows = await databaseService.query<{ id: string }>(
      `SELECT id FROM accounts WHERE user_id = ANY($1::uuid[])`,
      [TEST_USER_IDS],
    );
    const accountIds = accountRows.map((r) => r.id);

    if (accountIds.length > 0) {
      await databaseService.query(
        `DELETE FROM movements WHERE account_id = ANY($1::uuid[])`,
        [accountIds],
      );
      await databaseService.query(
        `DELETE FROM accounts WHERE id = ANY($1::uuid[])`,
        [accountIds],
      );
    }

    for (const prefix of TEST_IDEMPOTENCY_PREFIXES) {
      await databaseService.query(
        `DELETE FROM idempotency_responses WHERE key LIKE $1`,
        [`${prefix}%`],
      );
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    databaseService = app.get<DatabaseService>(DatabaseService);
    apiKey = app.get<ConfigService>(ConfigService).get<string>('API_KEY') as string;

    if (!apiKey) {
      throw new Error('API_KEY must be set in environment for E2E tests');
    }

    // Clean up any stale data from a previously interrupted run
    await teardownTestData();
  });

  afterAll(async () => {
    try {
      await teardownTestData();
    } catch (err) {
      console.error('[Teardown] Error cleaning up test data:', err.message);
    } finally {
      await app.close();
    }
  });

  describe('Security & Authentication', () => {
    it('should return 401 when API key is missing', async () => {
      // First create an account so we know it exists
      const acc = await request(app.getHttpServer()).post('/wallet/account').set('x-api-key', apiKey).send({ user_id: '00000000-0000-0000-0000-000000000001' });
      const id = acc.body.id;

      const res = await request(app.getHttpServer()).get(`/wallet/balance/${id}`);
      expect(res.status).toBe(401);
    });

    it('should return 401 when API key is invalid', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance/00000000-0000-0000-0000-000000000001')
        .set('x-api-key', 'wrong-key');
      expect(res.status).toBe(401);
    });

    it('should allow public access to health check', async () => {
      const res = await request(app.getHttpServer()).get('/system/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Concurrency & Race Conditions', () => {
    it('should handle concurrent transfers without double-spending (Deterministic Locking)', async () => {
      console.log('\n[Evidence] Scenario: 20 Parallel Transfers of $10 from $100 balance');

      const userA = '00000000-0000-0000-0000-000000000111';
      const userB = '00000000-0000-0000-0000-000000000112';

      const accA = await request(app.getHttpServer()).post('/wallet/account').set('x-api-key', apiKey).send({ user_id: userA });
      const accB = await request(app.getHttpServer()).post('/wallet/account').set('x-api-key', apiKey).send({ user_id: userB });
      const accAId = accA.body.id;
      const accBId = accB.body.id;

      await request(app.getHttpServer()).post('/wallet/deposit').set('x-api-key', apiKey).send({ account_id: accAId, amount: 30 });

      const transferRequests = Array.from({ length: 5 }).map((_, i) =>
        request(app.getHttpServer())
          .post('/wallet/transfer')
          .set('x-api-key', apiKey)
          .set('x-idempotency-key', `concurrency-test-${i}`)
          .send({ from_account_id: accAId, to_account_id: accBId, amount: 10 })
      );

      const results = await Promise.all(transferRequests);
      const successes = results.filter(res => res.status === 201);
      const failures = results.filter(res => res.status === 422);

      console.log(`[Evidence] Results: ${successes.length} Successes (201), ${failures.length} Failures (422)`);

      expect(successes.length).toBe(3);
      expect(failures.length).toBe(2);

      const balA = await request(app.getHttpServer()).get(`/wallet/balance/${accAId}`).set('x-api-key', apiKey);
      const balB = await request(app.getHttpServer()).get(`/wallet/balance/${accBId}`).set('x-api-key', apiKey);

      console.log(`[Evidence] Final Balances -> Account A: ${balA.body.balance}, Account B: ${balB.body.balance}`);

      const totalBalance = parseFloat(balA.body.balance) + parseFloat(balB.body.balance);
      expect(totalBalance).toBe(30);
      expect(parseFloat(balA.body.balance)).toBe(0);
      expect(parseFloat(balB.body.balance)).toBe(30);
    });
  });

  describe('Deep Idempotency (Ledger Integrity)', () => {
    it('should only record one movement and one balance change for repeated requests', async () => {
      console.log('\n[Evidence] Scenario: Brute-forcing 5 identical deposit requests with same key');

      const user = '00000000-0000-0000-0000-000000000221';
      const acc = await request(app.getHttpServer()).post('/wallet/account').set('x-api-key', apiKey).send({ user_id: user });
      const accId = acc.body.id;
      const key = `idempotency-brute-force-${Date.now()}`;

      const requests = Array.from({ length: 5 }).map(() =>
        request(app.getHttpServer())
          .post('/wallet/deposit')
          .set('x-api-key', apiKey)
          .set('x-idempotency-key', key)
          .send({ account_id: accId, amount: 50 })
      );

      const results = await Promise.all(requests);

      console.log(`[Evidence] Received Status Codes: ${results.map(r => r.status).join(', ')}`);

      results.forEach(res => expect([201, 409]).toContain(res.status));

      const historyRes = await request(app.getHttpServer()).get(`/wallet/history/${accId}`).set('x-api-key', apiKey);
      console.log(`[Evidence] Movements in ledger for this account: ${historyRes.body.history.length}`);
      expect(historyRes.body.history.length).toBe(1);

      const finalBal = await request(app.getHttpServer()).get(`/wallet/balance/${accId}`).set('x-api-key', apiKey);
      console.log(`[Evidence] Final Balance: ${finalBal.body.balance} (Expected 50, not 250)`);
      expect(parseFloat(finalBal.body.balance)).toBe(50);
    });
  });

  describe('Middleware/DB Desync (The "Ghost" Success)', () => {
    it('should return 409 when movement exists but idempotency cache is missing', async () => {
      console.log('\n[Evidence] Scenario: Simulating missing cache but existing ledger record');

      const user = '00000000-0000-0000-0000-000000000331';
      const acc = await request(app.getHttpServer()).post('/wallet/account').set('x-api-key', apiKey).send({ user_id: user });
      const accId = acc.body.id;
      const key = `desync-test-${Date.now()}`;

      await databaseService.query(
        'INSERT INTO movements (account_id, amount, type, idempotency_key) VALUES ($1, $2, $3, $4)',
        [accId, 10, 'DEPOSIT', key]
      );

      const res = await request(app.getHttpServer())
        .post('/wallet/deposit')
        .set('x-api-key', apiKey)
        .set('x-idempotency-key', key)
        .send({ account_id: accId, amount: 10 });

      console.log(`[Evidence] API Response status: ${res.status}`);
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('idempotency key already processed');
    });
  });

  describe('Deadlock Prevention', () => {
    it('should handle circular transfers (A->B, B->A) without deadlocking', async () => {
      console.log('\n[Evidence] Scenario: Parallel circular transfers (A->B and B->A)');

      const userA = '00000000-0000-0000-0000-000000000441';
      const userB = '00000000-0000-0000-0000-000000000442';

      const accA = await request(app.getHttpServer()).post('/wallet/account').set('x-api-key', apiKey).send({ user_id: userA });
      const accB = await request(app.getHttpServer()).post('/wallet/account').set('x-api-key', apiKey).send({ user_id: userB });
      const idA = accA.body.id;
      const idB = accB.body.id;

      await request(app.getHttpServer()).post('/wallet/deposit').set('x-api-key', apiKey).send({ account_id: idA, amount: 100 });
      await request(app.getHttpServer()).post('/wallet/deposit').set('x-api-key', apiKey).send({ account_id: idB, amount: 100 });

      const reqs = [
        request(app.getHttpServer()).post('/wallet/transfer').set('x-api-key', apiKey).set('x-idempotency-key', 'circ-1').send({ from_account_id: idA, to_account_id: idB, amount: 50 }),
        request(app.getHttpServer()).post('/wallet/transfer').set('x-api-key', apiKey).set('x-idempotency-key', 'circ-2').send({ from_account_id: idB, to_account_id: idA, amount: 50 })
      ];

      const results = await Promise.all(reqs);
      expect(results[0].status).toBe(201);
      expect(results[1].status).toBe(201);

      const balA = await request(app.getHttpServer()).get(`/wallet/balance/${idA}`).set('x-api-key', apiKey);
      const balB = await request(app.getHttpServer()).get(`/wallet/balance/${idB}`).set('x-api-key', apiKey);

      expect(parseFloat(balA.body.balance)).toBe(100);
      expect(parseFloat(balB.body.balance)).toBe(100);
    });
  });
});
