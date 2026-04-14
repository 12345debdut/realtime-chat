import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class RoomTagModel extends Model {
  static override table = 'room_tags';
  static override associations = {
    rooms: { type: 'belongs_to' as const, key: 'room_id' },
    tags: { type: 'belongs_to' as const, key: 'tag_id' },
  };

  @field('room_id') roomId!: string;
  @field('tag_id') tagId!: string;
}
