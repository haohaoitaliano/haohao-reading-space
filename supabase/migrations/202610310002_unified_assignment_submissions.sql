begin;

create table public.student_assignment_submissions (
  id uuid primary key,
  camp_id uuid not null references public.camps (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  student_display_name text not null default '同学',
  version integer not null default 1 check (version > 0),
  visibility text not null default 'public' check (visibility in ('public', 'teacher_only')),
  has_recording boolean not null,
  photo_count integer not null check (photo_count between 0 and 3),
  created_at timestamptz not null default now(),
  unique (course_id, user_id, version),
  check (has_recording or photo_count > 0)
);

alter table public.student_submissions
  add column assignment_submission_id uuid unique
    references public.student_assignment_submissions (id) on delete cascade;

alter table public.student_photo_submissions
  add column assignment_submission_id uuid unique
    references public.student_assignment_submissions (id) on delete cascade;

create index student_assignment_submissions_camp_created_idx
  on public.student_assignment_submissions (camp_id, created_at desc);
create index student_assignment_submissions_user_created_idx
  on public.student_assignment_submissions (user_id, created_at desc);

create or replace function private.prepare_student_assignment_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  latest_version integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.course_id::text || ':' || new.user_id::text || ':assignment', 0));

  select coalesce(nullif(trim(profile_row.display_name), ''), '同学')
  into new.student_display_name
  from public.profiles as profile_row
  where profile_row.id = new.user_id;

  select greatest(
    coalesce((
      select max(existing.version)
      from public.student_assignment_submissions as existing
      where existing.course_id = new.course_id and existing.user_id = new.user_id
    ), 0),
    coalesce((
      select max(existing.version)
      from public.student_submissions as existing
      where existing.course_id = new.course_id
        and existing.user_id = new.user_id
        and existing.assignment_submission_id is null
    ), 0),
    coalesce((
      select max(existing.version)
      from public.student_photo_submissions as existing
      where existing.course_id = new.course_id
        and existing.user_id = new.user_id
        and existing.assignment_submission_id is null
    ), 0)
  ) + 1 into latest_version;

  new.version := latest_version;
  new.created_at := now();
  return new;
end;
$$;

create trigger prepare_student_assignment_submission_before_insert
before insert on public.student_assignment_submissions
for each row execute function private.prepare_student_assignment_submission();

revoke all on function private.prepare_student_assignment_submission() from public, anon, authenticated;

create or replace function private.can_read_student_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_assignment_submissions as assignment_row
    where assignment_row.id = target_assignment_id
      and (
        private.is_admin()
        or assignment_row.user_id = (select auth.uid())
        or (
          assignment_row.visibility = 'public'
          and private.is_active_camp_member(assignment_row.camp_id)
          and private.is_active_camp_user(assignment_row.camp_id, assignment_row.user_id)
        )
      )
  );
$$;

revoke all on function private.can_read_student_assignment(uuid) from public, anon;
grant execute on function private.can_read_student_assignment(uuid) to authenticated;

alter table public.student_assignment_submissions enable row level security;

create policy "student_assignment_submissions_select_visible"
on public.student_assignment_submissions
for select
to authenticated
using (private.can_read_student_assignment(id));

create policy "student_assignment_submissions_delete_own"
on public.student_assignment_submissions
for delete
to authenticated
using (user_id = (select auth.uid()));

grant select, delete on public.student_assignment_submissions to authenticated;

create or replace function private.protect_student_submission_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.id <> old.id
    or new.camp_id <> old.camp_id
    or new.course_id <> old.course_id
    or new.user_id <> old.user_id
    or new.student_display_name <> old.student_display_name
    or new.version <> old.version
    or new.created_at <> old.created_at
    or new.assignment_submission_id is distinct from old.assignment_submission_id then
    raise exception 'submission identity cannot be changed';
  end if;

  if new.storage_path is distinct from old.storage_path
    or new.file_name is distinct from old.file_name
    or new.mime_type is distinct from old.mime_type
    or new.size_bytes is distinct from old.size_bytes
    or new.duration_seconds is distinct from old.duration_seconds then
    if private.is_admin()
      or coalesce((select auth.role()), '') = 'service_role' then
      null;
    else
      raise exception 'submitted recording cannot be changed';
    end if;
  end if;

  if (
    new.playback_storage_path is distinct from old.playback_storage_path
    or new.playback_mime_type is distinct from old.playback_mime_type
    or new.playback_size_bytes is distinct from old.playback_size_bytes
    or new.transcode_status is distinct from old.transcode_status
  ) and not (
    private.is_admin()
    or coalesce((select auth.role()), '') = 'service_role'
  ) then
    raise exception 'submission playback metadata cannot be changed';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.protect_student_submission_identity()
from public, anon, authenticated;

drop policy if exists "student_photo_submissions_select_own_or_admin"
on public.student_photo_submissions;

create policy "student_photo_submissions_select_visible_assignment"
on public.student_photo_submissions
for select
to authenticated
using (
  private.is_admin()
  or user_id = (select auth.uid())
  or (
    assignment_submission_id is not null
    and private.can_read_student_assignment(assignment_submission_id)
  )
);

drop policy if exists "student_submission_photos_select_own_or_admin"
on public.student_submission_photos;

create policy "student_submission_photos_select_visible_assignment"
on public.student_submission_photos
for select
to authenticated
using (
  private.is_admin()
  or exists (
    select 1
    from public.student_photo_submissions as submission_row
    where submission_row.id = submission_id
      and (
        submission_row.user_id = (select auth.uid())
        or (
          submission_row.assignment_submission_id is not null
          and private.can_read_student_assignment(submission_row.assignment_submission_id)
        )
      )
  )
);

drop policy if exists "student_homework_photos_objects_select_own_or_admin"
on storage.objects;

create policy "student_homework_photos_objects_select_visible_assignment"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-homework-photos'
  and (
    private.is_admin()
    or exists (
      select 1
      from public.student_submission_photos as photo_row
      join public.student_photo_submissions as submission_row on submission_row.id = photo_row.submission_id
      where photo_row.storage_path = storage.objects.name
        and (
          submission_row.user_id = (select auth.uid())
          or (
            submission_row.assignment_submission_id is not null
            and private.can_read_student_assignment(submission_row.assignment_submission_id)
          )
        )
    )
  )
);

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

  select course.id, course.camp_id, content.recording_assignment_enabled, content.photo_assignment_enabled
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

  if course_row.recording_assignment_enabled <> (audio_metadata is not null) then
    raise exception 'recording requirement mismatch';
  end if;
  if course_row.photo_assignment_enabled and (photo_total < 1 or photo_total > 3) then
    raise exception 'photo requirement mismatch';
  end if;
  if not course_row.photo_assignment_enabled and photo_total <> 0 then
    raise exception 'photo assignment is disabled';
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

create or replace function private.course_has_no_submissions(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (select 1 from public.student_submissions where course_id = target_course_id)
    and not exists (select 1 from public.student_photo_submissions where course_id = target_course_id)
    and not exists (select 1 from public.student_assignment_submissions where course_id = target_course_id);
$$;

revoke all on function private.course_has_no_submissions(uuid) from public, anon;
grant execute on function private.course_has_no_submissions(uuid) to authenticated;

commit;
