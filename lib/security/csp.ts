// Builds the Content-Security-Policy header for one request.
export function buildCsp({
  nonce,
  supabaseUrl,
  isDev,
}: {
  nonce: string;
  supabaseUrl: string;
  isDev: boolean;
}) {
  const directives = [
    "default-src 'self'",
    // strict-dynamic: scripts loaded by nonced scripts are trusted, so no host allowlist is needed.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // shortcut: inline styles allowed (Tailwind/Radix set style attributes); nonce styles when that is worth the churn
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabaseUrl}${isDev ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  return directives.join("; ");
}
