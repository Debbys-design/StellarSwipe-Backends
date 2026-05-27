import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('bridge_routes')
@Unique(['sourceChain', 'destinationChain', 'sourceAsset', 'destinationAsset', 'bridgeProvider'])
export class BridgeRoute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  bridgeProvider: string;

  @Column()
  @Index()
  sourceChain: string;

  @Column()
  @Index()
  destinationChain: string;

  @Column()
  sourceAsset: string;

  @Column()
  destinationAsset: string;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  baseFeePercentage: string;

  @Column('decimal', { precision: 36, scale: 18, nullable: true })
  minTransferAmount: string;

  @Column('decimal', { precision: 36, scale: 18, nullable: true })
  maxTransferAmount: string;

  @Column({ default: 600 })
  estimatedTimeSeconds: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  totalTransfers: number;

  @Column('decimal', { precision: 36, scale: 18, default: '0' })
  totalVolume: string;

  @Column({ nullable: true })
  lastUsedAt: Date;

  @Column('jsonb', { nullable: true })
  routeConfig: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
