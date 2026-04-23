/**
 * Unit tests for TagRepository — validates tag CRUD, room-tag associations,
 * and server sync logic.
 */

// ─── Mock WatermelonDB storage ──────────────────────────────────────────────

jest.mock('../foundation/storage', () => ({
  database: {
    write: jest.fn(async (fn: () => Promise<any>) => fn()),
    batch: jest.fn(),
  },
  collections: {
    tags: {
      query: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
    },
    roomTags: {
      query: jest.fn(),
      create: jest.fn(),
    },
    rooms: {
      find: jest.fn(),
    },
  },
}));

// ─── Mock HTTP module ───────────────────────────────────────────────────────

jest.mock('../foundation/network/http', () => ({
  http: {
    post: jest.fn(),
    delete: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
  },
}));

import { tagRepository } from '../features/chat/data/TagRepository';
import { database, collections } from '../foundation/storage';
import { http } from '../foundation/network/http';

const mockDb = database as any;
const col = collections as any;
const mockHttp = http as any;

// ─── Tests ──────────────────────────────────────────────────────────────────

/** Set up the tags.query mock so the duplicate-check in createTag returns empty. */
function mockNoDuplicateTag() {
  col.tags.query.mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.write.mockImplementation(async (fn: () => Promise<any>) => fn());
});

describe('tagRepository.createTag', () => {
  it('creates a tag with name, color, and createdAt set', async () => {
    mockNoDuplicateTag();
    const mockTag: any = { id: 'local-1', name: 'Work', color: '#FF6B6B', serverId: null, createdAt: new Date() };

    col.tags.create.mockImplementation((setter: (t: any) => void) => {
      const record: any = {};
      setter(record);
      // BUG FIX VERIFICATION: createdAt must be set
      expect(record.name).toBe('Work');
      expect(record.color).toBe('#FF6B6B');
      expect(record.createdAt).toBeInstanceOf(Date);
      Object.assign(mockTag, record);
      return mockTag;
    });

    mockHttp.post.mockResolvedValue({ data: { id: 'server-tag-1' } });
    mockTag.update = jest.fn(async (setter: (t: any) => void) => { setter(mockTag); });

    const result = await tagRepository.createTag('Work', '#FF6B6B');

    expect(result).toBe(mockTag);
    expect(col.tags.create).toHaveBeenCalledTimes(1);
    expect(mockHttp.post).toHaveBeenCalledWith('/tags', { name: 'Work', color: '#FF6B6B' });
  });

  it('sets createdAt even when no color is provided', async () => {
    mockNoDuplicateTag();
    let capturedColor: string | undefined;

    col.tags.create.mockImplementation((setter: (t: any) => void) => {
      const record: any = {};
      setter(record);
      capturedColor = record.color;
      expect(record.createdAt).toBeInstanceOf(Date);
      return { ...record, id: 'local-2', update: jest.fn() };
    });

    mockHttp.post.mockResolvedValue({ data: { id: 'server-tag-2' } });

    await tagRepository.createTag('Personal');

    expect(capturedColor).toMatch(/^#[0-9A-F]{6}$/i);
    expect(col.tags.create).toHaveBeenCalledTimes(1);
  });

  it('continues without error when server sync fails (non-duplicate)', async () => {
    mockNoDuplicateTag();
    const mockTag = { id: 'local-3', name: 'Test', serverId: null, update: jest.fn() };
    col.tags.create.mockImplementation(() => mockTag);
    mockHttp.post.mockRejectedValue(new Error('network error'));

    const result = await tagRepository.createTag('Test');

    expect(result).toBe(mockTag);
    expect(mockTag.update).not.toHaveBeenCalled();
  });

  it('rejects with tag_exists when a local duplicate exists', async () => {
    col.tags.query.mockReturnValue({
      fetch: jest.fn().mockResolvedValue([{ id: 'existing', name: 'Work' }]),
    });

    await expect(tagRepository.createTag('Work')).rejects.toThrow('tag_exists');
    expect(col.tags.create).not.toHaveBeenCalled();
  });

  it('rolls back local tag when server returns tag_exists (409)', async () => {
    mockNoDuplicateTag();
    const mockTag = {
      id: 'local-dup',
      serverId: null,
      markAsDeleted: jest.fn(),
      update: jest.fn(),
    };
    col.tags.create.mockImplementation(() => mockTag);
    mockHttp.post.mockRejectedValue({
      response: { data: { error: 'tag_exists' } },
    });

    await expect(tagRepository.createTag('Duplicate')).rejects.toThrow('tag_exists');
    expect(mockTag.markAsDeleted).toHaveBeenCalled();
  });

  it('updates serverId after successful server sync', async () => {
    mockNoDuplicateTag();
    const mockTag = {
      id: 'local-4',
      serverId: null,
      update: jest.fn(async (setter: (t: any) => void) => { setter(mockTag); }),
    };
    col.tags.create.mockImplementation(() => mockTag);
    mockHttp.post.mockResolvedValue({ data: { id: 'server-tag-99' } });

    await tagRepository.createTag('Synced');

    expect(mockTag.update).toHaveBeenCalledTimes(1);
    expect(mockTag.serverId).toBe('server-tag-99');
  });
});

describe('tagRepository.getAllTags', () => {
  it('fetches all tags from local DB', async () => {
    const tags = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }];
    col.tags.query.mockReturnValue({ fetch: jest.fn().mockResolvedValue(tags) });

    const result = await tagRepository.getAllTags();

    expect(result).toEqual(tags);
  });
});

