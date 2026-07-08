begin;

create or replace function private.is_empty_camp(target_camp_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (select 1 from public.courses where camp_id = target_camp_id)
    and not exists (select 1 from public.camp_members where camp_id = target_camp_id)
    and not exists (select 1 from public.weekly_meetings where camp_id = target_camp_id)
    and not exists (select 1 from public.camp_invites where camp_id = target_camp_id)
    and not exists (select 1 from public.student_submissions where camp_id = target_camp_id);
$$;

revoke all on function private.is_empty_camp(uuid) from public, anon;
grant execute on function private.is_empty_camp(uuid) to authenticated;

drop policy if exists "camps_delete_admin_only" on public.camps;

create policy "camps_delete_admin_only"
on public.camps
for delete
to authenticated
using (private.is_admin() and private.is_empty_camp(id));

commit;
