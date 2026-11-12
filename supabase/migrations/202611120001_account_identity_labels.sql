begin;

alter table public.profiles
  add column identity_label text;

update public.profiles
set identity_label = 'student'
where identity_label is null;

alter table public.profiles
  alter column identity_label set default 'student',
  alter column identity_label set not null,
  add constraint profiles_identity_label_check
    check (identity_label in ('student', 'teacher', 'helper'));

create or replace function private.profile_update_allowed(
  profile_id uuid,
  requested_role public.app_role,
  requested_status text,
  requested_created_at timestamptz,
  requested_identity_label text
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
          and current_profile.identity_label = requested_identity_label
      )
    );
$$;

revoke execute on function private.profile_update_allowed(uuid, public.app_role, text, timestamptz)
  from public, anon, authenticated;
revoke execute on function private.profile_update_allowed(uuid, public.app_role, text, timestamptz, text)
  from public, anon;
grant execute on function private.profile_update_allowed(uuid, public.app_role, text, timestamptz, text)
  to authenticated;

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()) or private.is_admin())
with check (
  private.profile_update_allowed(id, role, status, created_at, identity_label)
);

create or replace function public.get_admin_users()
returns table (
  id uuid,
  display_name text,
  email text,
  system_role public.app_role,
  status text,
  identity_label text,
  camp_id uuid,
  camp_name text,
  membership_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'admin required'; end if;
  return query
  select profile.id, profile.display_name, coalesce(account.email, ''), profile.role,
    profile.status, profile.identity_label, member.camp_id, camp.name, member.status
  from public.profiles profile
  join auth.users account on account.id = profile.id
  left join public.camp_members member on member.user_id = profile.id
  left join public.camps camp on camp.id = member.camp_id
  order by lower(profile.display_name), lower(coalesce(account.email, '')), camp.created_at;
end;
$$;

revoke all on function public.get_admin_users() from public, anon, authenticated;
grant execute on function public.get_admin_users() to authenticated;

create or replace function public.set_user_identity_label(target_user_id uuid, target_identity_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'admin required'; end if;
  if target_identity_label not in ('student', 'teacher', 'helper') then
    raise exception 'invalid identity label';
  end if;
  update public.profiles
  set identity_label = target_identity_label, updated_at = now()
  where id = target_user_id;
  if not found then raise exception 'user not found'; end if;
end;
$$;

revoke all on function public.set_user_identity_label(uuid, text) from public, anon, authenticated;
grant execute on function public.set_user_identity_label(uuid, text) to authenticated;

create or replace function public.get_visible_identity_labels(target_user_ids uuid[])
returns table (user_id uuid, identity_label text)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.identity_label
  from public.profiles profile
  where profile.id = any(target_user_ids)
    and (
      private.is_admin()
      or profile.id = (select auth.uid())
      or exists (
        select 1
        from public.camp_members mine
        join public.camp_members theirs on theirs.camp_id = mine.camp_id
        where mine.user_id = (select auth.uid()) and mine.status = 'active'
          and theirs.user_id = profile.id and theirs.status = 'active'
      )
    );
$$;

revoke all on function public.get_visible_identity_labels(uuid[]) from public, anon;
grant execute on function public.get_visible_identity_labels(uuid[]) to authenticated;

commit;
