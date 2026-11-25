# Architecture

## Layers

```
Browser
  -> proxy.ts                       pages only: session refresh, signed-out redirect, CSP nonce (not security)
  -> app/api/**/route.ts            session refresh, role gate, CSRF, validation, error mapping
  -> lib/consultations/service.ts   the only place that queries consultations
  -> Supabase Postgres              RLS, column grants, triggers (final authority)
```

Server Components (`app/dashboard/page.tsx`, `app/admin/page.tsx`) read through the same service functions as the API. Client components never query the database for consultations. They send changes to the API with `lib/api/client.ts` and call `router.refresh()` so the server re-renders the list.

A bug, or a direct call to the Supabase REST API with a user's token, can bypass every layer above Postgres. Postgres is set up so that such a bypass still leaks nothing: see [database](database.md) and [security](security.md).

## Request flow: booking a consultation

1. The student fills in `components/consultations/booking-form.tsx`. The form validates with `lib/consultations/form-schema.ts`, which reuses the API schema, so the browser and the server reject the same input.
2. `createConsultationRequest` in `lib/api/client.ts` sends `POST /api/consultations` with a JSON body. The browser adds the `Origin` header and the Supabase session cookie.
3. `proxy.ts` does not run for `/api/*`. The route handler's `getClaims()` refreshes the session and returns the new cookies.
4. `app/api/consultations/route.ts` runs the guards in order: `authenticate("student")` (401 or 403), `checkMutationHeaders` (Origin 403, Content-Type 415), `parseJsonBody` (413, 400 for bad JSON or Zod `.strict()` failure).
5. `createConsultation` in the service inserts the row with `student_id` taken from the token, never from the body.
6. Postgres checks the column grants, the RLS `with check` (role is `student` and `student_id` equals the caller), the check constraints, and the insert trigger (rate limit, status must be `scheduled`, date must be in the future).
7. A trigger or constraint failure comes back as a Postgres error. `dbErrorResponse` maps it to 429, 409 or 400 with fixed text. Anything unknown becomes a logged 500 with a generic message.
8. On success the route returns 201 with the consultation in camelCase. The form redirects to `/dashboard` and refreshes.

## Folder map

- `app/api/consultations/route.ts`: `GET` own list, `POST` create
- `app/api/consultations/[id]/route.ts`: `PATCH` complete, incomplete, cancel, reschedule
- `app/api/admin/consultations/route.ts`: `GET` all consultations
- `app/dashboard/`, `app/admin/`: Pages. Layouts send the wrong role to `/` as a UX gate only
- `app/page.tsx`: The only role router: `/auth/login`, `/auth/error?error=no_role`, `/dashboard` or `/admin`
- `app/auth/`: Template auth pages; `confirm/route.ts` verifies email links
- `components/auth/`, `components/layout/`, `components/consultations/`, `components/ui/`: Auth forms, app header, theme switcher and logout button, booking and list components, shadcn/ui
- `proxy.ts`, `proxy.test.ts`: Session refresh and CSP nonce, and the test for which paths its matcher covers
- `tests/integration/`: API tests against real Supabase, one file per concern, with `helpers.ts` and `setup.ts`
- `lib/api/guards.ts`: Origin and Content-Type check, capped JSON body parser, list query parser (cursors)
- `lib/api/respond.ts`: `json`, `errorResponse`, `validationError`, `dbErrorResponse`
- `lib/api/auth.ts`: `authenticate(role)` for route handlers
- `lib/api/client.ts`: Browser fetch wrapper that maps responses to a result type
- `lib/auth/current-user.ts`: Reads `{ id, role }` from verified JWT claims
- `lib/auth/safe-redirect.ts`: Same-site path check for `/auth/confirm`
- `lib/consultations/schema.ts`: Zod schemas shared by API and form
- `lib/consultations/service.ts`: All queries, the DTO mapping
- `lib/security/csp.ts`: CSP string builder
- `lib/supabase/`: Server, browser and proxy clients (a new server client per request)
- `supabase/migrations/`: Schema, grants, policies

## Why API routes over Server Actions

The brief asks for API routes. They also fit this design for three reasons.

- A route has a stable URL, method and status code contract. That makes the guard order testable with plain `Request` objects (see `tests/integration/`) and lets the same endpoints serve any other client later.
- Server Actions are public POST endpoints with framework-managed behaviour. The Origin check, body cap and error mapping here are explicit and visible in one file, `lib/api/guards.ts`.
- Rate limiting, 429 with `Retry-After`, and 404 versus 403 are HTTP concerns that are easier to express in a route.

The app defines no Server Actions. The template's auth forms call Supabase from the browser client, which the brief allows.

## Why one service layer

`lib/consultations/service.ts` is the only file that touches the `consultations` table. Pages and routes share it, so list ordering, keyset pagination, the camelCase DTO and the hidden `student_id` behave the same everywhere. It takes the Supabase client as an argument, so the integration tests swap in a real client with a real user token and run the handlers, service, RLS and triggers together.

Student queries also add `.eq("student_id", userId)`. RLS already limits the rows. The filter is a second check and lets Postgres use the `(student_id, scheduled_at)` index.

## Rendering

The root layout reads the `x-nonce` request header, so every page renders per request. That is what a per-request CSP nonce requires. `cacheComponents` and `use cache` are not used. See [decisions](decisions.md).
