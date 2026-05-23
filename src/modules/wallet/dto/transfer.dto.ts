import { IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class TransferDto {
  @IsUUID()
  @IsNotEmpty()
  from_account_id: string;

  @IsUUID()
  @IsNotEmpty()
  to_account_id: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}
