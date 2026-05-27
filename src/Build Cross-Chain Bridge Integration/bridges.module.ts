import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { BridgeManagerService } from './bridge-manager.service';
import { BridgeController } from './bridge.controller';

import { WormholeProvider } from './providers/wormhole.provider';
import { AllbridgeProvider } from './providers/allbridge.provider';

import { BridgeTransaction } from './entities/bridge-transaction.entity';
import { WrappedAsset } from './entities/wrapped-asset.entity';
import { BridgeRoute } from './entities/bridge-route.entity';

import { MonitorTransfersJob } from './jobs/monitor-transfers.job';
import { SyncWrappedAssetsJob } from './jobs/sync-wrapped-assets.job';

import { AttestationVerifier } from './utils/attestation-verifier';
import { TransferTracker } from './utils/transfer-tracker';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([BridgeTransaction, WrappedAsset, BridgeRoute]),
  ],
  controllers: [BridgeController],
  providers: [
    // Core service
    BridgeManagerService,

    // Bridge providers
    WormholeProvider,
    AllbridgeProvider,

    // Background jobs
    MonitorTransfersJob,
    SyncWrappedAssetsJob,

    // Utilities
    AttestationVerifier,
    TransferTracker,
  ],
  exports: [BridgeManagerService, TransferTracker, WormholeProvider, AllbridgeProvider],
})
export class BridgesModule {}
