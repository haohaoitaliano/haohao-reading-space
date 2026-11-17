begin;

alter table public.course_contents
  add column if not exists recording_assignment_required boolean not null default false,
  add column if not exists photo_assignment_required boolean not null default false;

comment on column public.course_contents.recording_assignment_required is
  'Whether a recording is required for completion; upload remains available when false.';
comment on column public.course_contents.photo_assignment_required is
  'Whether at least one photo is required for completion; upload remains available when false.';

create or replace function public.complete_student_assignment(
  target_assignment_id uuid,
  target_camp_id uuid,
  target_course_id uuid,
  audio_metadata jsonb default null,
  photos_metadata jsonb default '[]'::jsonb
)
returns table (
  assignment_id uuid,
  assignment_version integer,
  audio_submission_id uuid,
  audio_version integer,
  photo_submission_id uuid,
  audio_transcode_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, storage
as $$
declare
  current_user_id uuid := (select auth.uid());
  course_row record;
  existing_assignment record;
  new_assignment record;
  result_audio_id uuid;
  result_audio_version integer;
  result_photo_submission_id uuid;
  result_audio_transcode_status text;
  photo_item jsonb;
  photo_total integer;
  audio_path text;
  photo_path text;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.profiles
    where id = current_user_id and role = 'student' and status = 'active'
  ) then
    raise exception 'active student required';
  end if;
  if jsonb_typeof(coalesce(photos_metadata, '[]'::jsonb)) <> 'array' then
    raise exception 'photos metadata must be an array';
  end if;
  photo_total := jsonb_array_length(coalesce(photos_metadata, '[]'::jsonb));

  select course.id, course.camp_id,
    content.recording_assignment_required, content.photo_assignment_required
  into course_row
  from public.courses as course
  join public.course_contents as content on content.course_id = course.id
  where course.id = target_course_id
    and course.camp_id = target_camp_id
    and private.can_read_course_content(course.id);

  if not found then raise exception 'course is unavailable'; end if;

  select * into existing_assignment
  from public.student_assignment_submissions
  where id = target_assignment_id;

  if found then
    if existing_assignment.user_id <> current_user_id
      or existing_assignment.camp_id <> target_camp_id
      or existing_assignment.course_id <> target_course_id then
      raise exception 'assignment id conflict';
    end if;
    return query
      select existing_assignment.id, existing_assignment.version,
        audio_row.id, audio_row.version, photo_row.id, audio_row.transcode_status
      from (select 1) as singleton
      left join public.student_submissions as audio_row
        on audio_row.assignment_submission_id = existing_assignment.id
      left join public.student_photo_submissions as photo_row
        on photo_row.assignment_submission_id = existing_assignment.id;
    return;
  end if;

  if course_row.recording_assignment_required and audio_metadata is null then
    raise exception 'required recording is missing';
  end if;
  if course_row.photo_assignment_required and photo_total < 1 then
    raise exception 'required photo is missing';
  end if;
  if photo_total > 3 then
    raise exception 'too many photos';
  end if;
  if audio_metadata is null and photo_total = 0 then
    raise exception 'assignment has no material';
  end if;

  if audio_metadata is not null then
    audio_path := audio_metadata->>'storage_path';
    if (audio_metadata->>'id')::uuid <> target_assignment_id
      or (storage.foldername(audio_path))[1] <> target_camp_id::text
      or (storage.foldername(audio_path))[2] <> current_user_id::text
      or (storage.foldername(audio_path))[3] <> target_assignment_id::text
      or not exists (
        select 1 from storage.objects
        where bucket_id = 'student-recordings' and name = audio_path
      ) then
      raise exception 'invalid recording object';
    end if;
  end if;

  for photo_item in select value from jsonb_array_elements(coalesce(photos_metadata, '[]'::jsonb)) loop
    photo_path := photo_item->>'storage_path';
    if (storage.foldername(photo_path))[1] <> target_camp_id::text
      or (storage.foldername(photo_path))[2] <> current_user_id::text
      or (storage.foldername(photo_path))[3] <> target_course_id::text
      or (storage.foldername(photo_path))[4] <> target_assignment_id::text
      or not exists (
        select 1 from storage.objects
        where bucket_id = 'student-homework-photos' and name = photo_path
      ) then
      raise exception 'invalid photo object';
    end if;
  end loop;

  insert into public.student_assignment_submissions (
    id, camp_id, course_id, user_id, visibility, has_recording, photo_count
  ) values (
    target_assignment_id, target_camp_id, target_course_id, current_user_id,
    'public', audio_metadata is not null, photo_total
  ) returning * into new_assignment;

  if audio_metadata is not null then
    insert into public.student_submissions (
      id, camp_id, course_id, user_id, storage_path, file_name, mime_type,
      size_bytes, duration_seconds, visibility, assignment_submission_id
    ) values (
      target_assignment_id, target_camp_id, target_course_id, current_user_id,
      audio_metadata->>'storage_path', left(audio_metadata->>'file_name', 255),
      audio_metadata->>'mime_type', (audio_metadata->>'size_bytes')::bigint,
      (audio_metadata->>'duration_seconds')::numeric, 'public', target_assignment_id
    ) returning id, version, transcode_status
      into result_audio_id, result_audio_version, result_audio_transcode_status;
  end if;

  if photo_total > 0 then
    insert into public.student_photo_submissions (
      id, camp_id, course_id, user_id, assignment_submission_id
    ) values (
      target_assignment_id, target_camp_id, target_course_id, current_user_id, target_assignment_id
    ) returning id into result_photo_submission_id;

    for photo_item in select value from jsonb_array_elements(photos_metadata) loop
      insert into public.student_submission_photos (
        id, submission_id, storage_path, file_name, mime_type, size_bytes, position
      ) values (
        (photo_item->>'id')::uuid, target_assignment_id, photo_item->>'storage_path',
        left(photo_item->>'file_name', 255), photo_item->>'mime_type',
        (photo_item->>'size_bytes')::bigint, (photo_item->>'position')::integer
      );
    end loop;
  end if;

  return query select new_assignment.id, new_assignment.version,
    result_audio_id, result_audio_version, result_photo_submission_id, result_audio_transcode_status;
end;
$$;

revoke all on function public.complete_student_assignment(uuid, uuid, uuid, jsonb, jsonb)
from public, anon;
grant execute on function public.complete_student_assignment(uuid, uuid, uuid, jsonb, jsonb)
to authenticated;

commit;
