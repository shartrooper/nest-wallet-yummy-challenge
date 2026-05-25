import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DB_POOL } from './database.constants';
import { DatabaseService } from './database.service';
import { SchemaRunnerService } from './schema-runner.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DB_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const pool = new Pool({
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          user: configService.get<string>('DB_USER'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_NAME'),
        });
        pool.on('error', (err) => {
          console.error('Unexpected error on idle pg client', err);
        });
        return pool;
      },
    },
    DatabaseService,
    SchemaRunnerService,
  ],
  exports: [DB_POOL, DatabaseService],
})
export class DatabaseModule {}
