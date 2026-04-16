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

export const ProfileUpdateSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  bio: z.string().max(280).nullable().optional(),
  email: z.string().email().max(254).nullable().optional(),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).nullable().optional(),
  dateOfBirth: z.string().date().nullable().optional(),
  location: z.string().max(100).nullable().optional(),
});
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;

export const UserSchema = z.object({
  id: IdSchema,
  handle: z.string().min(3).max(32),
  displayName: z.string().min(1).max(64),
  avatarUrl: z.string().url().nullable(),
  bio: z.string().max(280).nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  dateOfBirth: z.string().date().nullable(),
  location: z.string().max(100).nullable(),
  privacy: PrivacySettingsSchema,
  createdAt: TimestampSchema,
});
export type User = z.infer<typeof UserSchema>;

/** Public-facing user shape — excludes personal info (bio, email, phone, etc.) */
export const PublicUserSchema = UserSchema.omit({
  bio: true,
  email: true,
  phone: true,
  dateOfBirth: true,
  location: true,
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

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
