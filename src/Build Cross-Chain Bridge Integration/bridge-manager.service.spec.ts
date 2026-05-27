import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { BridgeManagerService } from './bridge-manager.service';
import { WormholeProvider } from './providers/wormhole.provider';
import { AllbridgeProvider } from './providers/allbridge.provider';
import { TransferTracker } from './utils/transfer-tracker';
import { BridgeTransaction } from './entities/bridge-transaction.entity';
import { WrappedAsset } from './entities/wrapped-asset.entity';
import { BridgeRoute } from './entities/bridge-route.entity';
import { TransferStatus } from './interfaces/bridge-provider.interface';

const mockBridgeQuote = {
  sourceChain: 'ethereum',
  destinationChain: 'stellar',
  sourceAsset: 'USDC',
  destinationAsset: 'USDC',
  inputAmount: '100',
  outputAmount: '99.9',
  fee: '0.1',
  estimatedTime: 600,
  bridgeProvider: 'wormhole',
  route: ['ethereum', 'wormhole-guardians', 'stellar'],
  expiresAt: new Date(Date.now() + 300000),
};

const mockTransferResult = {
  transferId: 'test-transfer-123',
  sourceChain: 'ethereum',
  destinationChain: 'stellar',
  sourceAsset: 'USDC',
  destinationAsset: 'USDC',
  amount: '100',
  recipientAddress: 'GDEST...',
  txHash: '0xabc123',
  status: TransferStatus.INITIATED,
  estimatedCompletionTime: new Date(Date.now() + 600000),
  bridgeProvider: 'wormhole',
};

