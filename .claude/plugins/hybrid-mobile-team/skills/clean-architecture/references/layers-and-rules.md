# Clean Architecture — Layers, Rules & Patterns

## The Three Layers

### 1. Foundation Layer (Infrastructure)

The innermost layer. Pure infrastructure with zero business logic. Shared across all features.

```
foundation/
├── network/
│   ├── http.ts              # Axios/fetch client + auth interceptor
│   ├── socket.ts            # Socket.IO client
│   ├── config.ts            # API_URL, SOCKET_URL
│   └── secureStore.ts       # Keychain/Keystore token storage
└── storage/
    ├── index.ts             # Database singleton + collections export
    ├── schema.ts            # WatermelonDB table definitions
    ├── kv.ts                # MMKV key-value store
    └── models/
        ├── RoomModel.ts
        ├── MessageModel.ts
        └── UserModel.ts
```

**Rules:**
- Depends on nothing (no feature imports, no UI imports)
- Exports pure utilities: HTTP client, socket client, DB instance, KV store
- No business logic, no domain concepts
- Any feature's data layer can import from here

---

### 2. Data Layer (Repositories)

Lives inside each feature at `features/<name>/data/`. Bridges presentation to infrastructure.

```
features/chat/data/
├── RoomRepository.ts          # network + storage → domain operations
├── MessageRepository.ts
└── SyncEngine.ts              # Orchestrates real-time sync
```

**Repository Pattern:**

```typescript
// features/chat/data/RoomRepository.ts
import { http } from '@/foundation/network/http';
import { database, collections } from '@/foundation/storage';
import { Q } from '@nozbe/watermelondb';

export const roomRepository = {
  /** Fetches rooms from server and upserts into local DB */
  async syncFromServer(): Promise<void> {
    const { data } = await http.get('/rooms');
    await database.write(async () => {
      // Upsert logic using batch
    });
  },

  /** Observes rooms sorted by last activity */
  observeAll() {
    return collections.rooms
      .query(Q.sortBy('updated_at', Q.desc))
      .observe();
  },

  /** Gets a single room by ID */
  async findById(roomId: string) {
    return collections.rooms.find(roomId);
  },
};
```

**Rules:**
- Imports FROM `foundation/network/` and `foundation/storage/`
- Never imports from `presentation/` (no hooks, no screens, no UI)
- Never imports from other features' data layers (unless explicitly designed for cross-feature sharing)
- One repository per aggregate root: `RoomRepository`, `MessageRepository`, `ConnectionRepository`, `UserRepository`
- Repositories are the ONLY place that touches both network and storage

---

### 3. Presentation Layer (UI)

Lives inside each feature at `features/<name>/presentation/`. Contains screens, components, and hooks.

```
features/chat/presentation/
├── screens/
│   ├── ChatListScreen.tsx       # Thin shell
│   └── ChatRoomScreen.tsx
├── components/
│   ├── MessageBubble.tsx        # Feature-specific UI
│   ├── InputBar.tsx
│   └── TypingDots.tsx
├── hooks/
│   ├── useRooms.ts              # View model
│   └── useChatRoom.ts
└── state/
    └── chatStore.ts             # Zustand (if needed)
```

**Rules:**
- Imports FROM its own `data/` layer (repository) and shared `ui/`
- Never imports from `foundation/` directly (no `http`, no `database`, no `socket`)
- Screens are thin shells — delegate all logic to hooks
- Feature-specific components live here; shared components live in `ui/`

---

## Dependency Rule Diagram

```
┌─────────────────────────────────────────────────┐
│                 Presentation                     │
│   screens → hooks → repositories                 │
│   screens → ui/ (shared design system)           │
├─────────────────────────────────────────────────┤
│                    Data                          │
│   repositories → foundation/network              │
│   repositories → foundation/storage              │
├─────────────────────────────────────────────────┤
│                 Foundation                        │
│   network (http, socket, secureStore)            │
│   storage (database, schema, models, kv)         │
│   → depends on NOTHING                           │
└─────────────────────────────────────────────────┘
```

**Arrows point inward only. Never reverse.**

---

## Shared Layers (Outside Features)

