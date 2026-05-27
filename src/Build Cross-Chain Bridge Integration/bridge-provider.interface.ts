export interface BridgeQuote {
  sourceChain: string;
  destinationChain: string;
  sourceAsset: string;
  destinationAsset: string;
  inputAmount: string;
  outputAmount: string;
  fee: string;
  estimatedTime: number; // in seconds
  bridgeProvider: string;
  route: string[];
  expiresAt: Date;
}

export interface BridgeTransferResult {
  transferId: string;
  sourceChain: string;
  destinationChain: string;
  sourceAsset: string;
  destinationAsset: string;
  amount: string;
  recipientAddress: string;
  txHash: string;
  status: TransferStatus;
  estimatedCompletionTime: Date;
  bridgeProvider: string;
}

export interface TransferStatusResult {
  transferId: string;
  status: TransferStatus;
  sourceChain: string;
  destinationChain: string;
  txHash: string;
  destinationTxHash?: string;
  completedAt?: Date;
  error?: string;
}

export interface WrappedAssetInfo {
  originalAsset: string;
  originalChain: string;
  wrappedAsset: string;
  wrappedChain: string;
  decimals: number;
  name: string;
  symbol: string;
  bridgeProvider: string;
}

export enum TransferStatus {
  PENDING = 'PENDING',
  INITIATED = 'INITIATED',
  ATTESTED = 'ATTESTED',
  REDEEMED = 'REDEEMED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface IBridgeProvider {
  readonly providerName: string;
  readonly supportedChains: string[];

  getQuote(
    sourceChain: string,
    destinationChain: string,
    sourceAsset: string,
    destinationAsset: string,
    amount: string,
  ): Promise<BridgeQuote>;

  initiateTransfer(
    sourceChain: string,
    destinationChain: string,
    sourceAsset: string,
    destinationAsset: string,
    amount: string,
    recipientAddress: string,
    senderAddress: string,
  ): Promise<BridgeTransferResult>;

  getTransferStatus(transferId: string): Promise<TransferStatusResult>;

  getSupportedAssets(chain: string): Promise<WrappedAssetInfo[]>;

  isHealthy(): Promise<boolean>;
}
