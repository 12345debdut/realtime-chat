---
name: clean-architecture
description: |
  Clean architecture skill for React Native apps. Use this when structuring features into domain/data/presentation layers, defining repository interfaces, creating use-case patterns, enforcing dependency rules, and designing feature-first folder structures.
version: "1.0.0"
---

# Clean Architecture — React Native Skill

You are an expert in applying Clean Architecture principles (Uncle Bob) to React Native applications, adapted from ResoCoder's Flutter pattern and Feature-Sliced Design. Use the reference documentation in `references/` for layer definitions, dependency rules, and patterns.

## When to Use This Skill

- Structuring a new feature from scratch
- Deciding where code belongs (which layer, which feature)
- Defining repository interfaces and their implementations
- Creating hooks that act as view models
- Enforcing dependency rules between layers
- Refactoring from a flat structure to feature-first architecture
- Designing the data flow from UI → hook → repository → network/storage

## Core Principles

1. **Feature-First, Vertical Slicing** — Each feature owns its full stack: `data/` (repositories) + `presentation/` (screens, hooks, components). No "all-screens-in-one-folder" horizontal layouts.
2. **Dependency Rule: Inward Only** — Presentation depends on Data. Data depends on Foundation. Foundation depends on nothing. Never reverse these arrows.
3. **Repository Pattern** — Repositories are the ONLY bridge between presentation and infrastructure. Screens never import from `foundation/` directly.
4. **Hooks as View Models** — Custom hooks (`useRooms`, `useChatRoom`) encapsulate all data fetching, state management, and side effects. Screens are thin shells.
5. **Foundation is Infrastructure** — Network (HTTP, Socket), Storage (DB, KV) live in `foundation/`. They are pure infrastructure with zero business logic.
6. **Shared UI is Isolated** — Design system components (`ui/`) have no dependencies on features, data, or foundation.

## Quick Reference

### Feature Structure
```
features/
  chat/
    data/
      RoomRepository.ts          # Composes foundation/network + foundation/storage
      MessageRepository.ts
      SyncEngine.ts              # Orchestrator
    presentation/
      screens/
        ChatListScreen.tsx       # Thin shell — uses hooks + ui/
        ChatRoomScreen.tsx
      components/
        MessageBubble.tsx        # Feature-specific UI
        InputBar.tsx
      hooks/
        useRooms.ts              # View model — calls RoomRepository
        useChatRoom.ts           # View model — calls MessageRepository
```

### Dependency Flow
```
Screen → Hook → Repository → Foundation (network/storage)
  │                              ↑
  └── ui/ components             │ (no reverse)
```

### Repository Pattern
```tsx
// features/chat/data/RoomRepository.ts
import { http } from '@/foundation/network/http';
import { database, collections } from '@/foundation/storage';

export const roomRepository = {
  async syncFromServer(): Promise<void> {
    const { data } = await http.get('/rooms');
    await database.write(async () => {
      await database.batch(
        ...data.rooms.map(room =>
          collections.rooms.prepareCreate(r => { /* ... */ })
        ),
      );
    });
  },
};
```

### Hook as View Model
```tsx
// features/chat/presentation/hooks/useRooms.ts
export function useRooms() {
  const [rooms, setRooms] = useState<RoomModel[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const sub = collections.rooms
      .query(Q.sortBy('updated_at', Q.desc))
      .observe()
      .subscribe(setRooms);
    return () => sub.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await roomRepository.syncFromServer();
    setRefreshing(false);
  }, []);

  return { rooms, refreshing, refresh };
}
```

### Thin Screen
```tsx
// features/chat/presentation/screens/ChatListScreen.tsx
export default function ChatListScreen() {
  const { rooms, refreshing, refresh } = useRooms();
  return (
    <FlatList
      data={rooms}
      renderItem={({ item }) => <ChatListItem room={item} />}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}
```

## Common Mistakes to Avoid

- **Don't import `http` or `database` in screens** — Only repositories touch infrastructure.
- **Don't put business logic in screens** — Extract to hooks or repositories.
- **Don't create "god repositories"** — One repository per aggregate root (Room, Message, Connection, User).
- **Don't share hooks across features without thought** — If a hook serves multiple features, consider if it belongs in a shared layer or if the features should share a data repository.
- **Don't skip the repository layer** — Even for simple GET calls, go through a repository. It's the seam for testing and future offline support.
- **Don't let `foundation/` import from `features/`** — Foundation is the innermost layer. It never knows about features.
