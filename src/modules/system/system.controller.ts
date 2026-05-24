import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiResponse, ApiSecurity } from '@nestjs/swagger';
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
    const userA = '00000000-0000-0000-0000-000000000001';
    const userB = '00000000-0000-0000-0000-000000000002';

    // Create accounts if they don't exist
    await this.databaseService.query(
      'INSERT INTO accounts (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance',
      [userA, 1000],
    );
    await this.databaseService.query(
      'INSERT INTO accounts (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance',
      [userB, 500],
    );

    return {
      message: 'Demo data seeded/reset',
      accounts: [
        { user_id: userA, initial_balance: 1000 },
        { user_id: userB, initial_balance: 500 },
      ],
      tip: 'Use these accounts to test transfers/withdrawals.',
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
