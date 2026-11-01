begin;

alter table public.camps
  add column description text;

create function public.update_camp_info_admin(
  target_camp_id uuid,
  camp_name text,
  student_limit integer,
  local_starts_at timestamp without time zone,
  local_ends_at timestamp without time zone,
  camp_description text
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

  select timezone into camp_timezone from public.camps where id = target_camp_id;
  if camp_timezone is null then
    raise exception using errcode = 'P0002', message = 'camp not found';
  end if;

  update public.camps
  set name = trim(camp_name),
      max_students = student_limit,
      starts_at = local_starts_at at time zone camp_timezone,
      ends_at = case when local_ends_at is null then null else local_ends_at at time zone camp_timezone end,
      description = nullif(trim(camp_description), '')
  where id = target_camp_id
  returning id into saved_id;

  if saved_id is null then
    raise exception using errcode = 'P0002', message = 'camp not found';
  end if;
  return saved_id;
end;
$$;

revoke all on function public.update_camp_info_admin(uuid, text, integer, timestamp without time zone, timestamp without time zone, text) from public, anon;
grant execute on function public.update_camp_info_admin(uuid, text, integer, timestamp without time zone, timestamp without time zone, text) to authenticated;

commit;
