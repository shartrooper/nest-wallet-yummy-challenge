import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { AccountRepository } from './account.repository';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';

@Module({
  imports: [DatabaseModule, IdempotencyModule],
  controllers: [WalletController],
  providers: [WalletService, AccountRepository],
  exports: [WalletService],
})
export class WalletModule {}
