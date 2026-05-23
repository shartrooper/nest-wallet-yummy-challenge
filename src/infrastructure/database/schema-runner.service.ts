import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SchemaRunnerService implements OnModuleInit {
  private readonly logger = new Logger(SchemaRunnerService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      await this.bootstrapDatabase();
      await this.waitForConnection();
      await this.runSchema();
    } catch (error) {
      this.logger.error(`Failed to initialize database: ${error.message}`);
    }
  }

  private async bootstrapDatabase() {
    const dbName = this.configService.get<string>('DB_NAME');
    const user = this.configService.get<string>('DB_USER');
    const password = this.configService.get<string>('DB_PASSWORD');
    const host = this.configService.get<string>('DB_HOST');
    const port = this.configService.get<number>('DB_PORT');

    // Connect to the default 'postgres' database to check/create the target database
    const bootstrapPool = new Pool({
      host,
      port,
      user,
      password,
      database: 'postgres',
    });

    try {
      this.logger.log(`Checking if database "${dbName}" exists...`);
      const result = await bootstrapPool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName],
      );

      if (result.rowCount === 0) {
        this.logger.log(`Database "${dbName}" does not exist. Creating...`);
        // Note: CREATE DATABASE cannot be executed in a transaction block
        await bootstrapPool.query(`CREATE DATABASE ${dbName}`);
        this.logger.log(`Database "${dbName}" created successfully.`);
      } else {
        this.logger.log(`Database "${dbName}" already exists.`);
      }
    } catch (error) {
      this.logger.warn(`Could not bootstrap database: ${error.message}`);
      // We don't throw here because the DB might already exist but the user 
      // doesn't have permission to list pg_database (common in some managed DBs).
      // We let waitForConnection handle the final verdict.
    } finally {
      await bootstrapPool.end();
    }
  }

  private async waitForConnection() {
    const maxRetries = 5;
    const retryDelayMs = 2000;

    for (let i = 1; i <= maxRetries; i++) {
      this.logger.log(`Checking database connection... (Attempt ${i}/${maxRetries})`);
      if (await this.databaseService.checkConnection()) {
        this.logger.log('Database connection established.');
        return;
      }
      
      if (i < maxRetries) {
        this.logger.warn(`Database not ready, retrying in ${retryDelayMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
    throw new Error(`Could not connect to the database after ${maxRetries} attempts.`);
  }

  private async runSchema() {
    try {
      this.logger.log('Running database schema...');
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      await this.databaseService.transaction(async (client) => {
        // Acquire a transactional advisory lock to prevent concurrent schema updates
        // 123456789 is a chosen constant ID for this purpose
        await client.query('SELECT pg_advisory_xact_lock(123456789)');
        await client.query(schema);
      });
      
      this.logger.log('Database schema applied successfully.');
    } catch (error) {
      this.logger.error('Error applying database schema:', error);
    }
  }
}
