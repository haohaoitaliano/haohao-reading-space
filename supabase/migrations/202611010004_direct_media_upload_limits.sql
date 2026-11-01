begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'course-videos',
    'course-videos',
    false,
    104857600,
    array['video/mp4', 'video/quicktime', 'video/webm']
  ),
  (
    'course-pdfs',
    'course-pdfs',
    false,
    20971520,
    array['application/pdf']
  ),
  (
    'student-homework-photos',
    'student-homework-photos',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/heic', 'image/heif']
  )
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
        join public.course_contents as content_row
          on content_row.course_id = course_row.id
        where course_row.id = ((storage.foldername(storage.objects.name))[3])::uuid
          and course_row.camp_id = ((storage.foldername(storage.objects.name))[1])::uuid
          and content_row.photo_assignment_enabled
      )
    )
  )
);

commit;
