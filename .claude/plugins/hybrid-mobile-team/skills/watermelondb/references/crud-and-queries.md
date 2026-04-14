# CRUD & Query API Reference

## Writers & Readers

All database modifications MUST happen inside a writer. Reads can happen anywhere but readers guarantee consistency.

### database.write()

```typescript
const result = await database.write(async () => {
  // All creates, updates, deletes go here
  const post = await database.get<Post>('posts').create(p => {
    p.title = 'Hello';
    p.body = 'World';
  });
  return post;
});
```

### database.read()

```typescript
// Guarantees no writes happen during this block
const data = await database.read(async () => {
  const posts = await database.get<Post>('posts').query().fetch();
  const comments = await database.get<Comment>('comments').query().fetch();
  return { posts, comments };
});
```

### @writer / @reader Decorators

```typescript
class Post extends Model {
  @writer async markAsPinned() {
    await this.update(p => { p.isPinned = true; });
  }

  @reader async exportData() {
    const comments = await this.comments.fetch();
    return { title: this.title, comments: comments.map(c => c.body) };
  }
}
```

### Nested Writers

```typescript
class Comment extends Model {
  @writer async appendToPost() {
    const post = await this.post.fetch();
    // callWriter to invoke another writer from within a writer
    await this.callWriter(() => post.appendBody(this.body));
  }
}
```

---

## Create

```typescript
await database.write(async () => {
  const post = await database.get<Post>('posts').create(p => {
    p.title = 'New post';
    p.body = 'Content here';
    p.isPinned = false;
    p.author.set(currentUser);
    // Custom ID (optional):
    p._raw.id = crypto.randomUUID();
  });
});
```

## Read

### Find by ID
```typescript
const post = await database.get<Post>('posts').find(postId);
// Throws if not found
```

### Find and Observe
```typescript
// Fetch + subscribe in one call (for withObservables)
database.get<Post>('posts').findAndObserve(postId);
```

### Query
```typescript
// Fetch all
const allPosts = await database.get<Post>('posts').query().fetch();

// Fetch with conditions
const pinnedPosts = await database.get<Post>('posts')
  .query(Q.where('is_pinned', true))
  .fetch();

// Count
const count = await database.get<Post>('posts')
  .query(Q.where('is_pinned', true))
  .fetchCount();

// IDs only
const ids = await database.get<Post>('posts')
  .query(Q.where('is_pinned', true))
  .fetchIds();
```

## Update

```typescript
await database.write(async () => {
  await post.update(p => {
    p.title = 'Updated title';
    p.isPinned = true;
  });
});
```

## Delete

```typescript
await database.write(async () => {
  // For synced apps — marks as deleted, sync pushes deletion
  await post.markAsDeleted();

  // Permanent — bypasses sync, removes immediately
  await post.destroyPermanently();
});
```

## Batch Operations

Group multiple operations into a single DB transaction:

```typescript
await database.write(async () => {
  await database.batch(
    // Create
    database.get<Post>('posts').prepareCreate(p => {
      p.title = 'Batch post';
    }),

    // Update
    existingPost.prepareUpdate(p => {
      p.isPinned = true;
    }),

    // Delete
    oldPost.prepareMarkAsDeleted(),

    // Spread arrays
    ...comments.map(c => c.prepareUpdate(c2 => { c2.isRead = true; })),
  );
});
```

**Prepared operations:**
- `collection.prepareCreate(builder)` — instead of `await collection.create()`
- `record.prepareUpdate(builder)` — instead of `await record.update()`
- `record.prepareMarkAsDeleted()` — instead of `await record.markAsDeleted()`
- `record.prepareDestroyPermanently()` — instead of `await record.destroyPermanently()`

Falsy values (null, undefined, false) in batch are silently ignored.

---

## Query API (Q)

```typescript
import { Q } from '@nozbe/watermelondb';
```

### Q.where — Filter

