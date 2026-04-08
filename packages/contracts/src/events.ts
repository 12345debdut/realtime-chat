/**
 * Socket.IO wire protocol — client ↔ server.
 * All payloads are validated at both ends with the Zod schemas below,
 * so runtime drift between client and server is caught immediately.
 */
import { z } from 'zod';

import { MessageSchema, SendMessageInputSchema } from './messages';
import { ClientIdSchema, IdSchema, TimestampSchema } from './primitives';

// ── Client → Server ────────────────────────────────────────────────────────
export const C2S_MessageSendSchema = SendMessageInputSchema;
export type C2S_MessageSend = z.infer<typeof C2S_MessageSendSchema>;

export const C2S_TypingStartSchema = z.object({ roomId: IdSchema });
export const C2S_TypingStopSchema = z.object({ roomId: IdSchema });

export const C2S_ReadReceiptSchema = z.object({
  roomId: IdSchema,
  upToMessageId: IdSchema,
});

export const C2S_RoomJoinSchema = z.object({ roomId: IdSchema });
export const C2S_RoomLeaveSchema = z.object({ roomId: IdSchema });

// ── Server → Client ────────────────────────────────────────────────────────
export const S2C_MessageNewSchema = z.object({
  message: MessageSchema,
});
export type S2C_MessageNew = z.infer<typeof S2C_MessageNewSchema>;

export const S2C_MessageAckSchema = z.object({
  clientId: ClientIdSchema,
  serverId: IdSchema,
  createdAt: TimestampSchema,
});
export type S2C_MessageAck = z.infer<typeof S2C_MessageAckSchema>;

export const S2C_MessageFailSchema = z.object({
  clientId: ClientIdSchema,
  reason: z.string(),
});
export type S2C_MessageFail = z.infer<typeof S2C_MessageFailSchema>;

export const S2C_TypingSchema = z.object({
  roomId: IdSchema,
  userId: IdSchema,
  typing: z.boolean(),
});
export type S2C_Typing = z.infer<typeof S2C_TypingSchema>;

export const S2C_PresenceSchema = z.object({
  userId: IdSchema,
  online: z.boolean(),
  lastSeenAt: TimestampSchema.nullable(),
});
export type S2C_Presence = z.infer<typeof S2C_PresenceSchema>;

export const S2C_ReadReceiptSchema = z.object({
  roomId: IdSchema,
  userId: IdSchema,
  upToMessageId: IdSchema,
  at: TimestampSchema,
});
export type S2C_ReadReceipt = z.infer<typeof S2C_ReadReceiptSchema>;

/** Canonical event-name constants — single source of truth. */
export const EventNames = {
  // C2S
  MessageSend: 'message:send',
  TypingStart: 'typing:start',
  TypingStop: 'typing:stop',
  ReadReceipt: 'read:receipt',
  RoomJoin: 'room:join',
  RoomLeave: 'room:leave',
  // S2C
  MessageNew: 'message:new',
  MessageAck: 'message:ack',
  MessageFail: 'message:fail',
  Typing: 'typing',
  Presence: 'presence',
  ReadReceiptBroadcast: 'read:receipt:broadcast',
} as const;
export type EventName = (typeof EventNames)[keyof typeof EventNames];
