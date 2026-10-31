begin;

alter table public.submission_comments
  alter column submission_id drop not null,
  alter column content drop not null,
  add column assignment_submission_id uuid
    references public.student_assignment_submissions (id) on delete cascade,
  add column parent_comment_id uuid
    references public.submission_comments (id) on delete restrict,
  add column author_role text,
  add column audio_storage_path text unique,
  add column audio_mime_type text,
  add column audio_size_bytes bigint,
  add column audio_duration_seconds numeric(6, 3),
  add column audio_playback_storage_path text unique,
  add column audio_playback_mime_type text,
  add column audio_playback_size_bytes bigint,
  add column audio_transcode_status text,
  add column image_storage_path text unique,
  add column image_mime_type text,
  add column image_size_bytes bigint;

alter table public.submission_comments
  drop constraint if exists submission_comments_content_check;

update public.submission_comments as comment_row
set author_role = profile_row.role,
    audio_transcode_status = null
from public.profiles as profile_row
where profile_row.id = comment_row.user_id;

alter table public.submission_comments
  alter column author_role set not null,
  add constraint submission_comments_one_target_check check (
    (submission_id is not null)::integer + (assignment_submission_id is not null)::integer = 1
  ),
  add constraint submission_comments_author_role_check check (author_role in ('admin', 'student')),
  add constraint submission_comments_content_check check (
    content is null
    or (content = trim(content) and char_length(content) between 1 and 1000)
  ),
  add constraint submission_comments_material_check check (
    content is not null or audio_storage_path is not null or image_storage_path is not null
  ),
  add constraint submission_comments_audio_check check (
    (audio_storage_path is null and audio_mime_type is null and audio_size_bytes is null
      and audio_duration_seconds is null and audio_transcode_status is null)
    or (
      audio_storage_path is not null
      and audio_mime_type in ('audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg')
      and audio_size_bytes between 1 and 3145728
      and audio_duration_seconds > 0 and audio_duration_seconds <= 45
      and audio_transcode_status in ('pending', 'processing', 'ready', 'failed', 'not_required')
    )
  ),
  add constraint submission_comments_audio_playback_check check (
    (audio_transcode_status = 'ready'
      and audio_playback_storage_path is not null
      and audio_playback_mime_type = 'audio/mp4'
      and audio_playback_size_bytes > 0)
    or (coalesce(audio_transcode_status, '') <> 'ready'
      and audio_playback_storage_path is null
      and audio_playback_mime_type is null
      and audio_playback_size_bytes is null)
  ),
  add constraint submission_comments_image_check check (
    (image_storage_path is null and image_mime_type is null and image_size_bytes is null)
    or (
      image_storage_path is not null
      and image_mime_type in ('image/jpeg', 'image/png', 'image/webp')
      and image_size_bytes between 1 and 3145728
    )
  );

create index submission_comments_assignment_created_idx
on public.submission_comments (assignment_submission_id, created_at)
where assignment_submission_id is not null;

create index submission_comments_parent_idx
on public.submission_comments (parent_comment_id)
where parent_comment_id is not null;

