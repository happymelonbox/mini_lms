-- Roles: default privilege lockdown, app_role, user_roles, and the JWT hook that puts the role in the token.
-- Tables, functions and sequences created later in `public` must not be callable by API roles
-- unless a migration grants it explicitly (Supabase's defaults grant everything to anon/authenticated).
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
-- Functions are also executable by PUBLIC by default, which no schema-scoped revoke can undo.
alter default privileges for role postgres revoke execute on functions from public;

create type public.app_role as enum ('student', 'admin');

create table public.user_roles (
  user_id uuid primary key references auth.users on delete cascade,
  role public.app_role not null default 'student'
);

-- Only the auth service reads this table (via the token hook); the Data API never does.
alter table public.user_roles enable row level security;
grant select on public.user_roles to supabase_auth_admin;
create policy "auth admin reads roles" on public.user_roles
  for select to supabase_auth_admin using (true);

-- Every new user starts as a student; admins are promoted via SQL only.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Custom access token hook: copies the role into the JWT as `user_role`.
-- Reads user_roles only, never user_metadata (users can edit that). No row -> JSON null claim,
-- so RLS and getCurrentUser both fail closed.
create function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  claims jsonb;
  r public.app_role;
begin
  select role into r from public.user_roles where user_id = (event->>'user_id')::uuid;
  claims := jsonb_set(event->'claims', '{user_role}', coalesce(to_jsonb(r::text), 'null'::jsonb));
  return jsonb_set(event, '{claims}', claims);
end $$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
