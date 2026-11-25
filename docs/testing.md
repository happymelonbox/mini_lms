# Testing

## Approach

The database suites, the API guards, the schemas and the helpers were written test-first, alongside the code: the case table first, then the code that makes it pass. The component, page, layout and route-handler unit tests, and the rule that every source file has a sibling test, came after the code, during review. I checked each of those test files by breaking its source file, watching the test fail, and restoring the source.

Each suite lists its cases as data (a name, an input, an expected result) and runs them through one assertion. In Vitest that is `it.each`. In pgTAP it is a temp table of cases and one `select is(...) from cases`. To add a case, you add one row, and a reviewer can read the whole contract as a table.

The layers run in this order:

| Layer                | Runs against                                       | Proves                                                         |
| -------------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| pgTAP                | A real Postgres inside the local stack             | Constraints, triggers, grants, RLS, the token hook             |
| Unit (Vitest)        | One test file per source file, no network          | Schemas, guards, error mapping, CSP, redirects, client mapping |
| Components (Vitest)  | React components in jsdom with Testing Library     | What a user sees and can do in each component                  |
| Integration (Vitest) | Route handlers with a real Supabase client and RLS | The whole chain from handler to database                       |

## Commands and counts

I measured these counts by running each command at this commit.

| Command                    | Result                    |
| -------------------------- | ------------------------- |
| `npm run test:db`          | 102 tests, 3 files, pass  |
| `npm run test:unit`        | 323 tests, 22 files, pass |
| `npm run test:components`  | 144 tests, 37 files, pass |
| `npm run test:integration` | 62 tests, 6 files, pass   |
| `npm test`                 | 529 tests, 65 files, pass |

`npm test` runs every Vitest project (unit, components and integration). `test:db` and `test:integration` need the local stack, so run `supabase start` and `supabase db reset` first. The integration tests read `.env.local` and sign in as the seeded admin. `supabase db lint` checks the database functions.

## pgTAP suites (`supabase/tests/`)

Each file creates its own users and runs in a transaction that rolls back, so no file depends on the seed.

- `roles.test.sql` (15 tests): The signup trigger gives `student`. A promoted user gets an `admin` claim. An unknown user gets a null claim. `anon` and `authenticated` cannot execute the hook or touch `user_roles`. `supabase_auth_admin` can. A table and a function created later get no default grants for API roles. `user_roles` has RLS on
- `consultations_guards.test.sql` (58 tests): 33 insert cases (names, reason, length limits, whitespace including tabs, newlines, BOM and the ideographic space, plus a zero-width space, NEL and U+001C accepted as JS `trim()` does, past and present dates, non-scheduled status). 18 update cases (the full status transition matrix, reschedule rules, immutable `student_id`, cancelled rows). 6 rate-limit cases (10th allowed, 11th refused, a 10-row and an 11-row multi-row insert, rows older than a minute ignored, another student unaffected by a saturated one). One more: `updated_at` is bumped by an update
- `consultations_policies.test.sql` (29 tests): The RLS and grants table. Each case runs a statement as `anon`, a student, another student, an admin or a token with no role claim, and compares the exact result or error text. It covers reads, updates, column grants, inserts and deletes

The policy suite simulates PostgREST by setting `request.jwt.claims` and `role` inside the transaction.

## Unit suites

Every source file under `app/`, `components/`, `hooks/` and `lib/`, and `proxy.ts`, has a sibling test file (`booking-form.tsx` has `booking-form.test.tsx`). `tests/sibling-tests.test.ts` lists one row per source file and fails when a test file is missing. `lib/database.types.ts` is the only exception, because it is generated. Every test is a table test (`it.each`).

The `.test.ts` files run in the `unit` project with no network. They mock the edges: the network (`fetch`), the Supabase client factory and Next.js navigation. They assert what a caller or user sees, such as a status code, a redirect target or a message, and not how the code gets there. The areas with the most cases:

- **Schemas** (`schema.test.ts`, `form-schema.test.ts`): Trim rules, NUL and broken UTF-16, limits, future dates, offsets, `.strict()` keys, patch actions, cursor decoding and rejection
- **API guards** (`guards.test.ts`): Origin match, prefix tricks, unset `APP_ORIGIN`, Content-Type, body size at 10,240 bytes with and without `Content-Length`, UTF-8 byte counting, list query
- **Error mapping** (`respond.test.ts`): Every database error to status, no raw text leaks, `Retry-After` on 429, `no-store`
- **Browser client** (`client.test.ts`): Response mapping for 200, 201, 400, 401, 404, 409, 429, 500 and network failure
- **Auth** (`current-user.test.ts`, `safe-redirect.test.ts`): Claim parsing, null role, redirect allow list
- **Security** (`csp.test.ts`, `proxy.test.ts`): Directives, nonce, dev versus production. Which paths the proxy matcher covers
- **UI helpers** (`list-page.test.ts`, `datetime.test.ts`): Cursor parsing with fallback, local time conversion

## Component suite (`**/*.test.tsx`)

The `components` project runs in jsdom with `@testing-library/react` and `user-event`, and `tests/setup-components.ts` adds the jest-dom matchers and cleanup. Run it with `npm run test:components`; it needs no Supabase. It covers the components, the pages and the layouts. The tests mock the Supabase client factory, Next.js navigation and the network, render the component, and act as a user would: type, click, submit. They assert on what appears, such as messages, labels, links and disabled buttons. `booking-form.test.tsx`, for example, fills in the booking form and checks the messages it shows.

## Integration suites (`tests/integration/`)

`anonymous.test.ts`, `list.test.ts`, `create.test.ts`, `patch.test.ts`, `admin.test.ts` and `keyset.test.ts` each cover one concern. `helpers.ts` holds the shared actors and calls. `setup.ts` swaps `lib/supabase/server` for a real supabase-js client that holds a real user token, then calls the route handlers directly. The handlers, service, RLS and triggers all run, and nothing below the cookie layer is mocked.

- Fresh users per run: students sign up with a random email, so the signup trigger gives them the student role and the seeded demo data is never changed. The test replaces a student before that student reaches the limit of 10 per minute.
- Actors: two fresh students, the seeded admin, and an anonymous client.
- Coverage: 401 for signed-out callers on all four routes. List isolation between students, cursor validation (400), stale cursors, and keyset walks forward and back (distinct and tied instants, two students for the admin, default page starts at now). Create validation (including NUL in text), unknown keys, past dates, role refusal and guard order (an admin with an empty body gets 403, not 400). Origin, Content-Type, body size and malformed JSON. The 429 path with `Retry-After`, a 15-way parallel burst (at most 10 created, at least 1, the rest 429, database count equals successes), plus a direct bulk insert of 11 rows that the database refuses. PATCH actions, illegal transitions (409), validation (400), other students' rows (404), non-UUID ids (404) and admin refusal (403). Admin list for both roles.

## Formatting

Prettier sets the code style. `npm run format` rewrites files and `npm run format:check` fails if any file differs. `.gitattributes` keeps line endings as LF on every system, so the check passes on Windows too.

## What is not tested

There are no browser end-to-end tests. The component tests run in jsdom, so layout, real navigation and browser quirks are not covered there. The manual browser test evidence (iPhone, Pixel, desktop Chrome and Safari) is attached to the pull request.
