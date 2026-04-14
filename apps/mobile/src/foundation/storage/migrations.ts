/**
 * WatermelonDB schema migrations.
 *
 * Every time the schema version is bumped, a matching migration step must be
 * added here so that existing local databases are upgraded in-place instead of
 * being destroyed and recreated (which would wipe all offline data).
 */
import {
  schemaMigrations,
  addColumns,
  createTable,
  unsafeExecuteSql,
} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      // v1 → v2: Add pin support on rooms, tags system (tags + room_tags tables)
      toVersion: 2,
      steps: [
        addColumns({
          table: 'rooms',
          columns: [{ name: 'is_pinned', type: 'boolean' }],
        }),
        createTable({
          name: 'tags',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'color', type: 'string' },
            { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'created_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'room_tags',
          columns: [
            { name: 'room_id', type: 'string', isIndexed: true },
            { name: 'tag_id', type: 'string', isIndexed: true },
          ],
        }),
      ],
    },
    {
      // v2 → v3: Safety-net for devices that were set to v2 before the migration
      // file existed — the tables/columns may be missing. Uses IF NOT EXISTS so
      // it is a no-op on databases that already have the correct schema.
      toVersion: 3,
      steps: [
        unsafeExecuteSql(
          `CREATE TABLE IF NOT EXISTS "tags" ("id" primary key, "_changed" text, "_status" text, "name" text NOT NULL, "color" text NOT NULL, "server_id" text, "created_at" real NOT NULL);`,
        ),
        unsafeExecuteSql(
          `CREATE INDEX IF NOT EXISTS "tags_server_id" ON "tags" ("server_id");`,
        ),
        unsafeExecuteSql(
          `CREATE TABLE IF NOT EXISTS "room_tags" ("id" primary key, "_changed" text, "_status" text, "room_id" text NOT NULL, "tag_id" text NOT NULL);`,
        ),
        unsafeExecuteSql(
          `CREATE INDEX IF NOT EXISTS "room_tags_room_id" ON "room_tags" ("room_id");`,
        ),
        unsafeExecuteSql(
          `CREATE INDEX IF NOT EXISTS "room_tags_tag_id" ON "room_tags" ("tag_id");`,
        ),
      ],
    },
    {
      // v3 → v4: Add unread_count to rooms for badge display
      toVersion: 4,
      steps: [
        addColumns({
          table: 'rooms',
          columns: [{ name: 'unread_count', type: 'number' }],
        }),
      ],
    },
    {
      // v4 → v5: Add deleted_at to messages for soft-delete support
      toVersion: 5,
      steps: [
        addColumns({
          table: 'messages',
          columns: [{ name: 'deleted_at', type: 'number', isOptional: true }],
        }),
      ],
    },
  ],
});
