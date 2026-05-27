import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WormholeProvider } from '../providers/wormhole.provider';
import { AllbridgeProvider } from '../providers/allbridge.provider';
import { WrappedAsset } from '../entities/wrapped-asset.entity';
import { BridgeRoute } from '../entities/bridge-route.entity';
import { WrappedAssetInfo } from '../interfaces/bridge-provider.interface';

@Injectable()
export class SyncWrappedAssetsJob {
  private readonly logger = new Logger(SyncWrappedAssetsJob.name);

  private readonly allChains = [
    'stellar', 'ethereum', 'bsc', 'polygon', 'avalanche', 'solana', 'arbitrum', 'optimism',
  ];

  constructor(
    private readonly wormholeProvider: WormholeProvider,
    private readonly allbridgeProvider: AllbridgeProvider,
    @InjectRepository(WrappedAsset)
    private readonly wrappedAssetRepository: Repository<WrappedAsset>,
    @InjectRepository(BridgeRoute)
    private readonly bridgeRouteRepository: Repository<BridgeRoute>,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async syncWrappedAssets(): Promise<void> {
    this.logger.log('Starting wrapped assets sync...');

    await Promise.allSettled([
      this.syncProviderAssets(this.wormholeProvider),
      this.syncProviderAssets(this.allbridgeProvider),
    ]);

    this.logger.log('Wrapped assets sync complete');
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async syncBridgeRoutes(): Promise<void> {
    this.logger.log('Syncing bridge routes...');

    const providers = [this.wormholeProvider, this.allbridgeProvider];

    for (const provider of providers) {
      const supportedChains = provider.supportedChains;

      for (const sourceChain of supportedChains) {
        for (const destChain of supportedChains) {
          if (sourceChain === destChain) continue;

          try {
            await this.upsertRoute(sourceChain, destChain, provider.providerName);
          } catch (error) {
            this.logger.warn(
              `Failed to upsert route ${sourceChain}→${destChain} for ${provider.providerName}: ${error.message}`,
            );
          }
        }
      }
    }

    this.logger.log('Bridge routes sync complete');
  }

  async triggerManualSync(): Promise<{ synced: number; errors: number }> {
    this.logger.log('Manual sync triggered');
    let synced = 0;
    let errors = 0;

    for (const provider of [this.wormholeProvider, this.allbridgeProvider]) {
      for (const chain of provider.supportedChains) {
        try {
          const assets = await provider.getSupportedAssets(chain);
          for (const asset of assets) {
            await this.upsertWrappedAsset(asset);
            synced++;
          }
        } catch (error) {
          this.logger.warn(`Manual sync error for ${provider.providerName}/${chain}: ${error.message}`);
          errors++;
        }
      }
    }

    return { synced, errors };
  }

  private async syncProviderAssets(
    provider: typeof this.wormholeProvider | typeof this.allbridgeProvider,
  ): Promise<void> {
    for (const chain of provider.supportedChains) {
      try {
        const assets = await provider.getSupportedAssets(chain);
        this.logger.debug(
          `Found ${assets.length} assets for ${provider.providerName}/${chain}`,
        );

        for (const asset of assets) {
          await this.upsertWrappedAsset(asset);
        }
      } catch (error) {
        this.logger.warn(
          `Asset sync failed for ${provider.providerName}/${chain}: ${error.message}`,
        );
      }
    }
  }

  private async upsertWrappedAsset(info: WrappedAssetInfo): Promise<void> {
    const existing = await this.wrappedAssetRepository.findOne({
      where: {
        originalChain: info.originalChain,
        originalAsset: info.originalAsset,
        bridgeProvider: info.bridgeProvider,
      },
    });

    if (existing) {
      existing.originalSymbol = info.symbol;
      existing.originalName = info.name;
      existing.originalDecimals = info.decimals;
      existing.wrappedAssetCode = info.wrappedAsset;
      existing.wrappedChain = info.wrappedChain;
      existing.isActive = true;
      existing.lastSyncedAt = new Date();
      await this.wrappedAssetRepository.save(existing);
    } else {
      const asset = this.wrappedAssetRepository.create({
        bridgeProvider: info.bridgeProvider,
        originalChain: info.originalChain,
        originalAsset: info.originalAsset,
        originalSymbol: info.symbol,
        originalName: info.name,
        originalDecimals: info.decimals,
        wrappedChain: info.wrappedChain,
        wrappedAssetCode: info.wrappedAsset,
        wrappedDecimals: info.decimals > 7 ? 7 : info.decimals, // Stellar max 7 decimals
        isActive: true,
        lastSyncedAt: new Date(),
      });
      await this.wrappedAssetRepository.save(asset);
      this.logger.log(
        `New wrapped asset registered: ${info.symbol} (${info.originalChain} → ${info.wrappedChain}) via ${info.bridgeProvider}`,
      );
    }
  }

  private async upsertRoute(
    sourceChain: string,
    destinationChain: string,
    providerName: string,
  ): Promise<void> {
    const existing = await this.bridgeRouteRepository.findOne({
      where: { sourceChain, destinationChain, bridgeProvider: providerName },
    });

    if (!existing) {
      const route = this.bridgeRouteRepository.create({
        bridgeProvider: providerName,
        sourceChain,
        destinationChain,
        sourceAsset: '*',
        destinationAsset: '*',
        isActive: true,
        estimatedTimeSeconds: this.getDefaultEstimatedTime(sourceChain),
      });
      await this.bridgeRouteRepository.save(route);
    }
  }

  private getDefaultEstimatedTime(sourceChain: string): number {
    const times: Record<string, number> = {
      ethereum: 1000, bsc: 90, polygon: 150, avalanche: 120,
      solana: 60, arbitrum: 90, optimism: 90, stellar: 40,
    };
    return times[sourceChain] || 300;
  }
}
