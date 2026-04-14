/**
 * Socket.IO wire protocol — client ↔ server.
 * All payloads are validated at both ends with the Zod schemas below,
 * so runtime drift between client and server is caught immediately.
 */
import { z } from 'zod';

import { ConnectionRequestWithUserSchema } from './connections';
import { MessageSchema, SendMessageInputSchema } from './messages';
import { ClientIdSchema, IdSchema, TimestampSchema } from './primitives';
import { RoomSchema } from './rooms';

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

export const C2S_MessageDeleteSchema = z.object({
  messageId: IdSchema,
  roomId: IdSchema,
});
export type C2S_MessageDelete = z.infer<typeof C2S_MessageDeleteSchema>;

/** Client heartbeat — tiny payload, just proves the user is still alive. */
export const C2S_HeartbeatSchema = z.object({});
export type C2S_Heartbeat = z.infer<typeof C2S_HeartbeatSchema>;

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

export const S2C_MessageDeletedSchema = z.object({
  messageId: IdSchema,
  roomId: IdSchema,
  deletedAt: TimestampSchema,
});
export type S2C_MessageDeleted = z.infer<typeof S2C_MessageDeletedSchema>;

// ── Connection request events (S2C) ───────────────────────────────────────
export const S2C_ConnectionRequestNewSchema = z.object({
  request: ConnectionRequestWithUserSchema,
});
export type S2C_ConnectionRequestNew = z.infer<typeof S2C_ConnectionRequestNewSchema>;

export const S2C_ConnectionAcceptedSchema = z.object({
  requestId: IdSchema,
  room: RoomSchema,
});
export type S2C_ConnectionAccepted = z.infer<typeof S2C_ConnectionAcceptedSchema>;

export const S2C_ConnectionRequestRevokedSchema = z.object({
  requestId: IdSchema,
});
export type S2C_ConnectionRequestRevoked = z.infer<typeof S2C_ConnectionRequestRevokedSchema>;

export const S2C_ConnectionRequestExpiredSchema = z.object({
  requestId: IdSchema,
});
export type S2C_ConnectionRequestExpired = z.infer<typeof S2C_ConnectionRequestExpiredSchema>;

/** Canonical event-name constants — single source of truth. */
export const EventNames = {
  // C2S
  MessageSend: 'message:send',
  TypingStart: 'typing:start',
  TypingStop: 'typing:stop',
  ReadReceipt: 'read:receipt',
  RoomJoin: 'room:join',
  RoomLeave: 'room:leave',
  Heartbeat: 'heartbeat',
  // S2C
  MessageNew: 'message:new',
  MessageAck: 'message:ack',
  MessageFail: 'message:fail',
  MessageDelete: 'message:delete',
  MessageDeleted: 'message:deleted',
  Typing: 'typing',
  Presence: 'presence',
  ReadReceiptBroadcast: 'read:receipt:broadcast',
  ConnectionRequestNew: 'connection:request:new',
  ConnectionAccepted: 'connection:accepted',
  ConnectionRequestRevoked: 'connection:request:revoked',
  ConnectionRequestExpired: 'connection:request:expired',
} as const;
export type EventName = (typeof EventNames)[keyof typeof EventNames];
