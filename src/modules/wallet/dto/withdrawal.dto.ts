import { IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class WithdrawalDto {
  @IsUUID()
  @IsNotEmpty()
  account_id: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}
