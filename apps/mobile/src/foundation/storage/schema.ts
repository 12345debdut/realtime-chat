/**
 * WatermelonDB schema. WatermelonDB is the UI source of truth:
 * every screen observes local tables; the SyncEngine mutates them in
 * response to socket events and outbox drains.
 */
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 5,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'handle', type: 'string' },
        { name: 'display_name', type: 'string' },
        { name: 'avatar_url', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'rooms',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'kind', type: 'string' },
        { name: 'title', type: 'string', isOptional: true },
        { name: 'last_message_preview', type: 'string', isOptional: true },
        { name: 'last_message_at', type: 'number', isOptional: true },
        { name: 'is_pinned', type: 'boolean' },
        { name: 'unread_count', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'tags',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'color', type: 'string' },
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'room_tags',
      columns: [
        { name: 'room_id', type: 'string', isIndexed: true },
        { name: 'tag_id', type: 'string', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'memberships',
      columns: [
        { name: 'room_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'last_read_message_id', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'messages',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'client_id', type: 'string', isIndexed: true },
        { name: 'room_id', type: 'string', isIndexed: true },
        { name: 'author_id', type: 'string', isIndexed: true },
        { name: 'kind', type: 'string' },
        { name: 'body', type: 'string' },
        { name: 'media_url', type: 'string', isOptional: true },
        { name: 'reply_to_id', type: 'string', isOptional: true },
        // pending | sent | delivered | read | failed
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'edited_at', type: 'number', isOptional: true },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
  ],
});
