begin;

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
    or (
      new.student_display_name <> old.student_display_name
      and pg_trigger_depth() <= 1
    )
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

create or replace function private.sync_profile_display_name_snapshots()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  update public.student_submissions
  set student_display_name = new.display_name
  where user_id = new.id
    and student_display_name is distinct from new.display_name;

  update public.student_photo_submissions
  set student_display_name = new.display_name
  where user_id = new.id
    and student_display_name is distinct from new.display_name;

  update public.student_assignment_submissions
  set student_display_name = new.display_name
  where user_id = new.id
    and student_display_name is distinct from new.display_name;

  update public.submission_comments
  set author_display_name = new.display_name
  where user_id = new.id
    and author_display_name is distinct from new.display_name;

  return new;
end;
$$;

revoke all on function private.sync_profile_display_name_snapshots()
from public, anon, authenticated;

create trigger sync_profile_display_name_snapshots_after_update
after update of display_name on public.profiles
for each row
when (old.display_name is distinct from new.display_name)
execute function private.sync_profile_display_name_snapshots();

commit;
