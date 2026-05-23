import { Test, TestingModule } from '@nestjs/testing';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { NotFoundException } from '@nestjs/common';

describe('WalletController', () => {
  let controller: WalletController;
  let service: WalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        {
          provide: WalletService,
          useValue: {
            getBalance: jest.fn(),
            deposit: jest.fn(),
            withdraw: jest.fn(),
            transfer: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WalletController>(WalletController);
    service = module.get<WalletService>(WalletService);
  });

  it('should return balance', async () => {
    const accountId = '00000000-0000-0000-0000-000000000000';
    (service.getBalance as jest.Mock).mockResolvedValue(100.5);

    const result = await controller.getBalance(accountId);

    expect(result).toEqual({
      account_id: accountId,
      balance: 100.5,
    });
    expect(service.getBalance).toHaveBeenCalledWith(accountId);
  });

  it('should propagate NotFoundException', async () => {
    const accountId = '00000000-0000-0000-0000-000000000000';
    (service.getBalance as jest.Mock).mockRejectedValue(new NotFoundException());

    await expect(controller.getBalance(accountId)).rejects.toThrow(NotFoundException);
  });

  describe('deposit', () => {
    it('should successfully deposit', async () => {
      const dto = { account_id: 'uuid', amount: 100 };
      (service.deposit as jest.Mock).mockResolvedValue({ newBalance: 150 });

      const result = await controller.deposit(dto);

      expect(result).toEqual({ newBalance: 150 });
      expect(service.deposit).toHaveBeenCalledWith(dto.account_id, dto.amount);
    });
  });

  describe('withdraw', () => {
    it('should successfully withdraw', async () => {
      const dto = { account_id: 'uuid', amount: 50 };
      (service.withdraw as jest.Mock).mockResolvedValue({ newBalance: 50 });

      const result = await controller.withdraw(dto);

      expect(result).toEqual({ newBalance: 50 });
      expect(service.withdraw).toHaveBeenCalledWith(dto.account_id, dto.amount);
    });
  });

  describe('transfer', () => {
    it('should successfully transfer', async () => {
      const dto = { from_account_id: 'uuid-1', to_account_id: 'uuid-2', amount: 30 };
      (service.transfer as jest.Mock).mockResolvedValue({ fromNewBalance: 70, toNewBalance: 50 });

      const result = await controller.transfer(dto);

      expect(result).toEqual({ fromNewBalance: 70, toNewBalance: 50 });
      expect(service.transfer).toHaveBeenCalledWith(dto.from_account_id, dto.to_account_id, dto.amount);
    });
  });
});
