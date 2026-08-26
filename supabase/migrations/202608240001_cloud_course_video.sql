begin;

create table public.course_videos (
  course_id uuid primary key references public.courses (id) on delete cascade,
  storage_path text unique not null check (char_length(trim(storage_path)) > 0),
  file_name text not null check (char_length(trim(file_name)) > 0),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 104857600),
  duration_seconds numeric(10, 3) check (duration_seconds is null or duration_seconds >= 0),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.course_videos enable row level security;

create policy "course_videos_select_admin_only"
on public.course_videos
for select
to authenticated
using (private.is_admin());

create policy "course_videos_insert_admin_only"
on public.course_videos
for insert
to authenticated
with check (private.is_admin());

create policy "course_videos_update_admin_only"
on public.course_videos
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "course_videos_delete_admin_only"
on public.course_videos
for delete
to authenticated
using (private.is_admin());

grant select, insert, update, delete on public.course_videos to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'course-videos',
  'course-videos',
  false,
  104857600,
  array[
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do nothing;

create policy "course_videos_objects_select_admin_only"
on storage.objects
for select
to authenticated
using (bucket_id = 'course-videos' and private.is_admin());

create policy "course_videos_objects_insert_admin_only"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'course-videos' and private.is_admin());

create policy "course_videos_objects_update_admin_only"
on storage.objects
for update
to authenticated
using (bucket_id = 'course-videos' and private.is_admin())
with check (bucket_id = 'course-videos' and private.is_admin());

create policy "course_videos_objects_delete_admin_only"
on storage.objects
for delete
to authenticated
using (bucket_id = 'course-videos' and private.is_admin());

commit;
