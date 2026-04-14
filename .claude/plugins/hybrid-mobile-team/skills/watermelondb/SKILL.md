---
name: watermelondb
description: |
  Offline-first database skill using WatermelonDB. Use this for all local persistence — defining schemas, creating models with decorators, CRUD operations via writers, reactive queries with observe/withObservables, relations, batch operations, and backend synchronization via the sync protocol.
version: "1.0.0"
---

# WatermelonDB — Offline-First Database Skill

You are an expert in WatermelonDB v0.27+ with JSI SQLite adapter on React Native's New Architecture. Use the reference documentation in `references/` for exact API signatures and patterns.

## When to Use This Skill

- Defining database schemas and models
- Creating, reading, updating, deleting records
- Building reactive queries that auto-update UI
- Establishing relations (belongs_to, has_many, many-to-many)
- Batch operations for performance
- Syncing local database with remote server
- Observing records/queries/counts in React components

## Core Principles

1. **Lazy Loading** — Records load only when queried. Never load entire tables into memory.
2. **Reactivity via Observables** — Use `observe()`, `withObservables()`, or `observeWithColumns()` to auto-re-render on changes. Never poll.
3. **All Writes in Writers** — Every create/update/delete MUST happen inside `database.write()` or a `@writer` method. No exceptions.
4. **Batch for Performance** — Group multiple operations with `prepareCreate`/`prepareUpdate` + `batch()` to minimize DB round-trips.
5. **Snake_case Schema, camelCase JS** — Schema columns use `snake_case` (`is_pinned`, `created_at`), model properties use `camelCase` (`isPinned`, `createdAt`).
6. **Index Foreign Keys** — Always `isIndexed: true` on `_id` columns and frequently queried columns.

## Quick Reference

### Schema + Model
```tsx
// schema.ts
tableSchema({
  name: 'messages',
  columns: [
    { name: 'body', type: 'string' },
    { name: 'room_id', type: 'string', isIndexed: true },
    { name: 'sender_id', type: 'string', isIndexed: true },
    { name: 'status', type: 'string' },
    { name: 'created_at', type: 'number' },
  ],
})

// MessageModel.ts
class MessageModel extends Model {
  static table = 'messages';
  static associations = {
    rooms: { type: 'belongs_to', key: 'room_id' },
  };
  @text('body') body!: string;
  @field('status') status!: string;
  @immutableRelation('rooms', 'room_id') room!: Relation<RoomModel>;
  @date('created_at') createdAt!: Date;
}
```

### CRUD
```tsx
// Create (inside writer)
await database.write(async () => {
  await database.get<MessageModel>('messages').create(msg => {
    msg.body = 'Hello';
    msg.room.set(room);
    msg._raw.id = crypto.randomUUID();
  });
});

// Query
const messages = await database.get<MessageModel>('messages')
  .query(Q.where('room_id', roomId), Q.sortBy('created_at', Q.desc))
  .fetch();

// Update
await database.write(async () => {
  await message.update(m => { m.status = 'delivered'; });
});

// Delete
await database.write(async () => {
  await message.markAsDeleted(); // for sync
});
```

### Reactive Observation
```tsx
const enhance = withObservables(['room'], ({ room }) => ({
  room,
  messages: room.messages.extend(Q.sortBy('created_at', Q.desc)),
}));
```

### Batch
```tsx
await database.write(async () => {
  await database.batch(
    ...messages.map(m => m.prepareUpdate(msg => { msg.status = 'read'; })),
  );
});
```

## Common Mistakes to Avoid

- **Don't modify records outside a writer** — Will throw. Always wrap in `database.write()` or use `@writer`.
- **Don't destructure shared values** — `const { body } = record` captures a snapshot, not a reactive reference.
- **Don't forget `isIndexed`** — Queries on unindexed columns are full table scans on large datasets.
- **Don't use `observe()` in non-reactive contexts** — Use `fetch()` for one-shot reads, `observe()` only for subscriptions.
- **Don't mutate raw records** — Always use `update()` or `prepareUpdate()` builder patterns.
- **Don't call `unsafeResetDatabase()` during active sync** — Corrupts sync state.
- **Don't mix `0`/`from` timestamps** — `@date` columns store Unix ms; raw columns store seconds. Be consistent.
