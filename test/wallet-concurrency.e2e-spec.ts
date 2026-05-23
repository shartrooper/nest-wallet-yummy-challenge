import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, UnprocessableEntityException } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/infrastructure/database/database.service';

describe('Wallet Concurrency (e2e)', () => {
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

  it('should handle concurrent transfers without double-spending', async () => {
    // 1. Create two accounts
    const userA = '00000000-0000-0000-0000-000000000001';
    const userB = '00000000-0000-0000-0000-000000000002';
    
    const accA = await request(app.getHttpServer())
      .post('/wallet/account')
      .send({ user_id: userA });
    
    const accB = await request(app.getHttpServer())
      .post('/wallet/account')
      .send({ user_id: userB });

    const accAId = accA.body.id;
    const accBId = accB.body.id;

    // 2. Deposit $100 to Account A
    await request(app.getHttpServer())
      .post('/wallet/deposit')
      .send({ account_id: accAId, amount: 100 });

    // 3. Fire 20 concurrent transfers of $10 each (Total $200 requested, only $100 available)
    const transferRequests = Array.from({ length: 20 }).map((_, i) => 
      request(app.getHttpServer())
        .post('/wallet/transfer')
        .set('x-idempotency-key', `stress-test-${i}`)
        .send({
          from_account_id: accAId,
          to_account_id: accBId,
          amount: 10
        })
    );

    const results = await Promise.all(transferRequests);

    // 4. Verify exactly 10 succeeded and 10 failed
    const successes = results.filter(res => res.status === 201);
    const failures = results.filter(res => res.status === 422); // Unprocessable Entity (Insufficient funds)

    expect(successes.length).toBe(10);
    expect(failures.length).toBe(10);

    // 5. Verify final balances
    const finalBalanceA = await request(app.getHttpServer()).get(`/wallet/balance/${accAId}`);
    const finalBalanceB = await request(app.getHttpServer()).get(`/wallet/balance/${accBId}`);

    expect(parseFloat(finalBalanceA.body.balance)).toBe(0);
    expect(parseFloat(finalBalanceB.body.balance)).toBe(100);
  });
});
