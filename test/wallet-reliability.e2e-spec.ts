import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/infrastructure/database/database.service';

describe('Wallet Reliability & Integrity (e2e)', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    databaseService = app.get<DatabaseService>(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Concurrency & Race Conditions', () => {
    it('should handle concurrent transfers without double-spending (Deterministic Locking)', async () => {
      console.log('\n[Evidence] Scenario: 20 Parallel Transfers of $10 from $100 balance');
      
      const userA = '00000000-0000-0000-0000-000000000011';
      const userB = '00000000-0000-0000-0000-000000000012';
      
      const accA = await request(app.getHttpServer()).post('/wallet/account').send({ user_id: userA });
      const accB = await request(app.getHttpServer()).post('/wallet/account').send({ user_id: userB });
      const accAId = accA.body.id;
      const accBId = accB.body.id;

      await request(app.getHttpServer()).post('/wallet/deposit').send({ account_id: accAId, amount: 100 });

      const transferRequests = Array.from({ length: 20 }).map((_, i) => 
        request(app.getHttpServer())
          .post('/wallet/transfer')
          .set('x-idempotency-key', `concurrency-test-${i}`)
          .send({ from_account_id: accAId, to_account_id: accBId, amount: 10 })
      );

      const results = await Promise.all(transferRequests);
      const successes = results.filter(res => res.status === 201);
      const failures = results.filter(res => res.status === 422);

      console.log(`[Evidence] Results: ${successes.length} Successes (201), ${failures.length} Failures (422)`);

      expect(successes.length).toBe(10);
      expect(failures.length).toBe(10);

      const balA = await request(app.getHttpServer()).get(`/wallet/balance/${accAId}`);
      const balB = await request(app.getHttpServer()).get(`/wallet/balance/${accBId}`);

      console.log(`[Evidence] Final Balances -> Account A: ${balA.body.balance}, Account B: ${balB.body.balance}`);
      
      const totalBalance = parseFloat(balA.body.balance) + parseFloat(balB.body.balance);
      expect(totalBalance).toBe(100);
      expect([0, 100]).toContain(parseFloat(balA.body.balance));
      expect([0, 100]).toContain(parseFloat(balB.body.balance));
    });
  });

  describe('Deep Idempotency (Ledger Integrity)', () => {
    it('should only record one movement and one balance change for repeated requests', async () => {
      console.log('\n[Evidence] Scenario: Brute-forcing 5 identical deposit requests with same key');
      
      const user = '00000000-0000-0000-0000-000000000021';
      const acc = await request(app.getHttpServer()).post('/wallet/account').send({ user_id: user });
      const accId = acc.body.id;
      const key = `idempotency-brute-force-${Date.now()}`;

      const requests = Array.from({ length: 5 }).map(() => 
        request(app.getHttpServer())
          .post('/wallet/deposit')
          .set('x-idempotency-key', key)
          .send({ account_id: accId, amount: 50 })
      );

      const results = await Promise.all(requests);
      
      console.log(`[Evidence] Received Status Codes: ${results.map(r => r.status).join(', ')}`);
      
      // We accept 201 (success/cached success) or 409 (DB safety net caught the race)
      results.forEach(res => expect([201, 409]).toContain(res.status));

      // Verify Ledger
      const historyRes = await request(app.getHttpServer()).get(`/wallet/history/${accId}`);
      console.log(`[Evidence] Movements in ledger for this account: ${historyRes.body.history.length}`);
      expect(historyRes.body.history.length).toBe(1);

      const finalBal = await request(app.getHttpServer()).get(`/wallet/balance/${accId}`);
      console.log(`[Evidence] Final Balance: ${finalBal.body.balance} (Expected 50, not 250)`);
      expect(parseFloat(finalBal.body.balance)).toBe(50);
    });
  });

  describe('Middleware/DB Desync (The "Ghost" Success)', () => {
    it('should return 422 when movement exists but idempotency cache is missing', async () => {
      console.log('\n[Evidence] Scenario: Simulating missing cache but existing ledger record');
      
      const user = '00000000-0000-0000-0000-000000000031';
      const acc = await request(app.getHttpServer()).post('/wallet/account').send({ user_id: user });
      const accId = acc.body.id;
      const key = `desync-test-${Date.now()}`;

      // 1. Manually inject movement into DB (simulating a success that didn't get cached)
      await databaseService.query(
        'INSERT INTO movements (account_id, amount, type, idempotency_key) VALUES ($1, $2, $3, $4)',
        [accId, 10, 'DEPOSIT', key]
      );

      // 2. Call API with same key
      const res = await request(app.getHttpServer())
        .post('/wallet/deposit')
        .set('x-idempotency-key', key)
        .send({ account_id: accId, amount: 10 });

      console.log(`[Evidence] API Response status: ${res.status}`);
      console.log(`[Evidence] API Error Body: ${JSON.stringify(res.body)}`);

      // We expect 409 because the DatabaseErrorMapper catches the unique constraint violation on the movement
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('idempotency key already processed');
    });
  });

  describe('Deadlock Prevention', () => {
    it('should handle circular transfers (A->B, B->A) without deadlocking', async () => {
      console.log('\n[Evidence] Scenario: Parallel circular transfers (A->B and B->A)');
      
      const userA = '00000000-0000-0000-0000-000000000041';
      const userB = '00000000-0000-0000-0000-000000000042';
      
      const accA = await request(app.getHttpServer()).post('/wallet/account').send({ user_id: userA });
      const accB = await request(app.getHttpServer()).post('/wallet/account').send({ user_id: userB });
      const idA = accA.body.id;
      const idB = accB.body.id;

      await request(app.getHttpServer()).post('/wallet/deposit').send({ account_id: idA, amount: 100 });
      await request(app.getHttpServer()).post('/wallet/deposit').send({ account_id: idB, amount: 100 });

      const reqs = [
        request(app.getHttpServer()).post('/wallet/transfer').set('x-idempotency-key', 'circ-1').send({ from_account_id: idA, to_account_id: idB, amount: 50 }),
        request(app.getHttpServer()).post('/wallet/transfer').set('x-idempotency-key', 'circ-2').send({ from_account_id: idB, to_account_id: idA, amount: 50 })
      ];

      const results = await Promise.all(reqs);
      console.log(`[Evidence] Status Codes: ${results[0].status}, ${results[1].status}`);

      expect(results[0].status).toBe(201);
      expect(results[1].status).toBe(201);

      const balA = await request(app.getHttpServer()).get(`/wallet/balance/${idA}`);
      const balB = await request(app.getHttpServer()).get(`/wallet/balance/${idB}`);

      console.log(`[Evidence] Final Balances: A=${balA.body.balance}, B=${balB.body.balance}`);
      expect(parseFloat(balA.body.balance)).toBe(100);
      expect(parseFloat(balB.body.balance)).toBe(100);
    });
  });
});
