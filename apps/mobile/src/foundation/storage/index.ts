import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { MembershipModel } from './models/MembershipModel';
import { MessageModel } from './models/MessageModel';
import { RoomModel } from './models/RoomModel';
import { RoomTagModel } from './models/RoomTagModel';
import { TagModel } from './models/TagModel';
import { UserModel } from './models/UserModel';
import { migrations } from './migrations';
import { schema } from './schema';

const modelClasses = [UserModel, RoomModel, MembershipModel, MessageModel, TagModel, RoomTagModel];

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'rtc',
  // New Architecture: JSI-backed SQLite adapter.
  jsi: true,
  onSetUpError: (error) => {
    // If migration is truly unrecoverable, log and let the app surface the error.
    // The v2→v3 safety-net migration handles the common "stuck at v2 without tables"
    // case, so this handler should rarely fire.
    console.error('[db] setup error — database may need a reinstall', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses,
});

export const collections = {
  users: database.get<UserModel>('users'),
  rooms: database.get<RoomModel>('rooms'),
  memberships: database.get<MembershipModel>('memberships'),
  messages: database.get<MessageModel>('messages'),
  tags: database.get<TagModel>('tags'),
  roomTags: database.get<RoomTagModel>('room_tags'),
};
