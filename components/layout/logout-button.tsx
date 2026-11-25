"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "local" });
    // refresh() clears the client router cache, so Back refetches and gets redirected
    // instead of showing the last user's rows.
    router.replace("/auth/login");
    router.refresh();
  };

  return (
    <Button variant="ghost" onClick={logout} className="px-3">
      Log out
    </Button>
  );
}
