import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { BridgeTransaction } from '../entities/bridge-transaction.entity';
import { TransferStatus } from '../interfaces/bridge-provider.interface';

export interface TransferSummary {
  totalTransfers: number;
  pendingTransfers: number;
  completedTransfers: number;
  failedTransfers: number;
  totalVolume: Record<string, string>;
  averageCompletionTimeSeconds: number;
}

@Injectable()
export class TransferTracker {
  private readonly logger = new Logger(TransferTracker.name);

  constructor(
    @InjectRepository(BridgeTransaction)
    private readonly txRepository: Repository<BridgeTransaction>,
  ) {}

  async trackTransfer(
    transferId: string,
    data: Partial<BridgeTransaction>,
  ): Promise<BridgeTransaction> {
    const existing = await this.txRepository.findOne({ where: { transferId } });

    if (existing) {
      Object.assign(existing, data, { updatedAt: new Date() });
      return this.txRepository.save(existing);
    }

    const transaction = this.txRepository.create({ transferId, ...data });
    return this.txRepository.save(transaction);
  }

  async updateStatus(
    transferId: string,
    status: TransferStatus,
    additionalData?: Partial<BridgeTransaction>,
  ): Promise<BridgeTransaction | null> {
    const transaction = await this.txRepository.findOne({ where: { transferId } });

    if (!transaction) {
      this.logger.warn(`Transfer not found for status update: ${transferId}`);
      return null;
    }

    transaction.status = status;
    transaction.lastCheckedAt = new Date();

    if (status === TransferStatus.COMPLETED) {
      transaction.completedAt = new Date();
    }

    if (additionalData) {
      Object.assign(transaction, additionalData);
    }

    const saved = await this.txRepository.save(transaction);
    this.logger.log(`Transfer ${transferId} status updated to ${status}`);
    return saved;
  }

  async getActiveTransfers(): Promise<BridgeTransaction[]> {
    return this.txRepository.find({
      where: [
        { status: TransferStatus.PENDING },
        { status: TransferStatus.INITIATED },
        { status: TransferStatus.ATTESTED },
      ],
    });
  }

  async getStaleTransfers(olderThanHours: number = 24): Promise<BridgeTransaction[]> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    return this.txRepository.find({
      where: [
        { status: TransferStatus.PENDING, createdAt: LessThan(cutoff) },
        { status: TransferStatus.INITIATED, createdAt: LessThan(cutoff) },
      ],
    });
  }

  async getTransfersByUser(
    userAddress: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ transfers: BridgeTransaction[]; total: number }> {
    const [transfers, total] = await this.txRepository.findAndCount({
      where: { userAddress },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { transfers, total };
  }

  async getTransferById(transferId: string): Promise<BridgeTransaction | null> {
    return this.txRepository.findOne({ where: { transferId } });
  }

  async getSummary(
    fromDate?: Date,
    toDate?: Date,
  ): Promise<TransferSummary> {
    const qb = this.txRepository.createQueryBuilder('tx');

    if (fromDate) qb.andWhere('tx.createdAt >= :fromDate', { fromDate });
    if (toDate) qb.andWhere('tx.createdAt <= :toDate', { toDate });

    const allTx = await qb.getMany();

    const completedTx = allTx.filter((t) => t.status === TransferStatus.COMPLETED);
    const avgCompletion =
      completedTx.length > 0
        ? completedTx.reduce((acc, t) => {
            if (t.completedAt && t.createdAt) {
              return acc + (t.completedAt.getTime() - t.createdAt.getTime()) / 1000;
            }
            return acc;
          }, 0) / completedTx.length
        : 0;

    const volumeByAsset: Record<string, string> = {};
    for (const tx of completedTx) {
      const key = `${tx.sourceAsset}_${tx.sourceChain}`;
      volumeByAsset[key] = (
        parseFloat(volumeByAsset[key] || '0') + parseFloat(tx.amount)
      ).toFixed(18);
    }

    return {
      totalTransfers: allTx.length,
      pendingTransfers: allTx.filter((t) =>
        [TransferStatus.PENDING, TransferStatus.INITIATED, TransferStatus.ATTESTED].includes(
          t.status,
        ),
      ).length,
      completedTransfers: completedTx.length,
      failedTransfers: allTx.filter((t) =>
        [TransferStatus.FAILED, TransferStatus.REFUNDED].includes(t.status),
      ).length,
      totalVolume: volumeByAsset,
      averageCompletionTimeSeconds: Math.round(avgCompletion),
    };
  }

  async incrementRetryCount(transferId: string): Promise<void> {
    await this.txRepository.increment({ transferId }, 'retryCount', 1);
  }
}
