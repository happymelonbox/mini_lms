begin;
create extension if not exists pgtap with schema extensions;

-- Runs sql as a simulated PostgREST caller. actor: 'anon' | uid; urole: the user_role claim or null (claim absent).
-- Returns the scalar result, or ERR:<message>. Role is restored afterwards.
create function pg_temp.run_as(actor text, urole text, sql text) returns text language plpgsql as $$
declare r text;
begin
  begin
    perform set_config('request.jwt.claims',
      case when actor = 'anon' then '{"role":"anon"}'
           else jsonb_strip_nulls(
                  jsonb_build_object('sub', actor, 'role', 'authenticated', 'user_role', urole)
                )::text end, true);
    perform set_config('role', case when actor = 'anon' then 'anon' else 'authenticated' end, true);
    execute sql into r;
  exception when others then
    r := 'ERR:' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return coalesce(r, 'null');
end $$;

insert into auth.users (id, instance_id, aud, role, email) values
  ('cccccccc-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated',
    'p-a@example.com'),
  ('cccccccc-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated',
    'p-b@example.com'),
  ('cccccccc-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated',
    'p-admin@example.com');
update public.user_roles set role = 'admin' where user_id = 'cccccccc-0000-4000-8000-0000000000d1';

-- Fixtures: A owns three rows (one cancelled), B owns one. 'policy-test' reason marks them apart from seed data.
insert into public.consultations (id, student_id, first_name, last_name, reason, scheduled_at) values
  ('dddddddd-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-0000000000a1', 'A',
    'One',
    'policy-test',
    now() + interval '1 day'),
  ('dddddddd-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-0000000000a1', 'A',
    'Two',
    'policy-test',
    now() + interval '2 days'),
  ('dddddddd-0000-4000-8000-000000000003', 'cccccccc-0000-4000-8000-0000000000b1', 'B',
    'One',
    'policy-test',
    now() + interval '1 day'),
  ('dddddddd-0000-4000-8000-000000000004', 'cccccccc-0000-4000-8000-0000000000a1', 'A',
    'Four',
    'policy-test',
    now() + interval '1 day');
update public.consultations set status = 'cancelled' where id = 'dddddddd-0000-4000-8000-000000000004';

create temp table alias as select * from (values
  ('{A}', 'cccccccc-0000-4000-8000-0000000000a1'),
  ('{B}', 'cccccccc-0000-4000-8000-0000000000b1'),
  ('{D}', 'cccccccc-0000-4000-8000-0000000000d1'),
  ('{r1}', 'dddddddd-0000-4000-8000-000000000001'),
  ('{r2}', 'dddddddd-0000-4000-8000-000000000002'),
  ('{r3}', 'dddddddd-0000-4000-8000-000000000003'),
  ('{r4}', 'dddddddd-0000-4000-8000-000000000004')
) as t(k, v);
create function pg_temp.expand(t text) returns text language plpgsql as $$
declare a record;
begin
  for a in select * from pg_temp.alias loop t := replace(t, a.k, a.v); end loop;
  return t;
end $$;

