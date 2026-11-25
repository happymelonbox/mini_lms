# Database

Migrations live in `supabase/migrations/` and run in order. `supabase db reset` applies them and then `supabase/seed.sql`. The TypeScript types in `lib/database.types.ts` are generated from this schema. Regenerate them after a migration change with `supabase gen types typescript --local > lib/database.types.ts`.

## Enums

| Enum                         | Values                                |
| ---------------------------- | ------------------------------------- |
| `public.app_role`            | `student`, `admin`                    |
| `public.consultation_status` | `scheduled`, `completed`, `cancelled` |

## Tables

### `public.user_roles`

| Column    | Type                | Notes                                        |
| --------- | ------------------- | -------------------------------------------- |
| `user_id` | `uuid` primary key  | References `auth.users`, `on delete cascade` |
| `role`    | `app_role` not null | Default `student`                            |

RLS is enabled. `anon` and `authenticated` have no privileges. Only `supabase_auth_admin` can `select`, and one policy allows it. The Data API never reads this table. The token hook does.

### `public.consultations`

| Column                     | Type                   | Notes                                             |
| -------------------------- | ---------------------- | ------------------------------------------------- |
| `id`                       | `uuid` primary key     | `gen_random_uuid()`                               |
| `student_id`               | `uuid` not null        | References `auth.users`, `on delete cascade`      |
| `first_name`, `last_name`  | `text` not null        | Constraints `first_name_valid`, `last_name_valid` |
| `reason`                   | `text` not null        | Constraint `reason_valid`                         |
| `scheduled_at`             | `timestamptz` not null | Stored as an absolute instant                     |
| `status`                   | `consultation_status`  | Default `scheduled`                               |
| `created_at`, `updated_at` | `timestamptz`          | Default `now()`; `updated_at` set by trigger      |

The three text constraints match Zod's `.trim().min(1)`, and the whitespace test matches JavaScript's `trim()` exactly. It uses an explicit list of the characters `trim()` strips (tab, newline, vertical tab, form feed, carriage return, space, NBSP, U+1680, U+2000 to U+200A, U+2028, U+2029, U+202F, U+205F, U+3000 and the BOM U+FEFF) and not `\s`, so it does not depend on the database locale. Names allow 1 to 100 characters and the reason 1 to 1000. Each rejects empty strings and any leading or trailing whitespace from that list (`!~ '^[...]|[...]$'`). Zero-width spaces, NEL (U+0085) and U+001C to U+001F pass both layers, because `trim()` keeps them. The API trims input first, so valid API calls always pass. A direct REST call with `" Ann"` fails with `23514`.

### Indexes

| Index                                 | Columns                      | Serves                       |
| ------------------------------------- | ---------------------------- | ---------------------------- |
| `consultations_student_scheduled_idx` | `(student_id, scheduled_at)` | Student list ordered by date |
| `consultations_student_created_idx`   | `(student_id, created_at)`   | Rate limit count             |
| `consultations_scheduled_idx`         | `(scheduled_at)`             | Admin list ordered by date   |

The keyset lists use `(student_id, scheduled_at)` and `(scheduled_at)` as they are: an index range scan plus a small incremental sort on `id`. A review tried `(…, id)` composites. They only remove that sort (0.14 ms against 0.11 ms) and grow the admin index from 8.5 MB to 40 MB per 1M rows, so the indexes are unchanged. The one case that would justify them is thousands of bookings at the same instant. See [scalability](scalability.md).

## Triggers and error codes

Guard triggers raise `P0001` with a stable message. The API maps the message to a status in `lib/api/respond.ts`, so the messages are a contract and tests pin them.

- `consultations_guard_insert` (before insert):
  - At most 10 rows per student created in the last minute. Message `rate_limited`. API status: 429 with `Retry-After: 60`.
  - New rows must be `scheduled`. Message `insert_must_be_scheduled`. API status: 500 (unreachable from the API, status is not an insertable column).
  - `scheduled_at` must be after now. Message `scheduled_at_must_be_future`. API status: 400.
