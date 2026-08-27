begin;

alter table public.student_submissions
  add column playback_storage_path text unique
    check (playback_storage_path is null or char_length(trim(playback_storage_path)) > 0),
  add column playback_mime_type text
    check (playback_mime_type is null or playback_mime_type = 'audio/mp4'),
  add column playback_size_bytes bigint
    check (playback_size_bytes is null or playback_size_bytes > 0),
  add column transcode_status text not null default 'pending'
    check (transcode_status in ('pending', 'processing', 'ready', 'failed', 'not_required'));

update public.student_submissions
set transcode_status = case
  when mime_type in ('audio/webm', 'audio/ogg') then 'pending'
  else 'not_required'
end;

alter table public.student_submissions
  add constraint student_submissions_playback_ready_check check (
    (
      transcode_status = 'ready'
      and playback_storage_path is not null
      and playback_mime_type = 'audio/mp4'
      and playback_size_bytes is not null
    )
    or (
      transcode_status <> 'ready'
      and playback_storage_path is null
      and playback_mime_type is null
      and playback_size_bytes is null
    )
  );

create or replace function private.prepare_student_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.course_id::text || ':' || new.user_id::text, 0));
  select coalesce(nullif(trim(profile_row.display_name), ''), '同学')
  into new.student_display_name
  from public.profiles as profile_row
  where profile_row.id = new.user_id;
  select coalesce(max(existing.version), 0) + 1
  into new.version
  from public.student_submissions as existing
  where existing.course_id = new.course_id
    and existing.user_id = new.user_id;
  new.playback_storage_path := null;
  new.playback_mime_type := null;
  new.playback_size_bytes := null;
  new.transcode_status := case
    when new.mime_type in ('audio/webm', 'audio/ogg') then 'pending'
    else 'not_required'
  end;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

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
    or new.mime_type is distinct from old.mime_type then
    new.playback_storage_path := null;
    new.playback_mime_type := null;
    new.playback_size_bytes := null;
    new.transcode_status := case
      when new.mime_type in ('audio/webm', 'audio/ogg') then 'pending'
      else 'not_required'
    end;
  elsif (
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

revoke all on function private.prepare_student_submission() from public, anon, authenticated;
revoke all on function private.protect_student_submission_identity() from public, anon, authenticated;

grant select, update on public.student_submissions to service_role;

drop policy if exists "student_recordings_objects_select_visible"
on storage.objects;

create policy "student_recordings_objects_select_visible"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-recordings'
  and exists (
    select 1
    from public.student_submissions as submission_row
    where submission_row.storage_path = storage.objects.name
      or (
        submission_row.transcode_status = 'ready'
        and submission_row.playback_storage_path = storage.objects.name
      )
  )
);

commit;
