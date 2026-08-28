begin;

drop policy if exists "camps_delete_admin_only" on public.camps;

drop function if exists private.is_empty_camp(uuid);

create or replace function private.has_no_camp_members(target_camp_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.camp_members
    where camp_id = target_camp_id
      and status = 'active'
  );
$$;

revoke all on function private.has_no_camp_members(uuid) from public, anon;
grant execute on function private.has_no_camp_members(uuid) to authenticated;

create policy "camps_delete_admin_only"
on public.camps
for delete
to authenticated
using (private.is_admin() and private.has_no_camp_members(id));

create policy "student_recordings_objects_delete_admin_only"
on storage.objects
for delete
to authenticated
using (bucket_id = 'student-recordings' and private.is_admin());

commit;
