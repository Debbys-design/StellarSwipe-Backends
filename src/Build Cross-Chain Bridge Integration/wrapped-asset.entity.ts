import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('wrapped_assets')
@Unique(['originalChain', 'originalAsset', 'bridgeProvider'])
export class WrappedAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  bridgeProvider: string;

  @Column()
  originalChain: string;

  @Column()
  @Index()
  originalAsset: string;

  @Column()
  originalSymbol: string;

  @Column()
  originalName: string;

  @Column({ default: 18 })
  originalDecimals: number;

  @Column({ default: 'stellar' })
  wrappedChain: string;

  @Column()
  @Index()
  wrappedAssetCode: string;

  @Column({ nullable: true })
  wrappedIssuer: string;

  @Column({ default: 7 })
  wrappedDecimals: number;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  coingeckoId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  contractAddress: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  lastSyncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
