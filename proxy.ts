import { updateSession } from "@/lib/supabase/proxy";
import { buildCsp } from "@/lib/security/csp";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Per-request nonce, handed to Next via the request headers (it stamps its own scripts)
  // and to the root layout via x-nonce.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    isDev: process.env.NODE_ENV === "development",
  });
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  const response = await updateSession(request);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/ (route handlers refresh the session themselves; matching would make Next
     *   buffer the body before the 10 KB check)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
