import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service';
import { DB_POOL } from './database.constants';

describe('DatabaseService', () => {
  let service: DatabaseService;
  let mockPool: any;

  beforeEach(async () => {
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: DB_POOL,
          useValue: mockPool,
        },
      ],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkConnection', () => {
    it('should return true when connection is successful', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      const result = await (service as any).checkConnection();
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT NOW()', []);
    });

    it('should return false when connection fails', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Connection failed'));
      const result = await (service as any).checkConnection();
      expect(result).toBe(false);
    });
  });
});
