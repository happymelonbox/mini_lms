begin;
create extension if not exists pgtap with schema extensions;

-- Runs one statement; returns its single result, or ERR:<constraint name | message> on failure.
-- Guard triggers raise stable machine-matchable messages, so the message is the contract.
create function pg_temp.run(sql text) returns text language plpgsql as $$
declare r text; c text;
begin
  execute sql into r;
  return coalesce(r, 'null');
exception when others then
  get stacked diagnostics c = constraint_name;
  return 'ERR:' || coalesce(nullif(c, ''), sqlerrm);
end $$;

insert into auth.users (id, instance_id, aud, role, email) values
  ('bbbbbbbb-0000-4000-8000-0000000000a1',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g-student@example.com'),
  ('bbbbbbbb-0000-4000-8000-0000000000a2',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g-other@example.com');

-- INSERT cases: name fields, reason, schedule, status.
create temp table ins_cases as
select * from (values
  ('valid booking',
    'Ann',            'Lee',            'Help',        '1 day',     'scheduled', 'OK'),
  ('one second ahead is future',
    'Ann',            'Lee',            'Help',        '1 second',  'scheduled', 'OK'),
  ('past schedule rejected',
    'Ann',            'Lee',            'Help',        '-1 day',    'scheduled', 'ERR:scheduled_at_must_be_future'),
  ('schedule == now rejected',
    'Ann',            'Lee',            'Help',        '0 seconds', 'scheduled', 'ERR:scheduled_at_must_be_future'),
  ('insert as completed rejected',
    'Ann',            'Lee',            'Help',        '1 day',     'completed', 'ERR:insert_must_be_scheduled'),
  ('insert as cancelled rejected',
    'Ann',            'Lee',            'Help',        '1 day',     'cancelled', 'ERR:insert_must_be_scheduled'),
  ('empty first_name rejected',
    '',               'Lee',            'Help',        '1 day',     'scheduled', 'ERR:first_name_valid'),
  ('untrimmed first_name rejected',
    ' Ann',           'Lee',            'Help',        '1 day',     'scheduled', 'ERR:first_name_valid'),
  ('100-char first_name ok',
    repeat('a', 100), 'Lee',            'Help',        '1 day',     'scheduled', 'OK'),
  ('101-char first_name rejected',
    repeat('a', 101), 'Lee',            'Help',        '1 day',     'scheduled', 'ERR:first_name_valid'),
  ('empty last_name rejected',
    'Ann',            '',               'Help',        '1 day',     'scheduled', 'ERR:last_name_valid'),
  ('untrimmed last_name rejected',
    'Ann',            'Lee ',           'Help',        '1 day',     'scheduled', 'ERR:last_name_valid'),
  ('101-char last_name rejected',
    'Ann',            repeat('a', 101), 'Help',        '1 day',     'scheduled', 'ERR:last_name_valid'),
  ('empty reason rejected',
    'Ann',            'Lee',            '',            '1 day',     'scheduled', 'ERR:reason_valid'),
  ('blank reason rejected',
    'Ann',            'Lee',            '   ',         '1 day',     'scheduled', 'ERR:reason_valid'),
  ('1000-char reason ok',
    'Ann',            'Lee',            repeat('a', 1000), '1 day',     'scheduled', 'OK'),
  ('1001-char reason rejected',
    'Ann',            'Lee',            repeat('a', 1001), '1 day',     'scheduled', 'ERR:reason_valid'),
  ('interior space ok',
    'Ann Marie',      'Lee',            'Need  help',  '1 day',     'scheduled', 'OK'),
  ('tab-only first_name rejected',
    E'\t',            'Lee',            'Help',        '1 day',     'scheduled', 'ERR:first_name_valid'),
  ('trailing newline first_name rejected',
    E'Ann\n',         'Lee',            'Help',        '1 day',     'scheduled', 'ERR:first_name_valid'),
  ('leading tab last_name rejected',
    'Ann',            E'\tLee',         'Help',        '1 day',     'scheduled', 'ERR:last_name_valid'),
  ('whitespace-only last_name rejected',
    'Ann',            E' \t\n',         'Help',        '1 day',     'scheduled', 'ERR:last_name_valid'),
  ('newline-only reason rejected',
    'Ann',            'Lee',            E'\n',         '1 day',     'scheduled', 'ERR:reason_valid'),
  ('trailing tab reason rejected',
    'Ann',            'Lee',            E'Help\t',     '1 day',     'scheduled', 'ERR:reason_valid'),
  ('leading space reason rejected',
    'Ann',            'Lee',            ' Help',       '1 day',     'scheduled', 'ERR:reason_valid'),
  ('BOM-only first_name rejected',
    E'\uFEFF',        'Lee',            'Help',        '1 day',     'scheduled', 'ERR:first_name_valid'),
  ('leading BOM last_name rejected',
    'Ann',            E'\uFEFFLee',     'Help',        '1 day',     'scheduled', 'ERR:last_name_valid'),
  ('leading ZWSP reason ok (JS trim keeps it too)',
    'Ann',            'Lee',            E'\u200BHelp', '1 day',     'scheduled', 'OK'),
  ('trailing NEL first_name ok (JS trim keeps it)',
    'Ann' || E'\u0085', 'Lee',            'Help',        '1 day',     'scheduled', 'OK'),
  ('leading U+001C first_name ok (JS trim keeps it)',
    E'\u001CAnn',     'Lee',            'Help',        '1 day',     'scheduled', 'OK'),
  ('leading ideographic space first_name rejected',
    E'\u3000Ann',     'Lee',            'Help',        '1 day',     'scheduled', 'ERR:first_name_valid'),
  ('trailing space first_name rejected',
    'Ann ',           'Lee',            'Help',        '1 day',     'scheduled', 'ERR:first_name_valid'),
  ('NBSP-only last_name rejected',
    'Ann',            E'\u00A0',        'Help',        '1 day',     'scheduled', 'ERR:last_name_valid')
) as t(description, first_name, last_name, reason, offset_by, status, expected);

-- UPDATE cases: each runs against a fresh row seeded in from_status.
-- Transition matrix first: every from -> to pair.
create temp table upd_cases as
select row_number() over () as n, * from (values
  ('scheduled -> scheduled (no-op)',
    'scheduled', $$status = 'scheduled'$$,                                'OK'),
  ('scheduled -> completed',
    'scheduled', $$status = 'completed'$$,                                'OK'),
  ('scheduled -> cancelled',
    'scheduled', $$status = 'cancelled'$$,                                'OK'),
  ('completed -> scheduled',
    'completed', $$status = 'scheduled'$$,                                'OK'),
  ('completed -> completed (no-op)',
    'completed', $$status = 'completed'$$,                                'OK'),
  ('completed -> cancelled',
    'completed', $$status = 'cancelled'$$,                                'ERR:invalid_status_transition'),
  ('cancelled -> scheduled',
    'cancelled', $$status = 'scheduled'$$,                                'ERR:consultation_cancelled_immutable'),
  ('cancelled -> completed',
    'cancelled', $$status = 'completed'$$,                                'ERR:consultation_cancelled_immutable'),
  ('cancelled -> cancelled',
    'cancelled', $$status = 'cancelled'$$,                                'ERR:consultation_cancelled_immutable'),
  -- reschedule rules
  ('reschedule scheduled to future',
    'scheduled', $$scheduled_at = now() + interval '2 days'$$,            'OK'),
  ('reschedule scheduled to past',
    'scheduled', $$scheduled_at = now() - interval '1 day'$$,             'ERR:scheduled_at_must_be_future'),
  ('reschedule scheduled to now',
    'scheduled', $$scheduled_at = now()$$,                                'ERR:scheduled_at_must_be_future'),
  ('reschedule completed rejected',
    'completed', $$scheduled_at = now() + interval '2 days'$$,            'ERR:reschedule_requires_scheduled'),
  ('reschedule cancelled rejected',
    'cancelled', $$scheduled_at = now() + interval '2 days'$$,            'ERR:consultation_cancelled_immutable'),
  ('reschedule + complete together',
    'scheduled', $$scheduled_at = now() + interval '2 days', status = 'completed'$$, 'OK'),
  -- immutability
  ('student_id change on scheduled',
    'scheduled', $$student_id = 'bbbbbbbb-0000-4000-8000-0000000000a2'$$, 'ERR:student_id_immutable'),
  ('student_id change on completed',
    'completed', $$student_id = 'bbbbbbbb-0000-4000-8000-0000000000a2'$$, 'ERR:student_id_immutable'),
  ('cancelled row: any edit rejected',
    'cancelled', $$reason = 'edited'$$,                                   'ERR:consultation_cancelled_immutable')
) as t(description, from_status, set_clause, expected);

-- Rate limit (10 per student per minute). Each case gets its own student: `prior` rows are
-- created `prior_age` ago, then one statement inserts `batch` rows at once.
create temp table rate_cases as
select * from (values
  ('10th insert is allowed',
    'bbbbbbbb-0000-4000-8000-0000000000c1'::uuid, 9,  interval '0',         1,  'OK'),
  ('11th insert is rejected',
    'bbbbbbbb-0000-4000-8000-0000000000c2'::uuid, 10, interval '0',         1,  'ERR:rate_limited'),
  ('one multi-row insert of 10 is allowed',
    'bbbbbbbb-0000-4000-8000-0000000000c3'::uuid, 0,  interval '0',         10, 'OK'),
  ('one multi-row insert of 11 is rejected',
    'bbbbbbbb-0000-4000-8000-0000000000c4'::uuid, 0,  interval '0',         11, 'ERR:rate_limited'),
  ('rows older than a minute do not count',
    'bbbbbbbb-0000-4000-8000-0000000000c5'::uuid, 10, interval '2 minutes', 1,  'OK'),
  ('another student is unaffected by a saturated one',
    'bbbbbbbb-0000-4000-8000-0000000000c6'::uuid, 0,  interval '0',         1,  'OK')
) as t(description, student, prior, prior_age, batch, expected);

insert into auth.users (id, instance_id, aud, role, email)
select student, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'g-rate-' || right(student::text, 2) || '@example.com'
from rate_cases;

select plan((
  (select count(*) from ins_cases) + (select count(*) from upd_cases) + (select count(*) from rate_cases) + 1
)::int);

-- Seed one row per update case (insert as scheduled, then move to from_status, as the guard requires).
create temp table upd_rows as
select n, gen_random_uuid() as id, from_status from upd_cases;
-- created an hour ago so these 18 rows stay outside the rate-limit window.
insert into public.consultations (id, student_id, first_name, last_name, reason, scheduled_at, created_at)
select id, 'bbbbbbbb-0000-4000-8000-0000000000a1', 'Ann', 'Lee', 'Help',
       now() + interval '1 day', now() - interval '1 hour'
from upd_rows;
update public.consultations c set status = r.from_status::public.consultation_status
from upd_rows r where c.id = r.id and r.from_status <> 'scheduled';

select is(
  pg_temp.run(format(
    $q$insert into public.consultations (student_id, first_name, last_name, reason, scheduled_at, status)
       values ('bbbbbbbb-0000-4000-8000-0000000000a1', %L, %L, %L, now() + %L::interval, %L) returning 'OK'$q$,
    first_name, last_name, reason, offset_by, status)),
  expected, 'insert: ' || description)
from ins_cases;

select is(
  pg_temp.run(format($q$update public.consultations set %s where id = %L returning 'OK'$q$, c.set_clause, r.id)),
  c.expected, 'update: ' || c.description)
from upd_cases c join upd_rows r using (n);

insert into public.consultations (student_id, first_name, last_name, reason, scheduled_at, created_at)
select student, 'Ann', 'Lee', 'Help', now() + interval '1 day', now() - prior_age
from rate_cases, generate_series(1, prior);

select is(
  pg_temp.run(format(
    $q$insert into public.consultations (student_id, first_name, last_name, reason, scheduled_at)
       select %L, 'Ann', 'Lee', 'Help', now() + interval '1 day' from generate_series(1, %s) returning 'OK'$q$,
    student, batch)),
  expected, 'rate limit: ' || description)
from rate_cases;

select ok(
  (select updated_at > created_at from public.consultations where id = r.id), description)
from (values (2, 'updated_at is bumped by an update')) as t(n, description) join upd_rows r using (n);

select * from finish();
rollback;
