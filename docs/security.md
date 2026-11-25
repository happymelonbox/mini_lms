# Security

The design assumes any layer above Postgres can fail, so the database refuses unsafe requests on its own.

## Threats and controls

- **A student reads or edits another student's rows.** Control: RLS: student policies require `auth.uid() = student_id`. The API also filters by `student_id`. Where: `0003_policies.sql`, `lib/consultations/service.ts`
- **A student edits fields they should not (names, reason, `created_at`, `student_id`, a row created as `completed`).** Control: Column-level grants: insert only five columns, update only `status` and `scheduled_at`. Where: `0003_policies.sql`
- **A new table or function is exposed to the Data API by default.** Control: Default privileges revoked from `anon` and `authenticated`, function `EXECUTE` revoked from `PUBLIC`. Every grant is explicit. Where: `0001_roles.sql`, tested in `roles.test.sql`
- **Privilege escalation to admin.** Control: The role lives in `user_roles`, which API roles cannot read or write. Only a SQL statement can promote a user. The hook never reads `user_metadata`. Where: `0001_roles.sql`
- **A user with no role row gets access.** Control: The hook emits a null role. RLS and `getCurrentUser` both treat it as no access. Where: [roles-and-access](roles-and-access.md)
- **Admin writes through a stolen or misused token.** Control: No policy gives an admin write access, and student policies require the student claim. The admin view can only read. Where: `0003_policies.sql`
- **Status rule bypass (cancelled row revived, completed row cancelled).** Control: `guard_consultation_update` trigger enforces the state machine in the database. Where: `0002_consultations.sql`
- **Booking floods, including direct REST bulk inserts.** Control: Insert trigger allows 10 rows per student per minute under a try-lock (a concurrent burst gets 429 instead of waiting). Returns 429 with `Retry-After: 60`. Where: `0002_consultations.sql`
- **Cross-site request forgery.** Control: Cookies are `SameSite=Lax`, and every mutating route requires an `Origin` header equal to `APP_ORIGIN`. If `APP_ORIGIN` is unset the check fails closed with 403. Where: `lib/api/guards.ts`
- **Mass assignment (`student_id`, `status` in the body).** Control: Zod `.strict()` rejects unknown keys. `student_id` always comes from the token. Where: `lib/consultations/schema.ts`, `service.ts`
- **Malformed or hostile input.** Control: Zod validation on every body and query. Text checks also exist as DB constraints that match Zod's trim rules. Where: `schema.ts`, `0002_consultations.sql`
- **Oversized bodies.** Control: 10 KB cap. A declared `Content-Length` over the cap is rejected before reading, and the stream is counted so chunked bodies cannot slip past. Bytes are counted, not characters. The proxy skips `/api`, so this streamed limit is the first reader of the body. Where: `lib/api/guards.ts`
- **Content-type confusion (form posts).** Control: Mutations require `application/json` or return 415. Where: `lib/api/guards.ts`
- **Row enumeration by id.** Control: Non-UUID, unknown and other users' ids all return the same 404. Where: `app/api/consultations/[id]/route.ts`
- **Information leaks in errors.** Control: Fixed messages per code. Raw database text is logged server side only. 5xx text is never shown in the UI. Where: `lib/api/respond.ts`, `lib/api/client.ts`
- **Reading identity from untrusted sources.** Control: `getClaims()` verifies the JWT. `getSession()` and the request body are never used for identity or role. Where: `lib/auth/current-user.ts`
- **Script injection (XSS).** Control: Nonce-based CSP with `strict-dynamic` set per request in `proxy.ts`. `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. React escapes output, and the app does not use `dangerouslySetInnerHTML`. Production allows no `eval`, so `lib/consultations/schema.ts` sets Zod to `jitless` mode to stop its `new Function` probe from tripping the policy. Where: `proxy.ts`, `lib/security/csp.ts`
- **Clickjacking, sniffing, referrer leaks.** Control: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` denying camera, microphone and geolocation, HSTS (`max-age=63072000; includeSubDomains`). `X-Powered-By` is off. Where: `next.config.ts`
- **Open redirect.** Control: The template's `/auth/confirm` redirected to any `next` value. It now accepts only same-site relative paths and rejects `//host`, `/\host` and tab or newline tricks. Where: `lib/auth/safe-redirect.ts` (the email templates in `supabase/templates/` link to this route)
- **Reflected text on the error page.** Control: The template echoed the error text from the URL. The page now looks up fixed copy by error code. Where: `app/auth/error/page.tsx`
- **Fail-open configuration.** Control: The template skipped its session check when the Supabase variables were missing (`hasEnvVars`). That helper is gone and the proxy always checks the session. Mutating routes also fail closed with 403 when `APP_ORIGIN` is unset. Where: `lib/supabase/proxy.ts`, `lib/api/guards.ts`
- **Weak passwords.** Control: Minimum 8 characters with lowercase, uppercase and digits, set in `supabase/config.toml`. Where: `config.toml`
- **Secrets in the repo.** Control: Only the publishable key is used and it lives in `.env.local`, which is git-ignored. `.env.example` has placeholders. The service role key is never used by the app. Where: `.gitignore`, `.env.example`
- **Supply-chain attacks.** Control: Exact version pins (`save-exact=true`), committed `package-lock.json`, `npm ci`, `ignore-scripts=true` in `.npmrc`, `audit-level=moderate`. Supabase CLI comes from Homebrew because its npm package needs install scripts. Where: `package.json`, `.npmrc`
- **Known Next.js vulnerabilities.** Control: Next.js and `eslint-config-next` are pinned to 16.4.6. Upgrade by changing the pin and the lockfile together. Where: `package.json`
- **Session handling bugs.** Control: A new Supabase client per request. `proxy.ts` refreshes cookies and returns the response it was given. Where: `lib/supabase/`

## Features left out

The app does not use `cacheComponents` or `use cache`, Server Actions of its own, or `next/og`. Each feature left out is one fewer place for a Next.js advisory to apply.

## Known limits

- The browser client needs the session cookie readable by scripts, so the strict CSP is the XSS control. The `Secure` flag follows `APP_ORIGIN` on the server (proxy and route handlers) and the page scheme in the browser. Plain `http://localhost` gets non-Secure cookies, because Safari drops Secure cookies there.
- Role changes lag. A demoted admin keeps access until their token expires, up to 3600 seconds, or until they log out and in. See [roles-and-access](roles-and-access.md).
- The CSP allows inline styles (`style-src 'unsafe-inline'`) because Tailwind and Radix set style attributes. Scripts are strict. The upgrade is nonce-based styles.
- Static images get no CSP. The proxy matcher skips `_next/static`, `_next/image`, `favicon.ico` and image file extensions. Images do not run script, and `X-Frame-Options` and the other static headers still apply to them.
- The rate limit is per student, not per IP, so it does not slow sign-up or login attempts. Supabase Auth has its own limits for those.
- Email confirmation is off locally to make the demo easy. Turn on `enable_confirmations` in `config.toml` for any shared deployment.
- HSTS only matters over HTTPS. Locally the header is sent, but browsers ignore it on plain HTTP.
- The admin list shows the name on the booking, not the account email, so it shows whatever the student typed.
- An unfiltered direct REST read by a student walks the whole index under RLS, which costs time proportional to the table until `statement_timeout`. See [scalability](scalability.md).
- There is no audit log of role changes or admin reads.
