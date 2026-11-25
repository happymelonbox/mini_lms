# Scalability

This page says what holds as the data and the traffic grow, what was measured, and what you change when a layer stops holding. The numbers come from a review on a local Postgres 17 with a copy of `consultations` holding 1,020,000 rows (99,998 students at about 10 rows, one student with 20,000, and ties on `scheduled_at`), and from a load test.

Load test (run before the try-lock change): 3 app instances, 20 students, 1,134 requests, 0 responses with a 5xx status, and every student got exactly 10 bookings across all three instances. With today's try-lock the same burst gives each student between 1 and 10, never more. Under that load POST had a p50 of 755 ms and PATCH 49 ms. The gap came from the old blocking lock, which entry 15 in [decisions](decisions.md) replaced.

## Database queries and indexes

Holds. Both lists use keyset pagination on `(scheduled_at, id)`. A deep page on 1M rows costs 0.11 ms with an index range scan, against 836 ms for the old offset. A heavy student with 20,000 rows costs 0.17 ms forward and 0.06 ms back. The query repeats the bound as `.gte` / `.lte` next to the `.or()`, because without it Postgres scans and filters (794 ms). Each page render runs one query and no count. Storage is about 263 MB per 1M rows including the four indexes.

A second run of the same check on 1M rows put the admin keyset page at 0.12 ms, against 760 ms for `OFFSET 500000`. For one student with 20,000 rows and the cursor in the middle, it took 4.3 ms, against 8.9 ms for the offset. Postgres estimated 26 matching rows where there were 10,000, because RLS and the `.or()` throw off its estimate. So it chose a bitmap scan that reads the rest of that student's range instead of stopping after 11 rows. It stays in milliseconds, and its cost grows only with that one student's history. The same SQL-function upgrade below fixes it.

Upgrade path: if thousands of bookings share one instant, a tie group costs 4 to 6 ms with the `.or()` form. A SQL function using `(scheduled_at, id) > ($1, $2)` with a `(scheduled_at, id)` index brings that to 0.07 ms. Do not add the composite indexes before then. They grow the admin index about 5 times.

## RLS

Holds. The policy subqueries run once per statement (InitPlan, `loops=1`), and the per-row cost is one comparison. Both lists use their index with RLS applied.

Limit: the OR of the two permissive policies is never an index condition. If a student calls PostgREST directly without `student_id=eq.`, the read walks the whole index. That took 752 ms at 1M rows and is capped by the 8 second `statement_timeout` of `authenticated`. At 10M rows or more it times out. Upgrade path: a role-specific view or RPC, or a PostgREST `db-pre-request` guard.

## Rate limit and lock

Holds. The count uses the `(student_id, created_at)` index and costs 0.03 ms even with 20,000 rows of history, because it reads only the last minute (at most 10 rows). The lock key is a 64-bit hash of the student id. A collision for 100,000 students has a chance of about 3e-10, and would only serialise two students' inserts.

The lock is a try-lock. A waiting insert would hold a PostgREST pool connection (`db_pool` defaults to 10), so a burst from one student could block everyone. Now the second concurrent insert gets `rate_limited` (429) at once. You get between 1 and 10 successes from a parallel burst, never more than 10.

## Triggers

Holds. The guard and `updated_at` triggers compare fields of the row and run no queries, except the rate-limit count above. A PATCH is a primary key lookup.

## Auth and getClaims

Holds. Tokens are ES256 and verified against the JWKS, which each process caches for 10 minutes. One verification costs about 187 microseconds. A page render verifies three times (proxy, layout, page), about 0.6 ms of CPU, so no extra caching is needed.

## Token refresh and the per-IP limit

Limit. The refresh runs on the server (`proxy.ts` and route handlers), so GoTrue sees the app server's IP, not the user's. Locally `token_refresh = 150` per 5 minutes per IP in `supabase/config.toml`, with `jwt_expiry = 3600`. That caps one egress IP at about 1,800 sessions refreshing per hour. Above it `getClaims` returns null and the proxy sends users to login.

What to set: in hosted Supabase, raise the token refresh rate limit (Authentication, Rate Limits) to match your active users per hour for each egress IP. Many instances behind one NAT share a single limit.

## Proxy and CSP

Holds. Each request does one `randomUUID`, a base64 encode and a string build, a constant cost. The matcher skips `/api` and static files.

## Connections

Holds. supabase-js talks HTTP to PostgREST, so Postgres connections equal the PostgREST and GoTrue pools whatever the number of app instances. A client object per request allocates memory, not a socket.

## Caching

Holds. Pages are dynamic on purpose (the CSP nonce needs it). After keyset each render runs one list query. Before, it also ran a count, and a second count past the end.

## Data growth

Holds for queries (see the first section). Ascending order would show the oldest history first, so the default view starts at now and Earlier walks back. Keyset has no last page. The integration tests sign up a new user per run and never delete it, which only matters locally.

## Multi-instance

Holds. No state lives in process memory except the JWKS cache. All instances must run the same build ID, so a page and its static assets match. Deploy them together.

## Beyond one Postgres

This is documented, not built.

- **Rate limit and replicas.** The rate limit and its lock live in one primary. Sharding by student keeps the limit correct inside each shard, but a global admin list then needs a merge. Keyset reads are safe on read replicas.
- **Admin total.** If you ever need one, use a trigger-maintained counter, or `pg_class.reltuples` through a security-definer RPC. Never use the PostgREST planned count under RLS: it said 5,100 for 1,020,000 rows.
- **Unfiltered direct REST reads by a student.** They cost time proportional to the table until `statement_timeout`. The fix is a role-specific view or RPC, or a `db-pre-request` guard.
- **Tied instants.** Thousands of bookings at the same instant need the SQL function and `(scheduled_at, id)` index described above.
- **GoTrue rate limits.** They are per IP, so many instances behind one NAT share one limit.
