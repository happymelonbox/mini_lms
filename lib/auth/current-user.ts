import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Constants } from "@/lib/database.types";

const roleSchema = z.enum(Constants.public.Enums.app_role);
export type Role = z.infer<typeof roleSchema>;
export type CurrentUser = { id: string; role: Role | null; email: string | undefined };

// Identity and role come only from verified JWT claims (never getSession, never the request body).
// Unknown or missing role -> null, which every role-gated route treats as 403.
export async function getCurrentUser(
  supabase: Pick<SupabaseClient, "auth">,
): Promise<CurrentUser | null> {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const role = roleSchema.safeParse(claims.user_role);
  return { id: claims.sub, role: role.success ? role.data : null, email: claims.email };
}
