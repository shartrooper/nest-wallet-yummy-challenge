import { IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class DepositDto {
  @IsUUID()
  @IsNotEmpty()
  account_id: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}
