import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';

@Injectable()
export class IdempotencyService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getResponse(key: string): Promise<any> {
    const rows = await this.databaseService.query(
      'SELECT status_code, response_body FROM idempotency_responses WHERE key = $1',
      [key]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async saveResponse(key: string, statusCode: number, responseBody: any): Promise<void> {
    await this.databaseService.query(
      'INSERT INTO idempotency_responses (key, status_code, response_body) VALUES ($1, $2, $3)',
      [key, statusCode, JSON.stringify(responseBody)]
    );
  }
}
