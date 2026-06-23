begin;

do $$
declare
  admin_id uuid;
  beta_camp_id uuid;
begin
  select id
  into admin_id
  from public.profiles
  where role = 'admin' and status = 'active'
  order by created_at
  limit 1;

  if admin_id is null then
    raise exception 'Create an active admin profile before running this seed.';
  end if;

  insert into public.camps (
    name,
    slug,
    status,
    max_students,
    starts_at,
    ends_at,
    created_by
  )
  values (
    '好好意语共读空间 · 7天公测',
    'reading-beta-7d',
    'active',
    20,
    now(),
    now() + interval '30 days',
    admin_id
  )
  on conflict (slug) do update
  set
    name = excluded.name,
    status = excluded.status,
    max_students = excluded.max_students,
    ends_at = excluded.ends_at,
    updated_at = now()
  returning id into beta_camp_id;

  insert into public.camp_invites (
    camp_id,
    code_hash,
    code_hint,
    max_uses,
    expires_at,
    is_active,
    created_by
  )
  values (
    beta_camp_id,
    encode(extensions.digest(convert_to(upper(trim('LETTURA01')), 'UTF8'), 'sha256'), 'hex'),
    'LETT***01',
    20,
    now() + interval '30 days',
    true,
    admin_id
  )
  on conflict (code_hash) do update
  set
    camp_id = excluded.camp_id,
    code_hint = excluded.code_hint,
    max_uses = excluded.max_uses,
    expires_at = excluded.expires_at,
    is_active = true;
end;
$$;

commit;
