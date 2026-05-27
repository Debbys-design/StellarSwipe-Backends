import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransferStatus } from '../interfaces/bridge-provider.interface';

export class TransferStatusDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  transferId: string;
}

export class TransferStatusResponseDto {
  @ApiProperty()
  transferId: string;

  @ApiProperty({ enum: TransferStatus })
  status: TransferStatus;

  @ApiProperty()
  sourceChain: string;

  @ApiProperty()
  destinationChain: string;

  @ApiProperty()
  sourceAsset: string;

  @ApiProperty()
  destinationAsset: string;

  @ApiProperty()
  amount: string;

  @ApiPropertyOptional()
  receivedAmount?: string;

  @ApiProperty()
  senderAddress: string;

  @ApiProperty()
  recipientAddress: string;

  @ApiPropertyOptional()
  sourceTxHash?: string;

  @ApiPropertyOptional()
  destinationTxHash?: string;

  @ApiProperty()
  bridgeProvider: string;

  @ApiPropertyOptional()
  estimatedCompletionTime?: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
