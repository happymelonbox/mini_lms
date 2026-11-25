-- Row level security and column grants for consultations.
alter table public.consultations enable row level security;

-- Column grants are the first wall: students may only set what the booking form and
-- the cancel/complete/reschedule actions need. No DELETE for anyone: cancel is a status change.
grant select on public.consultations to authenticated;
grant insert (student_id, first_name, last_name, reason, scheduled_at) on public.consultations to authenticated;
grant update (status, scheduled_at) on public.consultations to authenticated;

-- Roles are disjoint capabilities: student policies also require the student claim, so a token
-- with no user_role claim gets nothing (fail closed). Admins have a read policy only, so the
-- admin view is read-only by construction. auth.* calls are wrapped in (select ...) so Postgres
-- evaluates them once per statement, not per row.
create policy "students read own" on public.consultations for select to authenticated
  using ((select auth.jwt() ->> 'user_role') = 'student' and (select auth.uid()) = student_id);

create policy "admins read all" on public.consultations for select to authenticated
  using ((select auth.jwt() ->> 'user_role') = 'admin');

create policy "students insert own" on public.consultations for insert to authenticated
  with check ((select auth.jwt() ->> 'user_role') = 'student' and (select auth.uid()) = student_id);

create policy "students update own" on public.consultations for update to authenticated
  using ((select auth.jwt() ->> 'user_role') = 'student' and (select auth.uid()) = student_id)
  with check ((select auth.jwt() ->> 'user_role') = 'student' and (select auth.uid()) = student_id);
