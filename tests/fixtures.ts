import { PostgrestError } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { ConsultationDto } from "@/lib/consultations/service";

export const consultation = (over: Partial<ConsultationDto> = {}): ConsultationDto => ({
  id: "11111111-1111-4111-8111-111111111111",
  firstName: "Ann",
  lastName: "Lee",
  reason: "Help with my essay",
  scheduledAt: "2999-06-15T12:00:00.000Z",
  status: "scheduled",
  createdAt: "2999-01-01T00:00:00.000Z",
  updatedAt: "2999-01-01T00:00:00.000Z",
  ...over,
});

export const listPage = (
  data: ConsultationDto[],
  nextCursor: string | null = null,
  prevCursor: string | null = null,
) => ({ ok: true as const, value: { data, nextCursor, prevCursor } });

export const users = {
  student: { id: "student-1", role: "student", email: "stu@example.com" },
  admin: { id: "admin-1", role: "admin", email: "boss@example.com" },
  roleless: { id: "u1", role: null, email: "a@b.c" },
} satisfies Record<string, CurrentUser>;

export const dbError = (code = "XX000", message = "boom") =>
  new PostgrestError({ code, message, details: "", hint: "" });
