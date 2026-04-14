/**
 * Unit tests for RoomRepository — validates syncFromServer, deleteRoom,
 * togglePin, and upsertRoom logic.
 *
 * Strategy: mock the storage and http modules at the jest.mock level,
 * then access mock functions through the imported module references
 * to avoid jest.mock hoisting issues.
 */

// ─── Mock SyncEngine ────────────────────────────────────────────────────────

const mockSocketEmit = jest.fn();

jest.mock('../features/chat/data/SyncEngine', () => ({
  getSocketInstance: jest.fn(() => ({
    connected: true,
    emit: mockSocketEmit,
  })),
}));

// ─── Mock HTTP module ───────────────────────────────────────────────────────

jest.mock('../foundation/network/http', () => ({
  http: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    post: jest.fn(),
  },
}));

// ─── Mock WatermelonDB storage ──────────────────────────────────────────────

jest.mock('../foundation/storage', () => ({
  database: {
    write: jest.fn(async (fn: () => Promise<any>) => fn()),
    batch: jest.fn(),
  },
  collections: {
    rooms: {
      query: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
    },
    tags: {
      query: jest.fn(),
      create: jest.fn(),
    },
    roomTags: {
      query: jest.fn(),
      create: jest.fn(),
    },
    memberships: {
      query: jest.fn(),
    },
    messages: {
      query: jest.fn(),
    },
  },
}));

// ─── Imports (must come after jest.mock) ─────────────────────────────────────

import { roomRepository } from '../features/chat/data/RoomRepository';
import { database, collections } from '../foundation/storage';
import { http } from '../foundation/network/http';

// Cast to jest.Mock for easy access
const mockDb = database as any;
const col = collections as any;
const mockHttp = http as any;

// ─── Helpers ────────────────────────────────────────────────────────────────

const now = Date.now();

function makeServerRoom(overrides: Record<string, any> = {}) {
  return {
    id: 'server-room-1',
    kind: 'dm' as const,
    title: 'Test Room',
    createdAt: now,
    updatedAt: now,
    lastMessagePreview: 'hello',
    lastMessageAt: now,
    memberIds: ['user-1', 'user-2'],
    isPinned: false,
    tags: [],
    ...overrides,
  };
}

function makeServerTag(overrides: Record<string, any> = {}) {
  return {
    id: 'server-tag-1',
    name: 'Work',
    color: '#FF6B6B',
    createdAt: now,
    ...overrides,
  };
}

function mockQueryReturn(mockFn: jest.Mock, rows: any[]) {
  mockFn.mockReturnValue({ fetch: jest.fn().mockResolvedValue(rows) });
}

function mockQueryReturnOnce(mockFn: jest.Mock, rows: any[]) {
  mockFn.mockReturnValueOnce({ fetch: jest.fn().mockResolvedValue(rows) });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Re-set the database.write mock (clearAllMocks clears calls but not implementation)
  mockDb.write.mockImplementation(async (fn: () => Promise<any>) => fn());
});

