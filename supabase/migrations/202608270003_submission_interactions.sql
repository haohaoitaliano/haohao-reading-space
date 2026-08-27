begin;

create table public.submission_encouragements (
  id uuid primary key default extensions.gen_random_uuid(),
  submission_id uuid not null references public.student_submissions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  unique (submission_id, user_id)
);

create index submission_encouragements_submission_created_idx
on public.submission_encouragements (submission_id, created_at);

create table public.submission_comments (
  id uuid primary key default extensions.gen_random_uuid(),
  submission_id uuid not null references public.student_submissions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  author_display_name text not null default '同学'
    check (char_length(trim(author_display_name)) between 1 and 80),
  content text not null check (
    content = trim(content)
    and char_length(content) between 1 and 100
  ),
  created_at timestamptz not null default now()
);

create index submission_comments_submission_created_idx
on public.submission_comments (submission_id, created_at);

create or replace function private.can_interact_with_public_submission(
  target_submission_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_submissions as submission_row
    where submission_row.id = target_submission_id
      and submission_row.visibility = 'public'
      and private.is_active_camp_member(submission_row.camp_id)
      and private.is_active_camp_user(submission_row.camp_id, submission_row.user_id)
      and private.is_active_camp_user(submission_row.camp_id, target_user_id)
  );
$$;

revoke all on function private.can_interact_with_public_submission(uuid, uuid)
from public, anon;
grant execute on function private.can_interact_with_public_submission(uuid, uuid)
to authenticated;

create or replace function private.prepare_submission_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.content := trim(new.content);
  new.created_at := now();

  select coalesce(nullif(trim(profile_row.display_name), ''), '同学')
  into new.author_display_name
  from public.profiles as profile_row
  where profile_row.id = new.user_id;

  return new;
end;
$$;

revoke all on function private.prepare_submission_comment()
from public, anon, authenticated;

create trigger prepare_submission_comment_before_insert
before insert on public.submission_comments
for each row execute function private.prepare_submission_comment();

alter table public.submission_encouragements enable row level security;
alter table public.submission_comments enable row level security;

create policy "submission_encouragements_select_visible_public"
on public.submission_encouragements
for select
to authenticated
using (
  private.can_interact_with_public_submission(submission_id, user_id)
);

create policy "submission_encouragements_insert_own_visible_public"
on public.submission_encouragements
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.can_interact_with_public_submission(submission_id, user_id)
  and exists (
    select 1
    from public.student_submissions as submission_row
    where submission_row.id = submission_id
      and submission_row.user_id <> (select auth.uid())
  )
);

create policy "submission_encouragements_delete_own_visible_public"
on public.submission_encouragements
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and private.can_interact_with_public_submission(submission_id, user_id)
);

create policy "submission_comments_select_visible_public"
on public.submission_comments
for select
to authenticated
using (
  private.can_interact_with_public_submission(submission_id, user_id)
);

create policy "submission_comments_insert_own_visible_public"
on public.submission_comments
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.can_interact_with_public_submission(submission_id, user_id)
);

create policy "submission_comments_delete_own_visible_public"
on public.submission_comments
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and private.can_interact_with_public_submission(submission_id, user_id)
);

revoke all on public.submission_encouragements from anon, authenticated;
revoke all on public.submission_comments from anon, authenticated;
grant select, insert, delete on public.submission_encouragements to authenticated;
grant select, insert, delete on public.submission_comments to authenticated;

commit;
