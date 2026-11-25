// Supabase client for server code, bound to the request's cookies.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// A new client per request: never share one across requests.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // Secure follows the real scheme: Safari drops Secure cookies on http://localhost.
      cookieOptions: { secure: process.env.APP_ORIGIN?.startsWith("https:") },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    },
  );
}
