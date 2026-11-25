// /: sends the visitor to login, the error page, or their role's home.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// The only role router: layouts, and pages that read data, send any role mismatch back here.
export default async function Home() {
  const user = await getCurrentUser(await createClient());
  if (!user) redirect("/auth/login");
  if (!user.role) redirect("/auth/error?error=no_role");
  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}
