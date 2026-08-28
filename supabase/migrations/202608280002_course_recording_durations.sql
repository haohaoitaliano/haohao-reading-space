begin;

alter table public.courses
  add column max_duration_seconds integer not null default 120,
  add column target_duration_seconds integer;

alter table public.courses
  add constraint courses_max_duration_seconds_positive
    check (max_duration_seconds > 0),
  add constraint courses_target_duration_seconds_positive
    check (target_duration_seconds is null or target_duration_seconds > 0),
  add constraint courses_target_within_max_duration
    check (target_duration_seconds is null or target_duration_seconds <= max_duration_seconds);

drop function public.get_course_schedule(uuid);

create function public.get_course_schedule(target_camp_id uuid default null)
returns table (
  id uuid, camp_id uuid, day_number integer, italian_title text, chinese_title text,
  unlock_at timestamptz, unlock_mode text, automatic_unlock_at timestamptz,
  effective_unlock_at timestamptz, camp_timezone text, camp_starts_at timestamptz,
  status text, max_duration_seconds integer, target_duration_seconds integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select course_row.id, course_row.camp_id, course_row.day_number,
    course_row.italian_title, course_row.chinese_title, course_row.unlock_at,
    course_row.unlock_mode, private.course_automatic_unlock_at(course_row.id),
    private.course_effective_unlock_at(course_row.id), camp_row.timezone,
    camp_row.starts_at, course_row.status, course_row.max_duration_seconds,
    course_row.target_duration_seconds
  from public.courses as course_row
  join public.camps as camp_row on camp_row.id = course_row.camp_id
  where target_camp_id is null or course_row.camp_id = target_camp_id;
$$;

revoke all on function public.get_course_schedule(uuid) from public, anon;
grant execute on function public.get_course_schedule(uuid) to authenticated;

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
    or new.created_at <> old.created_at then
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

drop policy if exists "student_recordings_objects_update_own" on storage.objects;

commit;
