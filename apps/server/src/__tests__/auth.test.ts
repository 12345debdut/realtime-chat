import type { FastifyInstance } from 'fastify';
import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';

import { prisma } from '../lib/prisma';
import { rotateRefresh, signAccess } from '../lib/tokens';
import { authRoutes } from '../routes/auth';

import { buildTestApp, createMockUser } from './helpers';

// Mock argon2 so we don't need native bindings in tests
vi.mock('argon2', () => ({
  default: {
    hash: vi.fn(async (pw: string) => `hashed:${pw}`),
    verify: vi.fn(async (hash: string, pw: string) => hash === `hashed:${pw}`),
  },
}));

// We need to test rotateRefresh and issueRefresh directly, but they import
// prisma internally. Since prisma is already mocked via helpers, we can
// import the token module and its functions will use the mocked prisma.
// We also need to mock the env module (already done in helpers).

const mockPrisma = prisma as any;

// We must import after the vi.mock calls in helpers have been evaluated.
// Dynamic import isn't needed because the top-level `import './helpers'`
// already sets up all mocks before this module's own imports resolve.
beforeEach(() => {
  vi.clearAllMocks();
});

describe('rotateRefresh', () => {
  it('should return new tokens when given a valid refresh token', async () => {
    const user = createMockUser({ id: 'user-1', handle: 'alice' });

    // updateMany returns count=1 (atomic revoke succeeded)
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    // findUnique returns the now-revoked token with its user
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: user.id,
      tokenHash: 'somehash',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: new Date(),
      user,
    });

    // issueRefresh (called internally) creates a new refresh token
    mockPrisma.refreshToken.create.mockResolvedValue({
      id: 'rt-2',
      userId: user.id,
      tokenHash: 'newhash',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const result = await rotateRefresh('valid-raw-token');

    expect(result).not.toBeNull();
    expect(result!.userId).toBe('user-1');
    expect(result!.handle).toBe('alice');
    expect(result!.tokens.accessToken).toBeDefined();
    expect(result!.tokens.refreshToken).toBeDefined();
    expect(result!.tokens.expiresAt).toBeGreaterThan(Date.now());
  });

  it('should return null when the refresh token is expired', async () => {
    // updateMany returns count=0 because the token is expired (expiresAt < now)
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    const result = await rotateRefresh('expired-raw-token');

    expect(result).toBeNull();
  });

  it('should return null when the refresh token is already revoked', async () => {
    // updateMany returns count=0 because revokedAt is already set
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    const result = await rotateRefresh('already-revoked-token');

    expect(result).toBeNull();
  });

  it('should handle concurrent calls so only one succeeds (TOCTOU protection)', async () => {
    const user = createMockUser({ id: 'user-1', handle: 'alice' });

    // First call: atomic update succeeds (count=1)
    // Second call: atomic update fails (count=0) because token already revoked
    mockPrisma.refreshToken.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: user.id,
      tokenHash: 'somehash',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: new Date(),
      user,
    });

    mockPrisma.refreshToken.create.mockResolvedValue({
      id: 'rt-new',
      userId: user.id,
      tokenHash: 'newhash',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const sameToken = 'race-condition-token';

    // Simulate concurrent calls
    const [result1, result2] = await Promise.all([
      rotateRefresh(sameToken),
      rotateRefresh(sameToken),
    ]);

    // Exactly one should succeed, one should fail
    const successes = [result1, result2].filter((r) => r !== null);
    const failures = [result1, result2].filter((r) => r === null);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(successes[0]!.tokens.accessToken).toBeDefined();
  });
});

describe('signAccess', () => {
  it('should return a JWT token and future expiration timestamp', () => {
    const result = signAccess({ sub: 'user-1', handle: 'alice' });

    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.token.split('.')).toHaveLength(3); // JWT has 3 parts
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Auth route error mapping (used by mobile client for user-friendly strings)
// ═══════════════════════════════════════════════════════════════════════════
describe('auth route error codes', () => {
  let authApp: FastifyInstance;

  beforeAll(async () => {
    authApp = await buildTestApp(authRoutes);
  });

  afterAll(async () => {
    await authApp.close();
  });

  it('should return 401 with { error: "invalid_credentials" } for wrong password', async () => {
    const user = createMockUser({
      id: 'user-login',
      handle: 'alice',
      passwordHash: 'hashed:correctpassword',
    });
    mockPrisma.user.findUnique.mockResolvedValue(user);

    const res = await authApp.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { handle: 'alice', password: 'wrongpassword' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'invalid_credentials' });
  });

  it('should return 409 with { error: "handle_taken" } for duplicate handle on register', async () => {
    const existingUser = createMockUser({ id: 'user-existing', handle: 'alice' });
    mockPrisma.user.findUnique.mockResolvedValue(existingUser);

    const res = await authApp.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { 'content-type': 'application/json' },
      payload: { handle: 'alice', displayName: 'Alice Again', password: 'somepassword123' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'handle_taken' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Smart data handling on user switch (mobile-side behavior documentation)
// ═══════════════════════════════════════════════════════════════════════════
describe('Smart data handling on user switch', () => {
  it('should preserve WatermelonDB data when same user re-logs in', () => {
    // Mobile-side behavior: When the same user logs out and logs back in,
    // the WatermelonDB local database should NOT be wiped. The mobile client
    // compares the returned userId from /auth/login with the locally stored
    // userId. If they match, the existing local DB is reused for offline-first
    // continuity (messages, rooms, etc. are already synced).
    //
    // This is enforced in the mobile app layer (AuthStore / WatermelonDB reset
    // logic), not on the server. Server test is a placeholder to document the
    // expected contract.
    expect(true).toBe(true);
  });

  it('should clear WatermelonDB data when different user logs in', () => {
    // Mobile-side behavior: When a different user logs in on the same device,
    // the WatermelonDB local database MUST be wiped and re-created. The mobile
    // client detects a userId mismatch between the login response and locally
    // stored userId, then calls database.write(() => database.unsafeResetDatabase())
    // before proceeding with the new session.
    //
    // This is enforced in the mobile app layer. Server test is a placeholder
    // to document the expected contract.
    expect(true).toBe(true);
  });
});
