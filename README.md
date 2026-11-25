# Mini-LMS

Mini-LMS is a consultation booking app. Students sign up, book a consultation with their name, a reason and a date and time, then mark it complete or incomplete, reschedule it or cancel it. Admins sign in and see every consultation in a read-only table. It runs on Next.js 16 (App Router, TypeScript), Supabase (Postgres, Auth, Row Level Security) and shadcn/ui, and every change goes through API routes rather than Server Actions.

## Requirements checklist

- **1. Login, logout, sign up.** Template auth pages under `app/auth/`, hardened (see [security](docs/security.md))
- **2. Student dashboard of own consultations.** `app/dashboard/page.tsx`, `GET /api/consultations`
- **3. Mark complete / incomplete.** `PATCH /api/consultations/[id]` with `{"action":"complete"}` or `{"action":"incomplete"}`
- **4. Booking form: first name, last name, reason, date and time.** `app/dashboard/book/page.tsx`, `POST /api/consultations`
- **5. Reschedule.** `PATCH` with `{"action":"reschedule","scheduledAt":"..."}`
- **6. Cancel.** `PATCH` with `{"action":"cancel"}` (soft cancel, status becomes `cancelled`)
- **7. Admin sees all consultations; roles are defined by you.** `app/admin/page.tsx`, `GET /api/admin/consultations`, [roles](docs/roles-and-access.md)
- **8. README with setup, justifications, assumptions, summary.** This file
- **9. Migrations and schema.** `supabase/migrations/0001_roles.sql`, `0002_consultations.sql`, `0003_policies.sql`, `supabase/seed.sql`
- **10. API routes over Server Actions.** All create and change logic is in `app/api/**/route.ts`. The app defines no Server Actions; the template auth forms call Supabase from the browser
- **11. Any RBAC; justify it.** Role in a table, copied into the JWT by a token hook, enforced by RLS and an API role gate ([why](docs/roles-and-access.md))
- **12. Component library.** shadcn/ui (`components/ui/`)

## Getting started (launch)

### Requirements

I built and tested this on macOS. The CI workflow runs the format, lint, type, unit, component and build checks on Ubuntu and Windows, and the pgTAP and integration suites on Ubuntu. The Windows 10 and 11 steps use Docker Desktop with the WSL 2 backend, and I have not run the database stack on Windows myself.

- Node 24 or 26 LTS (22.22.2 or later also works). `.nvmrc` pins 24 for `nvm use`. Node 25 runs the app, but the component tests use jsdom 31, which warns on it.
- A Docker-compatible runtime.
- The Supabase CLI.

I install the CLI with a package manager because its npm package needs install scripts, and this repo sets `ignore-scripts=true` in `.npmrc`.

**macOS.** Use Colima (or Docker Desktop or OrbStack) and Homebrew:

```bash
brew install colima docker supabase/tap/supabase
colima start --cpu 4 --memory 8
```

