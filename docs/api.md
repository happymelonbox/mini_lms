# API

All routes live under `app/api/` and return JSON with `Cache-Control: no-store`. Authentication is the Supabase session cookie. Use the browser, or send the cookies with curl as in the examples.

## Conventions

**Consultation object (DTO).** `student_id` is never returned.

```json
{
  "id": "<uuid>",
  "firstName": "Ann",
  "lastName": "Lee",
  "reason": "Help with my course plan",
  "scheduledAt": "2030-01-01T10:00:00+00:00",
  "status": "scheduled",
  "createdAt": "<timestamp>",
  "updatedAt": "<timestamp>"
}
```

**Error body.** Every error has this shape. `fields` appears on validation errors.

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid request",
    "fields": { "reason": ["Required"] }
  }
}
```

**Guard order.** Cheap checks that reveal nothing run first.

1. Auth and role: 401 or 403.
2. Origin must equal `APP_ORIGIN` exactly: 403 `forbidden_origin`.
3. Content-Type must be `application/json`: 415.
4. The `id` in the path must be a UUID: otherwise 404.
5. Body at most 10 KB (10,240 bytes), counted while streaming: 413.
6. JSON parses: 400 `invalid_json`.
7. Zod `.strict()` validation: 400 `validation_error`. Unknown keys are errors.
8. Query as the user, so RLS and triggers apply.

Read-only routes skip steps 2, 3, 5 to 7.

**Dates.** `scheduledAt` is an ISO 8601 date-time with a timezone offset (`2030-01-01T10:00:00+10:00` or `...Z`) and must be in the future.

**Pagination (cursors).** `GET` list routes use keyset pagination. They take `?after=<cursor>`, `?before=<cursor>` (never both) and `?pageSize=` (1 to 50, default 10). Ordering is `scheduled_at` ascending, then `id`. With no cursor, the list starts at now: the first page is the upcoming bookings. The response is `{ "data": [...], "nextCursor": <string|null>, "prevCursor": <string|null>, "pageSize": <n> }`. Pass `nextCursor` as `after` to go later, and `prevCursor` as `before` to go earlier. A null cursor means nothing lies that way. The default page always returns a `prevCursor`, so you can walk back into history, and that page may then be empty. A cursor past the end returns an empty `data` array and null cursors. There is no total and no page number. A cursor is opaque: it is base64url of `scheduledAt|id`, and a bad one (wrong characters, longer than 200, not a timestamp and a UUID) returns 400.

## Routes

### `GET /api/consultations`

Student only. Lists the caller's consultations.

| Status | Meaning                                                  |
| ------ | -------------------------------------------------------- |
| 200    | One page of the list                                     |
| 400    | Bad cursor, both `after` and `before`, or bad `pageSize` |
| 401    | Signed out                                               |
| 403    | Role is not student                                      |

### `POST /api/consultations`

Student only. Creates a consultation with status `scheduled`.

Body (all fields required, no others allowed):

| Field                   | Rule                                  |
| ----------------------- | ------------------------------------- |
| `firstName`, `lastName` | String, trimmed, 1 to 100 characters  |
| `reason`                | String, trimmed, 1 to 1000 characters |
| `scheduledAt`           | Future ISO 8601 date-time with offset |

| Status    | Meaning                                                                               |
| --------- | ------------------------------------------------------------------------------------- |
| 201       | Created, body is the DTO                                                              |
| 400       | `invalid_json`, or `validation_error` (unknown key, blank name, past date, no offset) |
| 401 / 403 | Signed out / wrong role or bad Origin (`forbidden_origin`)                            |
| 413       | Body over 10 KB                                                                       |
| 415       | Content-Type is not JSON                                                              |
| 429       | More than 10 bookings in a minute, `Retry-After: 60`                                  |
| 500       | `internal_error`, fixed message                                                       |

### `PATCH /api/consultations/{id}`

Student only, own rows only. The body is one of:

```json
{ "action": "complete" }
{ "action": "incomplete" }
{ "action": "cancel" }
{ "action": "reschedule", "scheduledAt": "2030-02-01T09:00:00Z" }
```

| Action       | Effect             | Allowed from |
| ------------ | ------------------ | ------------ |
| `complete`   | status `completed` | `scheduled`  |
| `incomplete` | status `scheduled` | `completed`  |
| `cancel`     | status `cancelled` | `scheduled`  |
| `reschedule` | new `scheduledAt`  | `scheduled`  |

| Status    | Meaning                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 200       | Updated, body is the DTO                                                                                                     |
| 400       | Unknown action, extra key, missing or past `scheduledAt`                                                                     |
| 401 / 403 | Signed out / wrong role or bad Origin                                                                                        |
| 404       | Id is not a UUID, does not exist, or belongs to someone else. All three look the same                                        |
| 409       | `conflict`: the state does not allow the change (for example, anything on a cancelled row, or reschedule on a completed row) |
| 413 / 415 | As above                                                                                                                     |

A student who targets another student's row gets 404, not 403, so ids cannot be probed.

### `GET /api/admin/consultations`

Admin only. Same pagination and DTO as the student list, across all students. The DTO has the booking's first and last name and no email. Read-only: no write route exists for admins.

| Status    | Meaning                                                  |
| --------- | -------------------------------------------------------- |
| 200       | Paginated list                                           |
| 400       | Bad cursor, both `after` and `before`, or bad `pageSize` |
| 401 / 403 | Signed out / role is not admin                           |

## Error codes

| `code`                             | Status |
| ---------------------------------- | ------ |
| `unauthorized`                     | 401    |
| `forbidden`, `forbidden_origin`    | 403    |
| `not_found`                        | 404    |
| `payload_too_large`                | 413    |
| `unsupported_media_type`           | 415    |
| `invalid_json`, `validation_error` | 400    |
| `conflict`                         | 409    |
| `rate_limited`                     | 429    |
| `internal_error`                   | 500    |

## curl examples

To get a session cookie, sign in through the browser and copy the `sb-...-auth-token` cookies from the developer tools. Then replace the placeholders.

```bash
# List my consultations
curl -s "http://localhost:3000/api/consultations?pageSize=10" \
  -H "Cookie: <session cookies copied from the browser>"

# Book
curl -s -X POST http://localhost:3000/api/consultations \
  -H "Cookie: <session cookies>" \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Ann","lastName":"Lee","reason":"Course plan","scheduledAt":"2030-01-01T10:00:00Z"}'

# Cancel
curl -s -X PATCH http://localhost:3000/api/consultations/<consultation id> \
  -H "Cookie: <session cookies>" \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -d '{"action":"cancel"}'

# Admin list
curl -s http://localhost:3000/api/admin/consultations -H "Cookie: <admin session cookies>"
```

Leave out the `Origin` header and the POST returns 403, which is the CSRF check working.
