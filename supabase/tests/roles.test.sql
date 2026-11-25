begin;
create extension if not exists pgtap with schema extensions;

-- Users are created inside the test so it does not depend on seed data.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't-student@example.com'),
  ('aaaaaaaa-0000-4000-8000-0000000000a2',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 't-admin@example.com');
update public.user_roles set role = 'admin' where user_id = 'aaaaaaaa-0000-4000-8000-0000000000a2';

-- What the token hook puts in the user_role claim.
create temp table hook_cases as
select * from (values
  ('signup trigger gives new user the student role', 'aaaaaaaa-0000-4000-8000-0000000000a1'::uuid, 'student'),
  ('promoted user gets admin claim',                 'aaaaaaaa-0000-4000-8000-0000000000a2'::uuid, 'admin'),
  ('unknown user gets no role claim (fail closed)',  'aaaaaaaa-0000-4000-8000-0000000000ff'::uuid, null)
) as t(description, uid, expected_role);

-- Objects created later in public must not be reachable by API roles by default.
create table public.zz_new_table (id int);
create function public.zz_new_fn() returns int language sql as 'select 1';

-- Who may execute / read what.
create temp table priv_cases as
select * from (values
  ('authenticated cannot execute hook',
    'authenticated',       'function', 'public.custom_access_token_hook(jsonb)', 'execute', false),
  ('anon cannot execute hook',
    'anon',                'function', 'public.custom_access_token_hook(jsonb)', 'execute', false),
  ('auth admin can execute hook',
    'supabase_auth_admin', 'function', 'public.custom_access_token_hook(jsonb)', 'execute', true),
  ('authenticated cannot read user_roles',
    'authenticated',       'table',    'public.user_roles',                      'select',  false),
  ('anon cannot read user_roles',
    'anon',                'table',    'public.user_roles',                      'select',  false),
  ('authenticated cannot write user_roles',
    'authenticated',       'table',    'public.user_roles',                      'update',  false),
  ('auth admin can read user_roles',
    'supabase_auth_admin', 'table',    'public.user_roles',                      'select',  true),
  ('anon gets no default table grant',
    'anon',                'table',    'public.zz_new_table',                    'select',  false),
  ('authenticated gets no default table grant',
    'authenticated',       'table',    'public.zz_new_table',                    'insert',  false),
  ('anon gets no default function grant',
    'anon',                'function', 'public.zz_new_fn()',                     'execute', false),
  ('authenticated gets no default function grant',
    'authenticated',       'function', 'public.zz_new_fn()',                     'execute', false)
) as t(description, grantee, kind, object, priv, expected);

select plan(((select count(*) from hook_cases) + (select count(*) from priv_cases) + 1)::int);

select is(
  public.custom_access_token_hook(
    jsonb_build_object('user_id', uid, 'claims', '{"sub":"x"}'::jsonb)
  )->'claims'->>'user_role',
  expected_role, description)
from hook_cases;

select is(
  case kind when 'function' then has_function_privilege(grantee, object, priv)
            else has_table_privilege(grantee, object, priv) end,
  expected, description)
from priv_cases;

select ok((select relrowsecurity from pg_class where oid = t.tbl), description)
from (values ('public.user_roles'::regclass, 'user_roles has RLS enabled')) as t(tbl, description);

select * from finish();
rollback;
