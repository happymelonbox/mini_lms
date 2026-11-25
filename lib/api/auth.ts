import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser, type CurrentUser, type Role } from "@/lib/auth/current-user";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "./respond";

// 401 when signed out, 403 when the role does not match. Every handler calls this first.
export async function authenticate(
  role: Role,
): Promise<{ supabase: SupabaseClient<Database>; user: CurrentUser } | { response: Response }> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return { response: errorResponse(401, "unauthorized", "Authentication required") };
  if (user.role !== role) return { response: errorResponse(403, "forbidden", "Forbidden") };
  return { supabase, user };
}