### ui/ — Design System
```
ui/
├── theme/
│   ├── ThemeProvider.tsx
│   └── tokens.ts
├── Avatar.tsx
├── Button.tsx
├── Text.tsx
├── SearchBar.tsx
├── PressableScale.tsx
└── index.ts
```
- Zero dependencies on features, data, or foundation
- Pure presentational components with theme tokens
- If a feature-specific widget becomes reusable, lift it here

### navigation/ — App Navigation
```
navigation/
├── RootNavigator.tsx
├── TabNavigator.tsx
└── types.ts
```
- Imports screens from `features/*/presentation/screens/`
- Imports shared UI from `ui/`

### lib/ — Pure Utilities
```
lib/
├── logger.ts
└── formatTime.ts
```
- Zero dependencies. Pure functions. No side effects.

---

## The Hook-as-ViewModel Pattern

Hooks bridge repositories (data layer) to screens (presentation layer):

```typescript
// features/connections/presentation/hooks/useConnections.ts
import { useState, useEffect, useCallback } from 'react';
import { connectionRepository } from '../../data/ConnectionRepository';
import { onSyncEvent } from '@/features/chat/data/SyncEngine';

export function useConnections() {
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPending = useCallback(async () => {
    const data = await connectionRepository.getPending();
    setRequests(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPending();
    const unsub = onSyncEvent('connection:request:new', fetchPending);
    return unsub;
  }, [fetchPending]);

  const accept = useCallback(async (id: string) => {
    await connectionRepository.accept(id);
    setRequests(prev => prev.filter(r => r.id !== id));
  }, []);

  const ignore = useCallback(async (id: string) => {
    await connectionRepository.ignore(id);
    setRequests(prev => prev.filter(r => r.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPending();
    setRefreshing(false);
  }, [fetchPending]);

  return { requests, loading, refreshing, accept, ignore, refresh };
}
```

### Screen Consuming the Hook

```typescript
// features/connections/presentation/screens/ConnectionsScreen.tsx
export default function ConnectionsScreen() {
  const { requests, loading, refreshing, accept, ignore, refresh } = useConnections();

  if (loading) return <LoadingSpinner />;

  return (
    <FlatList
      data={requests}
      renderItem={({ item }) => (
        <ConnectionCard
          request={item}
          onAccept={() => accept(item.id)}
          onIgnore={() => ignore(item.id)}
        />
      )}
      refreshing={refreshing}
      onRefresh={refresh}
      ListEmptyComponent={<EmptyState message="No pending requests" />}
    />
  );
}
```

---

## Cross-Feature Communication

When features need to interact (e.g., chat feature reacts to connection acceptance):

**Preferred: Event Bus**
```typescript
// Feature A emits
emitSyncEvent('connection:accepted', { roomId });

// Feature B subscribes
onSyncEvent('connection:accepted', ({ roomId }) => {
  roomRepository.syncFromServer();
});
```

**Acceptable: Direct repository import (sparingly)**
```typescript
// chat/data/SyncEngine.ts imports from connections/data/ when needed
import { connectionRepository } from '@/features/connections/data/ConnectionRepository';
```

**Never: Screen-to-screen direct imports**

---

## Feature Checklist

When creating a new feature, create these in order:

1. **Schema** — Add table to `foundation/storage/schema.ts`
2. **Model** — Create in `foundation/storage/models/`
3. **Repository** — Create `features/<name>/data/<Name>Repository.ts`
4. **Hook** — Create `features/<name>/presentation/hooks/use<Name>.ts`
5. **Screen** — Create `features/<name>/presentation/screens/<Name>Screen.tsx`
6. **Navigation** — Wire screen into navigator
7. **Components** — Extract feature-specific UI into `presentation/components/`

---

## Anti-Patterns

| Anti-Pattern | Why It's Wrong | Correct Approach |
|-------------|---------------|-----------------|
| Screen imports `http` directly | Skips repository, untestable | Screen → Hook → Repository → http |
| Screen imports `database` directly | Couples UI to persistence | Screen → Hook → Repository → database |
| Repository imports React hooks | Data layer is framework-agnostic | Keep repos as plain async functions |
| One mega repository for everything | God object, hard to test | One repo per aggregate root |
| Horizontal folders (all screens together) | Features can't be isolated or extracted | Feature-first vertical slicing |
| Hook does HTTP calls directly | Duplicates logic, untestable | Hook calls repository methods |
| foundation/ imports from features/ | Circular dependency | Foundation is the innermost layer |
