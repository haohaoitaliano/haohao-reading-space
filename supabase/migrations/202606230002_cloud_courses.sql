begin;

create table public.courses (
  id uuid primary key default extensions.gen_random_uuid(),
  camp_id uuid not null references public.camps (id) on delete cascade,
  day_number integer not null check (day_number > 0),
  italian_title text not null check (char_length(trim(italian_title)) > 0),
  chinese_title text,
  unlock_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (camp_id, day_number)
);

create table public.course_contents (
  course_id uuid primary key references public.courses (id) on delete cascade,
  description text,
  reading_text text not null check (char_length(trim(reading_text)) > 0),
  reflection_prompt_zh text,
  reflection_prompt_it text,
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create table public.course_vocabulary (
  id uuid primary key default extensions.gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  position integer not null check (position > 0),
  word text not null check (char_length(trim(word)) > 0),
  meaning_zh text,
  created_at timestamptz not null default now(),
  unique (course_id, position)
);

create index courses_camp_status_unlock_idx
  on public.courses (camp_id, status, unlock_at);
create index course_vocabulary_course_position_idx
  on public.course_vocabulary (course_id, position);

alter table public.courses enable row level security;
alter table public.course_contents enable row level security;
alter table public.course_vocabulary enable row level security;

create or replace function private.is_active_camp_member(target_camp_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.camp_members as member_row
    join public.camps as camp_row on camp_row.id = member_row.camp_id
    where member_row.camp_id = target_camp_id
      and member_row.user_id = (select auth.uid())
      and member_row.status = 'active'
      and camp_row.status = 'active'
  );
$$;

revoke all on function private.is_active_camp_member(uuid) from public, anon;
grant execute on function private.is_active_camp_member(uuid) to authenticated;

create or replace function private.can_read_course_content(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.courses as course_row
    where course_row.id = target_course_id
      and course_row.status = 'published'
      and (course_row.unlock_at is null or course_row.unlock_at <= now())
      and private.is_active_camp_member(course_row.camp_id)
  );
$$;

revoke all on function private.can_read_course_content(uuid) from public, anon;
grant execute on function private.can_read_course_content(uuid) to authenticated;

create policy "courses_select_published_member_or_admin"
on public.courses
for select
to authenticated
using (
  private.is_admin()
  or (status = 'published' and private.is_active_camp_member(camp_id))
);

create policy "courses_insert_admin_only"
on public.courses
for insert
to authenticated
with check (private.is_admin());

create policy "courses_update_admin_only"
on public.courses
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "courses_delete_admin_only"
on public.courses
for delete
to authenticated
using (private.is_admin());

create policy "course_contents_select_unlocked_or_admin"
on public.course_contents
for select
to authenticated
using (private.is_admin() or private.can_read_course_content(course_id));

create policy "course_contents_insert_admin_only"
on public.course_contents
for insert
to authenticated
with check (private.is_admin());

create policy "course_contents_update_admin_only"
on public.course_contents
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "course_contents_delete_admin_only"
on public.course_contents
for delete
to authenticated
using (private.is_admin());

create policy "course_vocabulary_select_unlocked_or_admin"
on public.course_vocabulary
for select
to authenticated
using (private.is_admin() or private.can_read_course_content(course_id));

create policy "course_vocabulary_insert_admin_only"
on public.course_vocabulary
for insert
to authenticated
with check (private.is_admin());

create policy "course_vocabulary_update_admin_only"
on public.course_vocabulary
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "course_vocabulary_delete_admin_only"
on public.course_vocabulary
for delete
to authenticated
using (private.is_admin());

grant select, insert, update, delete on public.courses to authenticated;
grant select, insert, update, delete on public.course_contents to authenticated;
grant select, insert, update, delete on public.course_vocabulary to authenticated;

commit;
