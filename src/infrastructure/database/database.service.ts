import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { DB_POOL } from './database.constants';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async query<T = any>(text: string, params: any[] = []): Promise<T[]> {
    const start = Date.now();
    const res = await this.pool.query(text, params);
    const duration = Date.now() - start;
    this.logger.debug({ text, duration, rows: res.rowCount });
    return res.rows;
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.query('SELECT NOW()');
      return true;
    } catch (error) {
      this.logger.error('Database connection check failed', error.stack);
      return false;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