describe('roomRepository.syncFromServer', () => {
  it('fetches rooms and tags from server in parallel', async () => {
    mockHttp.get.mockImplementation((url: string) => {
      if (url === '/rooms') return Promise.resolve({ data: [] });
      if (url === '/tags') return Promise.resolve({ data: [] });
      return Promise.reject(new Error('unexpected url'));
    });
    mockQueryReturn(col.rooms.query, []);

    await roomRepository.syncFromServer();

    expect(mockHttp.get).toHaveBeenCalledWith('/rooms');
    expect(mockHttp.get).toHaveBeenCalledWith('/tags');
  });

  it('creates a new local tag from server data with createdAt set', async () => {
    const serverTag = makeServerTag();
    mockHttp.get.mockImplementation((url: string) => {
      if (url === '/rooms') return Promise.resolve({ data: [] });
      if (url === '/tags') return Promise.resolve({ data: [serverTag] });
      return Promise.reject();
    });

    // No existing tag
    mockQueryReturn(col.tags.query, []);
    mockQueryReturn(col.rooms.query, []);

    let capturedRecord: any = {};
    col.tags.create.mockImplementation((setter: (t: any) => void) => {
      setter(capturedRecord);
      return capturedRecord;
    });

    await roomRepository.syncFromServer();

    expect(col.tags.create).toHaveBeenCalledTimes(1);
    expect(capturedRecord.name).toBe('Work');
    expect(capturedRecord.color).toBe('#FF6B6B');
    expect(capturedRecord.serverId).toBe('server-tag-1');
    // BUG FIX VERIFICATION: createdAt must be set
    expect(capturedRecord.createdAt).toBeInstanceOf(Date);
    expect(capturedRecord.createdAt.getTime()).toBe(now);
  });

  it('updates existing tag when server_id matches', async () => {
    const serverTag = makeServerTag({ name: 'Updated Work' });
    mockHttp.get.mockImplementation((url: string) => {
      if (url === '/rooms') return Promise.resolve({ data: [] });
      if (url === '/tags') return Promise.resolve({ data: [serverTag] });
      return Promise.reject();
    });

    const existingTag = {
      id: 'local-tag-1',
      serverId: 'server-tag-1',
      name: 'Work',
      update: jest.fn(async (setter: (t: any) => void) => { setter(existingTag); }),
    };

    mockQueryReturnOnce(col.tags.query, [existingTag]);
    mockQueryReturn(col.rooms.query, []);

    await roomRepository.syncFromServer();

    expect(existingTag.update).toHaveBeenCalledTimes(1);
    expect(existingTag.name).toBe('Updated Work');
    expect(col.tags.create).not.toHaveBeenCalled();
  });

  it('matches offline-created tag by name and sets serverId', async () => {
    const serverTag = makeServerTag();
    mockHttp.get.mockImplementation((url: string) => {
      if (url === '/rooms') return Promise.resolve({ data: [] });
      if (url === '/tags') return Promise.resolve({ data: [serverTag] });
      return Promise.reject();
    });

    const offlineTag = {
      id: 'local-offline-tag',
      serverId: null,
      name: 'Work',
      update: jest.fn(async (setter: (t: any) => void) => { setter(offlineTag); }),
    };

    // First query: by server_id → no match
    mockQueryReturnOnce(col.tags.query, []);
    // Second query: by name + null server_id → finds offline tag
    mockQueryReturnOnce(col.tags.query, [offlineTag]);
    mockQueryReturn(col.rooms.query, []);

    await roomRepository.syncFromServer();

    expect(offlineTag.update).toHaveBeenCalledTimes(1);
    expect(offlineTag.serverId).toBe('server-tag-1');
  });

  it('creates a new room with isPinned from server', async () => {
    const serverRoom = makeServerRoom();
    mockHttp.get.mockImplementation((url: string) => {
      if (url === '/rooms') return Promise.resolve({ data: [serverRoom] });
      if (url === '/tags') return Promise.resolve({ data: [] });
      return Promise.reject();
    });

    mockQueryReturn(col.tags.query, []);
    mockQueryReturn(col.rooms.query, []);
    mockQueryReturn(col.roomTags.query, []);

    let capturedRoom: any = {};
    col.rooms.create.mockImplementation((setter: (r: any) => void) => {
      setter(capturedRoom);
      capturedRoom.id = 'local-room-1';
      return capturedRoom;
    });

    await roomRepository.syncFromServer();

    expect(col.rooms.create).toHaveBeenCalledTimes(1);
    expect(capturedRoom.serverId).toBe('server-room-1');
    expect(capturedRoom.isPinned).toBe(false);
  });

  it('updates existing room isPinned from server', async () => {
    const serverRoom = makeServerRoom({ isPinned: true });
    mockHttp.get.mockImplementation((url: string) => {
      if (url === '/rooms') return Promise.resolve({ data: [serverRoom] });
      if (url === '/tags') return Promise.resolve({ data: [] });
      return Promise.reject();
    });

    const existingRoom = {
      id: 'local-room-1',
      serverId: 'server-room-1',
      isPinned: false,
      update: jest.fn(async (setter: (r: any) => void) => { setter(existingRoom); }),
    };

    mockQueryReturn(col.tags.query, []);
    mockQueryReturnOnce(col.rooms.query, [existingRoom]);
    mockQueryReturn(col.rooms.query, []);
    mockQueryReturn(col.roomTags.query, []);

    await roomRepository.syncFromServer();

    expect(existingRoom.update).toHaveBeenCalled();
    expect(existingRoom.isPinned).toBe(true);
  });

  it('joins all rooms via socket after sync', async () => {
    mockHttp.get.mockImplementation((url: string) => {
      if (url === '/rooms') return Promise.resolve({ data: [] });
      if (url === '/tags') return Promise.resolve({ data: [] });
      return Promise.reject();
    });

    // After the write(), query all rooms for socket join
    mockQueryReturn(col.rooms.query, [
      { serverId: 'room-a' },
      { serverId: 'room-b' },
    ]);

    await roomRepository.syncFromServer();

    expect(mockSocketEmit).toHaveBeenCalledWith('room:join', { roomId: 'room-a' });
    expect(mockSocketEmit).toHaveBeenCalledWith('room:join', { roomId: 'room-b' });
  });
});

