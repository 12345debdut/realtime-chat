import { z } from 'zod';

/** Server-assigned ids are opaque strings (cuid/uuid). */
export const IdSchema = z.string().min(1);
export type Id = z.infer<typeof IdSchema>;

/** Client-generated idempotency key for optimistic writes. */
export const ClientIdSchema = z.string().uuid();
export type ClientId = z.infer<typeof ClientIdSchema>;

/** Unix epoch millis — JSON-safe across wire. */
export const TimestampSchema = z.number().int().nonnegative();
export type Timestamp = z.infer<typeof TimestampSchema>;

export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(30),
});
export type Pagination = z.infer<typeof PaginationSchema>;
