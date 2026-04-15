import { z } from 'zod';

import { IdSchema, TimestampSchema } from './primitives';

export const PrivacySettingsSchema = z.object({
  readReceiptsEnabled: z.boolean(),
  onlineStatusVisible: z.boolean(),
  typingIndicatorsEnabled: z.boolean(),
});
export type PrivacySettings = z.infer<typeof PrivacySettingsSchema>;

export const PrivacySettingsUpdateSchema = PrivacySettingsSchema.partial();
export type PrivacySettingsUpdate = z.infer<typeof PrivacySettingsUpdateSchema>;

export const UserSchema = z.object({
  id: IdSchema,
  handle: z.string().min(3).max(32),
  displayName: z.string().min(1).max(64),
  avatarUrl: z.string().url().nullable(),
  privacy: PrivacySettingsSchema,
  createdAt: TimestampSchema,
});
export type User = z.infer<typeof UserSchema>;

export const RegisterRequestSchema = z.object({
  handle: z.string().min(3).max(32).regex(/^[a-z0-9_]+$/i),
  displayName: z.string().min(1).max(64),
  password: z.string().min(8).max(128),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  handle: z.string().min(3).max(32),
  password: z.string().min(8).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: TimestampSchema,
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const AuthResponseSchema = z.object({
  user: UserSchema,
  tokens: AuthTokensSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const RefreshRequestSchema = z.object({
  refreshToken: z.string(),
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
