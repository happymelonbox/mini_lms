// All consultation queries: list with keyset pagination, create, update. Rules beyond these live in RLS and triggers.
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesUpdate } from "@/lib/database.types";
import { encodeCursor, type CreateInput, type ListQuery, type PatchInput } from "./schema";

type Db = SupabaseClient<Database>;
type Row = Tables<"consultations">;

// Wire format: camelCase, and student_id is deliberately not exposed.
export type ConsultationDto = {
  id: string;
  firstName: string;
  lastName: string;
  reason: string;
  scheduledAt: string;
  status: Row["status"];
  createdAt: string;
  updatedAt: string;
};

type ListResult = { data: ConsultationDto[]; nextCursor: string | null; prevCursor: string | null };
type Result<T> = { ok: true; value: T } | { ok: false; error: PostgrestError };

const toDto = (r: Row): ConsultationDto => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  reason: r.reason,
  scheduledAt: r.scheduled_at,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// The default view is "everything from now on": a forward page starting just before any real id at this instant.
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

async function list(
  db: Db,
  { after, before, pageSize }: ListQuery,
  studentId?: string,
): Promise<Result<ListResult>> {
  const backward = !!before;
  const from = before ?? after ?? { scheduledAt: new Date().toISOString(), id: NIL_UUID };
  const lt = backward ? "lt" : "gt";
  const { scheduledAt: t, id } = from;
  let q = db.from("consultations").select("*");
  // Redundant with RLS for students on purpose: defence in depth and lets the student_id index be used.
  if (studentId) q = q.eq("student_id", studentId);
  // The bound on scheduled_at alone is what lets Postgres range-scan the index;
  // the .or() alone scans and filters (800 ms at 1M rows).
  const bounded = backward ? q.lte("scheduled_at", t) : q.gte("scheduled_at", t);
  const { data, error } = await bounded
    .or(`scheduled_at.${lt}.${t},and(scheduled_at.eq.${t},id.${lt}.${id})`)
    .order("scheduled_at", { ascending: !backward })
    .order("id", { ascending: !backward })
    .limit(pageSize + 1);
  if (error) return { ok: false, error };

  const more = data.length > pageSize;
  const rows = data.slice(0, pageSize);
  if (backward) rows.reverse();
  const enc = (r: Row | undefined) => (r ? encodeCursor(r.scheduled_at, r.id) : null);
  const [first, last] = [enc(rows[0]), enc(rows[rows.length - 1])];
  const dto = rows.map(toDto);
  if (backward)
    return { ok: true, value: { data: dto, nextCursor: last, prevCursor: more ? first : null } };
  // Earlier is always offered on the default view, even over an empty page:
  // we do not probe for history (no extra query).
  const prevCursor = first ?? (after ? null : encodeCursor(t, id));
  return { ok: true, value: { data: dto, nextCursor: more ? last : null, prevCursor } };
}

export const listOwnConsultations = (db: Db, userId: string, query: ListQuery) =>
  list(db, query, userId);
export const listAllConsultations = (db: Db, query: ListQuery) => list(db, query);

export async function createConsultation(
  db: Db,
  userId: string,
  input: CreateInput,
): Promise<Result<ConsultationDto>> {
  const { data, error } = await db
    .from("consultations")
    .insert({
      student_id: userId, // always from the token, never the body
      first_name: input.firstName,
      last_name: input.lastName,
      reason: input.reason,
      scheduled_at: input.scheduledAt,
    })
    .select()
    .single();
  if (error) return { ok: false, error };
  return { ok: true, value: toDto(data) };
}

/** `value: null` means no row matched (missing or not yours) -> caller answers 404. */
export async function updateConsultation(
  db: Db,
  userId: string,
  id: string,
  patch: PatchInput,
): Promise<Result<ConsultationDto | null>> {
  const changes: TablesUpdate<"consultations"> =
    patch.action === "complete"
      ? { status: "completed" }
      : patch.action === "incomplete"
        ? { status: "scheduled" }
        : patch.action === "cancel"
          ? { status: "cancelled" }
          : { scheduled_at: patch.scheduledAt };
  const { data, error } = await db
    .from("consultations")
    .update(changes)
    .eq("id", id)
    .eq("student_id", userId)
    .select()
    .maybeSingle();
  if (error) return { ok: false, error };
  return { ok: true, value: data ? toDto(data) : null };
}
