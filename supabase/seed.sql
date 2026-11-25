-- Local demo data only. All three users log in with password 'Password123!'.
-- The signup trigger gives each user the student role; the admin is promoted below.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'student@example.com',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'student2@example.com',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''),
  ('99999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'admin@example.com',
    crypt('Password123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', '');

insert into auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, 'email', id::text,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now()
from auth.users where email in ('student@example.com', 'student2@example.com', 'admin@example.com');

update public.user_roles set role = 'admin' where user_id = '99999999-9999-4999-8999-999999999999';

-- The insert guard only accepts future scheduled rows, so create as scheduled, then move status.
insert into public.consultations (id, student_id, first_name, last_name, reason, scheduled_at) values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
    'Sam',  'Student', 'Questions about my course plan', now() + interval '2 days'),
  ('a0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
    'Sam',  'Student', 'Help with the final project',    now() + interval '5 days'),
  ('a0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
    'Sam',  'Student', 'Schedule clash',                 now() + interval '7 days'),
  ('b0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
    'Sara', 'Second',  'Career advice',                  now() + interval '3 days'),
  ('b0000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
    'Sara', 'Second',  'Exam preparation tips',          now() + interval '6 days'),
  ('b0000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222',
    'Sara', 'Second',  'Intro session (done)',           now() + interval '1 day');
update public.consultations set status = 'cancelled' where id = 'a0000000-0000-4000-8000-000000000003';
update public.consultations set status = 'completed' where id = 'b0000000-0000-4000-8000-000000000003';
