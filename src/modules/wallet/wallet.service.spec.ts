import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { AccountRepository } from './account.repository';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

describe('WalletService', () => {
  let service: WalletService;
  let accountRepository: AccountRepository;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: AccountRepository,
          useValue: {
            findById: jest.fn(),
            findByIdWithLock: jest.fn(),
            updateBalance: jest.fn(),
            recordMovement: jest.fn(),
          },
        },
        {
          provide: DatabaseService,
          useValue: {
            transaction: jest.fn((cb) => cb({})), // Pass a dummy client
          },
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    accountRepository = module.get<AccountRepository>(AccountRepository);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  it('should return balance when account exists', async () => {
    (accountRepository.findById as jest.Mock).mockResolvedValue({
      id: 'uuid',
      balance: '150.50',
    });

    const balance = await service.getBalance('uuid');

    expect(balance).toBe(150.5);
    expect(accountRepository.findById).toHaveBeenCalledWith('uuid');
  });

  it('should throw NotFoundException when account does not exist', async () => {
    (accountRepository.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.getBalance('non-existent')).rejects.toThrow(NotFoundException);
  });

  describe('deposit', () => {
    it('should successfully deposit funds', async () => {
      const accountId = 'uuid';
      const amount = 100;
      
      (accountRepository.findByIdWithLock as jest.Mock).mockResolvedValue({ id: accountId, balance: '50.00' });
      
      const result = await service.deposit(accountId, amount);

      expect(result.newBalance).toBe(150.0);
      expect(accountRepository.findByIdWithLock).toHaveBeenCalledWith(accountId, {});
      expect(accountRepository.updateBalance).toHaveBeenCalledWith(accountId, 150.0, {});
      expect(accountRepository.recordMovement).toHaveBeenCalledWith(accountId, amount, 'DEPOSIT', {});
    });

    it('should throw BadRequestException for negative amount', async () => {
      await expect(service.deposit('uuid', -10)).rejects.toThrow('Amount must be positive');
    });
  });

  describe('withdrawal', () => {
    it('should successfully withdraw funds', async () => {
      const accountId = 'uuid';
      const amount = 50;
      
      (accountRepository.findByIdWithLock as jest.Mock).mockResolvedValue({ id: accountId, balance: '100.00' });
      
      const result = await service.withdraw(accountId, amount);

      expect(result.newBalance).toBe(50.0);
      expect(accountRepository.updateBalance).toHaveBeenCalledWith(accountId, 50.0, {});
      expect(accountRepository.recordMovement).toHaveBeenCalledWith(accountId, amount, 'WITHDRAWAL', {});
    });

    it('should throw UnprocessableEntityException for insufficient funds', async () => {
      const accountId = 'uuid';
      const amount = 150;
      
      (accountRepository.findByIdWithLock as jest.Mock).mockResolvedValue({ id: accountId, balance: '100.00' });
      
      await expect(service.withdraw(accountId, amount)).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('transfer', () => {
    it('should successfully transfer funds', async () => {
      const fromId = 'uuid-1';
      const toId = 'uuid-2';
      const amount = 50;
      
      (accountRepository.findByIdWithLock as jest.Mock)
        .mockResolvedValueOnce({ id: fromId, balance: '100.00' }) // First call (lower ID)
        .mockResolvedValueOnce({ id: toId, balance: '20.00' });   // Second call (higher ID)
      
      // We need to ensure deterministic ordering in the test if we want to check call arguments
      // But for now, let's just check the result
      const result = await service.transfer(fromId, toId, amount);

      expect(result.fromNewBalance).toBe(50.0);
      expect(result.toNewBalance).toBe(70.0);
      
      expect(accountRepository.updateBalance).toHaveBeenCalledTimes(2);
      expect(accountRepository.recordMovement).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException for transfer to same account', async () => {
      await expect(service.transfer('uuid', 'uuid', 10)).rejects.toThrow('Cannot transfer to the same account');
    });
  });
});
