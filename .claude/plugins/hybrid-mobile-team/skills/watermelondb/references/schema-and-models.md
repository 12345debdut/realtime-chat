# Schema & Model API Reference

## Schema Definition

```typescript
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,  // Increment on every schema change
  tables: [
    tableSchema({
      name: 'posts',        // Plural snake_case
      columns: [
        { name: 'title', type: 'string' },
        { name: 'subtitle', type: 'string', isOptional: true },
        { name: 'body', type: 'string' },
        { name: 'is_pinned', type: 'boolean' },
        { name: 'author_id', type: 'string', isIndexed: true },
        { name: 'likes', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
```

### Column Types

| Type | JS Default | Null Default | Notes |
|------|-----------|-------------|-------|
| `'string'` | `''` | `null` | Use for text, IDs, enum strings |
| `'number'` | `0` | `null` | Use for counts, timestamps, amounts |
| `'boolean'` | `false` | `null` | Use for flags |

### Column Options

| Option | Type | Description |
|--------|------|-------------|
| `isOptional` | `boolean` | Allow `null` values (default: false) |
| `isIndexed` | `boolean` | Create SQLite index for faster queries (default: false) |

### Naming Conventions

- **Tables**: plural snake_case — `rooms`, `messages`, `connection_requests`
- **Columns**: snake_case — `is_pinned`, `sender_id`, `created_at`
- **Relations**: end with `_id` — `room_id`, `author_id`
- **Booleans**: start with `is_` — `is_read`, `is_pinned`
- **Dates**: end with `_at`, type `number` (Unix timestamp) — `created_at`, `updated_at`

### Auto-managed Columns

- `id` (string) — auto-added, unique identifier
- `_status` — reserved for sync (`created`, `updated`, `synced`)
- `_changed` — reserved for sync (comma-separated changed column names)

### Indexing Rules

Always index:
- Foreign key columns (`_id` suffix)
- Columns used in `Q.where()` frequently
- Columns used in `Q.on()` joins

Avoid indexing:
- Date columns (unless range-queried frequently)
- Large text columns
- Columns rarely filtered on

---

## Model Definition

```typescript
import { Model } from '@nozbe/watermelondb';
import {
  field, text, date, json, readonly, nochange,
  relation, immutableRelation, children, lazy, writer, reader,
} from '@nozbe/watermelondb/decorators';
import { Q } from '@nozbe/watermelondb';

class Post extends Model {
  static table = 'posts';

  static associations = {
    comments: { type: 'has_many', foreignKey: 'post_id' },
    users:    { type: 'belongs_to', key: 'author_id' },
  };

  // Field decorators
  @text('title') title!: string;
  @text('body') body!: string;
  @field('is_pinned') isPinned!: boolean;
  @field('likes') likes!: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  // Relations
  @immutableRelation('users', 'author_id') author!: Relation<User>;
  @children('comments') comments!: Query<Comment>;

  // Lazy (extended query)
  @lazy recentComments = this.comments.extend(
    Q.sortBy('created_at', Q.desc),
    Q.take(10),
  );

  // Computed
  get isPopular() {
    return this.likes > 100;
  }

  // Writer method
  @writer async pin() {
    await this.update(post => {
      post.isPinned = true;
    });
  }

  @writer async addComment(body: string, author: User) {
    return await this.collections.get<Comment>('comments').create(c => {
      c.post.set(this);
      c.author.set(author);
      c.body = body;
    });
  }
}
```

### Decorator Reference

| Decorator | Column Type | JS Type | Notes |
|-----------|-----------|---------|-------|
| `@field(column)` | any | raw value | Generic field |
| `@text(column)` | string | string | Auto-trims whitespace |
| `@date(column)` | number | Date | Converts Unix timestamp ↔ Date |
| `@json(column, sanitizer)` | string | object | JSON serialize/deserialize |
| `@readonly` | any | any | Cannot be changed after create |
| `@nochange` | any | any | Throws if modified after create |
| `@relation(table, column)` | string | Relation | Mutable relation |
| `@immutableRelation(table, column)` | string | Relation | Immutable (better perf) |
| `@children(table)` | — | Query | Has-many query |
| `@lazy` | — | Query | Extended query (on access) |
| `@writer` | — | method | Write action |
| `@reader` | — | method | Read action |

### Association Types

```typescript
// Parent (has_many)
static associations = {
  comments: { type: 'has_many', foreignKey: 'post_id' },
};

// Child (belongs_to)
static associations = {
  posts: { type: 'belongs_to', key: 'post_id' },
};
```

### Relation API

```typescript
// Read
const author = await comment.author.fetch();   // async fetch
const authorId = comment.author.id;             // sync ID access
comment.author.observe();                       // RxJS Observable

// Write (inside create/update block)
comment.author.set(someUser);                   // set by record
comment.author.id = userId;                     // set by ID
```

### Many-to-Many (Pivot Table)

```typescript
// Schema: post_authors table with post_id + user_id columns
class PostAuthor extends Model {
  static table = 'post_authors';
  @immutableRelation('posts', 'post_id') post!: Relation<Post>;
  @immutableRelation('users', 'user_id') user!: Relation<User>;
}
```

---

## Database Initialization

```typescript
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';

const adapter = new SQLiteAdapter({
  schema,
  jsi: true,            // JSI for performance (React Native)
  onSetUpError: (error) => { /* handle */ },
});

const database = new Database({
  adapter,
  modelClasses: [Post, Comment, User],
});

// Export collections for convenience
export const collections = {
  posts: database.get<Post>('posts'),
  comments: database.get<Comment>('comments'),
  users: database.get<User>('users'),
};
```
