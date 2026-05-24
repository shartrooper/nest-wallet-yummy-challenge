import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { DatabaseModule } from '../../infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SystemController],
})
export class SystemModule {}
