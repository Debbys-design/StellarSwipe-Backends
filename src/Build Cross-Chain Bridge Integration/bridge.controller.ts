import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BridgeManagerService } from './bridge-manager.service';
import { BridgeTransferDto } from './dto/bridge-transfer.dto';
import { BridgeQuoteDto, BridgeQuoteResponseDto } from './dto/bridge-quote.dto';
import { TransferStatusResponseDto } from './dto/transfer-status.dto';

@ApiTags('bridges')
@Controller('bridges')
export class BridgeController {
  constructor(private readonly bridgeManagerService: BridgeManagerService) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get best bridge quote for a cross-chain transfer' })
  @ApiResponse({ status: 200, description: 'Quote retrieved', type: BridgeQuoteResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid parameters or no route available' })
  async getQuote(
    @Body(ValidationPipe) dto: BridgeQuoteDto,
  ): Promise<BridgeQuoteResponseDto> {
    return this.bridgeManagerService.getBestQuote(
      dto.sourceChain,
      dto.destinationChain,
      dto.sourceAsset,
      dto.destinationAsset,
      dto.amount,
      dto.provider,
    );
  }

  @Post('transfer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate a cross-chain bridge transfer' })
  @ApiResponse({ status: 201, description: 'Transfer initiated', type: TransferStatusResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  async initiateTransfer(
    @Body(ValidationPipe) dto: BridgeTransferDto,
  ): Promise<TransferStatusResponseDto> {
    return this.bridgeManagerService.initiateTransfer({
      sourceChain: dto.sourceChain,
      destinationChain: dto.destinationChain,
      sourceAsset: dto.sourceAsset,
      destinationAsset: dto.destinationAsset,
      amount: dto.amount,
      recipientAddress: dto.recipientAddress,
      senderAddress: dto.senderAddress,
      slippageTolerance: dto.slippageTolerance,
      memo: dto.memo,
    });
  }

  @Get('transfer/:transferId/status')
  @ApiOperation({ summary: 'Get the current status of a bridge transfer' })
  @ApiParam({ name: 'transferId', description: 'Bridge transfer ID' })
  @ApiResponse({ status: 200, description: 'Transfer status', type: TransferStatusResponseDto })
  @ApiResponse({ status: 404, description: 'Transfer not found' })
  async getTransferStatus(
    @Param('transferId') transferId: string,
  ): Promise<TransferStatusResponseDto> {
    return this.bridgeManagerService.getTransferStatus(transferId);
  }

  @Get('transfers')
  @ApiOperation({ summary: 'Get all transfers for a user address' })
  @ApiQuery({ name: 'userAddress', required: true, description: 'User wallet address' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results', example: 20 })
  @ApiQuery({ name: 'offset', required: false, description: 'Pagination offset', example: 0 })
  @ApiResponse({ status: 200, description: 'User transfer history' })
  async getUserTransfers(
    @Query('userAddress') userAddress: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<{ transfers: TransferStatusResponseDto[]; total: number }> {
    return this.bridgeManagerService.getTransfersByUser(userAddress, limit, offset);
  }

  @Get('routes')
  @ApiOperation({ summary: 'Get all supported bridge routes' })
  @ApiResponse({ status: 200, description: 'Supported routes list' })
  async getSupportedRoutes() {
    return this.bridgeManagerService.getSupportedRoutes();
  }

  @Get('assets/:chain')
  @ApiOperation({ summary: 'Get supported wrapped assets for a chain' })
  @ApiParam({ name: 'chain', description: 'Chain name (e.g. stellar, ethereum)' })
  @ApiResponse({ status: 200, description: 'Supported assets' })
  async getSupportedAssets(@Param('chain') chain: string) {
    return this.bridgeManagerService.getSupportedAssets(chain);
  }

  @Get('health')
  @ApiOperation({ summary: 'Get health status of all bridge providers' })
  @ApiResponse({ status: 200, description: 'Provider health status' })
  async getProviderHealth(): Promise<Record<string, boolean>> {
    return this.bridgeManagerService.getProviderHealth();
  }
}
