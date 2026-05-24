import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('System')
@Controller('system')
export class SystemController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Check API and Database health' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async health() {
    try {
      await this.databaseService.query('SELECT 1');
      return { status: 'ok', database: 'connected' };
    } catch (error) {
      return { status: 'error', database: 'disconnected' };
    }
  }

  @Post('seed')
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Seed database with demo accounts (Evaluator use only)' })
  @ApiResponse({ status: 201, description: 'Database seeded successfully' })
  async seed() {
    const idA = '11111111-1111-4111-8111-111111111111';
    const userA = '00000000-0000-0000-0000-000000000001';
    const idB = '22222222-2222-4222-8222-222222222222';
    const userB = '00000000-0000-0000-0000-000000000002';

    // Create accounts if they don't exist
    const resA = await this.databaseService.query(
      'INSERT INTO accounts (id, user_id, balance) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance RETURNING id',
      [idA, userA, 1000],
    );
    const resB = await this.databaseService.query(
      'INSERT INTO accounts (id, user_id, balance) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance RETURNING id',
      [idB, userB, 500],
    );

    return {
      message: 'Demo data seeded/reset',
      accounts: [
        { account_id: resA[0].id, user_id: userA, initial_balance: 1000 },
        { account_id: resB[0].id, user_id: userB, initial_balance: 500 },
      ],
      tip: 'Use the account_id values to test transfers/withdrawals/balance.',
    };
  }

  @Post('reset')
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Wipe all data (movements, accounts, idempotency) - USE WITH CAUTION' })
  @ApiResponse({ status: 200, description: 'Database wiped successfully' })
  async reset() {
    // Truncate all tables in correct order
    await this.databaseService.query('TRUNCATE TABLE movements, accounts, idempotency_responses CASCADE');
    return { message: 'Database wiped clean.' };
  }
}
