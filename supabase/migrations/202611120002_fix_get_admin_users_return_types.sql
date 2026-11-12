begin;

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
  select profile.id, profile.display_name, coalesce(account.email, '')::text, profile.role,
    profile.status, profile.identity_label, member.camp_id, camp.name, member.status
  from public.profiles profile
  join auth.users account on account.id = profile.id
  left join public.camp_members member on member.user_id = profile.id
  left join public.camps camp on camp.id = member.camp_id
  order by lower(profile.display_name), lower(coalesce(account.email, '')), camp.created_at;
end;
$$;

commit;
