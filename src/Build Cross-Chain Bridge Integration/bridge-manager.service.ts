import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IBridgeProvider, BridgeQuote, TransferStatus } from './interfaces/bridge-provider.interface';
import { TransferConfig } from './interfaces/transfer-config.interface';
import { BridgeTransaction } from './entities/bridge-transaction.entity';
import { WrappedAsset } from './entities/wrapped-asset.entity';
import { BridgeRoute } from './entities/bridge-route.entity';
import { TransferTracker } from './utils/transfer-tracker';
import { WormholeProvider } from './providers/wormhole.provider';
import { AllbridgeProvider } from './providers/allbridge.provider';
import { TransferStatusResponseDto } from './dto/transfer-status.dto';
import { BridgeQuoteResponseDto } from './dto/bridge-quote.dto';

@Injectable()
export class BridgeManagerService {
  private readonly logger = new Logger(BridgeManagerService.name);
  private readonly providers: Map<string, IBridgeProvider>;

  constructor(
    private readonly wormholeProvider: WormholeProvider,
    private readonly allbridgeProvider: AllbridgeProvider,
    private readonly transferTracker: TransferTracker,
    @InjectRepository(BridgeTransaction)
    private readonly txRepository: Repository<BridgeTransaction>,
    @InjectRepository(WrappedAsset)
    private readonly wrappedAssetRepository: Repository<WrappedAsset>,
    @InjectRepository(BridgeRoute)
    private readonly bridgeRouteRepository: Repository<BridgeRoute>,
  ) {
    this.providers = new Map([
      ['wormhole', this.wormholeProvider],
      ['allbridge', this.allbridgeProvider],
    ]);
  }

  async getBestQuote(
    sourceChain: string,
    destinationChain: string,
    sourceAsset: string,
    destinationAsset: string,
    amount: string,
    preferredProvider?: string,
  ): Promise<BridgeQuoteResponseDto> {
    this.logger.log(
      `Fetching best quote: ${amount} ${sourceAsset} (${sourceChain}) → ${destinationAsset} (${destinationChain})`,
    );

    if (preferredProvider) {
      const provider = this.getProvider(preferredProvider);
      const quote = await provider.getQuote(
        sourceChain, destinationChain, sourceAsset, destinationAsset, amount,
      );
      return this.mapQuoteToDto(quote);
    }

    const quotes = await this.getAllQuotes(
      sourceChain, destinationChain, sourceAsset, destinationAsset, amount,
    );

    if (quotes.length === 0) {
      throw new BadRequestException(
        `No bridge route available from ${sourceChain} to ${destinationChain}`,
      );
    }

    // Pick best quote by highest output amount
    const best = quotes.reduce((a, b) =>
      parseFloat(a.outputAmount) >= parseFloat(b.outputAmount) ? a : b,
    );

    const alternatives = quotes.filter((q) => q !== best);
    return {
      ...this.mapQuoteToDto(best),
      alternativeQuotes: alternatives.map(this.mapQuoteToDto.bind(this)),
    };
  }

  async getAllQuotes(
    sourceChain: string,
    destinationChain: string,
    sourceAsset: string,
    destinationAsset: string,
    amount: string,
  ): Promise<BridgeQuote[]> {
    const eligibleProviders = Array.from(this.providers.values()).filter((p) =>
      p.supportsRoute(sourceChain, destinationChain),
    );

    const results = await Promise.allSettled(
      eligibleProviders.map((p) =>
        p.getQuote(sourceChain, destinationChain, sourceAsset, destinationAsset, amount),
      ),
    );

    return results
      .filter((r): r is PromiseFulfilledResult<BridgeQuote> => r.status === 'fulfilled')
      .map((r) => r.value);
  }

  async initiateTransfer(config: TransferConfig): Promise<TransferStatusResponseDto> {
    this.logger.log(
      `Initiating transfer: ${config.amount} ${config.sourceAsset} from ${config.sourceChain} to ${config.destinationChain}`,
    );

    const provider = await this.selectBestProvider(
      config.sourceChain,
      config.destinationChain,
      config.sourceAsset,
      config.destinationAsset,
      config.amount,
    );

    const result = await provider.initiateTransfer(
      config.sourceChain,
      config.destinationChain,
      config.sourceAsset,
      config.destinationAsset,
      config.amount,
      config.recipientAddress,
      config.senderAddress,
    );

    // Persist the transaction
    const transaction = await this.transferTracker.trackTransfer(result.transferId, {
      bridgeProvider: provider.providerName,
      sourceChain: result.sourceChain,
      destinationChain: result.destinationChain,
      sourceAsset: result.sourceAsset,
      destinationAsset: result.destinationAsset,
      amount: result.amount,
      senderAddress: config.senderAddress,
      recipientAddress: result.recipientAddress,
      userAddress: config.senderAddress,
      sourceTxHash: result.txHash,
      status: result.status,
      estimatedCompletionTime: result.estimatedCompletionTime,
      metadata: { slippageTolerance: config.slippageTolerance, memo: config.memo },
    });

    // Update route stats
    await this.updateRouteStats(
      config.sourceChain,
      config.destinationChain,
      config.sourceAsset,
      config.destinationAsset,
      provider.providerName,
      config.amount,
    );

    return this.mapTransactionToStatusDto(transaction);
  }

