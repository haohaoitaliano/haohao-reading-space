begin;

create table public.student_submissions (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.camps (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  student_display_name text not null default '同学',
  storage_path text unique not null check (char_length(trim(storage_path)) > 0),
  file_name text not null check (char_length(trim(file_name)) > 0),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 31457280),
  duration_seconds numeric(10, 3) not null check (duration_seconds >= 0),
  visibility text not null default 'public' check (visibility in ('public', 'teacher_only')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id, version)
);

create index student_submissions_camp_course_created_idx
on public.student_submissions (camp_id, course_id, created_at desc);

create index student_submissions_user_created_idx
on public.student_submissions (user_id, created_at desc);

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
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger prepare_student_submission_before_insert
before insert on public.student_submissions
for each row execute function private.prepare_student_submission();

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
  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_student_submission_identity_before_update
before update on public.student_submissions
for each row execute function private.protect_student_submission_identity();

revoke all on function private.prepare_student_submission() from public, anon, authenticated;
revoke all on function private.protect_student_submission_identity() from public, anon, authenticated;

alter table public.student_submissions enable row level security;

create policy "student_submissions_select_visible"
on public.student_submissions
for select
to authenticated
using (
  private.is_admin()
  or user_id = (select auth.uid())
  or (
    visibility = 'public'
    and private.is_active_camp_member(camp_id)
  )
);

create policy "student_submissions_insert_own"
on public.student_submissions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.can_read_course_content(course_id)
  and exists (
    select 1
    from public.courses as course_row
    where course_row.id = course_id
      and course_row.camp_id = camp_id
  )
  and (storage.foldername(storage_path))[1] = camp_id::text
  and (storage.foldername(storage_path))[2] = (select auth.uid())::text
);

create policy "student_submissions_update_own"
on public.student_submissions
for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (storage.foldername(storage_path))[1] = camp_id::text
  and (storage.foldername(storage_path))[2] = (select auth.uid())::text
);

create policy "student_submissions_delete_own"
on public.student_submissions
for delete
to authenticated
using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.student_submissions to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'student-recordings',
  'student-recordings',
  false,
  31457280,
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
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
  )
);

create policy "student_recordings_objects_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-recordings'
  and (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
  and private.is_active_camp_member(
    ((storage.foldername(storage.objects.name))[1])::uuid
  )
);

create policy "student_recordings_objects_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'student-recordings'
  and (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
)
with check (
  bucket_id = 'student-recordings'
  and (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
);

create policy "student_recordings_objects_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'student-recordings'
  and (storage.foldername(storage.objects.name))[2] = (select auth.uid())::text
);

commit;