```typescript
Q.where('is_pinned', true)                    // Equality (shorthand)
Q.where('is_pinned', Q.eq(true))              // Equality (explicit)
Q.where('status', Q.notEq(null))              // Not equal
Q.where('likes', Q.gt(0))                     // Greater than
Q.where('likes', Q.gte(100))                  // Greater than or equal
Q.where('likes', Q.lt(50))                    // Less than
Q.where('likes', Q.lte(50))                   // Less than or equal
Q.where('likes', Q.weakGt(0))                 // Greater than (null-safe)
Q.where('likes', Q.between(10, 100))          // Between (inclusive)
Q.where('status', Q.oneOf(['draft', 'pub']))   // IN array
Q.where('status', Q.notIn(['archived']))        // NOT IN array
```

### Text Search (LIKE)

```typescript
// Case-insensitive prefix search
Q.where('username', Q.like(`${Q.sanitizeLikeString(query)}%`))

// Contains
Q.where('body', Q.like(`%${Q.sanitizeLikeString(query)}%`))

// Not like
Q.where('status', Q.notLike('%draft%'))
```

**Always use `Q.sanitizeLikeString()` with user input!**

### Column Comparison

```typescript
Q.where('likes', Q.gt(Q.column('dislikes')))
```

### Logical Operators

```typescript
// AND (implicit — multiple Q.where = AND)
collection.query(
  Q.where('is_pinned', true),
  Q.where('is_published', true),
)

// OR
collection.query(
  Q.or(
    Q.where('is_pinned', true),
    Q.where('likes', Q.gt(100)),
  ),
)

// AND + OR nested
collection.query(
  Q.where('is_published', true),
  Q.or(
    Q.where('is_pinned', true),
    Q.and(
      Q.where('likes', Q.gt(10)),
      Q.where('dislikes', Q.lt(5)),
    ),
  ),
)
```

### Sorting & Pagination

```typescript
Q.sortBy('created_at', Q.desc)    // Sort descending
Q.sortBy('title', Q.asc)          // Sort ascending
Q.skip(20)                         // Offset
Q.take(10)                         // Limit
```

### JOIN — Related Table Queries

```typescript
// Comments where the parent post has author_id = john.id
database.get<Comment>('comments').query(
  Q.on('posts', 'author_id', john.id),
)

// With multiple conditions on related table
database.get<Comment>('comments').query(
  Q.on('posts', [
    Q.where('author_id', john.id),
    Q.where('is_published', true),
  ]),
)

// JOIN with OR across tables
tasksCollection.query(
  Q.experimentalJoinTables(['projects']),
  Q.or(
    Q.where('is_followed', true),
    Q.on('projects', 'is_followed', true),
  ),
)

// Deep nested JOIN
tasksCollection.query(
  Q.experimentalNestedJoin('projects', 'teams'),
  Q.on('projects', Q.on('teams', 'name', 'Engineering')),
)
```

### Extended Queries (on Model)

```typescript
@lazy recentMessages = this.messages.extend(
  Q.sortBy('created_at', Q.desc),
  Q.take(50),
);
```

### Unsafe SQL (Escape Hatch)

```typescript
database.get<Comment>('comments').query(
  Q.unsafeSqlQuery(
    `SELECT * FROM comments WHERE foo IS NOT ? AND _status IS NOT 'deleted'`,
    ['bar'],
  ),
).fetch();
```

---

## Observation (Reactive)

### Record
```typescript
record.observe()                              // Observable<Record>
```

### Query
```typescript
query.observe()                               // Observable<Record[]> — re-emits on add/remove
query.observeWithColumns(['likes', 'status']) // Also re-emits on column changes
query.observeCount()                          // Observable<number>
```

### Relation
```typescript
comment.author.observe()                      // Observable<User>
```

### In React (withObservables)

```typescript
import { withObservables } from '@nozbe/watermelondb/react';

const enhance = withObservables(['post'], ({ post }) => ({
  post,                                    // auto-observe record
  comments: post.comments,                  // auto-observe query
  commentCount: post.comments.observeCount(),
  author: post.author,                      // auto-observe relation
}));

export default enhance(PostComponent);
```

### Database Provider + useDatabase Hook

```typescript
import { DatabaseProvider, useDatabase } from '@nozbe/watermelondb/react';

// Wrap app
<DatabaseProvider database={database}>
  <App />
</DatabaseProvider>

// Use in component
const db = useDatabase();
```

---

## Reset

```typescript
// Destroys ALL data. Use for logout (different user) or dev reset.
await database.write(() => database.unsafeResetDatabase());
```

**Never call during active sync.**
