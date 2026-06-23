begin;

create type public.app_role as enum ('student', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  role public.app_role not null default 'student',
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and status = 'active'
  );
$$;

revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create or replace function private.profile_update_allowed(
  profile_id uuid,
  requested_role public.app_role,
  requested_status text,
  requested_created_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_admin()
    or (
      profile_id = (select auth.uid())
      and exists (
        select 1
        from public.profiles current_profile
        where current_profile.id = profile_id
          and current_profile.role = requested_role
          and current_profile.status = requested_status
          and current_profile.created_at = requested_created_at
      )
    );
$$;

revoke execute on function private.profile_update_allowed(uuid, public.app_role, text, timestamptz)
  from public, anon;
grant execute on function private.profile_update_allowed(uuid, public.app_role, text, timestamptz)
  to authenticated;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or private.is_admin()
);

create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
  or private.is_admin()
)
with check (
  private.profile_update_allowed(id, role, status, created_at)
);

create policy "profiles_delete_admin_only"
on public.profiles
for delete
to authenticated
using (private.is_admin());

grant select, update, delete on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_display_name text;
begin
  requested_display_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');

  insert into public.profiles (id, display_name, role, status)
  values (
    new.id,
    left(coalesce(requested_display_name, split_part(coalesce(new.email, '同学'), '@', 1)), 80),
    'student',
    'active'
  );

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id <> old.id then
    raise exception 'Profile id cannot be changed';
  end if;

  if (select auth.uid()) is not null and not private.is_admin() then
    if new.role <> old.role
      or new.status <> old.status
      or new.created_at <> old.created_at then
      raise exception 'Only an admin can change profile security fields';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.protect_profile_security_fields() from public, anon, authenticated;

create trigger protect_profile_security_fields_before_update
before update on public.profiles
for each row execute function public.protect_profile_security_fields();

commit;
