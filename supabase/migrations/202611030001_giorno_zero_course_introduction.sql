begin;

alter table public.courses
  drop constraint if exists courses_day_number_check;

alter table public.courses
  add constraint courses_day_number_check check (day_number >= 0);

create or replace function private.course_automatic_unlock_at(target_course_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when course_row.day_number = 0 then course_row.created_at
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

commit;
