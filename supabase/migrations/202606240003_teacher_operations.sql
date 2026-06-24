begin;

create table public.weekly_meetings (
  id uuid primary key default extensions.gen_random_uuid(),
  camp_id uuid not null references public.camps (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  scheduled_at timestamptz not null,
  meeting_url text not null check (char_length(trim(meeting_url)) between 1 and 1000),
  description text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index weekly_meetings_camp_scheduled_idx
  on public.weekly_meetings (camp_id, scheduled_at desc);

alter table public.weekly_meetings enable row level security;

create policy "weekly_meetings_select_member_or_admin"
on public.weekly_meetings for select to authenticated
using (private.is_admin() or private.is_active_camp_member(camp_id));

create policy "weekly_meetings_insert_admin_only"
on public.weekly_meetings for insert to authenticated
with check (private.is_admin());

create policy "weekly_meetings_update_admin_only"
on public.weekly_meetings for update to authenticated
using (private.is_admin()) with check (private.is_admin());

create policy "weekly_meetings_delete_admin_only"
on public.weekly_meetings for delete to authenticated
using (private.is_admin());

grant select, insert, update, delete on public.weekly_meetings to authenticated;

create or replace function private.set_weekly_meeting_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_weekly_meeting_updated_at() from public, anon, authenticated;

create trigger weekly_meetings_set_updated_at
before update on public.weekly_meetings
for each row execute function private.set_weekly_meeting_updated_at();

create or replace function public.create_camp_admin(
  camp_name text,
  camp_slug text,
  camp_timezone text,
  local_starts_at timestamp without time zone,
  student_limit integer,
  camp_status text
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare created_id uuid;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  if local_starts_at is null then
    raise exception using errcode = '22023', message = 'start time required';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = camp_timezone) then
    raise exception using errcode = '22023', message = 'invalid camp timezone';
  end if;
  insert into public.camps (name, slug, timezone, starts_at, max_students, status, created_by)
  values (
    trim(camp_name), lower(trim(camp_slug)), camp_timezone,
    local_starts_at at time zone camp_timezone, student_limit, camp_status, auth.uid()
  )
  returning id into created_id;
  return created_id;
end;
$$;

create or replace function public.create_camp_invite_admin(
  target_camp_id uuid,
  invite_code text,
  invite_max_uses integer,
  local_expires_at timestamp without time zone
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  created_id uuid;
  camp_timezone text;
  normalized_code text := upper(trim(invite_code));
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;
  if invite_code is null or char_length(normalized_code) < 6 then
    raise exception using errcode = '22023', message = 'invite code too short';
  end if;
  select timezone into camp_timezone from public.camps where id = target_camp_id;
  if camp_timezone is null then
    raise exception using errcode = 'P0002', message = 'camp not found';
  end if;
  insert into public.camp_invites (
    camp_id, code_hash, code_hint, max_uses, expires_at, is_active, created_by
  ) values (
    target_camp_id,
    encode(extensions.digest(convert_to(normalized_code, 'UTF8'), 'sha256'), 'hex'),
    left(normalized_code, 2) || repeat('*', greatest(char_length(normalized_code) - 4, 2)) || right(normalized_code, 2),
    invite_max_uses,
    case when local_expires_at is null then null else local_expires_at at time zone camp_timezone end,
    true,
    auth.uid()
  ) returning id into created_id;
  return created_id;
end;
$$;

create or replace function public.save_weekly_meeting_admin(
  target_meeting_id uuid,
  target_camp_id uuid,
  meeting_title text,
  local_scheduled_at timestamp without time zone,
  target_meeting_url text,
  meeting_description text
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
  select timezone into camp_timezone from public.camps where id = target_camp_id;
  if camp_timezone is null then
    raise exception using errcode = 'P0002', message = 'camp not found';
  end if;
  if target_meeting_id is null then
    insert into public.weekly_meetings (
      camp_id, title, scheduled_at, meeting_url, description, created_by, updated_by
    ) values (
      target_camp_id, trim(meeting_title),
      local_scheduled_at at time zone camp_timezone,
      trim(target_meeting_url), nullif(trim(meeting_description), ''), auth.uid(), auth.uid()
    ) returning id into saved_id;
  else
    update public.weekly_meetings
    set camp_id = target_camp_id,
        title = trim(meeting_title),
        scheduled_at = local_scheduled_at at time zone camp_timezone,
        meeting_url = trim(target_meeting_url),
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

revoke all on function public.create_camp_admin(text, text, text, timestamp without time zone, integer, text) from public, anon;
revoke all on function public.create_camp_invite_admin(uuid, text, integer, timestamp without time zone) from public, anon;
revoke all on function public.save_weekly_meeting_admin(uuid, uuid, text, timestamp without time zone, text, text) from public, anon;
grant execute on function public.create_camp_admin(text, text, text, timestamp without time zone, integer, text) to authenticated;
grant execute on function public.create_camp_invite_admin(uuid, text, integer, timestamp without time zone) to authenticated;
grant execute on function public.save_weekly_meeting_admin(uuid, uuid, text, timestamp without time zone, text, text) to authenticated;

commit;
