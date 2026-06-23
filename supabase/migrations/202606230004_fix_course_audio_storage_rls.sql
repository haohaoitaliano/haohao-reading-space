begin;

drop policy if exists "course_audio_objects_select_unlocked_or_admin"
on storage.objects;

create policy "course_audio_objects_select_unlocked_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'course-audio'
  and (
    private.is_admin()
    or exists (
      select 1
      from public.courses as course_row
      join public.camp_members as member_row on member_row.camp_id = course_row.camp_id
      join public.camps as camp_row on camp_row.id = course_row.camp_id
      where course_row.camp_id::text = (storage.foldername(storage.objects.name))[1]
        and course_row.id::text = (storage.foldername(storage.objects.name))[2]
        and course_row.status = 'published'
        and (course_row.unlock_at is null or course_row.unlock_at <= now())
        and member_row.user_id = (select auth.uid())
        and member_row.status = 'active'
        and camp_row.status = 'active'
    )
  )
);

commit;
