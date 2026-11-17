begin;

alter table public.submission_comments
  drop constraint if exists submission_comments_audio_check;

alter table public.submission_comments
  add constraint submission_comments_audio_check check (
    (audio_storage_path is null and audio_mime_type is null and audio_size_bytes is null
      and audio_duration_seconds is null and audio_transcode_status is null)
    or (
      audio_storage_path is not null
      and audio_mime_type in ('audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg')
      and audio_size_bytes between 1 and 8388608
      and audio_duration_seconds > 0 and audio_duration_seconds <= 120
      and audio_transcode_status in ('pending', 'processing', 'ready', 'failed', 'not_required')
    )
  );

update storage.buckets
set file_size_limit = 8388608
where id = 'submission-comment-media';

commit;
