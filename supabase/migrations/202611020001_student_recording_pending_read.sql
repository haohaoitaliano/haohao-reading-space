begin;

drop policy if exists "student_recordings_objects_select_own_active_camp_pending"
on storage.objects;

create policy "student_recordings_objects_select_own_active_camp_pending"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-recordings'
  and exists (
    select 1
    from public.profiles as profile_row
    where profile_row.id = (select auth.uid())
      and profile_row.role = 'student'
      and profile_row.status = 'active'
  )
  and (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
  and private.is_active_camp_member(
    ((storage.foldername(storage.objects.name))[1])::uuid
  )
);

commit;
