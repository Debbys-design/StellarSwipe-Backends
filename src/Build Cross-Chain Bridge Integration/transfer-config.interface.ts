export interface TransferConfig {
  sourceChain: string;
  destinationChain: string;
  sourceAsset: string;
  destinationAsset: string;
  amount: string;
  recipientAddress: string;
  senderAddress: string;
  slippageTolerance?: number; // percentage, e.g. 0.5 for 0.5%
  deadline?: number; // unix timestamp
  referrerAddress?: string;
  memo?: string;
}

export interface BridgeConfig {
  wormhole: WormholeConfig;
  allbridge: AllbridgeConfig;
  monitoring: MonitoringConfig;
}

export interface WormholeConfig {
  rpcUrl: string;
  coreBridgeAddress: string;
  tokenBridgeAddress: string;
  guardianSetIndex: number;
  consistencyLevel: number;
  stellarCoreUrl: string;
  stellarNetwork: 'testnet' | 'mainnet';
  supportedChains: WormholeChainConfig[];
}

export interface WormholeChainConfig {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  tokenBridgeAddress: string;
  nativeCurrency: string;
}

export interface AllbridgeConfig {
  apiUrl: string;
  apiKey?: string;
  stellarPublicKey: string;
  supportedChains: string[];
  maxRetries: number;
  timeoutMs: number;
}

export interface MonitoringConfig {
  pollIntervalMs: number;
  maxTransferAgeHours: number;
  alertThresholdMinutes: number;
}

export interface ChainAssetPair {
  chain: string;
  asset: string;
  address: string;
  decimals: number;
}

export interface RouteConfig {
  sourceChain: string;
  destinationChain: string;
  preferredProvider?: string;
  maxFeePercentage?: number;
  minOutputAmount?: string;
}
