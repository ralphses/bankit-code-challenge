import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({ example: '4460e9d1-c459-4752-9cc4-cf6a6ecb9cab' })
  @IsString()
  @IsNotEmpty()
  senderAccountId!: string;

  @ApiProperty({ example: '4d86d928-f3b7-4544-a96d-a14cd4c4d602' })
  @IsString()
  @IsNotEmpty()
  recipientAccountId!: string;

  @ApiProperty({ example: 20000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;
}

export type TransferCreatedResponse = { success: true; reference: string; status: string };
export type TransferLookupResponse = {
  reference: string;
  senderAccountId: string;
  recipientAccountId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
};
