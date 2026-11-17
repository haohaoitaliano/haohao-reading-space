begin;

alter table public.course_contents
  add column reading_blocks jsonb;

alter table public.course_contents
  add constraint course_contents_reading_blocks_array
  check (reading_blocks is null or jsonb_typeof(reading_blocks) = 'array');

create table public.course_reading_images (
  id uuid primary key default extensions.gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  storage_path text unique not null check (char_length(trim(storage_path)) > 0),
  file_name text not null check (char_length(trim(file_name)) > 0),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 8388608),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index course_reading_images_course_idx on public.course_reading_images (course_id);
alter table public.course_reading_images enable row level security;

create policy "course_reading_images_select_unlocked_or_admin" on public.course_reading_images
for select to authenticated
using (private.is_admin() or private.can_read_course_content(course_id));

create policy "course_reading_images_insert_admin_only" on public.course_reading_images
for insert to authenticated with check (private.is_admin());

create policy "course_reading_images_update_admin_only" on public.course_reading_images
for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "course_reading_images_delete_admin_only" on public.course_reading_images
for delete to authenticated using (private.is_admin());

grant select, insert, update, delete on public.course_reading_images to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-reading-images', 'course-reading-images', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "course_reading_images_objects_select_unlocked_or_admin" on storage.objects
for select to authenticated using (
  bucket_id = 'course-reading-images'
  and exists (
    select 1 from public.course_reading_images as image_row
    where image_row.storage_path = storage.objects.name
      and (private.is_admin() or private.can_read_course_content(image_row.course_id))
  )
);

create policy "course_reading_images_objects_insert_admin_only" on storage.objects
for insert to authenticated with check (bucket_id = 'course-reading-images' and private.is_admin());

create policy "course_reading_images_objects_update_admin_only" on storage.objects
for update to authenticated
using (bucket_id = 'course-reading-images' and private.is_admin())
with check (bucket_id = 'course-reading-images' and private.is_admin());

create policy "course_reading_images_objects_delete_admin_only" on storage.objects
for delete to authenticated using (bucket_id = 'course-reading-images' and private.is_admin());

commit;
