import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { TransferStatus } from '../interfaces/bridge-provider.interface';

@Entity('bridge_transactions')
@Index(['transferId'])
@Index(['userAddress'])
@Index(['status'])
@Index(['sourceChain', 'destinationChain'])
export class BridgeTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  transferId: string;

  @Column()
  bridgeProvider: string;

  @Column()
  sourceChain: string;

  @Column()
  destinationChain: string;

  @Column()
  sourceAsset: string;

  @Column()
  destinationAsset: string;

  @Column('decimal', { precision: 36, scale: 18 })
  amount: string;

  @Column('decimal', { precision: 36, scale: 18, nullable: true })
  receivedAmount: string;

  @Column()
  senderAddress: string;

  @Column()
  recipientAddress: string;

  @Column({ nullable: true })
  userAddress: string;

  @Column({ nullable: true })
  sourceTxHash: string;

  @Column({ nullable: true })
  destinationTxHash: string;

  @Column({
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.PENDING,
  })
  status: TransferStatus;

  @Column('decimal', { precision: 36, scale: 18, nullable: true })
  fee: string;

  @Column({ nullable: true })
  attestationVaa: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  estimatedCompletionTime: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  lastCheckedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