**Windows 10 or 11.** Install [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) with the WSL 2 backend and start it. Then, in PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Scoop comes from [scoop.sh](https://scoop.sh). You can also use the Node installer from nodejs.org instead of winget. Open a new terminal afterwards so the new commands are on your path.

**Linux.** Install Node 24 and Docker Engine, and the Supabase CLI from its [install guide](https://supabase.com/docs/guides/local-development/cli/getting-started). The commands below are the same as on macOS.

### Steps

Every command is the same on each system except where a PowerShell form is shown.

1. Clone the repo and install dependencies from the lockfile:
   ```bash
   npm ci
   ```
2. Start the local Supabase stack (Postgres, Auth, the REST API, Studio, Mailpit). The first run pulls Docker images:
   ```bash
   supabase start
   ```
3. Create your env file:

   ```bash
   cp .env.example .env.local
   ```

   ```powershell
   Copy-Item .env.example .env.local
   ```

   Run `supabase status` and copy two values into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: the **API URL** field.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the **Publishable** key field.

   Leave `APP_ORIGIN=http://localhost:3000`. It must equal the origin you open in the browser, or every create and update call fails with 403 (see [security](docs/security.md)). Never commit `.env.local`; `.gitignore` already excludes it.

4. Apply the migrations and the seed data:
   ```bash
   supabase db reset
   ```
5. Run the app:
   ```bash
   npm run dev
   ```
6. Open http://localhost:3000.

If you edit `supabase/config.toml` (for example the auth settings), restart the stack for the change to apply:

```bash
supabase stop && supabase start
```

```powershell
supabase stop; supabase start
```

Local email goes to Mailpit, whose URL `supabase status` prints. Email confirmation is off locally, so sign-up works without opening it. Mailpit only matters if you test the password reset flow.

### Demo accounts

`supabase db reset` seeds three users. This password is local demo data and exists only in your local database.

| Email                  | Role                                         | Password       |
| ---------------------- | -------------------------------------------- | -------------- |
| `student@example.com`  | student, has 3 consultations (one cancelled) | `Password123!` |
| `student2@example.com` | student, has 3 consultations (one completed) | `Password123!` |
| `admin@example.com`    | admin                                        | `Password123!` |

## Using the app

### As a student

1. Go to http://localhost:3000. It sends you to the login page. Sign in as `student@example.com`, or use **Create an account** to make your own. Passwords need at least 8 characters with a lowercase letter, an uppercase letter and a digit. With confirmation off locally, a new account is signed in straight away. Follow the **go to your consultations** link on the confirmation page.
2. The dashboard lists your consultations from now on, earliest first, 10 at a time. Use **Earlier** and **Later** to move through your history and your upcoming bookings. There are no page numbers or totals.
3. **Book a consultation** opens the form: first name, last name, reason and date and time. The time must be in the future. The form uses your browser timezone, and the time is stored in UTC.
4. Tick **Mark as done** on a row to mark it completed; untick it to mark it incomplete again.
5. **Reschedule** opens a dialog for a new date and time. It only shows on scheduled consultations.
6. **Cancel** asks for confirmation, then sets the status to `cancelled`. A cancelled consultation is read-only for good, so its row shows no buttons.

You can book at most 10 consultations per minute. The 11th gets a "Too many requests" message.

### As an admin

Sign in as `admin@example.com`. The app sends you to `/admin`, a read-only table of every student's consultations (booking name, reason, date and time, status, created time), 10 at a time from now on, with **Earlier** and **Later** links and no total. Admins cannot book, change or cancel anything. A student who opens `/admin` is sent back to `/dashboard`, and an admin who opens `/dashboard` is sent to `/admin`.

### Promote a user to admin

Roles live in the `user_roles` table. Run one statement against the local database, using the SQL editor in Studio (URL in `supabase status`) or `psql` with the DB URL from `supabase status`:

```sql
update public.user_roles set role = 'admin'
where user_id = (select id from auth.users where email = 'someone@example.com');
```

A token hook copies the role into the user's token when the token is issued, so the promoted user must log out and back in before the change takes effect. To demote, set the role back to `student`: the old token keeps working as an admin until it expires (up to `jwt_expiry`, 3600 seconds), unless the user logs out and in. See [roles and access](docs/roles-and-access.md).

## Design

The look is "editorial calm": a near-white page, one teal accent for actions and focus, a serif for headings and a humanist sans for everything else. It is built mobile first at 390px and checked for no sideways scroll at 360px.

- **Palette.** Light: page `#FAF9F5`, cards `#FFFFFF`, text `#1E2A2D`, muted text `#5A6567`, accent `#0B7468`, borders `#E2E0DA`. Dark: page `#151B1D`, cards `#1C2427`, text `#E7ECEA`, muted text `#A2ADAC`, accent `#5CC6B6`. Status colours: scheduled uses the accent tint, completed a soft green, cancelled grey with the reason struck through. Tokens live in `app/globals.css`, and every text, badge, button and focus pair passes WCAG AA in both themes.
- **Type.** Newsreader for headings and the wordmark, Source Sans 3 for body and UI. Both load through `next/font/google`, which self-hosts them, so the CSP keeps `font-src 'self'`.
- **Layout.** Bookings are a dated list: a block with weekday, day and month, then the reason, time and booking name, with the actions underneath on phones and to the right on wide screens. The admin list is one table that stacks into cards below 40rem. On phones the nav becomes a row of tabs under the wordmark. Controls are 44px tall on phones, corners are 10px on cards, buttons and inputs alike, borders are light and there are no shadows outside dialogs and menus. Menu zoom and slide only run when the viewer has not asked for reduced motion.
- **Voice.** One calm, friendly person, in short sentences and plain verbs: "Nothing coming up yet. Pick a time that suits you and it will show up here." Buttons say what they do ("Book it", "Save new time", "Yes, cancel it"). The booking form maps the API's "Required" and "Must be in the future" to plain sentences such as "Add a first name". Other API error text is shown as it comes.

## Testing

| Command                    | What it runs                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm test`                 | All Vitest tests (unit, components and integration)                                                      |
| `npm run test:unit`        | Unit tests only (no Supabase needed)                                                                     |
| `npm run test:components`  | React component tests in jsdom (no Supabase needed)                                                      |
| `npm run test:integration` | API tests against the local Supabase stack; needs `supabase start`, `supabase db reset` and `.env.local` |
| `npm run test:db`          | pgTAP suites (schema, triggers, grants, RLS) through `supabase test db`                                  |
| `supabase db lint`         | Lints the database functions                                                                             |
| `npm run format:check`     | Prettier check (`npm run format` fixes)                                                                  |
| `npm run lint`             | ESLint                                                                                                   |
| `npm run build`            | Production build                                                                                         |

`npm test` runs 529 tests in 65 files (unit 323, components 144, integration 62), and `npm run test:db` runs 102 pgTAP tests in 3 files. Every source file has a sibling unit test, and `tests/sibling-tests.test.ts` fails when one is missing. The per-suite counts and how the tests were written are in [testing](docs/testing.md). The manual browser test evidence (iPhone, Pixel, desktop Chrome and Safari) is attached to the pull request.

## Project structure

```
app/
  api/consultations/route.ts          GET list, POST create (student)
  api/consultations/[id]/route.ts     PATCH complete, incomplete, cancel, reschedule (student)
  api/admin/consultations/route.ts    GET all (admin)
  dashboard/                          student pages (list, book)
  admin/                              admin page
  auth/                               login, sign-up, password reset, email confirm
  page.tsx                            "/" redirects by role
components/
  auth/                               login, sign-up and password forms
  layout/                             app header, theme switcher, logout button
  consultations/                      booking form, consultation row, pagination
  ui/                                 shadcn/ui
lib/
  api/                                guards, error responses, auth gate, browser API client
  auth/                               current user from JWT claims, safe redirect
  consultations/                      Zod schemas, service (all queries), page helpers
  security/csp.ts                     CSP builder
  supabase/                           server, browser and proxy clients
proxy.ts                              session refresh and CSP nonce
proxy.test.ts                         which paths the proxy matcher covers
supabase/
  migrations/                         0001 roles, 0002 consultations, 0003 policies
  seed.sql                            demo users and consultations
  tests/                              pgTAP suites
tests/integration/                    API tests against real Supabase, one file per concern
docs/                                 design documents
```

## Implementation summary

- Page requests pass `proxy.ts`, which refreshes the session and sets a CSP nonce. It redirects signed-out users but does not authorise anything. It does not run for `/api/*`.
- Route handlers in `app/api/**` refresh the session themselves, check the role from the verified JWT, then validate the request, then call one service layer (`lib/consultations/service.ts`). The pages read through the service layer, and the GET routes are API surface for other clients.
- The service queries Supabase as the signed-in user, so Postgres Row Level Security decides what each user can see and change. Triggers enforce the status rules and the rate limit.
- Client components send every change to the API and then call `router.refresh()`.

Details are in [architecture](docs/architecture.md), [database](docs/database.md) and [api](docs/api.md).

## Assumptions

- Names are stored on each booking, because the brief puts them in the booking form.
- Every non-admin is a student. Admins are created with SQL only.
- Cancel is a soft cancel, so history is kept. A cancelled consultation cannot change again.
- Complete and incomplete can be toggled any number of times while the consultation is not cancelled.
- There are no overlap checks and no staff availability rules.
- Times are stored in UTC and shown in the viewer's timezone.
- The admin view is read-only.

## Justifications

I chose a role table, a custom access token hook that copies the role into the JWT, and RLS policies that read that claim. The API repeats the role check for a clean 403. Alternatives were `user_metadata` (users can edit it, so it is unsafe), `app_metadata` (needs the service role key at runtime) and an API-only check (a bypassed API would expose every row). The full reasoning and the fail-closed behaviour are in [roles-and-access](docs/roles-and-access.md). Other choices are recorded in [decisions](docs/decisions.md).

## Security summary

The database is the final authority: RLS on every table, column-level grants, no default privileges for API roles, and triggers for state rules and rate limiting. The API adds an exact Origin check, strict Zod validation, a 10 KB streamed body cap, 404 for rows you do not own, and a nonce-based CSP. Exact version pins, a committed lockfile and `ignore-scripts=true` control the supply chain. The full threat and control table, with known limits, is in [docs/security.md](docs/security.md).

## Documentation

- [docs/architecture.md](docs/architecture.md): layers, request flow, folder map, why API routes.
- [docs/database.md](docs/database.md): tables, constraints, triggers, grants, RLS policies, seed.
- [docs/roles-and-access.md](docs/roles-and-access.md): how roles work and why.
- [docs/api.md](docs/api.md): every route, request, response and error.
- [docs/security.md](docs/security.md): threats, controls and known limits.
- [docs/testing.md](docs/testing.md): test approach, suites and counts.
- [docs/decisions.md](docs/decisions.md): decision records, including deviations from the first design.
