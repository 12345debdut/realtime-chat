import { Model } from '@nozbe/watermelondb';
import { children, date, field, text } from '@nozbe/watermelondb/decorators';
import type { Query } from '@nozbe/watermelondb';

import type { MessageModel } from './MessageModel';

export class RoomModel extends Model {
  static override table = 'rooms';
  static override associations = {
    messages: { type: 'has_many' as const, foreignKey: 'room_id' },
    memberships: { type: 'has_many' as const, foreignKey: 'room_id' },
    room_tags: { type: 'has_many' as const, foreignKey: 'room_id' },
  };

  @field('server_id') serverId!: string;
  @field('kind') kind!: 'dm' | 'group';
  @text('title') title!: string | null;
  @text('last_message_preview') lastMessagePreview!: string | null;
  @field('last_message_at') lastMessageAt!: number | null;
  @field('is_pinned') isPinned!: boolean;
  @field('unread_count') unreadCount!: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @children('messages') messages!: Query<MessageModel>;
}