describe('roomRepository.deleteRoom', () => {
  it('deletes room and related records locally, then syncs to server', async () => {
    const mockRoom = {
      id: 'local-room-1',
      serverId: 'server-room-1',
      messages: { fetch: jest.fn().mockResolvedValue([]) },
      prepareMarkAsDeleted: jest.fn(() => 'room-delete-op'),
    };
    col.rooms.find.mockResolvedValue(mockRoom);
    mockQueryReturn(col.memberships.query, []);
    mockQueryReturn(col.roomTags.query, []);
    mockDb.batch.mockResolvedValue(undefined);
    mockHttp.delete.mockResolvedValue({});

    await roomRepository.deleteRoom('local-room-1');

    expect(mockDb.batch).toHaveBeenCalled();
    expect(mockHttp.delete).toHaveBeenCalledWith('/rooms/server-room-1');
  });

  it('captures serverId before local deletion', async () => {
    const mockRoom = {
      id: 'local-room-1',
      serverId: 'server-room-abc',
      messages: { fetch: jest.fn().mockResolvedValue([]) },
      prepareMarkAsDeleted: jest.fn(() => 'op'),
    };
    col.rooms.find.mockResolvedValue(mockRoom);
    mockQueryReturn(col.memberships.query, []);
    mockQueryReturn(col.roomTags.query, []);
    mockDb.batch.mockResolvedValue(undefined);
    mockHttp.delete.mockResolvedValue({});

    await roomRepository.deleteRoom('local-room-1');

    expect(mockHttp.delete).toHaveBeenCalledWith('/rooms/server-room-abc');
  });

  it('does not throw when server delete fails', async () => {
    const mockRoom = {
      id: 'local-room-1',
      serverId: 'server-room-1',
      messages: { fetch: jest.fn().mockResolvedValue([]) },
      prepareMarkAsDeleted: jest.fn(() => 'op'),
    };
    col.rooms.find.mockResolvedValue(mockRoom);
    mockQueryReturn(col.memberships.query, []);
    mockQueryReturn(col.roomTags.query, []);
    mockDb.batch.mockResolvedValue(undefined);
    mockHttp.delete.mockRejectedValue(new Error('network error'));

    await expect(roomRepository.deleteRoom('local-room-1')).resolves.toBeUndefined();
  });
});

describe('roomRepository.togglePin', () => {
  it('toggles isPinned from false to true', async () => {
    const mockRoom = {
      id: 'local-room-1',
      serverId: 'server-room-1',
      isPinned: false,
      update: jest.fn(async (setter: (r: any) => void) => { setter(mockRoom); }),
    };
    col.rooms.find.mockResolvedValue(mockRoom);
    mockHttp.put.mockResolvedValue({});

    await roomRepository.togglePin('local-room-1');

    expect(mockRoom.update).toHaveBeenCalled();
    expect(mockRoom.isPinned).toBe(true);
    expect(mockHttp.put).toHaveBeenCalledWith('/rooms/server-room-1/pin');
  });

  it('toggles isPinned from true to false', async () => {
    const mockRoom = {
      id: 'local-room-1',
      serverId: 'server-room-1',
      isPinned: true,
      update: jest.fn(async (setter: (r: any) => void) => { setter(mockRoom); }),
    };
    col.rooms.find.mockResolvedValue(mockRoom);
    mockHttp.put.mockResolvedValue({});

    await roomRepository.togglePin('local-room-1');

    expect(mockRoom.isPinned).toBe(false);
  });

  it('does not throw when server sync fails', async () => {
    const mockRoom = {
      id: 'local-room-1',
      serverId: 'server-room-1',
      isPinned: false,
      update: jest.fn(async (setter: (r: any) => void) => { setter(mockRoom); }),
    };
    col.rooms.find.mockResolvedValue(mockRoom);
    mockHttp.put.mockRejectedValue(new Error('offline'));

    await expect(roomRepository.togglePin('local-room-1')).resolves.toBeUndefined();
  });
});

describe('roomRepository.upsertRoom', () => {
  it('creates a new room with isPinned=false when not in local DB', async () => {
    const room = {
      id: 'server-room-new',
      kind: 'dm' as const,
      title: 'New Room',
      createdAt: now,
      updatedAt: now,
      lastMessagePreview: null,
      lastMessageAt: null,
      memberIds: ['user-1', 'user-2'],
    };

    mockQueryReturn(col.rooms.query, []);

    let capturedRecord: any = {};
    col.rooms.create.mockImplementation((setter: (r: any) => void) => {
      setter(capturedRecord);
      return capturedRecord;
    });

    await roomRepository.upsertRoom(room);

    expect(col.rooms.create).toHaveBeenCalledTimes(1);
    expect(capturedRecord.serverId).toBe('server-room-new');
    // BUG FIX VERIFICATION: isPinned must be explicitly set
    expect(capturedRecord.isPinned).toBe(false);
    expect(capturedRecord.createdAt).toBeInstanceOf(Date);
  });

  it('updates existing room when server_id matches', async () => {
    const room = {
      id: 'server-room-1',
      kind: 'dm' as const,
      title: 'Updated Title',
      createdAt: now,
      updatedAt: now + 1000,
      lastMessagePreview: 'new message',
      lastMessageAt: now + 1000,
      memberIds: ['user-1', 'user-2'],
    };

    const existingRoom = {
      id: 'local-room-1',
      title: 'Old Title',
      update: jest.fn(async (setter: (r: any) => void) => { setter(existingRoom); }),
    };

    mockQueryReturn(col.rooms.query, [existingRoom]);

    await roomRepository.upsertRoom(room);

    expect(existingRoom.update).toHaveBeenCalled();
    expect(existingRoom.title).toBe('Updated Title');
    expect(col.rooms.create).not.toHaveBeenCalled();
  });
});
