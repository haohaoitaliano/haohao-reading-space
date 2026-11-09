begin;

alter table public.camps
  add column course_unlock_schedule text not null default 'daily'
  check (course_unlock_schedule in ('daily', 'weekdays'));

create or replace function private.course_automatic_unlock_at(target_course_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  with course_schedule as (
    select
      course_row.day_number,
      course_row.created_at,
      camp_row.starts_at,
      camp_row.timezone,
      camp_row.course_unlock_schedule,
      camp_row.starts_at at time zone camp_row.timezone as local_starts_at
    from public.courses as course_row
    join public.camps as camp_row on camp_row.id = course_row.camp_id
    where course_row.id = target_course_id
  ), normalized_schedule as (
    select *,
      case extract(isodow from local_starts_at)::integer
        when 6 then local_starts_at + interval '2 days'
        when 7 then local_starts_at + interval '1 day'
        else local_starts_at
      end as first_weekday_starts_at
    from course_schedule
  )
  select case
    when day_number = 0 then created_at
    when starts_at is null then null
    when course_unlock_schedule = 'weekdays' then (
      first_weekday_starts_at
      + pg_catalog.make_interval(
          days => (day_number - 1)
            + 2 * (
                (extract(isodow from first_weekday_starts_at)::integer - 1 + day_number - 1) / 5
              )
        )
    ) at time zone timezone
    else (
      local_starts_at
      + pg_catalog.make_interval(days => day_number - 1)
    ) at time zone timezone
  end
  from normalized_schedule;
$$;

create function public.update_camp_info_admin(
  target_camp_id uuid,
  camp_name text,
  student_limit integer,
  local_starts_at timestamp without time zone,
  local_ends_at timestamp without time zone,
  camp_description text,
  target_course_unlock_schedule text
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  saved_id uuid;
  camp_timezone text;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  if camp_name is null or char_length(trim(camp_name)) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'invalid camp name';
  end if;
  if student_limit is null or student_limit < 1 then
    raise exception using errcode = '22023', message = 'invalid student limit';
  end if;
  if local_starts_at is null then
    raise exception using errcode = '22023', message = 'start time required';
  end if;
  if local_ends_at is not null and local_ends_at <= local_starts_at then
    raise exception using errcode = '22023', message = 'end time must be after start time';
  end if;
  if target_course_unlock_schedule not in ('daily', 'weekdays') then
    raise exception using errcode = '22023', message = 'invalid course unlock schedule';
  end if;

  select timezone into camp_timezone from public.camps where id = target_camp_id;
  if camp_timezone is null then
    raise exception using errcode = 'P0002', message = 'camp not found';
  end if;

  update public.camps
  set name = trim(camp_name),
      max_students = student_limit,
      starts_at = local_starts_at at time zone camp_timezone,
      ends_at = case when local_ends_at is null then null else local_ends_at at time zone camp_timezone end,
      description = nullif(trim(camp_description), ''),
      course_unlock_schedule = target_course_unlock_schedule,
      updated_at = now()
  where id = target_camp_id
  returning id into saved_id;

  if saved_id is null then
    raise exception using errcode = 'P0002', message = 'camp not found';
  end if;
  return saved_id;
end;
$$;

revoke all on function public.update_camp_info_admin(uuid, text, integer, timestamp without time zone, timestamp without time zone, text, text) from public, anon;
grant execute on function public.update_camp_info_admin(uuid, text, integer, timestamp without time zone, timestamp without time zone, text, text) to authenticated;

commit;
