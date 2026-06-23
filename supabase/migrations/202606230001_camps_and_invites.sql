begin;

create extension if not exists pgcrypto with schema extensions;

create table public.camps (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text unique not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  max_students integer not null default 20 check (max_students > 0),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.camp_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  camp_id uuid not null references public.camps (id) on delete cascade,
  code_hash text unique not null check (char_length(code_hash) = 64),
  code_hint text,
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0 and used_count <= max_uses),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.camp_members (
  id uuid primary key default extensions.gen_random_uuid(),
  camp_id uuid not null references public.camps (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  invite_id uuid references public.camp_invites (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'removed')),
  joined_at timestamptz not null default now(),
  ai_analysis_limit integer not null default 3 check (ai_analysis_limit >= 0),
  ai_analysis_used integer not null default 0 check (
    ai_analysis_used >= 0 and ai_analysis_used <= ai_analysis_limit
  ),
  unique (camp_id, user_id)
);

create index camp_members_user_status_idx on public.camp_members (user_id, status);
create index camp_members_camp_status_idx on public.camp_members (camp_id, status);
create index camp_invites_camp_idx on public.camp_invites (camp_id);

alter table public.camps enable row level security;
alter table public.camp_invites enable row level security;
alter table public.camp_members enable row level security;

create policy "camps_select_joined_or_admin"
on public.camps
for select
to authenticated
using (
  private.is_admin()
  or exists (
    select 1
    from public.camp_members
    where camp_members.camp_id = camps.id
      and camp_members.user_id = (select auth.uid())
      and camp_members.status = 'active'
  )
);

create policy "camps_insert_admin_only"
on public.camps
for insert
to authenticated
with check (private.is_admin());

create policy "camps_update_admin_only"
on public.camps
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "camps_delete_admin_only"
on public.camps
for delete
to authenticated
using (private.is_admin());

create policy "camp_invites_admin_all"
on public.camp_invites
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "camp_members_select_own_or_admin"
on public.camp_members
for select
to authenticated
using (user_id = (select auth.uid()) or private.is_admin());

create policy "camp_members_insert_admin_only"
on public.camp_members
for insert
to authenticated
with check (private.is_admin());

create policy "camp_members_update_admin_only"
on public.camp_members
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "camp_members_delete_admin_only"
on public.camp_members
for delete
to authenticated
using (private.is_admin());

grant select, insert, update, delete on public.camps to authenticated;
grant select, insert, update, delete on public.camp_invites to authenticated;
grant select, insert, update, delete on public.camp_members to authenticated;

create or replace function private.set_camp_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_camp_updated_at() from public, anon, authenticated;

create trigger camps_set_updated_at
before update on public.camps
for each row execute function private.set_camp_updated_at();

create or replace function public.redeem_camp_invite(invite_code text)
returns table (
  success boolean,
  result_code text,
  camp_id uuid,
  camp_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  requested_hash text;
  selected_invite_id uuid;
  selected_camp_id uuid;
  selected_camp_name text;
  selected_invite_active boolean;
  selected_expires_at timestamptz;
  selected_max_uses integer;
  selected_used_count integer;
  selected_camp_status text;
  selected_max_students integer;
  existing_member_status text;
  active_students integer;
begin
  if current_user_id is null then
    success := false;
    result_code := 'not_authenticated';
    return next;
    return;
  end if;

  if invite_code is null or trim(invite_code) = '' then
    success := false;
    result_code := 'invalid_invite';
    return next;
    return;
  end if;

  requested_hash := encode(
    extensions.digest(convert_to(upper(trim(invite_code)), 'UTF8'), 'sha256'),
    'hex'
  );

  select
    invite_row.id,
    invite_row.camp_id,
    camp_row.name,
    invite_row.is_active,
    invite_row.expires_at,
    invite_row.max_uses,
    invite_row.used_count,
    camp_row.status,
    camp_row.max_students
  into
    selected_invite_id,
    selected_camp_id,
    selected_camp_name,
    selected_invite_active,
    selected_expires_at,
    selected_max_uses,
    selected_used_count,
    selected_camp_status,
    selected_max_students
  from public.camp_invites as invite_row
  join public.camps as camp_row on camp_row.id = invite_row.camp_id
  where invite_row.code_hash = requested_hash
  for update of invite_row, camp_row;

  if selected_invite_id is null then
    success := false;
    result_code := 'invalid_invite';
    return next;
    return;
  end if;

  select member_row.status
  into existing_member_status
  from public.camp_members as member_row
  where member_row.camp_id = selected_camp_id
    and member_row.user_id = current_user_id;

  if existing_member_status = 'active' then
    success := true;
    result_code := 'already_joined';
    camp_id := selected_camp_id;
    camp_name := selected_camp_name;
    return next;
    return;
  end if;

  if existing_member_status = 'removed' then
    success := false;
    result_code := 'membership_removed';
    return next;
    return;
  end if;

  if not selected_invite_active then
    success := false;
    result_code := 'invite_inactive';
    return next;
    return;
  end if;

  if selected_expires_at is not null and selected_expires_at <= now() then
    success := false;
    result_code := 'invite_expired';
    return next;
    return;
  end if;

  if selected_used_count >= selected_max_uses then
    success := false;
    result_code := 'invite_full';
    return next;
    return;
  end if;

  if selected_camp_status <> 'active' then
    success := false;
    result_code := 'camp_inactive';
    return next;
    return;
  end if;

  select count(*)::integer
  into active_students
  from public.camp_members as member_row
  where member_row.camp_id = selected_camp_id
    and member_row.status = 'active';

  if active_students >= selected_max_students then
    success := false;
    result_code := 'camp_full';
    return next;
    return;
  end if;

  insert into public.camp_members (camp_id, user_id, invite_id)
  values (selected_camp_id, current_user_id, selected_invite_id);

  update public.camp_invites
  set used_count = used_count + 1
  where id = selected_invite_id;

  success := true;
  result_code := 'joined';
  camp_id := selected_camp_id;
  camp_name := selected_camp_name;
  return next;
end;
$$;

revoke all on function public.redeem_camp_invite(text) from public, anon;
grant execute on function public.redeem_camp_invite(text) to authenticated;

commit;
