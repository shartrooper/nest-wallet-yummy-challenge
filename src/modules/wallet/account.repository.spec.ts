import { Test, TestingModule } from '@nestjs/testing';
import { AccountRepository } from './account.repository';
import { DatabaseService } from '../../infrastructure/database/database.service';

describe('AccountRepository', () => {
  let repository: AccountRepository;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountRepository,
        {
          provide: DatabaseService,
          useValue: {
            query: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<AccountRepository>(AccountRepository);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  it('should return an account when found', async () => {
    const mockAccount = { id: 'uuid', balance: '100.00' };
    (databaseService.query as jest.Mock).mockResolvedValue([mockAccount]);

    const result = await repository.findById('uuid');

    expect(result).toEqual(mockAccount);
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM accounts WHERE id = $1'),
      ['uuid']
    );
  });

  it('should return null when account not found', async () => {
    (databaseService.query as jest.Mock).mockResolvedValue([]);

    const result = await repository.findById('non-existent');

    expect(result).toBeNull();
  });
});
