import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupportedChain } from './bridge-transfer.dto';

export class BridgeQuoteDto {
  @ApiProperty({ description: 'Source blockchain', enum: SupportedChain })
  @IsEnum(SupportedChain)
  sourceChain: SupportedChain;

  @ApiProperty({ description: 'Destination blockchain', enum: SupportedChain })
  @IsEnum(SupportedChain)
  destinationChain: SupportedChain;

  @ApiProperty({ description: 'Source asset identifier' })
  @IsString()
  @IsNotEmpty()
  sourceAsset: string;

  @ApiProperty({ description: 'Destination asset identifier' })
  @IsString()
  @IsNotEmpty()
  destinationAsset: string;

  @ApiProperty({ description: 'Amount to transfer' })
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiPropertyOptional({ description: 'Specific bridge provider to query' })
  @IsOptional()
  @IsString()
  provider?: string;
}

export class BridgeQuoteResponseDto {
  @ApiProperty()
  sourceChain: string;

  @ApiProperty()
  destinationChain: string;

  @ApiProperty()
  sourceAsset: string;

  @ApiProperty()
  destinationAsset: string;

  @ApiProperty()
  inputAmount: string;

  @ApiProperty()
  outputAmount: string;

  @ApiProperty()
  fee: string;

  @ApiProperty()
  estimatedTimeSeconds: number;

  @ApiProperty()
  bridgeProvider: string;

  @ApiProperty()
  route: string[];

  @ApiProperty()
  expiresAt: Date;

  @ApiPropertyOptional()
  alternativeQuotes?: BridgeQuoteResponseDto[];
}
