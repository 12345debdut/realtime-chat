import { z } from 'zod';

import { UserSchema } from './auth';
import { IdSchema, TimestampSchema } from './primitives';

export const RoomKindSchema = z.enum(['dm', 'group']);
export type RoomKind = z.infer<typeof RoomKindSchema>;

export const RoomSchema = z.object({
  id: IdSchema,
  kind: RoomKindSchema,
  title: z.string().min(1).max(120).nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  lastMessagePreview: z.string().max(280).nullable(),
  lastMessageAt: TimestampSchema.nullable(),
  memberIds: z.array(IdSchema).min(2),
});
export type Room = z.infer<typeof RoomSchema>;

export const RoomWithMembersSchema = RoomSchema.extend({
  members: z.array(UserSchema),
});
export type RoomWithMembers = z.infer<typeof RoomWithMembersSchema>;

export const CreateRoomRequestSchema = z.object({
  kind: RoomKindSchema,
  title: z.string().min(1).max(120).optional(),
  memberIds: z.array(IdSchema).min(1).max(128),
});
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;

// Tags
export const TagSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(30),
  color: z.string(),
  createdAt: TimestampSchema,
});
export type Tag = z.infer<typeof TagSchema>;

export const CreateTagRequestSchema = z.object({
  name: z.string().min(1).max(30).trim(),
  color: z.string().optional(),
});
export type CreateTagRequest = z.infer<typeof CreateTagRequestSchema>;

export const AddTagToRoomRequestSchema = z.object({
  tagId: IdSchema,
});
export type AddTagToRoomRequest = z.infer<typeof AddTagToRoomRequestSchema>;

// Extended room with pin/tag metadata
export const RoomWithMetaSchema = RoomSchema.extend({
  isPinned: z.boolean(),
  tags: z.array(TagSchema),
  unreadCount: z.number().int().min(0),
});
export type RoomWithMeta = z.infer<typeof RoomWithMetaSchema>;
