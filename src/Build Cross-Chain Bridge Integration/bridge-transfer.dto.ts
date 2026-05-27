import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEthereumAddress,
  Matches,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SupportedChain {
  STELLAR = 'stellar',
  ETHEREUM = 'ethereum',
  BSC = 'bsc',
  POLYGON = 'polygon',
  AVALANCHE = 'avalanche',
  SOLANA = 'solana',
  ARBITRUM = 'arbitrum',
  OPTIMISM = 'optimism',
}

export class BridgeTransferDto {
  @ApiProperty({ description: 'Source blockchain', enum: SupportedChain })
  @IsEnum(SupportedChain)
  sourceChain: SupportedChain;

  @ApiProperty({ description: 'Destination blockchain', enum: SupportedChain })
  @IsEnum(SupportedChain)
  destinationChain: SupportedChain;

  @ApiProperty({ description: 'Source asset identifier (contract address or symbol)' })
  @IsString()
  @IsNotEmpty()
  sourceAsset: string;

  @ApiProperty({ description: 'Destination asset identifier' })
  @IsString()
  @IsNotEmpty()
  destinationAsset: string;

  @ApiProperty({ description: 'Amount to transfer in base units' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, { message: 'Amount must be a valid positive number' })
  amount: string;

  @ApiProperty({ description: 'Recipient wallet address on destination chain' })
  @IsString()
  @IsNotEmpty()
  recipientAddress: string;

  @ApiProperty({ description: 'Sender wallet address on source chain' })
  @IsString()
  @IsNotEmpty()
  senderAddress: string;

  @ApiPropertyOptional({ description: 'Slippage tolerance in percentage (default: 0.5)' })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(5)
  slippageTolerance?: number;

  @ApiPropertyOptional({ description: 'Preferred bridge provider (wormhole | allbridge)' })
  @IsOptional()
  @IsString()
  preferredProvider?: string;

  @ApiPropertyOptional({ description: 'Optional memo or reference' })
  @IsOptional()
  @IsString()
  memo?: string;
}
