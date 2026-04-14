# Sync API Reference

## synchronize()

Bidirectional sync between WatermelonDB and a remote server.

```typescript
import { synchronize } from '@nozbe/watermelondb/sync';

await synchronize({
  database,
  pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
    const response = await fetch(
      `${API_URL}/sync?last_pulled_at=${lastPulledAt ?? 0}&schema_version=${schemaVersion}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error(await response.text());
    const { changes, timestamp } = await response.json();
    return { changes, timestamp };
  },
  pushChanges: async ({ changes, lastPulledAt }) => {
    const response = await fetch(`${API_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ changes, lastPulledAt }),
    });
    if (!response.ok) throw new Error(await response.text());
  },
  migrationsEnabledAtVersion: 1,
});
```

### pullChanges

**Receives:**
```typescript
{
  lastPulledAt: number | null;   // null on first sync
  schemaVersion: number;
  migration: { from: number; tables: string[]; columns: { table: string; columns: string[] }[] } | null;
}
```

**Must return:**
```typescript
{
  changes: SyncDatabaseChangeSet;  // See format below
  timestamp: number;               // Server's current timestamp
}
```

### pushChanges

**Receives:**
```typescript
{
  changes: SyncDatabaseChangeSet;  // Local changes since last sync
  lastPulledAt: number;            // Timestamp from last successful pull
}
```

**Must return:** Promise that resolves on success, rejects on failure.

---

## SyncDatabaseChangeSet Format

```typescript
type SyncDatabaseChangeSet = {
  [tableName: string]: {
    created: RawRecord[];      // New records
    updated: RawRecord[];      // Modified records
    deleted: string[];         // IDs of deleted records
  };
};

// Example:
{
  rooms: {
    created: [
      { id: 'abc', title: 'General', kind: 'group', _status: 'synced', _changed: '' },
    ],
    updated: [
      { id: 'def', title: 'Updated Room', kind: 'dm', _status: 'synced', _changed: '' },
    ],
    deleted: ['ghi'],
  },
  messages: {
    created: [],
    updated: [],
    deleted: [],
  },
}
```

---

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `database` | Database | WatermelonDB instance |
| `pullChanges` | Function | Fetch server changes |
| `pushChanges` | Function | Send local changes |
| `migrationsEnabledAtVersion` | number | Schema version before first migration |
| `sendCreatedAsUpdated` | boolean | Don't differentiate create/update in push |
| `conflictResolver` | Function | Custom conflict resolution |
| `onDidPullChanges` | Function | Callback after pull with extra response data |
| `onWillApplyRemoteChanges` | Function | Called before applying pulled changes |
| `log` | object | Sync logging object |
| `unsafeTurbo` | boolean | Enable turbo mode (first sync only, JSI required) |
| `_unsafeBatchPerCollection` | boolean | Split saves per collection (breaks transaction) |

---

## Conflict Resolution

```typescript
synchronize({
  database,
  conflictResolver: (tableName, local, remote, resolved) => {
    // `resolved` is WatermelonDB's default resolution (server wins)
    // Return a modified record to override
    if (tableName === 'messages' && local.status === 'failed') {
      return { ...resolved, status: local.status };
    }
    return resolved;
  },
});
```

---

## Extra Data in Pull Response

```typescript
synchronize({
  database,
  pullChanges: async (params) => {
    const response = await fetch(`${API_URL}/sync?...`);
    const { changes, timestamp, unreadCount, serverVersion } = await response.json();
    return { changes, timestamp, unreadCount, serverVersion };
  },
  onDidPullChanges: async ({ unreadCount, serverVersion }) => {
    // Process extra data after sync applies
    badgeStore.setCount(unreadCount);
  },
});
```

---

## Turbo Sync (First Login Only)

Up to 5.3x faster for initial sync. Requires JSI SQLite adapter.

```typescript
const isFirstSync = lastPulledAt === null;

await synchronize({
  database,
  pullChanges: async ({ lastPulledAt }) => {
    const response = await fetch(`${API_URL}/sync?...`);
    if (isFirstSync) {
      return { syncJson: await response.text() };
    }
    return await response.json();
  },
  unsafeTurbo: isFirstSync,
});
```

**Constraints:**
- JSI adapter required (no web, no Chrome debugging)
- Cannot be used for incremental syncs
- `deleted: []` must be empty in response
- Cannot combine with replacement sync

---

## Replacement Sync

Replace all local data (useful after permission changes or fixing sync state):

```typescript
pullChanges: async () => ({
  changes: { /* full dataset */ },
  timestamp: serverTimestamp,
  experimentalStrategy: 'replacement',
}),
```

- Replaces all records except locally-unpushed changes
- Deletes local records absent from server response
- Preserves locally-created records for next push

---

## Utilities

### Check for Unsynced Changes
```typescript
import { hasUnsyncedChanges } from '@nozbe/watermelondb/sync';

const hasLocal = await hasUnsyncedChanges({ database });
// true if any records need to be pushed
```

### Sync Logger
```typescript
import SyncLogger from '@nozbe/watermelondb/sync/SyncLogger';

const logger = new SyncLogger(10);
const log = logger.newLog();

await synchronize({ database, log, ... });

console.log(logger.formattedLogs); // Pretty-printed sync history
```

---

## Best Practices

- **Never call `synchronize()` concurrently** — it safely aborts if already running
- **Retry on push failure** — wrap in "retry once" logic
- **Debounce local-change-triggered syncs** — use `database.withChangesForTables` with throttle
- **Never reset DB during sync** — corrupts state
- **Censor logs** — they may contain user data
- **Delete migrations never** — old clients need them to sync correctly
- **Use `sendCreatedAsUpdated: true`** if your backend doesn't distinguish create vs update
