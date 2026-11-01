begin;

alter table public.weekly_meetings
  add column meeting_number text;

alter table public.weekly_meetings
  alter column meeting_url drop not null,
  drop constraint if exists weekly_meetings_meeting_url_check,
  add constraint weekly_meetings_meeting_url_check
    check (meeting_url is null or char_length(trim(meeting_url)) between 1 and 1000),
  add constraint weekly_meetings_meeting_number_check
    check (meeting_number is null or char_length(trim(meeting_number)) between 1 and 120),
  add constraint weekly_meetings_connection_required_check
    check (nullif(trim(meeting_url), '') is not null or nullif(trim(meeting_number), '') is not null);

drop function public.save_weekly_meeting_admin(uuid, uuid, text, timestamp without time zone, text, text);

create function public.save_weekly_meeting_admin(
  target_meeting_id uuid,
  target_camp_id uuid,
  meeting_title text,
  local_scheduled_at timestamp without time zone,
  target_meeting_url text,
  meeting_description text,
  target_meeting_number text
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  saved_id uuid;
  camp_timezone text;
  normalized_meeting_url text := nullif(trim(target_meeting_url), '');
  normalized_meeting_number text := nullif(trim(target_meeting_number), '');
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  if normalized_meeting_url is null and normalized_meeting_number is null then
    raise exception using errcode = '22023', message = 'meeting url or number required';
  end if;
  select timezone into camp_timezone from public.camps where id = target_camp_id;
  if camp_timezone is null then
    raise exception using errcode = 'P0002', message = 'camp not found';
  end if;
  if target_meeting_id is null then
    insert into public.weekly_meetings (
      camp_id, title, scheduled_at, meeting_url, meeting_number, description, created_by, updated_by
    ) values (
      target_camp_id, trim(meeting_title),
      local_scheduled_at at time zone camp_timezone,
      normalized_meeting_url, normalized_meeting_number,
      nullif(trim(meeting_description), ''), auth.uid(), auth.uid()
    ) returning id into saved_id;
  else
    update public.weekly_meetings
    set camp_id = target_camp_id,
        title = trim(meeting_title),
        scheduled_at = local_scheduled_at at time zone camp_timezone,
        meeting_url = normalized_meeting_url,
        meeting_number = normalized_meeting_number,
        description = nullif(trim(meeting_description), ''),
        updated_by = auth.uid()
    where id = target_meeting_id
    returning id into saved_id;
  end if;
  if saved_id is null then
    raise exception using errcode = 'P0002', message = 'meeting not found';
  end if;
  return saved_id;
end;
$$;

revoke all on function public.save_weekly_meeting_admin(uuid, uuid, text, timestamp without time zone, text, text, text) from public, anon;
grant execute on function public.save_weekly_meeting_admin(uuid, uuid, text, timestamp without time zone, text, text, text) to authenticated;

commit;
