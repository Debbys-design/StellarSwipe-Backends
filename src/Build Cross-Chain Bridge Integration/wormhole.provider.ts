import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseBridgeProvider } from './base-bridge.provider';
import {
  BridgeQuote,
  BridgeTransferResult,
  TransferStatusResult,
  WrappedAssetInfo,
  TransferStatus,
} from '../interfaces/bridge-provider.interface';
import { WormholeConfig } from '../interfaces/transfer-config.interface';

// Wormhole chain IDs
const WORMHOLE_CHAIN_IDS: Record<string, number> = {
  ethereum: 2,
  bsc: 4,
  polygon: 5,
  avalanche: 6,
  solana: 1,
  arbitrum: 23,
  optimism: 24,
  stellar: 26,
};

const WORMHOLE_SUPPORTED_CHAINS = Object.keys(WORMHOLE_CHAIN_IDS);

@Injectable()
export class WormholeProvider extends BaseBridgeProvider {
  readonly providerName = 'wormhole';
  readonly supportedChains = WORMHOLE_SUPPORTED_CHAINS;

  private readonly config: WormholeConfig;
  private readonly guardianRpcUrl: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.config = this.configService.get<WormholeConfig>('bridges.wormhole');
    this.guardianRpcUrl = this.config?.rpcUrl || 'https://wormhole-v2-mainnet-api.certus.one';
  }

  async getQuote(
    sourceChain: string,
    destinationChain: string,
    sourceAsset: string,
    destinationAsset: string,
    amount: string,
  ): Promise<BridgeQuote> {
    this.validateChain(sourceChain);
    this.validateChain(destinationChain);
    this.validateAmount(amount);

    return this.retryWithBackoff(async () => {
      // Wormhole fee structure: fixed relayer fee + gas
      const baseFeePercent = 0.1; // 0.1% base fee
      const relayerFee = this.calculateFeeAmount(amount, baseFeePercent);
      const outputAmount = (parseFloat(amount) - parseFloat(relayerFee)).toFixed(18);

      const quote: BridgeQuote = {
        sourceChain,
        destinationChain,
        sourceAsset,
        destinationAsset,
        inputAmount: amount,
        outputAmount,
        fee: relayerFee,
        estimatedTime: this.getEstimatedTime(sourceChain, destinationChain),
        bridgeProvider: this.providerName,
        route: [sourceChain, 'wormhole-guardians', destinationChain],
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min validity
      };

      this.logger.log(
        `Wormhole quote: ${amount} ${sourceAsset} on ${sourceChain} → ${outputAmount} ${destinationAsset} on ${destinationChain}`,
      );
      return quote;
    });
  }

  async initiateTransfer(
    sourceChain: string,
    destinationChain: string,
    sourceAsset: string,
    destinationAsset: string,
    amount: string,
    recipientAddress: string,
    senderAddress: string,
  ): Promise<BridgeTransferResult> {
    this.validateChain(sourceChain);
    this.validateChain(destinationChain);
    this.validateAmount(amount);

    return this.retryWithBackoff(async () => {
      const transferId = this.generateTransferId(
        sourceChain,
        destinationChain,
        senderAddress,
        amount,
      );

      this.logger.log(
        `Initiating Wormhole transfer: ${transferId} — ${amount} ${sourceAsset} from ${sourceChain} to ${destinationChain}`,
      );

      // In production: interact with Wormhole SDK / token bridge contracts
      // const wh = await wormhole(this.config.stellarNetwork, [evm, solana, stellar]);
      // const transfer = wh.tokenTransfer(token, amount, sender, receiver, automatic, payload);
      // const txIds = await transfer.initiateTransfer(signer);

      const mockTxHash = `0x${Buffer.from(transferId).toString('hex').slice(0, 64)}`;
      const estimatedCompletion = new Date(
        Date.now() + this.getEstimatedTime(sourceChain, destinationChain) * 1000,
      );

      return {
        transferId,
        sourceChain,
        destinationChain,
        sourceAsset,
        destinationAsset,
        amount,
        recipientAddress,
        txHash: mockTxHash,
        status: TransferStatus.INITIATED,
        estimatedCompletionTime: estimatedCompletion,
        bridgeProvider: this.providerName,
      };
    });
  }

  async getTransferStatus(transferId: string): Promise<TransferStatusResult> {
    return this.retryWithBackoff(async () => {
      this.logger.debug(`Checking Wormhole transfer status: ${transferId}`);

      // In production: query Wormhole Guardian network for VAA
      // const vaaBytes = await getSignedVAA(guardianRpcHost, emitterChain, emitterAddress, sequence);
      // Check if VAA has been signed and redeemed on destination chain

      // Simulate status progression for demonstration
      const mockStatus = TransferStatus.ATTESTED;

      return {
        transferId,
        status: mockStatus,
        sourceChain: 'ethereum',
        destinationChain: 'stellar',
        txHash: `0x${transferId.slice(0, 64)}`,
        destinationTxHash: mockStatus === TransferStatus.COMPLETED
          ? `stellar_tx_${transferId.slice(0, 32)}`
          : undefined,
      };
    });
  }

  async getSupportedAssets(chain: string): Promise<WrappedAssetInfo[]> {
    this.validateChain(chain);

    // In production: query Wormhole token bridge for registered assets
    // const tokenBridge = new ethers.Contract(tokenBridgeAddress, abi, provider);
    // const wrappedAssets = await tokenBridge.queryFilter(tokenBridge.filters.AssetRegistered());

    const mockAssets: WrappedAssetInfo[] = [
      {
        originalAsset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
        originalChain: 'ethereum',
        wrappedAsset: 'USDC',
        wrappedChain: 'stellar',
        decimals: 6,
        name: 'USD Coin (Wormhole)',
        symbol: 'USDC',
        bridgeProvider: this.providerName,
      },
      {
        originalAsset: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT on Ethereum
        originalChain: 'ethereum',
        wrappedAsset: 'USDT',
        wrappedChain: 'stellar',
        decimals: 6,
        name: 'Tether USD (Wormhole)',
        symbol: 'USDTwh',
        bridgeProvider: this.providerName,
      },
    ];

    return chain === 'stellar'
      ? mockAssets
      : mockAssets.filter((a) => a.originalChain === chain);
  }

  async isHealthy(): Promise<boolean> {
    try {
      // In production: ping Wormhole guardian RPC
      // const response = await fetch(`${this.guardianRpcUrl}/v1/heartbeat`);
      // return response.ok;
      this.logger.debug('Wormhole health check: OK');
      return true;
    } catch (error) {
      this.logger.error(`Wormhole health check failed: ${error.message}`);
      return false;
    }
  }

  async redeemTransfer(vaaBytes: Buffer, destinationChain: string): Promise<string> {
    this.logger.log(`Redeeming Wormhole VAA on ${destinationChain}`);

    // In production: submit signed VAA to destination chain token bridge
    // const tx = await tokenBridge.completeTransfer(vaaBytes);
    // return tx.hash;

    return `redeem_tx_${Date.now()}`;
  }

  async getSignedVAA(
    emitterChain: number,
    emitterAddress: string,
    sequence: number,
  ): Promise<Buffer> {
    const url = `${this.guardianRpcUrl}/v1/signed_vaa/${emitterChain}/${emitterAddress}/${sequence}`;
    this.logger.debug(`Fetching signed VAA from: ${url}`);

    // In production:
    // const response = await fetch(url);
    // const { vaaBytes } = await response.json();
    // return Buffer.from(vaaBytes, 'base64');

    return Buffer.from('mock_vaa_bytes');
  }

  private getEstimatedTime(sourceChain: string, destinationChain: string): number {
    // Wormhole finality times vary by chain
    const finalityTimes: Record<string, number> = {
      ethereum: 975,   // ~15 min (64 confirmations)
      solana: 32,      // ~32 seconds
      bsc: 46,         // ~46 seconds
      polygon: 256,    // ~256 seconds
      avalanche: 120,  // ~2 minutes
      arbitrum: 60,    // ~1 minute
      optimism: 60,
      stellar: 10,     // ~10 seconds
    };
    const sourceTime = finalityTimes[sourceChain] || 300;
    return sourceTime + 30; // Add 30s for guardian signing
  }

  private generateTransferId(
    sourceChain: string,
    destinationChain: string,
    senderAddress: string,
    amount: string,
  ): string {
    const timestamp = Date.now();
    const data = `${sourceChain}-${destinationChain}-${senderAddress}-${amount}-${timestamp}`;
    return Buffer.from(data).toString('base64url').slice(0, 32);
  }
}
