import { Model } from '@nozbe/watermelondb';
import { date, field, text } from '@nozbe/watermelondb/decorators';

import type { MessageStatus } from '@rtc/contracts';

export class MessageModel extends Model {
  static override table = 'messages';
  static override associations = {
    rooms: { type: 'belongs_to' as const, key: 'room_id' },
  };

  @field('server_id') serverId!: string | null;
  @field('client_id') clientId!: string;
  @field('room_id') roomId!: string;
  @field('author_id') authorId!: string;
  @field('kind') kind!: 'text' | 'image' | 'system';
  @text('body') body!: string;
  @field('media_url') mediaUrl!: string | null;
  @field('reply_to_id') replyToId!: string | null;
  @field('status') status!: MessageStatus;
  @date('created_at') createdAt!: Date;
  @date('edited_at') editedAt!: Date | null;
  @date('deleted_at') deletedAt!: Date | null;
}
