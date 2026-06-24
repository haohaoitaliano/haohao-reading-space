begin;

alter table public.camps
  add column timezone text not null default 'Europe/Rome';

alter table public.courses
  add column unlock_mode text not null default 'auto'
  check (unlock_mode in ('auto', 'manual'));

create or replace function private.validate_camp_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception using errcode = '22023', message = 'invalid camp timezone';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_camp_timezone() from public, anon, authenticated;

create trigger camps_validate_timezone
before insert or update of timezone on public.camps
for each row execute function private.validate_camp_timezone();

create or replace function private.course_automatic_unlock_at(target_course_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when camp_row.starts_at is null then null
    else (
      (camp_row.starts_at at time zone camp_row.timezone)
      + pg_catalog.make_interval(days => course_row.day_number - 1)
    ) at time zone camp_row.timezone
  end
  from public.courses as course_row
  join public.camps as camp_row on camp_row.id = course_row.camp_id
  where course_row.id = target_course_id;
$$;

create or replace function private.course_effective_unlock_at(target_course_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when course_row.unlock_mode = 'manual' then course_row.unlock_at
    else private.course_automatic_unlock_at(course_row.id)
  end
  from public.courses as course_row
  where course_row.id = target_course_id;
$$;

revoke all on function private.course_automatic_unlock_at(uuid) from public, anon;
revoke all on function private.course_effective_unlock_at(uuid) from public, anon;
grant execute on function private.course_automatic_unlock_at(uuid) to authenticated;
grant execute on function private.course_effective_unlock_at(uuid) to authenticated;

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
      and private.course_effective_unlock_at(target_course_id) is not null
      and private.course_effective_unlock_at(target_course_id) <= now()
      and private.is_active_camp_member(course_row.camp_id)
  );
$$;

revoke all on function private.can_read_course_content(uuid) from public, anon;
grant execute on function private.can_read_course_content(uuid) to authenticated;

create or replace function public.get_course_schedule(target_camp_id uuid default null)
returns table (
  id uuid, camp_id uuid, day_number integer, italian_title text, chinese_title text,
  unlock_at timestamptz, unlock_mode text, automatic_unlock_at timestamptz,
  effective_unlock_at timestamptz, camp_timezone text, camp_starts_at timestamptz,
  status text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select course_row.id, course_row.camp_id, course_row.day_number,
    course_row.italian_title, course_row.chinese_title, course_row.unlock_at,
    course_row.unlock_mode, private.course_automatic_unlock_at(course_row.id),
    private.course_effective_unlock_at(course_row.id), camp_row.timezone,
    camp_row.starts_at, course_row.status
  from public.courses as course_row
  join public.camps as camp_row on camp_row.id = course_row.camp_id
  where target_camp_id is null or course_row.camp_id = target_camp_id;
$$;

revoke all on function public.get_course_schedule(uuid) from public, anon;
grant execute on function public.get_course_schedule(uuid) to authenticated;

create or replace function public.update_camp_schedule(
  target_camp_id uuid,
  local_starts_at timestamp without time zone,
  target_timezone text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare saved_starts_at timestamptz;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = target_timezone) then
    raise exception using errcode = '22023', message = 'invalid camp timezone';
  end if;
  update public.camps
  set timezone = target_timezone,
      starts_at = local_starts_at at time zone target_timezone,
      updated_at = now()
  where id = target_camp_id
  returning starts_at into saved_starts_at;
  if saved_starts_at is null then
    raise exception using errcode = 'P0002', message = 'camp not found';
  end if;
  return saved_starts_at;
end;
$$;

create or replace function public.set_course_unlock_schedule(
  target_course_id uuid,
  target_mode text,
  local_unlock_at timestamp without time zone default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare camp_timezone text;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  if target_mode not in ('auto', 'manual') then
    raise exception using errcode = '22023', message = 'invalid unlock mode';
  end if;
  if target_mode = 'manual' and local_unlock_at is null then
    raise exception using errcode = '22023', message = 'manual unlock time required';
  end if;
  select camp_row.timezone into camp_timezone
  from public.courses as course_row
  join public.camps as camp_row on camp_row.id = course_row.camp_id
  where course_row.id = target_course_id;
  if camp_timezone is null then
    raise exception using errcode = 'P0002', message = 'course not found';
  end if;
  update public.courses
  set unlock_mode = target_mode,
      unlock_at = case when target_mode = 'manual'
        then local_unlock_at at time zone camp_timezone else null end,
      updated_at = now()
  where id = target_course_id;
  return private.course_effective_unlock_at(target_course_id);
end;
$$;

revoke all on function public.update_camp_schedule(uuid, timestamp without time zone, text) from public, anon;
revoke all on function public.set_course_unlock_schedule(uuid, text, timestamp without time zone) from public, anon;
grant execute on function public.update_camp_schedule(uuid, timestamp without time zone, text) to authenticated;
grant execute on function public.set_course_unlock_schedule(uuid, text, timestamp without time zone) to authenticated;

drop policy if exists "course_audio_objects_select_unlocked_or_admin" on storage.objects;

create policy "course_audio_objects_select_unlocked_or_admin"
on storage.objects for select to authenticated
using (
  bucket_id = 'course-audio'
  and (
    private.is_admin()
    or exists (
      select 1 from public.courses as course_row
      where course_row.camp_id::text = (storage.foldername(storage.objects.name))[1]
        and course_row.id::text = (storage.foldername(storage.objects.name))[2]
        and private.can_read_course_content(course_row.id)
    )
  )
);

commit;
