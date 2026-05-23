import { Controller, Get, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawalDto } from './dto/withdrawal.dto';
import { TransferDto } from './dto/transfer.dto';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance/:id')
  async getBalance(@Param('id', new ParseUUIDPipe()) id: string) {
    const balance = await this.walletService.getBalance(id);
    return { account_id: id, balance };
  }

  @Post('deposit')
  async deposit(@Body() depositDto: DepositDto) {
    return this.walletService.deposit(depositDto.account_id, depositDto.amount);
  }

  @Post('withdraw')
  async withdraw(@Body() withdrawalDto: WithdrawalDto) {
    return this.walletService.withdraw(withdrawalDto.account_id, withdrawalDto.amount);
  }

  @Post('transfer')
  async transfer(@Body() transferDto: TransferDto) {
    return this.walletService.transfer(
      transferDto.from_account_id,
      transferDto.to_account_id,
      transferDto.amount,
    );
  }
}
