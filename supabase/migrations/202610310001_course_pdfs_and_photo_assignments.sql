begin;

alter table public.course_contents
  add column recording_assignment_enabled boolean not null default true,
  add column photo_assignment_enabled boolean not null default false;

alter table public.course_contents
  drop constraint if exists course_contents_reading_text_check,
  alter column reading_text drop not null;

create table public.course_pdfs (
  id uuid primary key default extensions.gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  storage_path text unique not null check (char_length(trim(storage_path)) > 0),
  file_name text not null check (char_length(trim(file_name)) > 0),
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  position integer not null check (position > 0),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position)
);

create index course_pdfs_course_position_idx
  on public.course_pdfs (course_id, position);

alter table public.course_pdfs enable row level security;

create policy "course_pdfs_select_unlocked_or_admin"
on public.course_pdfs
for select
to authenticated
using (private.is_admin() or private.can_read_course_content(course_id));

create policy "course_pdfs_insert_admin_only"
on public.course_pdfs
for insert
to authenticated
with check (private.is_admin());

create policy "course_pdfs_update_admin_only"
on public.course_pdfs
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "course_pdfs_delete_admin_only"
on public.course_pdfs
for delete
to authenticated
using (private.is_admin());

grant select, insert, update, delete on public.course_pdfs to authenticated;

create table public.student_photo_submissions (
  id uuid primary key default extensions.gen_random_uuid(),
  camp_id uuid not null references public.camps (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  student_display_name text not null default '同学',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (course_id, user_id, version)
);

create index student_photo_submissions_camp_course_created_idx
  on public.student_photo_submissions (camp_id, course_id, created_at desc);

create index student_photo_submissions_user_created_idx
  on public.student_photo_submissions (user_id, created_at desc);

create table public.student_submission_photos (
  id uuid primary key default extensions.gen_random_uuid(),
  submission_id uuid not null references public.student_photo_submissions (id) on delete cascade,
  storage_path text unique not null check (char_length(trim(storage_path)) > 0),
  file_name text not null check (char_length(trim(file_name)) > 0),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/heic', 'image/heif')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  position integer not null check (position between 1 and 3),
  created_at timestamptz not null default now(),
  unique (submission_id, position)
);

create index student_submission_photos_submission_position_idx
  on public.student_submission_photos (submission_id, position);

create or replace function private.course_has_no_submissions(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (select 1 from public.student_submissions where course_id = target_course_id)
    and not exists (select 1 from public.student_photo_submissions where course_id = target_course_id);
$$;

revoke all on function private.course_has_no_submissions(uuid) from public, anon;
grant execute on function private.course_has_no_submissions(uuid) to authenticated;

create or replace function private.prepare_student_photo_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.course_id::text || ':' || new.user_id::text || ':photo', 0));
  select coalesce(nullif(trim(profile_row.display_name), ''), '同学')
  into new.student_display_name
  from public.profiles as profile_row
  where profile_row.id = new.user_id;
  select coalesce(max(existing.version), 0) + 1
  into new.version
  from public.student_photo_submissions as existing
  where existing.course_id = new.course_id
    and existing.user_id = new.user_id;
  new.created_at := now();
  return new;
end;
$$;

create trigger prepare_student_photo_submission_before_insert
before insert on public.student_photo_submissions
for each row execute function private.prepare_student_photo_submission();

revoke all on function private.prepare_student_photo_submission() from public, anon, authenticated;

alter table public.student_photo_submissions enable row level security;
alter table public.student_submission_photos enable row level security;

create policy "student_photo_submissions_select_own_or_admin"
on public.student_photo_submissions
for select
to authenticated
using (private.is_admin() or user_id = (select auth.uid()));

create policy "student_photo_submissions_insert_own"
on public.student_photo_submissions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.can_read_course_content(course_id)
  and exists (
    select 1
    from public.courses as course_row
    join public.course_contents as content_row on content_row.course_id = course_row.id
    where course_row.id = course_id
      and course_row.camp_id = camp_id
      and content_row.photo_assignment_enabled
  )
);

create policy "student_photo_submissions_delete_own"
on public.student_photo_submissions
for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "student_submission_photos_select_own_or_admin"
on public.student_submission_photos
for select
to authenticated
using (
  private.is_admin()
  or exists (
    select 1
    from public.student_photo_submissions as submission_row
    where submission_row.id = submission_id
      and submission_row.user_id = (select auth.uid())
  )
);

create policy "student_submission_photos_insert_own"
on public.student_submission_photos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.student_photo_submissions as submission_row
    where submission_row.id = submission_id
      and submission_row.user_id = (select auth.uid())
      and (storage.foldername(storage_path))[1] = submission_row.camp_id::text
      and (storage.foldername(storage_path))[2] = submission_row.user_id::text
      and (storage.foldername(storage_path))[3] = submission_row.course_id::text
      and (storage.foldername(storage_path))[4] = submission_row.id::text
  )
);

create policy "student_submission_photos_delete_own"
on public.student_submission_photos
for delete
to authenticated
using (
  exists (
    select 1
    from public.student_photo_submissions as submission_row
    where submission_row.id = submission_id
      and submission_row.user_id = (select auth.uid())
  )
);

grant select, insert, delete on public.student_photo_submissions to authenticated;
grant select, insert, delete on public.student_submission_photos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-pdfs',
  'course-pdfs',
  false,
  20971520,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "course_pdfs_objects_select_unlocked_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'course-pdfs'
  and exists (
    select 1
    from public.course_pdfs as pdf_row
    where pdf_row.storage_path = storage.objects.name
      and (private.is_admin() or private.can_read_course_content(pdf_row.course_id))
  )
);

create policy "course_pdfs_objects_insert_admin_only"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'course-pdfs' and private.is_admin());

create policy "course_pdfs_objects_update_admin_only"
on storage.objects
for update
to authenticated
using (bucket_id = 'course-pdfs' and private.is_admin())
with check (bucket_id = 'course-pdfs' and private.is_admin());

create policy "course_pdfs_objects_delete_admin_only"
on storage.objects
for delete
to authenticated
using (bucket_id = 'course-pdfs' and private.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-homework-photos',
  'student-homework-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "student_homework_photos_objects_select_own_or_admin"
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
        and submission_row.user_id = (select auth.uid())
    )
  )
);

create policy "student_homework_photos_objects_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-homework-photos'
  and (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
  and private.is_active_camp_member(((storage.foldername(storage.objects.name))[1])::uuid)
  and private.can_read_course_content(((storage.foldername(storage.objects.name))[3])::uuid)
  and exists (
    select 1
    from public.courses as course_row
    join public.course_contents as content_row on content_row.course_id = course_row.id
    where course_row.id = ((storage.foldername(storage.objects.name))[3])::uuid
      and course_row.camp_id = ((storage.foldername(storage.objects.name))[1])::uuid
      and content_row.photo_assignment_enabled
  )
);

create policy "student_homework_photos_objects_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'student-homework-photos'
  and (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
);

commit;