describe('tagRepository.getTagsForRoom', () => {
  it('returns empty array when room has no tags', async () => {
    col.roomTags.query.mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) });

    const result = await tagRepository.getTagsForRoom('room-1');

    expect(result).toEqual([]);
  });

  it('returns tags for room via roomTags pivot', async () => {
    const roomTags = [{ tagId: 'tag-1' }, { tagId: 'tag-2' }];
    const tags = [{ id: 'tag-1', name: 'Work' }, { id: 'tag-2', name: 'Personal' }];

    col.roomTags.query.mockReturnValue({ fetch: jest.fn().mockResolvedValue(roomTags) });
    col.tags.query.mockReturnValue({ fetch: jest.fn().mockResolvedValue(tags) });

    const result = await tagRepository.getTagsForRoom('room-1');

    expect(result).toEqual(tags);
  });
});

describe('tagRepository.addTagToRoom', () => {
  it('skips if room-tag already exists', async () => {
    col.roomTags.query.mockReturnValue({
      fetch: jest.fn().mockResolvedValue([{ roomId: 'room-1', tagId: 'tag-1' }]),
    });

    await tagRepository.addTagToRoom('room-1', 'tag-1');

    expect(col.roomTags.create).not.toHaveBeenCalled();
  });

  it('creates room-tag and syncs to server', async () => {
    col.roomTags.query.mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) });
    col.roomTags.create.mockImplementation(() => {});
    col.rooms.find.mockResolvedValue({ serverId: 'server-room-1' });
    col.tags.find.mockResolvedValue({ serverId: 'server-tag-1' });
    mockHttp.post.mockResolvedValue({ data: { ok: true } });

    await tagRepository.addTagToRoom('room-1', 'tag-1');

    expect(col.roomTags.create).toHaveBeenCalledTimes(1);
    expect(mockHttp.post).toHaveBeenCalledWith('/rooms/server-room-1/tags', { tagId: 'server-tag-1' });
  });
});

describe('tagRepository.removeTagFromRoom', () => {
  it('does nothing when no matching room-tag exists', async () => {
    col.roomTags.query.mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) });

    await tagRepository.removeTagFromRoom('room-1', 'tag-1');

    expect(mockDb.write).not.toHaveBeenCalled();
  });

  it('deletes room-tag entries and syncs to server', async () => {
    const mockRt = { prepareMarkAsDeleted: jest.fn(() => 'prepared-op') };
    col.roomTags.query.mockReturnValue({ fetch: jest.fn().mockResolvedValue([mockRt]) });
    col.rooms.find.mockResolvedValue({ serverId: 'server-room-1' });
    col.tags.find.mockResolvedValue({ serverId: 'server-tag-1' });
    mockHttp.delete.mockResolvedValue({});

    await tagRepository.removeTagFromRoom('room-1', 'tag-1');

    expect(mockRt.prepareMarkAsDeleted).toHaveBeenCalled();
    expect(mockHttp.delete).toHaveBeenCalledWith('/rooms/server-room-1/tags/server-tag-1');
  });
});

describe('tagRepository.deleteTag', () => {
  it('deletes tag and all associated room-tags locally, then syncs to server', async () => {
    const mockTag = {
      id: 'tag-del-1',
      serverId: 'server-tag-del-1',
      prepareMarkAsDeleted: jest.fn(() => 'prep-tag'),
    };
    const mockRt1 = { prepareMarkAsDeleted: jest.fn(() => 'prep-rt-1') };
    const mockRt2 = { prepareMarkAsDeleted: jest.fn(() => 'prep-rt-2') };

    col.tags.find.mockResolvedValue(mockTag);
    col.roomTags.query.mockReturnValue({
      fetch: jest.fn().mockResolvedValue([mockRt1, mockRt2]),
    });
    mockDb.batch.mockResolvedValue(undefined);
    mockHttp.delete.mockResolvedValue({});

    await tagRepository.deleteTag('tag-del-1');

    expect(mockTag.prepareMarkAsDeleted).toHaveBeenCalled();
    expect(mockRt1.prepareMarkAsDeleted).toHaveBeenCalled();
    expect(mockRt2.prepareMarkAsDeleted).toHaveBeenCalled();
    expect(mockDb.batch).toHaveBeenCalledWith('prep-rt-1', 'prep-rt-2', 'prep-tag');
    expect(mockHttp.delete).toHaveBeenCalledWith('/tags/server-tag-del-1');
  });

  it('skips server sync when tag has no serverId', async () => {
    const mockTag = {
      id: 'tag-local',
      serverId: null,
      prepareMarkAsDeleted: jest.fn(() => 'prep-tag'),
    };
    col.tags.find.mockResolvedValue(mockTag);
    col.roomTags.query.mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) });
    mockDb.batch.mockResolvedValue(undefined);

    await tagRepository.deleteTag('tag-local');

    expect(mockHttp.delete).not.toHaveBeenCalled();
    expect(mockDb.batch).toHaveBeenCalledWith('prep-tag');
  });

  it('continues without error when server delete fails', async () => {
    const mockTag = {
      id: 'tag-err',
      serverId: 'server-err',
      prepareMarkAsDeleted: jest.fn(() => 'prep-tag'),
    };
    col.tags.find.mockResolvedValue(mockTag);
    col.roomTags.query.mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) });
    mockDb.batch.mockResolvedValue(undefined);
    mockHttp.delete.mockRejectedValue(new Error('network error'));

    // Should not throw
    await tagRepository.deleteTag('tag-err');

    expect(mockTag.prepareMarkAsDeleted).toHaveBeenCalled();
  });
});

describe('tagRepository.getRoomIdsForTag', () => {
  it('returns room IDs from roomTag entries', async () => {
    col.roomTags.query.mockReturnValue({
      fetch: jest.fn().mockResolvedValue([{ roomId: 'room-1' }, { roomId: 'room-2' }]),
    });

    const result = await tagRepository.getRoomIdsForTag('tag-1');

    expect(result).toEqual(['room-1', 'room-2']);
  });
});
