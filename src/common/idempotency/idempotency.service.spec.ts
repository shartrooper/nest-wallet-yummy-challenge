import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyService } from './idempotency.service';
import { DatabaseService } from '../../infrastructure/database/database.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: DatabaseService,
          useValue: {
            query: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  it('should return cached response', async () => {
    const mockResponse = { status_code: 201, response_body: { success: true } };
    (databaseService.query as jest.Mock).mockResolvedValue([mockResponse]);

    const result = await service.getResponse('key-1');

    expect(result).toEqual(mockResponse);
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT status_code, response_body FROM idempotency_responses'),
      ['key-1']
    );
  });

  it('should save response', async () => {
    await service.saveResponse('key-2', 200, { data: 'test' });

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO idempotency_responses'),
      ['key-2', 200, JSON.stringify({ data: 'test' })]
    );
  });
});
