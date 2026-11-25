// Session refresh and signed-out redirect used by proxy.ts.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // A new client per request: never share one across requests.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { secure: process.env.APP_ORIGIN?.startsWith("https:") },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Nothing may run between createServerClient and getClaims(): it refreshes the session cookies.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // Convenience redirect only, not authorisation: every route and page re-checks.
  if (!user && !request.nextUrl.pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    // Drop the old query: on a Back navigation it carries Next's internal `_rsc` key into the address bar.
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Return this exact response object (or copy its cookies), or the browser and server sessions drift apart.
  return supabaseResponse;
}
