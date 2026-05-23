import { Test, TestingModule } from '@nestjs/testing';
import { SchemaRunnerService } from './schema-runner.service';
import { DatabaseService } from './database.service';
import * as fs from 'fs';

jest.mock('fs');

describe('SchemaRunnerService', () => {
  let service: SchemaRunnerService;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchemaRunnerService,
        {
          provide: DatabaseService,
          useValue: {
            checkConnection: jest.fn(),
            query: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SchemaRunnerService>(SchemaRunnerService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should wait for connection and run schema on successful connection', async () => {
    (databaseService.checkConnection as jest.Mock).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('CREATE TABLE test;');
    (databaseService.query as jest.Mock).mockResolvedValueOnce([]);

    // Using any to bypass private method if needed, but onModuleInit is public
    await service.onModuleInit();

    expect(databaseService.checkConnection).toHaveBeenCalledTimes(2);
    expect(databaseService.query).toHaveBeenCalledWith('CREATE TABLE test;');
  });
});
