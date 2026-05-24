import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class DepositDto {
  @ApiProperty({ description: 'The UUID of the account to deposit into', example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID()
  @IsNotEmpty()
  account_id: string;

  @ApiProperty({ description: 'The amount to deposit', example: 100 })
  @IsNumber()
  @IsPositive()
  amount: number;
}
