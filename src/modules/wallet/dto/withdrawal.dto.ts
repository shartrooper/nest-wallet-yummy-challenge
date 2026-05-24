import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class WithdrawalDto {
  @ApiProperty({ description: 'The UUID of the account to withdraw from', example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID()
  @IsNotEmpty()
  account_id: string;

  @ApiProperty({ description: 'The amount to withdraw', example: 50 })
  @IsNumber()
  @IsPositive()
  amount: number;
}
