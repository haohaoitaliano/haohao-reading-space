begin;

create or replace function private.course_has_no_submissions(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.student_submissions where course_id = target_course_id);
$$;

revoke all on function private.course_has_no_submissions(uuid) from public, anon;
grant execute on function private.course_has_no_submissions(uuid) to authenticated;

drop policy if exists "courses_delete_admin_only" on public.courses;

create policy "courses_delete_admin_only"
on public.courses
for delete
to authenticated
using (private.is_admin() and private.course_has_no_submissions(id));

commit;
