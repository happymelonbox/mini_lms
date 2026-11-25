create type public.consultation_status as enum ('scheduled', 'completed', 'cancelled');

-- Text checks match JS trim() exactly: an explicit whitespace list (not \s), so the result does not depend on the
-- DB locale. Length >= 1 with no leading whitespace already means the first character is not whitespace.
create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users on delete cascade,
  first_name text not null constraint first_name_valid check (
    char_length(first_name) between 1 and 100
    and first_name !~ '^[\t\n\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]'
      '|[\t\n\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]$'
  ),
  last_name text not null constraint last_name_valid check (
    char_length(last_name) between 1 and 100
    and last_name !~ '^[\t\n\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]'
      '|[\t\n\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]$'
  ),
  reason text not null constraint reason_valid check (
    char_length(reason) between 1 and 1000
    and reason !~ '^[\t\n\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]'
      '|[\t\n\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]$'
  ),
  scheduled_at timestamptz not null,
  status public.consultation_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index consultations_student_scheduled_idx on public.consultations (student_id, scheduled_at);
create index consultations_student_created_idx on public.consultations (student_id, created_at);
create index consultations_scheduled_idx on public.consultations (scheduled_at);

-- clock_timestamp(), not now(): now() is frozen inside a transaction.
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

-- Business rules live in the DB too (defence in depth). Messages are a stable contract:
-- the API layer maps them to 400/409, so do not reword them.
create function public.guard_consultation_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Rate limit lives here, not in the API: it is shared across app instances and also covers
  -- direct PostgREST calls. The per-student advisory lock serialises concurrent inserts so the
  -- count below cannot be raced; rows of one multi-row insert count as they go in. It is a try-lock:
  -- a waiter would hold a PostgREST pool connection, so a burst from one student could starve everyone.
  if not pg_try_advisory_xact_lock(hashtextextended(new.student_id::text, 0)) then
    raise exception using errcode = 'P0001', message = 'rate_limited';
  end if;
  if (select count(*) from public.consultations
      where student_id = new.student_id and created_at > now() - interval '1 minute') >= 10 then
    raise exception using errcode = 'P0001', message = 'rate_limited';
  end if;
  if new.status <> 'scheduled' then
    raise exception using errcode = 'P0001', message = 'insert_must_be_scheduled';
  end if;
  if new.scheduled_at <= now() then
    raise exception using errcode = 'P0001', message = 'scheduled_at_must_be_future';
  end if;
  return new;
end $$;

create function public.guard_consultation_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.student_id is distinct from old.student_id then
    raise exception using errcode = 'P0001', message = 'student_id_immutable';
  end if;
  if old.status = 'cancelled' then
    raise exception using errcode = 'P0001', message = 'consultation_cancelled_immutable';
  end if;
  -- allowed moves: scheduled <-> completed, scheduled -> cancelled
  if new.status <> old.status and not (
       old.status = 'scheduled'
    or (old.status = 'completed' and new.status = 'scheduled')
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_status_transition';
  end if;
  if new.scheduled_at is distinct from old.scheduled_at then
    if old.status <> 'scheduled' then
      raise exception using errcode = 'P0001', message = 'reschedule_requires_scheduled';
    end if;
    if new.scheduled_at <= now() then
      raise exception using errcode = 'P0001', message = 'scheduled_at_must_be_future';
    end if;
  end if;
  return new;
end $$;

create trigger consultations_set_updated_at before update on public.consultations
  for each row execute function public.set_updated_at();
create trigger consultations_guard_insert before insert on public.consultations
  for each row execute function public.guard_consultation_insert();
create trigger consultations_guard_update before update on public.consultations
  for each row execute function public.guard_consultation_update();
