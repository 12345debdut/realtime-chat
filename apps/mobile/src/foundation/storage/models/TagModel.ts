import { Model } from '@nozbe/watermelondb';
import { date, field, text } from '@nozbe/watermelondb/decorators';

export class TagModel extends Model {
  static override table = 'tags';
  static override associations = {
    room_tags: { type: 'has_many' as const, foreignKey: 'tag_id' },
  };

  @text('name') name!: string;
  @field('color') color!: string;
  @field('server_id') serverId!: string | null;
  @date('created_at') createdAt!: Date;
}
