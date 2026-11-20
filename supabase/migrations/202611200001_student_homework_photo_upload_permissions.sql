begin;

drop policy if exists "student_homework_photos_objects_select_own_or_admin"
on storage.objects;

create policy "student_homework_photos_objects_select_own_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-homework-photos'
  and (
    private.is_admin()
    or (
      (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
      and private.is_active_camp_member(
        ((storage.foldername(storage.objects.name))[1])::uuid
      )
      and private.can_read_course_content(
        ((storage.foldername(storage.objects.name))[3])::uuid
      )
      and exists (
        select 1
        from public.courses as course_row
        where course_row.id = ((storage.foldername(storage.objects.name))[3])::uuid
          and course_row.camp_id = ((storage.foldername(storage.objects.name))[1])::uuid
      )
    )
  )
);

drop policy if exists "student_homework_photos_objects_insert_own"
on storage.objects;

create policy "student_homework_photos_objects_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-homework-photos'
  and (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
  and private.is_active_camp_member(
    ((storage.foldername(storage.objects.name))[1])::uuid
  )
  and private.can_read_course_content(
    ((storage.foldername(storage.objects.name))[3])::uuid
  )
  and exists (
    select 1
    from public.courses as course_row
    where course_row.id = ((storage.foldername(storage.objects.name))[3])::uuid
      and course_row.camp_id = ((storage.foldername(storage.objects.name))[1])::uuid
  )
);

commit;
