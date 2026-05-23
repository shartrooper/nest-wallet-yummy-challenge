import { Injectable, NotFoundException, BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { AccountRepository } from './account.repository';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { DatabaseErrorMapper } from '../../infrastructure/database/database-error.mapper';

@Injectable()
export class WalletService {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly databaseService: DatabaseService,
  ) {}

  async getBalance(accountId: string): Promise<number> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }
    return parseFloat(account.balance);
  }

  async deposit(accountId: string, amount: number): Promise<{ newBalance: number }> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    try {
      return await this.databaseService.transaction(async (client) => {
        const account = await this.accountRepository.findByIdWithLock(accountId, client);
        if (!account) {
          throw new NotFoundException(`Account with ID ${accountId} not found`);
        }

        const currentBalance = parseFloat(account.balance);
        const newBalance = currentBalance + amount;

        await this.accountRepository.updateBalance(accountId, newBalance, client);
        await this.accountRepository.recordMovement(accountId, amount, 'DEPOSIT', client);

        return { newBalance };
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw DatabaseErrorMapper.map(error);
    }
  }

  async withdraw(accountId: string, amount: number): Promise<{ newBalance: number }> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    try {
      return await this.databaseService.transaction(async (client) => {
        const account = await this.accountRepository.findByIdWithLock(accountId, client);
        if (!account) {
          throw new NotFoundException(`Account with ID ${accountId} not found`);
        }

        const currentBalance = parseFloat(account.balance);
        if (currentBalance < amount) {
          throw new UnprocessableEntityException('Insufficient funds');
        }

        const newBalance = currentBalance - amount;

        await this.accountRepository.updateBalance(accountId, newBalance, client);
        await this.accountRepository.recordMovement(accountId, amount, 'WITHDRAWAL', client);

        return { newBalance };
      });
    } catch (error) {
      if (
        error instanceof NotFoundException || 
        error instanceof BadRequestException || 
        error instanceof UnprocessableEntityException
      ) {
        throw error;
      }
      throw DatabaseErrorMapper.map(error);
    }
  }

  async transfer(fromId: string, toId: string, amount: number): Promise<{ fromNewBalance: number; toNewBalance: number }> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    if (fromId === toId) {
      throw new BadRequestException('Cannot transfer to the same account');
    }

    try {
      return await this.databaseService.transaction(async (client) => {
        // Deterministic locking to prevent deadlocks: lock lower ID first
        const [firstId, secondId] = fromId < toId ? [fromId, toId] : [toId, fromId];
        
        const firstAccount = await this.accountRepository.findByIdWithLock(firstId, client);
        const secondAccount = await this.accountRepository.findByIdWithLock(secondId, client);

        if (!firstAccount) throw new NotFoundException(`Account with ID ${firstId} not found`);
        if (!secondAccount) throw new NotFoundException(`Account with ID ${secondId} not found`);

        const fromAccount = firstId === fromId ? firstAccount : secondAccount;
        const toAccount = firstId === toId ? firstAccount : secondAccount;

        const fromCurrentBalance = parseFloat(fromAccount.balance);
        if (fromCurrentBalance < amount) {
          throw new UnprocessableEntityException('Insufficient funds');
        }

        const fromNewBalance = fromCurrentBalance - amount;
        const toNewBalance = parseFloat(toAccount.balance) + amount;

        await this.accountRepository.updateBalance(fromId, fromNewBalance, client);
        await this.accountRepository.updateBalance(toId, toNewBalance, client);

        // Record movements with reference IDs for audit trail
        // TRANSFER_OUT from sender, points to TRANSFER_IN
        // We'll record them and rely on the fact they are in the same transaction
        // The reference_id can point to the account or another movement if we had its ID
        // For now, let's just record them.
        await this.accountRepository.recordMovement(fromId, amount, 'TRANSFER_OUT', client, toId);
        await this.accountRepository.recordMovement(toId, amount, 'TRANSFER_IN', client, fromId);

        return { fromNewBalance, toNewBalance };
      });
    } catch (error) {
      if (
        error instanceof NotFoundException || 
        error instanceof BadRequestException || 
        error instanceof UnprocessableEntityException
      ) {
        throw error;
      }
      throw DatabaseErrorMapper.map(error);
    }
  }
}
