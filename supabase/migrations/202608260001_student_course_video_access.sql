begin;

drop policy if exists "course_videos_select_admin_only" on public.course_videos;

create policy "course_videos_select_unlocked_or_admin"
on public.course_videos
for select
to authenticated
using (private.is_admin() or private.can_read_course_content(course_id));

drop policy if exists "course_videos_objects_select_admin_only" on storage.objects;

create policy "course_videos_objects_select_unlocked_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'course-videos'
  and (
    private.is_admin()
    or exists (
      select 1
      from public.courses as course_row
      where course_row.camp_id::text = (storage.foldername(storage.objects.name))[1]
        and course_row.id::text = (storage.foldername(storage.objects.name))[2]
        and private.can_read_course_content(course_row.id)
    )
  )
);

commit;