const mockTransaction: Partial<BridgeTransaction> = {
  id: 'uuid-1',
  transferId: 'test-transfer-123',
  bridgeProvider: 'wormhole',
  sourceChain: 'ethereum',
  destinationChain: 'stellar',
  sourceAsset: 'USDC',
  destinationAsset: 'USDC',
  amount: '100',
  senderAddress: '0xSender',
  recipientAddress: 'GDEST...',
  userAddress: '0xSender',
  status: TransferStatus.INITIATED,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('BridgeManagerService', () => {
  let service: BridgeManagerService;
  let wormholeProvider: jest.Mocked<WormholeProvider>;
  let allbridgeProvider: jest.Mocked<AllbridgeProvider>;
  let transferTracker: jest.Mocked<TransferTracker>;
  let txRepository: jest.Mocked<Repository<BridgeTransaction>>;
  let routeRepository: jest.Mocked<Repository<BridgeRoute>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BridgeManagerService,
        {
          provide: WormholeProvider,
          useValue: {
            providerName: 'wormhole',
            supportedChains: ['ethereum', 'stellar', 'bsc', 'polygon', 'solana', 'avalanche', 'arbitrum', 'optimism'],
            getQuote: jest.fn(),
            initiateTransfer: jest.fn(),
            getTransferStatus: jest.fn(),
            getSupportedAssets: jest.fn(),
            isHealthy: jest.fn(),
            supportsRoute: jest.fn(),
          },
        },
        {
          provide: AllbridgeProvider,
          useValue: {
            providerName: 'allbridge',
            supportedChains: ['stellar', 'ethereum', 'bsc', 'polygon', 'solana', 'tron'],
            getQuote: jest.fn(),
            initiateTransfer: jest.fn(),
            getTransferStatus: jest.fn(),
            getSupportedAssets: jest.fn(),
            isHealthy: jest.fn(),
            supportsRoute: jest.fn(),
          },
        },
        {
          provide: TransferTracker,
          useValue: {
            trackTransfer: jest.fn(),
            updateStatus: jest.fn(),
            getTransferById: jest.fn(),
            getTransfersByUser: jest.fn(),
            getActiveTransfers: jest.fn(),
            incrementRetryCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(BridgeTransaction),
          useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() },
        },
        {
          provide: getRepositoryToken(WrappedAsset),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(BridgeRoute),
          useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), increment: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<BridgeManagerService>(BridgeManagerService);
    wormholeProvider = module.get(WormholeProvider);
    allbridgeProvider = module.get(AllbridgeProvider);
    transferTracker = module.get(TransferTracker);
    txRepository = module.get(getRepositoryToken(BridgeTransaction));
    routeRepository = module.get(getRepositoryToken(BridgeRoute));
  });

  describe('getBestQuote', () => {
    it('should return the quote with highest output amount', async () => {
      const wormholeQuote = { ...mockBridgeQuote, outputAmount: '99.9', bridgeProvider: 'wormhole' };
      const allbridgeQuote = { ...mockBridgeQuote, outputAmount: '99.7', bridgeProvider: 'allbridge' };

      wormholeProvider.supportsRoute.mockReturnValue(true);
      allbridgeProvider.supportsRoute.mockReturnValue(true);
      wormholeProvider.getQuote.mockResolvedValue(wormholeQuote);
      allbridgeProvider.getQuote.mockResolvedValue(allbridgeQuote);

      const result = await service.getBestQuote('ethereum', 'stellar', 'USDC', 'USDC', '100');

      expect(result.outputAmount).toBe('99.9');
      expect(result.bridgeProvider).toBe('wormhole');
      expect(result.alternativeQuotes).toHaveLength(1);
    });

    it('should use preferred provider when specified', async () => {
      wormholeProvider.supportsRoute.mockReturnValue(true);
      wormholeProvider.getQuote.mockResolvedValue(mockBridgeQuote);

      const result = await service.getBestQuote(
        'ethereum', 'stellar', 'USDC', 'USDC', '100', 'wormhole',
      );

      expect(result.bridgeProvider).toBe('wormhole');
      expect(allbridgeProvider.getQuote).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when no route available', async () => {
      wormholeProvider.supportsRoute.mockReturnValue(false);
      allbridgeProvider.supportsRoute.mockReturnValue(false);

      await expect(
        service.getBestQuote('ethereum', 'stellar', 'USDC', 'USDC', '100'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for unknown preferred provider', async () => {
      await expect(
        service.getBestQuote('ethereum', 'stellar', 'USDC', 'USDC', '100', 'unknown-bridge'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('initiateTransfer', () => {
    it('should initiate transfer and persist transaction', async () => {
      wormholeProvider.supportsRoute.mockReturnValue(true);
      allbridgeProvider.supportsRoute.mockReturnValue(false);
      wormholeProvider.getQuote.mockResolvedValue(mockBridgeQuote);
      wormholeProvider.initiateTransfer.mockResolvedValue(mockTransferResult);
      transferTracker.trackTransfer.mockResolvedValue(mockTransaction as BridgeTransaction);
      routeRepository.findOne.mockResolvedValue(null);

      const result = await service.initiateTransfer({
        sourceChain: 'ethereum',
        destinationChain: 'stellar',
        sourceAsset: 'USDC',
        destinationAsset: 'USDC',
        amount: '100',
        recipientAddress: 'GDEST...',
        senderAddress: '0xSender',
      });

      expect(result.transferId).toBe('test-transfer-123');
      expect(result.status).toBe(TransferStatus.INITIATED);
      expect(transferTracker.trackTransfer).toHaveBeenCalledWith(
        'test-transfer-123',
        expect.objectContaining({ bridgeProvider: 'wormhole' }),
      );
    });
  });

  describe('getTransferStatus', () => {
    it('should return status for existing transfer', async () => {
      transferTracker.getTransferById.mockResolvedValue(mockTransaction as BridgeTransaction);
      wormholeProvider.getTransferStatus.mockResolvedValue({
        transferId: 'test-transfer-123',
        status: TransferStatus.INITIATED,
        sourceChain: 'ethereum',
        destinationChain: 'stellar',
        txHash: '0xabc123',
      });

      const result = await service.getTransferStatus('test-transfer-123');
      expect(result.transferId).toBe('test-transfer-123');
    });

    it('should throw NotFoundException for unknown transfer', async () => {
      transferTracker.getTransferById.mockResolvedValue(null);
      await expect(service.getTransferStatus('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProviderHealth', () => {
    it('should return health status for all providers', async () => {
      wormholeProvider.isHealthy.mockResolvedValue(true);
      allbridgeProvider.isHealthy.mockResolvedValue(false);

      const health = await service.getProviderHealth();

      expect(health.wormhole).toBe(true);
      expect(health.allbridge).toBe(false);
    });
  });
});
