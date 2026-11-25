// Student shell: header plus a role redirect.
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// UX gate only; RLS and the API are the enforcement.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser(await createClient());
  if (user?.role !== "student") redirect("/");
  return (
    <>
      <AppHeader role="student" email={user.email} />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 md:px-6 md:pt-12">{children}</main>
    </>
  );
}
