# Roles and access

The brief asks how the app defines roles. This page describes the design and the reasons for it.

## How a role is defined

The app has two roles, `student` and `admin`. Each user has exactly one, stored in `public.user_roles`. Four pieces work together.

1. Table: `user_roles (user_id, role)` is the only source of truth. Users cannot read or write it through the Data API (see [database](database.md)).
2. Signup trigger: `on_auth_user_created` inserts a `student` row for every new `auth.users` row, so every account starts as a student. You cannot sign up as an admin.
3. Custom access token hook: `public.custom_access_token_hook` runs each time Supabase Auth issues a token. It reads `user_roles` and writes the role into the JWT as the `user_role` claim. It never reads `user_metadata`, which users can edit. The hook is enabled in `supabase/config.toml` under `[auth.hook.custom_access_token]`. Only `supabase_auth_admin` can execute it.
4. Enforcement, in two places:
   - RLS policies read `auth.jwt() ->> 'user_role'` ([policy table](database.md#rls-policies-on-consultations)).
   - Route handlers call `authenticate(role)` (`lib/api/auth.ts`). It reads the role with `getClaims()`, which verifies the JWT signature, and answers 401 when signed out or 403 when the role differs.

Layouts and data pages read the same claims with `getCurrentUser` to redirect users with the wrong role. That redirect is for the user experience only; the API and RLS do the enforcement.

## What each role can do

| Action                                             | student             | admin | signed out |
| -------------------------------------------------- | ------------------- | ----- | ---------- |
| List own consultations                             | yes                 | 403   | 401        |
| Book, complete, incomplete, reschedule, cancel own | yes                 | 403   | 401        |
| Touch another student's consultation               | 404 (row invisible) | 403   | 401        |
| List all consultations                             | 403                 | yes   | 401        |

The roles are disjoint. An admin cannot book or change anything, even through the REST API with their own token, because no policy gives an admin write access and the student policies require the student claim.

## Fail closed

If a user has no `user_roles` row, the hook sets `user_role` to JSON `null`, not `student`. `getCurrentUser` parses the claim with a Zod enum, so null or an unknown value becomes `role: null`. Route handlers answer 403 and RLS returns no rows. The signup trigger makes this case rare, and when it happens the user gets no access and lands on an error page that says so.

## Promotion and demotion

Promote with one statement, run as the database owner (Studio SQL editor or `psql`):

```sql
update public.user_roles set role = 'admin'
where user_id = (select id from auth.users where email = 'someone@example.com');
```

The role is written into the token when the token is issued, so a change reaches the user only with a new token.

- Promotion: the user logs out and in, and the next token carries `admin`.
- Demotion: the old token keeps its `admin` claim until it is refreshed or expires. `jwt_expiry` is 3600 seconds, so a demoted admin can still read all consultations for up to an hour unless they log out and in. Refresh tokens issue a new token with the new role, so the window ends at most one hour after the change.

Instant revocation would need the policies to look the role up in `user_roles` on every check instead of trusting the claim. That costs an extra query per check and makes the table readable by `authenticated`. I kept the claim because it keeps RLS cheap and follows Supabase's documented pattern. To narrow the window, shorten `jwt_expiry`.

## Why this design

- **Role in `user_metadata`.** Users can edit it from the browser, so it is unsafe.
- **Role in `app_metadata`.** Safe to read, but changing it needs the service role key, which the app would have to hold at runtime. SQL promotion on a table needs no extra secret.
- **Role checked only in the API.** A bug in the API, or a direct call to the Supabase REST API with a user token, would expose every row. With RLS, the database refuses.
- **Role looked up in each policy (`exists (select ... from user_roles)`).** Correct and instantly revocable, but runs an extra query per row check and needs the table readable by `authenticated`. The claim avoids both.
- **A `roles` and `permissions` matrix.** More than two roles with two capabilities need. To add a role, you add an enum value and policies.

With the claim, the check stays fast and the role table stays private, and Postgres makes the final decision. [Decisions](decisions.md) records how the first design changed (disjoint roles, fail-closed hook).