- `consultations_guard_update` (before update):
  - `student_id` cannot change. Message `student_id_immutable`. API status: 500 (unreachable through the API).
  - A cancelled row cannot change at all. Message `consultation_cancelled_immutable`. API status: 409.
  - Only `scheduled -> completed`, `scheduled -> cancelled`, `completed -> scheduled`. Message `invalid_status_transition`. API status: 409.
  - Changing `scheduled_at` needs status `scheduled`. Message `reschedule_requires_scheduled`. API status: 409.
  - New `scheduled_at` must be after now. Message `scheduled_at_must_be_future`. API status: 400.
- `consultations_set_updated_at` (before update):
  - Sets `updated_at` with `clock_timestamp()`.
- `on_auth_user_created` (after insert on `auth.users`):
  - Inserts a `student` row in `user_roles`.

Check-constraint failures (`23514`) map to 400. Unknown errors map to a logged 500 with a fixed message.

The rate limit takes `pg_try_advisory_xact_lock` on a hash of the student id before it counts. If another insert for the same student holds the lock, the insert is refused with `rate_limited` at once instead of waiting, so two requests cannot both see nine rows and both pass, and a burst never holds pool connections. Rows of one multi-row insert count as they go in. Because the limit sits in the database, it covers direct PostgREST bulk inserts and holds across app instances. See [decisions](decisions.md).

### Status state machine

```
scheduled --> completed
scheduled --> cancelled
completed --> scheduled      ("incomplete")
cancelled: terminal
```

A completed row cannot be cancelled or rescheduled. Un-complete it first. Setting a status to its current value is allowed and does nothing.

## Grants and default privileges

`0001_roles.sql` first revokes default privileges so objects created later in `public` are closed by default:

- `alter default privileges for role postgres in schema public revoke all` on tables, functions and sequences from `anon` and `authenticated`.
- `alter default privileges for role postgres revoke execute on functions from public`. A schema-scoped revoke cannot undo the `PUBLIC` default, so this one is global.

Then each table opens exactly what it needs.

- `user_roles`: `anon` none, `authenticated` none, `supabase_auth_admin` `select`.
- `consultations`: `anon` none, `authenticated` `select`, `insert (student_id, first_name, last_name, reason, scheduled_at)`, `update (status, scheduled_at)`, and `supabase_auth_admin` none.
- `custom_access_token_hook`: `anon` no execute, `authenticated` no execute, `supabase_auth_admin` execute.
- `handle_new_user`: `anon` no execute, `authenticated` no execute, `supabase_auth_admin` none.

Nobody can `delete`. A cancel is a status change. Because `status` is not in the insert column list, a student cannot create a row that is already completed. Because only `status` and `scheduled_at` are updatable, a student cannot edit names, reason, `created_at` or `student_id`.

## RLS policies on `consultations`

The two roles grant separate, non-overlapping access. Student policies require `user_role = 'student'` in the JWT. A token with no role gets nothing. Policies wrap `auth.jwt()` and `auth.uid()` in `(select ...)` so Postgres evaluates them once per statement.

| Policy                | Command | Condition                                                                         |
| --------------------- | ------- | --------------------------------------------------------------------------------- |
| `students read own`   | select  | role is `student` and `auth.uid() = student_id`                                   |
| `admins read all`     | select  | role is `admin`                                                                   |
| `students insert own` | insert  | role is `student` and `auth.uid() = student_id` (with check)                      |
| `students update own` | update  | role is `student` and `auth.uid() = student_id`, in both `using` and `with check` |

There is no admin write policy, so the admin view is read-only by construction. There is no delete policy.

## Seed data

`supabase/seed.sql` is local demo data. It inserts three confirmed users with the password `Password123!` (local only), plus their `auth.identities` rows.

| User                   | Role                                                      | Consultations                   |
| ---------------------- | --------------------------------------------------------- | ------------------------------- |
| `student@example.com`  | student                                                   | 3: two scheduled, one cancelled |
| `student2@example.com` | student                                                   | 3: two scheduled, one completed |
| `admin@example.com`    | admin (promoted by `update` after the signup trigger ran) | none                            |

Dates are relative to `now()`, so they are always in the future after a reset. The insert guard only accepts future `scheduled` rows, so the seed inserts every row as scheduled and then updates the status of the cancelled and completed ones.
