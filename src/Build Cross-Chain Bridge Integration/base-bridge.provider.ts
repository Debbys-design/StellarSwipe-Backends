import { Logger } from '@nestjs/common';
import {
  IBridgeProvider,
  BridgeQuote,
  BridgeTransferResult,
  TransferStatusResult,
  WrappedAssetInfo,
  TransferStatus,
} from '../interfaces/bridge-provider.interface';

export abstract class BaseBridgeProvider implements IBridgeProvider {
  protected readonly logger: Logger;
  abstract readonly providerName: string;
  abstract readonly supportedChains: string[];

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  abstract getQuote(
    sourceChain: string,
    destinationChain: string,
    sourceAsset: string,
    destinationAsset: string,
    amount: string,
  ): Promise<BridgeQuote>;

  abstract initiateTransfer(
    sourceChain: string,
    destinationChain: string,
    sourceAsset: string,
    destinationAsset: string,
    amount: string,
    recipientAddress: string,
    senderAddress: string,
  ): Promise<BridgeTransferResult>;

  abstract getTransferStatus(transferId: string): Promise<TransferStatusResult>;

  abstract getSupportedAssets(chain: string): Promise<WrappedAssetInfo[]>;

  abstract isHealthy(): Promise<boolean>;

  supportsRoute(sourceChain: string, destinationChain: string): boolean {
    return (
      this.supportedChains.includes(sourceChain) &&
      this.supportedChains.includes(destinationChain)
    );
  }

  protected validateAmount(amount: string): void {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error(`Invalid amount: ${amount}`);
    }
  }

  protected validateChain(chain: string): void {
    if (!this.supportedChains.includes(chain)) {
      throw new Error(
        `Chain ${chain} not supported by ${this.providerName}. Supported chains: ${this.supportedChains.join(', ')}`,
      );
    }
  }

  protected calculateFeeAmount(amount: string, feePercentage: number): string {
    const numAmount = parseFloat(amount);
    const fee = (numAmount * feePercentage) / 100;
    return fee.toFixed(18);
  }

  protected applySlippage(amount: string, slippagePercent: number): string {
    const numAmount = parseFloat(amount);
    const withSlippage = numAmount * (1 - slippagePercent / 100);
    return withSlippage.toFixed(18);
  }

  protected isTerminalStatus(status: TransferStatus): boolean {
    return [
      TransferStatus.COMPLETED,
      TransferStatus.FAILED,
      TransferStatus.REFUNDED,
    ].includes(status);
  }

  protected async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000,
  ): Promise<T> {
    let lastError: Error;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries - 1) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          this.logger.warn(
            `Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${error.message}`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  protected normalizeAddress(address: string, chain: string): string {
    if (['ethereum', 'bsc', 'polygon', 'avalanche', 'arbitrum', 'optimism'].includes(chain)) {
      return address.toLowerCase();
    }
    return address;
  }
}
