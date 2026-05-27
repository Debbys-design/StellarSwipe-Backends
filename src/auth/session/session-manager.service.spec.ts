import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SessionManagerService } from './session-manager.service';

const store = new Map<string, any>();

const mockCacheManager = {
  get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
  set: jest.fn((key: string, value: any) => { store.set(key, value); return Promise.resolve(); }),
  del: jest.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
};

const mockConfigService = {
  get: jest.fn((key: string, def?: any) => {
    const map: Record<string, any> = {
      'auth.sessionTTL': 3600,
      'auth.refreshTTL': 604800,
      'auth.maxSessionsPerUser': 2,
      'jwt.secret': 'test-secret-key-for-unit-tests-only',
    };
    return map[key] ?? def;
  }),
};

const mockJwtService = {
  sign: jest.fn(() => 'mock.access.token'),
};

describe('SessionManagerService', () => {
  let service: SessionManagerService;

  beforeEach(async () => {
    store.clear();
    jest.clearAllMocks();

    // Re-wire mocks to use the cleared store
    mockCacheManager.get.mockImplementation((key: string) =>
      Promise.resolve(store.get(key) ?? null),
    );
    mockCacheManager.set.mockImplementation((key: string, value: any) => {
      store.set(key, value);
      return Promise.resolve();
    });
    mockCacheManager.del.mockImplementation((key: string) => {
      store.delete(key);
      return Promise.resolve();
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionManagerService,
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get(SessionManagerService);
  });

  describe('issueTokens', () => {
    it('returns accessToken, refreshToken, and expiresIn', async () => {
      const result = await service.issueTokens('user-1', 'GPUBKEY');
      expect(result.accessToken).toBe('mock.access.token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);
      expect(result.expiresIn).toBe(3600);
    });

    it('persists an encrypted session entry', async () => {
      await service.issueTokens('user-1', 'GPUBKEY');
      const sessionKeys = [...store.keys()].filter((k) => k.startsWith('session:'));
      expect(sessionKeys.length).toBe(1);
      // Value must be encrypted (not plain JSON)
      const raw = store.get(sessionKeys[0]);
      expect(() => JSON.parse(raw)).toThrow();
    });

    it('persists an encrypted refresh token entry', async () => {
      await service.issueTokens('user-1', 'GPUBKEY');
      const refreshKeys = [...store.keys()].filter((k) => k.startsWith('refresh:'));
      expect(refreshKeys.length).toBe(1);
    });
  });

  describe('refreshTokens', () => {
    it('issues a new token pair and revokes the old session', async () => {
      const { refreshToken } = await service.issueTokens('user-1', 'GPUBKEY');
      const oldSessionKeys = [...store.keys()].filter((k) => k.startsWith('session:'));

      const newTokens = await service.refreshTokens(refreshToken);

      expect(newTokens.accessToken).toBe('mock.access.token');
      expect(typeof newTokens.refreshToken).toBe('string');

      // Old session must be gone
      for (const key of oldSessionKeys) {
        expect(store.has(key)).toBe(false);
      }
    });

    it('throws UnauthorizedException for an invalid refresh token', async () => {
      await expect(service.refreshTokens('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('prevents refresh token reuse (one-time use)', async () => {
      const { refreshToken } = await service.issueTokens('user-1', 'GPUBKEY');
      await service.refreshTokens(refreshToken);
      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('deleteSession / deleteAllUserSessions', () => {
    it('removes session and refresh entries on logout', async () => {
      await service.issueTokens('user-1', 'GPUBKEY');
      const sessionId = [...store.keys()].find((k) => k.startsWith('session:'))!.replace('session:', '');

      await service.deleteSession(sessionId);

      expect(store.has(`session:${sessionId}`)).toBe(false);
    });

    it('revokes all sessions for a user', async () => {
      await service.issueTokens('user-1', 'GPUBKEY');
      await service.issueTokens('user-1', 'GPUBKEY');

      await service.deleteAllUserSessions('user-1');

      const sessionKeys = [...store.keys()].filter((k) => k.startsWith('session:'));
      expect(sessionKeys.length).toBe(0);
    });
  });

  describe('max sessions per user', () => {
    it('evicts the oldest session when limit is exceeded', async () => {
      // maxSessionsPerUser = 2
      await service.issueTokens('user-1', 'GPUBKEY');
      await service.issueTokens('user-1', 'GPUBKEY');
      const sessionsBefore = [...store.keys()].filter((k) => k.startsWith('session:'));
      expect(sessionsBefore.length).toBe(2);

      // Third session should evict the first
      await service.issueTokens('user-1', 'GPUBKEY');
      const sessionsAfter = [...store.keys()].filter((k) => k.startsWith('session:'));
      expect(sessionsAfter.length).toBe(2);
    });
  });

  describe('getSession', () => {
    it('returns null for a non-existent session', async () => {
      const result = await service.getSession('no-such-id');
      expect(result).toBeNull();
    });

    it('returns decrypted session data for a valid session', async () => {
      await service.createSession('sess-x', 'user-2', 'GPUBKEY2', { ip: '127.0.0.1' });
      const session = await service.getSession('sess-x');
      expect(session).not.toBeNull();
      expect(session!.userId).toBe('user-2');
      expect(session!.publicKey).toBe('GPUBKEY2');
    });
  });
});
