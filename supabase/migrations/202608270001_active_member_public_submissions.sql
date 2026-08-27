begin;

create or replace function private.is_active_camp_user(
  target_camp_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.camp_members as member_row
    join public.camps as camp_row on camp_row.id = member_row.camp_id
    where member_row.camp_id = target_camp_id
      and member_row.user_id = target_user_id
      and member_row.status = 'active'
      and camp_row.status = 'active'
  );
$$;

revoke all on function private.is_active_camp_user(uuid, uuid) from public, anon;
grant execute on function private.is_active_camp_user(uuid, uuid) to authenticated;

drop policy if exists "student_submissions_select_visible"
on public.student_submissions;

create policy "student_submissions_select_visible"
on public.student_submissions
for select
to authenticated
using (
  private.is_admin()
  or user_id = (select auth.uid())
  or (
    visibility = 'public'
    and private.is_active_camp_member(camp_id)
    and private.is_active_camp_user(camp_id, user_id)
  )
);

commit;
