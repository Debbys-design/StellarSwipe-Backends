import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseBridgeProvider } from './base-bridge.provider';
import {
  BridgeQuote,
  BridgeTransferResult,
  TransferStatusResult,
  WrappedAssetInfo,
  TransferStatus,
} from '../interfaces/bridge-provider.interface';
import { AllbridgeConfig } from '../interfaces/transfer-config.interface';

const ALLBRIDGE_SUPPORTED_CHAINS = [
  'stellar',
  'ethereum',
  'bsc',
  'polygon',
  'avalanche',
  'solana',
  'tron',
  'celo',
  'fantom',
];

interface AllbridgeToken {
  symbol: string;
  name: string;
  decimals: number;
  tokenAddress: string;
  poolAddress: string;
  apr: number;
  lpRate: number;
}

interface AllbridgeChainConfig {
  chainSymbol: string;
  name: string;
  tokens: AllbridgeToken[];
}

@Injectable()
export class AllbridgeProvider extends BaseBridgeProvider {
  readonly providerName = 'allbridge';
  readonly supportedChains = ALLBRIDGE_SUPPORTED_CHAINS;

  private readonly config: AllbridgeConfig;
  private readonly apiBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.config = this.configService.get<AllbridgeConfig>('bridges.allbridge');
    this.apiBaseUrl = this.config?.apiUrl || 'https://core.api.allbridgeapp.com';
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
      // In production: call Allbridge Core API
      // const response = await fetch(`${this.apiBaseUrl}/v1/quote`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ sourceChain, destinationChain, sourceToken: sourceAsset, destinationToken: destinationAsset, amount }),
      // });
      // const data = await response.json();

      const feePercentage = 0.3; // Allbridge typical fee ~0.3%
      const fee = this.calculateFeeAmount(amount, feePercentage);
      const outputAmount = (parseFloat(amount) - parseFloat(fee)).toFixed(18);

      const quote: BridgeQuote = {
        sourceChain,
        destinationChain,
        sourceAsset,
        destinationAsset,
        inputAmount: amount,
        outputAmount,
        fee,
        estimatedTime: this.getEstimatedTime(sourceChain, destinationChain),
        bridgeProvider: this.providerName,
        route: [sourceChain, 'allbridge-pool', destinationChain],
        expiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3 min validity
      };

      this.logger.log(
        `Allbridge quote: ${amount} ${sourceAsset} on ${sourceChain} → ${outputAmount} ${destinationAsset} on ${destinationChain}`,
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
      // In production: use Allbridge Core SDK
      // const sdk = new AllbridgeCoreSdk({ ...nodeUrlsDefault });
      // const pools = await sdk.getPoolInfoMap();
      // const sourceToken = await sdk.getTokenInfo(sourceChain, sourceAsset);
      // const destToken = await sdk.getTokenInfo(destinationChain, destinationAsset);
      // const txResponse = await sdk.transfer({ amount, sourceToken, destToken, fromAccountAddress: senderAddress, toAccountAddress: recipientAddress });

      const transferId = `allbridge_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      this.logger.log(
        `Initiating Allbridge transfer: ${transferId} — ${amount} ${sourceAsset} from ${sourceChain} to ${destinationChain}`,
      );

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
        txHash: `allbridge_tx_${transferId}`,
        status: TransferStatus.INITIATED,
        estimatedCompletionTime: estimatedCompletion,
        bridgeProvider: this.providerName,
      };
    });
  }

  async getTransferStatus(transferId: string): Promise<TransferStatusResult> {
    return this.retryWithBackoff(async () => {
      this.logger.debug(`Checking Allbridge transfer status: ${transferId}`);

      // In production: query Allbridge transfer status API
      // const response = await fetch(`${this.apiBaseUrl}/v1/transfer/${transferId}/status`);
      // const data = await response.json();

      return {
        transferId,
        status: TransferStatus.PENDING,
        sourceChain: 'bsc',
        destinationChain: 'stellar',
        txHash: `allbridge_tx_${transferId}`,
      };
    });
  }

  async getSupportedAssets(chain: string): Promise<WrappedAssetInfo[]> {
    this.validateChain(chain);

    return this.retryWithBackoff(async () => {
      // In production: query Allbridge token list
      // const response = await fetch(`${this.apiBaseUrl}/v1/tokens`);
      // const chainConfig: AllbridgeChainConfig = await response.json();

      const mockAssets: WrappedAssetInfo[] = [
        {
          originalAsset: 'USDC',
          originalChain: 'ethereum',
          wrappedAsset: 'USDC',
          wrappedChain: 'stellar',
          decimals: 6,
          name: 'USD Coin (Allbridge)',
          symbol: 'aUSDC',
          bridgeProvider: this.providerName,
        },
        {
          originalAsset: 'BUSD',
          originalChain: 'bsc',
          wrappedAsset: 'BUSD',
          wrappedChain: 'stellar',
          decimals: 18,
          name: 'Binance USD (Allbridge)',
          symbol: 'aBUSD',
          bridgeProvider: this.providerName,
        },
        {
          originalAsset: 'USDT',
          originalChain: 'tron',
          wrappedAsset: 'USDT',
          wrappedChain: 'stellar',
          decimals: 6,
          name: 'Tether USD (Allbridge)',
          symbol: 'aUSDT',
          bridgeProvider: this.providerName,
        },
      ];

      return chain === 'stellar'
        ? mockAssets
        : mockAssets.filter((a) => a.originalChain === chain);
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      // In production: ping Allbridge API
      // const response = await fetch(`${this.apiBaseUrl}/health`);
      // return response.ok;
      this.logger.debug('Allbridge health check: OK');
      return true;
    } catch (error) {
      this.logger.error(`Allbridge health check failed: ${error.message}`);
      return false;
    }
  }

  async getPoolInfo(chain: string, asset: string): Promise<Record<string, any>> {
    // In production: fetch pool liquidity and APR info
    // const response = await fetch(`${this.apiBaseUrl}/v1/pools/${chain}/${asset}`);
    // return response.json();
    return {
      chain,
      asset,
      liquidity: '10000000',
      apr: 5.2,
      utilizationRate: 0.45,
    };
  }

  private getEstimatedTime(sourceChain: string, destinationChain: string): number {
    const chainTimes: Record<string, number> = {
      stellar: 10,
      solana: 30,
      bsc: 60,
      ethereum: 300,
      polygon: 120,
      avalanche: 90,
      tron: 30,
      celo: 60,
      fantom: 30,
    };
    const sourceTime = chainTimes[sourceChain] || 120;
    const destTime = chainTimes[destinationChain] || 120;
    return Math.max(sourceTime, destTime) + 30;
  }
}
