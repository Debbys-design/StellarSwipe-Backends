import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BridgeManagerService } from '../bridge-manager.service';
import { TransferTracker } from '../utils/transfer-tracker';
import { TransferStatus } from '../interfaces/bridge-provider.interface';
import { WormholeProvider } from '../providers/wormhole.provider';
import { AttestationVerifier } from '../utils/attestation-verifier';

@Injectable()
export class MonitorTransfersJob {
  private readonly logger = new Logger(MonitorTransfersJob.name);
  private isRunning = false;

  constructor(
    private readonly bridgeManagerService: BridgeManagerService,
    private readonly transferTracker: TransferTracker,
    private readonly wormholeProvider: WormholeProvider,
    private readonly attestationVerifier: AttestationVerifier,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async monitorActiveTransfers(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Monitor job already running, skipping');
      return;
    }

    this.isRunning = true;

    try {
      const activeTransfers = await this.transferTracker.getActiveTransfers();

      if (activeTransfers.length === 0) {
        return;
      }

      this.logger.log(`Monitoring ${activeTransfers.length} active bridge transfers`);

      await Promise.allSettled(
        activeTransfers.map((tx) => this.checkAndUpdateTransfer(tx.transferId, tx.bridgeProvider)),
      );
    } catch (error) {
      this.logger.error(`Monitor job error: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleStaleTransfers(): Promise<void> {
    this.logger.log('Checking for stale transfers...');

    try {
      const staleTransfers = await this.transferTracker.getStaleTransfers(4); // > 4 hours old

      for (const tx of staleTransfers) {
        this.logger.warn(
          `Stale transfer detected: ${tx.transferId} (${tx.bridgeProvider}) - ${tx.status}`,
        );

        await this.transferTracker.incrementRetryCount(tx.transferId);

        // Mark as failed if retried too many times
        if (tx.retryCount >= 10) {
          await this.transferTracker.updateStatus(tx.transferId, TransferStatus.FAILED, {
            errorMessage: 'Transfer timed out after maximum retries',
          });
          this.logger.error(`Transfer ${tx.transferId} marked as FAILED after max retries`);
        }
      }
    } catch (error) {
      this.logger.error(`Stale transfer handler error: ${error.message}`);
    }
  }

  @Cron('*/5 * * * *') // Every 5 minutes
  async processWormholeAttestations(): Promise<void> {
    try {
      const initiatedTransfers = await this.transferTracker.getActiveTransfers();
      const wormholeTransfers = initiatedTransfers.filter(
        (tx) =>
          tx.bridgeProvider === 'wormhole' &&
          tx.status === TransferStatus.INITIATED,
      );

      if (wormholeTransfers.length === 0) return;

      this.logger.log(`Processing ${wormholeTransfers.length} Wormhole attestations`);

      for (const tx of wormholeTransfers) {
        try {
          // In production: extract emitter chain + sequence from stored metadata
          // and call attestationVerifier.fetchSignedVAA()
          // If VAA found → update status to ATTESTED and trigger redemption

          this.logger.debug(`Checking attestation for Wormhole transfer: ${tx.transferId}`);

          // Simulate attestation check
          const isAttested = Math.random() > 0.5; // mock
          if (isAttested) {
            await this.transferTracker.updateStatus(
              tx.transferId,
              TransferStatus.ATTESTED,
            );
            this.logger.log(`Wormhole transfer attested: ${tx.transferId}`);
          }
        } catch (error) {
          this.logger.warn(
            `Attestation check failed for ${tx.transferId}: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Wormhole attestation processor error: ${error.message}`);
    }
  }

  private async checkAndUpdateTransfer(
    transferId: string,
    providerName: string,
  ): Promise<void> {
    try {
      await this.bridgeManagerService.getTransferStatus(transferId);
      await this.transferTracker.updateStatus(transferId, undefined, {
        lastCheckedAt: new Date(),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to check transfer ${transferId} (${providerName}): ${error.message}`,
      );
    }
  }
}
