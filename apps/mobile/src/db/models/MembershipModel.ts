import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class MembershipModel extends Model {
  static override table = 'memberships';

  @field('room_id') roomId!: string;
  @field('user_id') userId!: string;
  @field('last_read_message_id') lastReadMessageId!: string | null;
}
