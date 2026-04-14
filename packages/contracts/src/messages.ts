import { z } from 'zod';

import { ClientIdSchema, IdSchema, TimestampSchema } from './primitives';

export const MessageStatusSchema = z.enum(['pending', 'sent', 'delivered', 'read', 'failed']);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;

export const MessageKindSchema = z.enum(['text', 'image', 'system']);
export type MessageKind = z.infer<typeof MessageKindSchema>;

export const MessageSchema = z.object({
  id: IdSchema,
  clientId: ClientIdSchema,
  roomId: IdSchema,
  authorId: IdSchema,
  kind: MessageKindSchema,
  body: z.string().max(4000),
  mediaUrl: z.string().url().nullable(),
  replyToId: IdSchema.nullable(),
  status: MessageStatusSchema,
  createdAt: TimestampSchema,
  editedAt: TimestampSchema.nullable(),
  deletedAt: TimestampSchema.nullable(),
});
export type Message = z.infer<typeof MessageSchema>;

export const SendMessageInputSchema = z.object({
  clientId: ClientIdSchema,
  roomId: IdSchema,
  kind: MessageKindSchema.default('text'),
  body: z.string().min(1).max(4000),
  mediaUrl: z.string().url().optional(),
  replyToId: IdSchema.optional(),
});
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;
