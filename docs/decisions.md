# Decisions

Each record gives the decision, the alternatives, the reason and the consequence. The first design (roles in the JWT, RLS, API routes, one service layer) held. These entries cover the places where the code differs from it and the review proposals I declined.

## 1. Roles are disjoint capabilities

- **Decision:** Student RLS policies also require `user_role = 'student'`. Admins have a read policy only.
- **Alternatives:** Policies that check only `auth.uid() = student_id`, which would let an admin act as a student.
- **Reason:** Each role grants exactly one set of abilities. With the role check in the policy, a token with no role or an admin token cannot book or change rows, even through the REST API.
- **Consequence:** You cannot test the booking flow with an admin account. Use a student account.

## 2. The token hook fails closed

- **Decision:** With no `user_roles` row, the hook sets `user_role` to null.
- **Alternatives:** Default to `student` with `coalesce`.
- **Reason:** A default would grant access when the data is missing. A null role grants nothing in RLS or in `getCurrentUser`.
- **Consequence:** A user without a row cannot use the app. The signup trigger prevents this for normal sign-ups.

## 3. The rate limit lives in a database trigger

- **Decision:** 10 bookings per student per minute, counted in `guard_consultation_insert` under `pg_try_advisory_xact_lock` (see entry 15).
- **Alternatives:** An in-memory limiter in the API route.
- **Reason:** A review showed that a 500-row bulk insert sent straight to PostgREST bypassed the API-only limiter. An in-memory counter also resets on restart and is not shared between app instances. The trigger applies to every path and every instance.
- **Consequence:** Each insert counts rows with the `(student_id, created_at)` index. The limit is per student, not per IP.

## 4. Default privileges are closed

- **Decision:** Default privileges in `public` are revoked from `anon` and `authenticated`, and function `EXECUTE` is revoked from `PUBLIC`.
- **Alternatives:** Rely on explicit `revoke` per object.
- **Reason:** By default, Supabase grants API roles access to new objects, so a forgotten revoke on a future table would expose it. With the defaults revoked, a new object stays invisible until a migration grants access.
- **Consequence:** Every new table or function needs explicit grants. `roles.test.sql` checks this.

## 5. Database text checks match Zod

- **Decision:** `first_name_valid`, `last_name_valid` and `reason_valid` reject the leading and trailing whitespace that JS `trim()` strips, including tabs and newlines.
- **Alternatives:** A simple `char_length > 0`, or `trim(...) <> ''`, which only strips spaces.
- **Reason:** Zod's `.trim()` uses JS `trim()`, which strips more than spaces. A narrower database rule would accept values the API never produces, and a direct REST call could then store them.
- **Consequence:** API and database agree. The database check matches JS `trim()` exactly with an explicit whitespace list, so it does not depend on the locale. The guards suite covers tab, newline, BOM, NEL and U+001C cases.

## 6. The admin list shows the name on the booking

- **Decision:** The admin table shows the first and last name stored on the booking, not the account email.
- **Alternatives:** A security-definer view joining `auth.users` for the email.
- **Reason:** `auth.users` is not exposed to the Data API, and a security-definer view would add a privileged path for one column.
- **Consequence:** If a student types a different name than their account's, the admin sees what the student typed.

## 7. One guard order in every handler

- **Decision:** Auth and role, then Origin, then Content-Type, then id, then body size (streamed, 10 KB), then Zod `.strict()`, then the query as the user.
- **Alternatives:** Validate first and authorise later.
- **Reason:** Cheap rejections that reveal nothing come first, so a caller without access learns nothing about the schema. An admin who sends an empty body gets 403, not 400.
- **Consequence:** The order is documented in `lib/api/guards.ts` and tested in the integration suite.

## 8. CSP in `proxy.ts`, static headers in `next.config.ts`

- **Decision:** A per-request nonce CSP with `strict-dynamic` is set in `proxy.ts`. Fixed headers go in `next.config.ts`. `cacheComponents`, Server Actions of our own, `use cache` and `next/og` are not used.
- **Alternatives:** A static CSP with `unsafe-inline`, or only static headers.
- **Reason:** Nonces give strict control over scripts. The Next.js security advisories published during 2026 included issues in `use cache` and other cache features and in `next/og`, so leaving these features out reduces the attack surface.
- **Consequence:** Every page renders per request, because the layout reads the nonce header. Styles still allow `unsafe-inline`.

## 9. Template flaws fixed

- **Decision:** `/auth/confirm` accepts only same-site relative paths. The error page shows fixed copy per error code. The env check that skipped the session proxy was removed.
- **Alternatives:** Keep the template code.
- **Reason:** The template redirected to any `next` URL (open redirect), echoed URL text on the error page, and skipped authentication when env variables were missing.
- **Consequence:** `lib/auth/safe-redirect.ts` and its tests are new. An unknown error code shows a generic message. The confirmation and recovery email templates in `supabase/templates/` link to `/auth/confirm`, so the hardened route is the one the emails use.

## 10. Password policy

- **Decision:** Minimum 8 characters with lowercase, uppercase and digits (`password_requirements = "lower_upper_letters_digits"`).
- **Alternatives:** The default of 6 characters.
- **Reason:** The rule costs little, and Supabase Auth enforces it, so the app needs no code for it.
- **Consequence:** Supabase Auth rejects weak passwords on sign-up. The demo password `Password123!` meets the rule.

## 11. The template's root page was ported

