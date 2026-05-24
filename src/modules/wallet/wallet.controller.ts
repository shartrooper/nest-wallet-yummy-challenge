import { Controller, Get, Post, Body, Param, ParseUUIDPipe, UseInterceptors, Headers } from '@nestjs/common';
import { ApiTags, ApiSecurity, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiHeader } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawalDto } from './dto/withdrawal.dto';
import { TransferDto } from './dto/transfer.dto';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';

@ApiTags('Wallet')
@ApiSecurity('api-key')
@Controller('wallet')
@UseInterceptors(IdempotencyInterceptor)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance/:id')
  @ApiOperation({ summary: 'Get account balance' })
  @ApiParam({ name: 'id', description: 'The UUID of the account' })
  @ApiResponse({ status: 200, description: 'Returns the account balance' })
  @ApiResponse({ status: 400, description: 'Bad Request (invalid UUID)' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getBalance(@Param('id', new ParseUUIDPipe()) id: string) {
    const balance = await this.walletService.getBalance(id);
    return { account_id: id, balance };
  }

  @Get('history/:id')
  @ApiOperation({ summary: 'Get account transaction history' })
  @ApiParam({ name: 'id', description: 'The UUID of the account' })
  @ApiResponse({ status: 200, description: 'Returns the account transaction history' })
  @ApiResponse({ status: 400, description: 'Bad Request (invalid UUID)' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getHistory(@Param('id', new ParseUUIDPipe()) id: string) {
    const history = await this.walletService.getHistory(id);
    return { account_id: id, history };
  }

  @Post('account')
  @ApiOperation({ summary: 'Create a new account' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', format: 'uuid', description: 'The user ID (UUID) for the new account', example: '00000000-0000-0000-0000-000000000003' },
      },
      required: ['user_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'Account created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request (invalid UUID)' })
  async createAccount(@Body('user_id', new ParseUUIDPipe()) userId: string) {
    return this.walletService.createAccount(userId);
  }

  @Post('deposit')
  @ApiOperation({ summary: 'Deposit funds into an account' })
  @ApiHeader({ name: 'x-idempotency-key', required: false, description: 'Optional idempotency key to prevent duplicate requests' })
  @ApiResponse({ status: 201, description: 'Deposit successful' })
  @ApiResponse({ status: 400, description: 'Bad Request (invalid payload)' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async deposit(
    @Body() depositDto: DepositDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.walletService.deposit(depositDto.account_id, depositDto.amount, idempotencyKey);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw funds from an account' })
  @ApiHeader({ name: 'x-idempotency-key', required: false, description: 'Optional idempotency key to prevent duplicate requests' })
  @ApiResponse({ status: 201, description: 'Withdrawal successful' })
  @ApiResponse({ status: 400, description: 'Bad Request (invalid payload)' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 422, description: 'Unprocessable Entity (insufficient funds)' })
  async withdraw(
    @Body() withdrawalDto: WithdrawalDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.walletService.withdraw(withdrawalDto.account_id, withdrawalDto.amount, idempotencyKey);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Transfer funds between accounts' })
  @ApiHeader({ name: 'x-idempotency-key', required: false, description: 'Optional idempotency key to prevent duplicate requests' })
  @ApiResponse({ status: 201, description: 'Transfer successful' })
  @ApiResponse({ status: 400, description: 'Bad Request (invalid payload)' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 422, description: 'Unprocessable Entity (insufficient funds)' })
  async transfer(
    @Body() transferDto: TransferDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.walletService.transfer(
      transferDto.from_account_id,
      transferDto.to_account_id,
      transferDto.amount,
      idempotencyKey,
    );
  }
}