  async getTransferStatus(transferId: string): Promise<TransferStatusResponseDto> {
    const transaction = await this.transferTracker.getTransferById(transferId);

    if (!transaction) {
      throw new NotFoundException(`Transfer not found: ${transferId}`);
    }

    // Refresh status from provider if not terminal
    if (!this.isTerminalStatus(transaction.status)) {
      try {
        const provider = this.getProvider(transaction.bridgeProvider);
        const freshStatus = await provider.getTransferStatus(transferId);

        if (freshStatus.status !== transaction.status) {
          await this.transferTracker.updateStatus(transferId, freshStatus.status, {
            destinationTxHash: freshStatus.destinationTxHash,
            lastCheckedAt: new Date(),
          });
          transaction.status = freshStatus.status;
          transaction.destinationTxHash = freshStatus.destinationTxHash;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to refresh status for ${transferId}: ${error.message}`,
        );
      }
    }

    return this.mapTransactionToStatusDto(transaction);
  }

  async getTransfersByUser(
    userAddress: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ transfers: TransferStatusResponseDto[]; total: number }> {
    const { transfers, total } = await this.transferTracker.getTransfersByUser(
      userAddress, limit, offset,
    );
    return {
      transfers: transfers.map(this.mapTransactionToStatusDto.bind(this)),
      total,
    };
  }

  async getSupportedRoutes(): Promise<BridgeRoute[]> {
    return this.bridgeRouteRepository.find({ where: { isActive: true } });
  }

  async getSupportedAssets(chain: string): Promise<WrappedAsset[]> {
    return this.wrappedAssetRepository.find({
      where: { wrappedChain: chain, isActive: true },
    });
  }

  async getProviderHealth(): Promise<Record<string, boolean>> {
    const healthChecks = await Promise.allSettled(
      Array.from(this.providers.entries()).map(async ([name, provider]) => ({
        name,
        healthy: await provider.isHealthy(),
      })),
    );

    return Object.fromEntries(
      healthChecks
        .filter((r): r is PromiseFulfilledResult<{ name: string; healthy: boolean }> =>
          r.status === 'fulfilled',
        )
        .map((r) => [r.value.name, r.value.healthy]),
    );
  }

  private getProvider(providerName: string): IBridgeProvider {
    const provider = this.providers.get(providerName.toLowerCase());
    if (!provider) {
      throw new BadRequestException(
        `Unknown bridge provider: ${providerName}. Available: ${Array.from(this.providers.keys()).join(', ')}`,
      );
    }
    return provider;
  }

  private async selectBestProvider(
    sourceChain: string,
    destinationChain: string,
    sourceAsset: string,
    destinationAsset: string,
    amount: string,
  ): Promise<IBridgeProvider> {
    const quotes = await this.getAllQuotes(
      sourceChain, destinationChain, sourceAsset, destinationAsset, amount,
    );

    if (quotes.length === 0) {
      throw new BadRequestException(
        `No bridge provider supports route ${sourceChain} → ${destinationChain}`,
      );
    }

    const best = quotes.reduce((a, b) =>
      parseFloat(a.outputAmount) >= parseFloat(b.outputAmount) ? a : b,
    );

    return this.getProvider(best.bridgeProvider);
  }

  private async updateRouteStats(
    sourceChain: string,
    destinationChain: string,
    sourceAsset: string,
    destinationAsset: string,
    provider: string,
    amount: string,
  ): Promise<void> {
    try {
      const route = await this.bridgeRouteRepository.findOne({
        where: { sourceChain, destinationChain, sourceAsset, destinationAsset, bridgeProvider: provider },
      });

      if (route) {
        route.totalTransfers += 1;
        route.totalVolume = (parseFloat(route.totalVolume) + parseFloat(amount)).toFixed(18);
        route.lastUsedAt = new Date();
        await this.bridgeRouteRepository.save(route);
      }
    } catch (error) {
      this.logger.warn(`Failed to update route stats: ${error.message}`);
    }
  }

  private isTerminalStatus(status: TransferStatus): boolean {
    return [TransferStatus.COMPLETED, TransferStatus.FAILED, TransferStatus.REFUNDED].includes(
      status,
    );
  }

  private mapQuoteToDto(quote: BridgeQuote): BridgeQuoteResponseDto {
    return {
      sourceChain: quote.sourceChain,
      destinationChain: quote.destinationChain,
      sourceAsset: quote.sourceAsset,
      destinationAsset: quote.destinationAsset,
      inputAmount: quote.inputAmount,
      outputAmount: quote.outputAmount,
      fee: quote.fee,
      estimatedTimeSeconds: quote.estimatedTime,
      bridgeProvider: quote.bridgeProvider,
      route: quote.route,
      expiresAt: quote.expiresAt,
    };
  }

  private mapTransactionToStatusDto(tx: BridgeTransaction): TransferStatusResponseDto {
    return {
      transferId: tx.transferId,
      status: tx.status,
      sourceChain: tx.sourceChain,
      destinationChain: tx.destinationChain,
      sourceAsset: tx.sourceAsset,
      destinationAsset: tx.destinationAsset,
      amount: tx.amount,
      receivedAmount: tx.receivedAmount,
      senderAddress: tx.senderAddress,
      recipientAddress: tx.recipientAddress,
      sourceTxHash: tx.sourceTxHash,
      destinationTxHash: tx.destinationTxHash,
      bridgeProvider: tx.bridgeProvider,
      estimatedCompletionTime: tx.estimatedCompletionTime,
      completedAt: tx.completedAt,
      errorMessage: tx.errorMessage,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    };
  }
}
