/**
 * Tests for tag routes: GET /tags, POST /tags, DELETE /tags/:id
 */
import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

import './helpers';
import { buildTestApp, createMockTag } from './helpers';
import { prisma } from '../lib/prisma';
import { tagRoutes } from '../routes/tags';

const mockPrisma = prisma as any;

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp(tagRoutes);
});

afterAll(async () => {
  await app.close();
});

function inject(
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  opts: { userId?: string; body?: any } = {},
) {
  return app.inject({
    method,
    url,
    headers: {
      'content-type': 'application/json',
      'x-test-user-id': opts.userId ?? 'user-1',
      'x-test-user-handle': 'testuser',
    },
    ...(opts.body ? { payload: opts.body } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /tags
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /tags', () => {
  it('should return empty array when user has no tags', async () => {
    mockPrisma.tag.findMany.mockResolvedValue([]);

    const res = await inject('GET', '/tags');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('should return tags sorted by name with numeric createdAt', async () => {
    const t1 = new Date('2025-01-01T00:00:00Z');
    const t2 = new Date('2025-06-01T00:00:00Z');
    mockPrisma.tag.findMany.mockResolvedValue([
      createMockTag({ id: 'tag-1', name: 'Alpha', createdAt: t1 }),
      createMockTag({ id: 'tag-2', name: 'Beta', color: '#4ECDC4', createdAt: t2 }),
    ]);

    const res = await inject('GET', '/tags');
    const json = res.json();

    expect(res.statusCode).toBe(200);
    expect(json).toHaveLength(2);
    expect(json[0]).toEqual({ id: 'tag-1', name: 'Alpha', color: '#FF6B6B', createdAt: t1.getTime() });
    expect(json[1]).toEqual({ id: 'tag-2', name: 'Beta', color: '#4ECDC4', createdAt: t2.getTime() });

    // Verify query filters by userId and sorts by name
    const query = mockPrisma.tag.findMany.mock.calls[0][0];
    expect(query.where.userId).toBe('user-1');
    expect(query.orderBy.name).toBe('asc');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /tags
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /tags', () => {
  it('should return 400 for missing name', async () => {
    const res = await inject('POST', '/tags', { body: {} });
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 for empty name', async () => {
    const res = await inject('POST', '/tags', { body: { name: '' } });
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 for name exceeding 30 characters', async () => {
    const res = await inject('POST', '/tags', { body: { name: 'a'.repeat(31) } });
    expect(res.statusCode).toBe(400);
  });

  it('should return 409 when tag with same name already exists', async () => {
    mockPrisma.tag.findUnique.mockResolvedValue(createMockTag());

    const res = await inject('POST', '/tags', { body: { name: 'Work' } });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('tag_exists');
  });

  it('should create tag with default color when color not provided', async () => {
    const createdTag = createMockTag({ color: '#4ECDC4' });
    mockPrisma.tag.findUnique.mockResolvedValue(null);
    mockPrisma.tag.create.mockResolvedValue(createdTag);

    const res = await inject('POST', '/tags', { body: { name: 'Work' } });

    expect(res.statusCode).toBe(201);
    const createCall = mockPrisma.tag.create.mock.calls[0][0];
    expect(createCall.data.color).toBe('#4ECDC4');
    expect(createCall.data.name).toBe('Work');
    expect(createCall.data.userId).toBe('user-1');
  });

  it('should create tag with custom color when provided', async () => {
    const createdTag = createMockTag({ color: '#FF0000' });
    mockPrisma.tag.findUnique.mockResolvedValue(null);
    mockPrisma.tag.create.mockResolvedValue(createdTag);

    const res = await inject('POST', '/tags', { body: { name: 'Urgent', color: '#FF0000' } });

    expect(res.statusCode).toBe(201);
    const createCall = mockPrisma.tag.create.mock.calls[0][0];
    expect(createCall.data.color).toBe('#FF0000');
  });

  it('should return tag with numeric createdAt', async () => {
    const now = new Date('2025-03-15T10:00:00Z');
    mockPrisma.tag.findUnique.mockResolvedValue(null);
    mockPrisma.tag.create.mockResolvedValue(createMockTag({ createdAt: now }));

    const res = await inject('POST', '/tags', { body: { name: 'Personal' } });
    const json = res.json();

    expect(typeof json.createdAt).toBe('number');
    expect(json.createdAt).toBe(now.getTime());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /tags/:id
// ═══════════════════════════════════════════════════════════════════════════
describe('DELETE /tags/:id', () => {
  it('should return 403 when tag does not exist', async () => {
    mockPrisma.tag.findUnique.mockResolvedValue(null);

    const res = await inject('DELETE', '/tags/nonexistent');
    expect(res.statusCode).toBe(403);
  });

  it('should return 403 when tag belongs to another user', async () => {
    mockPrisma.tag.findUnique.mockResolvedValue(createMockTag({ userId: 'other-user' }));

    const res = await inject('DELETE', '/tags/tag-1');
    expect(res.statusCode).toBe(403);
  });

  it('should delete tag and return 204 when valid', async () => {
    mockPrisma.tag.findUnique.mockResolvedValue(createMockTag());
    mockPrisma.tag.delete.mockResolvedValue({});

    const res = await inject('DELETE', '/tags/tag-1');
    expect(res.statusCode).toBe(204);
    expect(mockPrisma.tag.delete).toHaveBeenCalledWith({ where: { id: 'tag-1' } });
  });
});