create or replace function private.can_read_submission_comment_target(
  target_submission_id uuid,
  target_assignment_submission_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_assignment_submission_id is not null then
      private.can_read_student_assignment(target_assignment_submission_id)
    when target_submission_id is not null then exists (
      select 1
      from public.student_submissions as submission_row
      where submission_row.id = target_submission_id
        and (
          private.is_admin()
          or submission_row.user_id = (select auth.uid())
          or (
            submission_row.visibility = 'public'
            and private.is_active_camp_member(submission_row.camp_id)
            and private.is_active_camp_user(submission_row.camp_id, submission_row.user_id)
          )
        )
    )
    else false
  end;
$$;

revoke all on function private.can_read_submission_comment_target(uuid, uuid)
from public, anon;
grant execute on function private.can_read_submission_comment_target(uuid, uuid)
to authenticated;

create or replace function private.prepare_submission_comment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, storage
as $$
declare
  target_camp_id uuid;
  parent_row public.submission_comments;
begin
  new.content := nullif(trim(coalesce(new.content, '')), '');
  new.created_at := now();

  select coalesce(nullif(trim(profile_row.display_name), ''), '同学'), profile_row.role
  into new.author_display_name, new.author_role
  from public.profiles as profile_row
  where profile_row.id = new.user_id and profile_row.status = 'active';

  if new.author_role is null then raise exception 'active author required'; end if;

  if new.assignment_submission_id is not null then
    select camp_id into target_camp_id
    from public.student_assignment_submissions
    where id = new.assignment_submission_id;
  else
    select camp_id into target_camp_id
    from public.student_submissions
    where id = new.submission_id;
  end if;
  if target_camp_id is null then raise exception 'comment target not found'; end if;

  if new.parent_comment_id is not null then
    select * into parent_row from public.submission_comments where id = new.parent_comment_id;
    if not found
      or parent_row.submission_id is distinct from new.submission_id
      or parent_row.assignment_submission_id is distinct from new.assignment_submission_id then
      raise exception 'reply target does not belong to this submission';
    end if;
  end if;

  if new.audio_storage_path is not null then
    if (storage.foldername(new.audio_storage_path))[1] <> target_camp_id::text
      or (storage.foldername(new.audio_storage_path))[2] <> new.user_id::text
      or (storage.foldername(new.audio_storage_path))[3] <> new.id::text then
      raise exception 'invalid comment audio path';
    end if;
    new.audio_transcode_status := case
      when new.audio_mime_type in ('audio/webm', 'audio/ogg') then 'pending'
      else 'not_required'
    end;
  end if;

  if new.image_storage_path is not null and (
    (storage.foldername(new.image_storage_path))[1] <> target_camp_id::text
    or (storage.foldername(new.image_storage_path))[2] <> new.user_id::text
    or (storage.foldername(new.image_storage_path))[3] <> new.id::text
  ) then raise exception 'invalid comment image path'; end if;

  return new;
end;
$$;

drop policy if exists "submission_comments_select_visible_public" on public.submission_comments;
drop policy if exists "submission_comments_insert_own_visible_public" on public.submission_comments;
drop policy if exists "submission_comments_delete_own_visible_public" on public.submission_comments;

create policy "submission_comments_select_visible_target"
on public.submission_comments for select to authenticated
using (private.can_read_submission_comment_target(submission_id, assignment_submission_id));

create policy "submission_comments_insert_own_visible_target"
on public.submission_comments for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.can_read_submission_comment_target(submission_id, assignment_submission_id)
);

create policy "submission_comments_delete_own_visible_target"
on public.submission_comments for delete to authenticated
using (
  user_id = (select auth.uid())
  and private.can_read_submission_comment_target(submission_id, assignment_submission_id)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submission-comment-media',
  'submission-comment-media',
  false,
  3145728,
  array['audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "submission_comment_media_insert_own_or_admin"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'submission-comment-media'
  and (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
  and (
    private.is_admin()
    or private.is_active_camp_member(((storage.foldername(storage.objects.name))[1])::uuid)
  )
);

create policy "submission_comment_media_select_visible"
on storage.objects for select to authenticated
using (
  bucket_id = 'submission-comment-media'
  and exists (
    select 1 from public.submission_comments as comment_row
    where (
      comment_row.audio_storage_path = storage.objects.name
      or comment_row.audio_playback_storage_path = storage.objects.name
      or comment_row.image_storage_path = storage.objects.name
    )
    and private.can_read_submission_comment_target(
      comment_row.submission_id,
      comment_row.assignment_submission_id
    )
  )
);

create policy "submission_comment_media_delete_own_or_admin"
on storage.objects for delete to authenticated
using (
  bucket_id = 'submission-comment-media'
  and (
    private.is_admin()
    or (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
  )
);

grant select, update on public.submission_comments to service_role;

commit;
