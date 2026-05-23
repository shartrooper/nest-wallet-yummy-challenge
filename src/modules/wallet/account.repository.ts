import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { PoolClient } from 'pg';

@Injectable()
export class AccountRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findById(id: string, client?: PoolClient): Promise<any> {
    const query = 'SELECT * FROM accounts WHERE id = $1';
    const params = [id];
    const rows = client 
      ? (await client.query(query, params)).rows 
      : await this.databaseService.query(query, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async findByIdWithLock(id: string, client: PoolClient): Promise<any> {
    const query = 'SELECT * FROM accounts WHERE id = $1 FOR UPDATE';
    const params = [id];
    const res = await client.query(query, params);
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  async updateBalance(id: string, newBalance: number, client: PoolClient): Promise<void> {
    const query = 'UPDATE accounts SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
    const params = [newBalance, id];
    await client.query(query, params);
  }

  async recordMovement(
    accountId: string,
    amount: number,
    type: string,
    client: PoolClient,
    referenceId?: string,
    idempotencyKey?: string,
  ): Promise<void> {
    const query = `
      INSERT INTO movements (account_id, amount, type, reference_id, idempotency_key)
      VALUES ($1, $2, $3, $4, $5)
    `;
    const params = [accountId, amount, type, referenceId, idempotencyKey];
    await client.query(query, params);
  }
}
