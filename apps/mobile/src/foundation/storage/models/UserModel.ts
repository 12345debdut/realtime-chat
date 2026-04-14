import { Model } from '@nozbe/watermelondb';
import { field, text, date } from '@nozbe/watermelondb/decorators';

export class UserModel extends Model {
  static override table = 'users';

  @field('server_id') serverId!: string;
  @text('handle') handle!: string;
  @text('display_name') displayName!: string;
  @field('avatar_url') avatarUrl!: string | null;
  @date('created_at') createdAt!: Date;
}
