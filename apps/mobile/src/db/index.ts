import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { MembershipModel } from './models/MembershipModel';
import { MessageModel } from './models/MessageModel';
import { RoomModel } from './models/RoomModel';
import { UserModel } from './models/UserModel';
import { schema } from './schema';

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'rtc',
  // New Architecture: JSI-backed SQLite adapter.
  jsi: true,
  onSetUpError: (error) => {
    console.error('[db] setup error', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [UserModel, RoomModel, MembershipModel, MessageModel],
});

export const collections = {
  users: database.get<UserModel>('users'),
  rooms: database.get<RoomModel>('rooms'),
  memberships: database.get<MembershipModel>('memberships'),
  messages: database.get<MessageModel>('messages'),
};