- **Decision:** `/` redirects by role: signed out to login, no role to an error page, admin to `/admin`, students to `/dashboard`. Layouts and pages send any role mismatch back to `/`. The single title from the original page was later replaced by per-page titles ("My consultations | Mini-LMS" and so on).
- **Alternatives:** Drop the root page and make `/dashboard` the entry.
- **Reason:** The TanStack-style `index.tsx` root page came with the brief's materials, not with the starter, and was ported to `app/page.tsx` plus the root metadata. As a Next page that routes by role, it keeps one entry point. Its title used an em dash and was the same on every page. Per-page titles name each tab after its page and drop the em dash, and the description now matches the wording on the login page.
- **Consequence:** The router is not a security boundary. Layouts gate every page under them, including `/dashboard/book`, which reads no data. Pages that read data also check the role, because Next layouts do not re-run on client navigation.

## 12. Supply chain controls

- **Decision:** Exact version pins, a committed lockfile, `npm ci`, and `ignore-scripts=true` in `.npmrc`. The Supabase CLI is installed with Homebrew.
- **Alternatives:** Caret ranges, and the `supabase` npm package.
- **Reason:** Several npm worm incidents in 2026 spread through install scripts and new versions. Pins block the second route and disabled scripts block the first. The CLI npm package needs install scripts, so it conflicts with `ignore-scripts`.
- **Consequence:** To upgrade, you change a pin, regenerate the lockfile and review the diff.

## 13. Keyset pagination, no totals

- **Decision:** Both lists use cursors (`after` / `before`) ordered by `(scheduled_at, id)`, with Earlier and Later links. The default view starts at now. No count of any kind is run.
- **Alternatives:** Offset pagination with `count: "exact"` (the first version). PostgREST `count: "estimated"`.
- **Reason:** A review measured both on a table of 1.02M rows. A deep offset (admin page 50,001) took 836 ms with a sort that spilled 121 MB to disk. The same page by keyset took 0.11 ms with an index range scan. An exact count is a sequential scan at 248 ms on every admin page view. The estimated count is wrong under RLS: with two permissive policies the planner guessed 5,100 for 1,020,000 rows. So there is no safe total, and the UI shows none.
- **Consequence:** There are no page numbers and no "last page". The default page starts at now, because ascending order would otherwise show the oldest history first. The cursor holds the raw `scheduled_at` string from PostgREST, since a `Date` round trip cuts microseconds and repeats a row. The query repeats the bound as `.gte` / `.lte` next to the `.or()`: without it Postgres filters instead of range scanning (794 ms against 0.11 ms). The existing indexes stay. A `(…, id)` composite only removes a small incremental sort and makes the admin index about 5 times larger (8.5 MB to 40 MB per 1M rows). The default page always offers Earlier, even when no history exists, so it needs no extra probe query. If you ever need a total, use a trigger-maintained counter, never the planned count.

## 14. Role changes apply at the next token

- **Decision:** The role claim is read when a token is issued and trusted until it expires.
- **Alternatives:** Look the role up in `user_roles` on every request.
- **Reason:** RLS and the API need no extra queries, and the approach follows Supabase's documented RBAC pattern.
- **Consequence:** Promotion needs a new login. Demotion takes effect at the next token issue, up to `jwt_expiry` (3600 seconds).

## 15. The rate-limit lock fails fast

- **Decision:** `guard_consultation_insert` takes `pg_try_advisory_xact_lock`. If the lock is held, the insert raises `rate_limited` (429) at once.
- **Alternatives:** `pg_advisory_xact_lock`, which queues the second request behind the first.
- **Reason:** A queued request holds a PostgREST pool connection (`db_pool` is 10 by default). A burst from one student could fill the pool and block every other user. The load test saw POST at 755 ms p50 against 49 ms for PATCH, which takes no lock.
- **Consequence:** A parallel burst from one student now creates between 1 and 10 rows, and the rest get 429. The count check still runs after the lock, so the limit is never exceeded. A client that retries after a second succeeds.

## 16. One teal accent, Newsreader and Source Sans 3

- **Decision:** The UI uses a near-white page, a single teal accent (`#0B7468` light, `#5CC6B6` dark), Newsreader for headings and Source Sans 3 for body and UI text, loaded with `next/font/google`. The shadcn tokens keep their names, with `success` added for the completed status.
- **Alternatives:** A clear blue accent. Inter or Geist for everything. A stack of new UI dependencies for the date block and the responsive table.
- **Reason:** Teal reads calm and supportive, stays apart from the default SaaS blue and from purple, and keeps enough distance from the completed green and the error red. Source Sans 3 is a humanist sans with open shapes that stays legible at 15 to 16px on phones. Newsreader is a gentle text serif built for screens, so headings feel editorial without a high-contrast display face. `next/font` downloads both at build time and serves them from the app, so the CSP needs no font host. The date block is a small pure helper (`dateParts` in `lib/datetime.ts`), and the stacked table is plain CSS with a container query.
- **Consequence:** `npm run build` needs network access to fetch the fonts. No runtime dependency was added. The contrast of every token pair is checked by a script against `app/globals.css`, so a token change should be re-checked the same way.

## Declined review findings

- CSP on static images: a reviewer asked for CSP headers on the files the proxy matcher skips (`_next/static`, `_next/image`, `favicon.ico` and image extensions). I declined. Images do not execute script, and `X-Frame-Options` and the other static headers from `next.config.ts` still apply. Adding these files to the matcher would run the session refresh on every image request.
