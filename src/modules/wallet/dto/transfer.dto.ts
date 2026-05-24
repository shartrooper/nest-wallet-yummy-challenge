import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class TransferDto {
  @ApiProperty({ description: 'The UUID of the account to transfer from', example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID()
  @IsNotEmpty()
  from_account_id: string;

  @ApiProperty({ description: 'The UUID of the account to transfer to', example: '22222222-2222-4222-8222-222222222222' })
  @IsUUID()
  @IsNotEmpty()
  to_account_id: string;

  @ApiProperty({ description: 'The amount to transfer', example: 50 })
  @IsNumber()
  @IsPositive()
  amount: number;
}
