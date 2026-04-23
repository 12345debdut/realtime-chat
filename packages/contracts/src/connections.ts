import { z } from 'zod';

import { PublicUserSchema } from './auth';
import { IdSchema, TimestampSchema } from './primitives';
import { RoomSchema } from './rooms';

export const ConnectionStatusSchema = z.enum(['pending', 'accepted', 'ignored']);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

export const ConnectionRequestSchema = z.object({
  id: IdSchema,
  senderId: IdSchema,
  receiverId: IdSchema,
  status: ConnectionStatusSchema,
  message: z.string().max(500).nullable(),
  createdAt: TimestampSchema,
});
export type ConnectionRequest = z.infer<typeof ConnectionRequestSchema>;

export const ConnectionRequestWithUserSchema = ConnectionRequestSchema.extend({
  sender: PublicUserSchema,
});
export type ConnectionRequestWithUser = z.infer<typeof ConnectionRequestWithUserSchema>;

export const SendConnectionRequestSchema = z.object({
  receiverId: IdSchema,
  message: z.string().max(500).optional(),
});
export type SendConnectionRequest = z.infer<typeof SendConnectionRequestSchema>;

export const RespondConnectionRequestSchema = z.object({
  requestId: IdSchema,
});
export type RespondConnectionRequest = z.infer<typeof RespondConnectionRequestSchema>;

// ── REST API Response types ─────────────────────────────────────────────────

/** POST /connections/request → already connected (existing DM room) */
export const SendConnectionAlreadyConnectedSchema = z.object({
  alreadyConnected: z.literal(true),
  room: RoomSchema,
});
export type SendConnectionAlreadyConnected = z.infer<typeof SendConnectionAlreadyConnectedSchema>;

/** POST /connections/request → new request created */
export const SendConnectionCreatedSchema = z.object({
  request: ConnectionRequestWithUserSchema,
});
export type SendConnectionCreated = z.infer<typeof SendConnectionCreatedSchema>;

/** POST /connections/:id/accept */
export const AcceptConnectionResponseSchema = z.object({
  request: ConnectionRequestSchema.extend({ status: z.literal('accepted') }),
  room: RoomSchema,
});
export type AcceptConnectionResponse = z.infer<typeof AcceptConnectionResponseSchema>;

/** POST /connections/:id/ignore */
export const IgnoreConnectionResponseSchema = z.object({
  success: z.literal(true),
});
export type IgnoreConnectionResponse = z.infer<typeof IgnoreConnectionResponseSchema>;

/** GET /connections → list of accepted peers */
export const ConnectionPeerSchema = z.object({
  id: IdSchema,
  peer: PublicUserSchema,
  createdAt: TimestampSchema,
});
export type ConnectionPeer = z.infer<typeof ConnectionPeerSchema>;

// ── Sent requests ──────────────────────────────────────────────────────────

/** GET /connections/sent → list of pending sent requests with receiver user data */
export const SentConnectionRequestWithUserSchema = ConnectionRequestSchema.extend({
  receiver: PublicUserSchema,
});
export type SentConnectionRequestWithUser = z.infer<typeof SentConnectionRequestWithUserSchema>;

// ── Revoke ─────────────────────────────────────────────────────────────────

/** POST /connections/:id/revoke */
export const RevokeConnectionResponseSchema = z.object({
  success: z.literal(true),
});
export type RevokeConnectionResponse = z.infer<typeof RevokeConnectionResponseSchema>;