-- Table of cases. actor/urole simulate the caller; expected is the exact result text.
-- {A}/{B}/{D} are student A, student B and the admin; {r1}..{r4} are the fixture rows (see `alias`).
create temp table cases as
select row_number() over () as n, * from (values
  -- reads
  ('A sees only own rows',                   '{A}',  'student',
    $$select count(*) from public.consultations where reason = 'policy-test'$$,
    '3'),
  ('B sees only own rows',                   '{B}',  'student',
    $$select count(*) from public.consultations where reason = 'policy-test'$$,
    '1'),
  ('A cannot read B row by id',              '{A}',  'student',
    $$select count(*) from public.consultations where id = '{r3}'$$,
    '0'),
  ('admin sees all rows',                    '{D}',  'admin',
    $$select count(*) from public.consultations where reason = 'policy-test'$$,
    '4'),
  ('anon cannot select',                     'anon', null,
    $$select count(*) from public.consultations$$,
    'ERR:permission denied for table consultations'),
  ('token without role claim sees nothing',  '{A}',  null,
    $$select count(*) from public.consultations where reason = 'policy-test'$$,
    '0'),
  ('student cannot read user_roles',         '{A}',  'student',
    $$select count(*) from public.user_roles$$,
    'ERR:permission denied for table user_roles'),
  ('anon cannot read user_roles',            'anon', null,
    $$select count(*) from public.user_roles$$,
    'ERR:permission denied for table user_roles'),
  -- updates (count of rows changed via CTE)
  ('A completes own row',                    '{A}',  'student',
    $$with x as (update public.consultations set status = 'completed' where id = '{r1}' returning 1)
      select count(*) from x$$,
    '1'),
  ('A reschedules own row',                  '{A}',  'student',
    $$with x as (update public.consultations set scheduled_at = now() + interval '5 days'
      where id = '{r2}' returning 1) select count(*) from x$$,
    '1'),
  ('A cannot update B row',                  '{A}',  'student',
    $$with x as (update public.consultations set status = 'cancelled' where id = '{r3}' returning 1)
      select count(*) from x$$,
    '0'),
  ('admin cannot update any row',            '{D}',  'admin',
    $$with x as (update public.consultations set status = 'cancelled' where reason = 'policy-test'
      returning 1) select count(*) from x$$,
    '0'),
  ('claimless token cannot update own',      '{B}',  null,
    $$with x as (update public.consultations set status = 'completed' where id = '{r3}' returning 1)
      select count(*) from x$$,
    '0'),
  ('anon cannot update',                     'anon', null,
    $$update public.consultations set status = 'completed' returning 'x'$$,
    'ERR:permission denied for table consultations'),
  ('A cannot hand a row to B',               '{A}',  'student',
    $$update public.consultations set student_id = '{B}' where id = '{r2}' returning 'x'$$,
    'ERR:permission denied for table consultations'),
  ('A cannot edit own cancelled row',        '{A}',  'student',
    $$update public.consultations set status = 'scheduled' where id = '{r4}' returning 'x'$$,
    'ERR:consultation_cancelled_immutable'),
  -- column grants
  ('student cannot edit first_name',         '{A}',  'student',
    $$update public.consultations set first_name = 'X' where id = '{r2}' returning 'x'$$,
    'ERR:permission denied for table consultations'),
  ('student cannot edit last_name',          '{A}',  'student',
    $$update public.consultations set last_name = 'X' where id = '{r2}' returning 'x'$$,
    'ERR:permission denied for table consultations'),
  ('student cannot edit reason',             '{A}',  'student',
    $$update public.consultations set reason = 'X' where id = '{r2}' returning 'x'$$,
    'ERR:permission denied for table consultations'),
  ('student cannot edit created_at',         '{A}',  'student',
    $$update public.consultations set created_at = now() where id = '{r2}' returning 'x'$$,
    'ERR:permission denied for table consultations'),
  -- inserts
  ('A inserts own booking',                  '{A}',  'student',
    $$insert into public.consultations (student_id, first_name, last_name, reason, scheduled_at)
      values ('{A}', 'A', 'New', 'x', now() + interval '1 day') returning 'OK'$$,
    'OK'),
  ('A cannot insert as B',                   '{A}',  'student',
    $$insert into public.consultations (student_id, first_name, last_name, reason, scheduled_at)
      values ('{B}', 'A', 'New', 'x', now() + interval '1 day') returning 'OK'$$,
    'ERR:new row violates row-level security policy for table "consultations"'),
  ('admin cannot insert',                    '{D}',  'admin',
    $$insert into public.consultations (student_id, first_name, last_name, reason, scheduled_at)
      values ('{D}', 'D', 'New', 'x', now() + interval '1 day') returning 'OK'$$,
    'ERR:new row violates row-level security policy for table "consultations"'),
  ('claimless token cannot insert',          '{A}',  null,
    $$insert into public.consultations (student_id, first_name, last_name, reason, scheduled_at)
      values ('{A}', 'A', 'New', 'x', now() + interval '1 day') returning 'OK'$$,
    'ERR:new row violates row-level security policy for table "consultations"'),
  ('anon cannot insert',                     'anon', null,
    $$insert into public.consultations (student_id, first_name, last_name, reason, scheduled_at)
      values ('{A}', 'A', 'New', 'x', now() + interval '1 day') returning 'OK'$$,
    'ERR:permission denied for table consultations'),
  ('student cannot choose status on insert', '{A}',  'student',
    $$insert into public.consultations (student_id, first_name, last_name, reason, scheduled_at, status)
      values ('{A}', 'A', 'New', 'x', now() + interval '1 day', 'scheduled') returning 'OK'$$,
    'ERR:permission denied for table consultations'),
  -- deletes: nobody
  ('student cannot delete own row',          '{A}',  'student',
    $$delete from public.consultations where id = '{r2}' returning 'x'$$,
    'ERR:permission denied for table consultations'),
  ('admin cannot delete',                    '{D}',  'admin',
    $$delete from public.consultations returning 'x'$$,
    'ERR:permission denied for table consultations'),
  ('anon cannot delete',                     'anon', null,
    $$delete from public.consultations returning 'x'$$,
    'ERR:permission denied for table consultations')
) as t(description, actor, urole, sql, expected);

select plan(((select count(*) from cases))::int);

-- Cases run in order: reads see the pristine fixtures before the update cases change them.
select is(pg_temp.run_as(pg_temp.expand(actor), urole, pg_temp.expand(sql)), expected, description)
from (select * from cases order by n) c;

select * from finish();
rollback;
