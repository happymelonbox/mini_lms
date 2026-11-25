// Only same-site relative paths; anything else (absolute URL, //host, /\host) falls back to "/".
export function safeRedirectPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  // Browsers strip tab/newline inside URLs, so "/\t/evil.com" would become "//evil.com".
  if (/[\t\r\n]/.test(next)) return "/";
  return next;
}
