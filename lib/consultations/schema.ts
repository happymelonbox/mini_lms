// Zod schemas shared by the API handlers and the booking form: input, patch actions, list cursors.
import { z } from "zod";

// Zod probes `new Function("")` to decide whether to JIT; our CSP forbids eval, so turn the probe off.
z.config({ jitless: true });

// Shared by the API handlers and the booking form, so both reject the same input.
// NUL and lone surrogates would reach Postgres as a 500, so reject them here.
// A regex, because the ES2024 string method for this is missing before Firefox 119.
const text = z
  .string()
  .trim()
  .refine((v) => !/[\0\p{Cs}]/u.test(v), "Invalid characters");
const name = text.min(1, "Required").max(100, "Max 100 characters");

// Future check lives here (not only in the DB trigger) so the client gets a field error, not a 400 from Postgres.
const futureDate = z.iso
  .datetime({ offset: true, error: "Use an ISO 8601 date-time with timezone offset" })
  .refine((v) => new Date(v).getTime() > Date.now(), "Must be in the future");

// strict(): unknown keys (student_id, status, ...) are rejected, not silently dropped.
export const createSchema = z
  .object({
    firstName: name,
    lastName: name,
    reason: text.min(1, "Required").max(1000, "Max 1000 characters"),
    scheduledAt: futureDate,
  })
  .strict();

export const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("complete") }).strict(),
  z.object({ action: z.literal("incomplete") }).strict(),
  z.object({ action: z.literal("cancel") }).strict(),
  z.object({ action: z.literal("reschedule"), scheduledAt: futureDate }).strict(),
]);

export const idSchema = z.uuid();

export const DEFAULT_PAGE_SIZE = 10;

export type Cursor = { scheduledAt: string; id: string };

// Cursor = base64url("scheduledAt|id"). scheduledAt is the raw string PostgREST returned: a Date round trip
// would cut microseconds and make the next page repeat a row.
export const encodeCursor = (scheduledAt: string, id: string) =>
  btoa(`${scheduledAt}|${id}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Validated here because the parts are interpolated into a PostgREST .or() filter.
const cursor = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,200}$/)
  .transform((s, ctx) => {
    try {
      return atob(s.replace(/-/g, "+").replace(/_/g, "/")).split("|");
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid cursor" });
      return z.NEVER;
    }
  })
  .pipe(z.tuple([z.iso.datetime({ offset: true }), z.uuid()]))
  .transform(([scheduledAt, id]): Cursor => ({ scheduledAt, id }));

export const listQuerySchema = z
  .object({
    after: cursor.optional(),
    before: cursor.optional(),
    pageSize: z.coerce.number().int().min(1).max(50).default(DEFAULT_PAGE_SIZE),
  })
  .refine((q) => !(q.after && q.before), {
    message: "Use either after or before, not both",
    path: ["before"],
  });

export type CreateInput = z.infer<typeof createSchema>;
export type PatchInput = z.infer<typeof patchSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
