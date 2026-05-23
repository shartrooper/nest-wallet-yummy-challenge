import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SchemaRunnerService implements OnModuleInit {
  private readonly logger = new Logger(SchemaRunnerService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    try {
      await this.waitForConnection();
      await this.runSchema();
    } catch (error) {
      this.logger.error(`Failed to initialize database: ${error.message}`);
      // In a real production app, we might want to exit the process here
      // process.exit(1);
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
      
      // Split by ; but handle potential ones inside triggers/functions
      // For simplicity in this technical test, we can try executing the whole block
      // PostgreSQL handles multiple statements in one query call.
      await this.databaseService.query(schema);
      
      this.logger.log('Database schema applied successfully.');
    } catch (error) {
      this.logger.error('Error applying database schema:', error);
      // We might want to throw here to prevent the app from starting with an invalid DB state
      // throw error;
    }
  }
}
