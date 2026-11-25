// Supabase client for the browser.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    // Secure follows the real scheme so cookies still work on http://localhost.
    { cookieOptions: { secure: window.location.protocol === "https:" } },
  );
}
