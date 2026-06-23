begin;

create table public.course_audio (
  course_id uuid primary key references public.courses (id) on delete cascade,
  storage_path text unique not null check (char_length(trim(storage_path)) > 0),
  file_name text not null check (char_length(trim(file_name)) > 0),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  duration_seconds numeric(10, 3) check (duration_seconds is null or duration_seconds >= 0),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.course_audio enable row level security;

create policy "course_audio_select_unlocked_or_admin"
on public.course_audio
for select
to authenticated
using (private.is_admin() or private.can_read_course_content(course_id));

create policy "course_audio_insert_admin_only"
on public.course_audio
for insert
to authenticated
with check (private.is_admin());

create policy "course_audio_update_admin_only"
on public.course_audio
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "course_audio_delete_admin_only"
on public.course_audio
for delete
to authenticated
using (private.is_admin());

grant select, insert, update, delete on public.course_audio to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'course-audio',
  'course-audio',
  false,
  20971520,
  array[
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
    'audio/ogg'
  ]
)
on conflict (id) do nothing;

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
      where course_row.camp_id::text = (storage.foldername(name))[1]
        and course_row.id::text = (storage.foldername(name))[2]
        and course_row.status = 'published'
        and (course_row.unlock_at is null or course_row.unlock_at <= now())
        and member_row.user_id = (select auth.uid())
        and member_row.status = 'active'
        and camp_row.status = 'active'
    )
  )
);

create policy "course_audio_objects_insert_admin_only"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'course-audio' and private.is_admin());

create policy "course_audio_objects_update_admin_only"
on storage.objects
for update
to authenticated
using (bucket_id = 'course-audio' and private.is_admin())
with check (bucket_id = 'course-audio' and private.is_admin());

create policy "course_audio_objects_delete_admin_only"
on storage.objects
for delete
to authenticated
using (bucket_id = 'course-audio' and private.is_admin());

commit;
