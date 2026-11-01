begin;

create table public.submission_comment_reads (
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  comment_id uuid not null references public.submission_comments (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create index submission_comment_reads_comment_idx
on public.submission_comment_reads (comment_id);

create or replace function private.can_mark_submission_comment_read(
  target_comment_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles as profile_row
      where profile_row.id = target_user_id
        and profile_row.role = 'student'
        and profile_row.status = 'active'
    )
    and exists (
      select 1
      from public.submission_comments as comment_row
      where comment_row.id = target_comment_id
        and comment_row.user_id <> target_user_id
        and private.can_read_submission_comment_target(
          comment_row.submission_id,
          comment_row.assignment_submission_id
        )
        and (
          exists (
            select 1
            from public.student_submissions as submission_row
            where submission_row.id = comment_row.submission_id
              and private.is_active_camp_member(submission_row.camp_id)
          )
          or exists (
            select 1
            from public.student_assignment_submissions as assignment_row
            where assignment_row.id = comment_row.assignment_submission_id
              and private.is_active_camp_member(assignment_row.camp_id)
          )
        )
        and (
          exists (
            select 1
            from public.student_submissions as submission_row
            where submission_row.id = comment_row.submission_id
              and submission_row.user_id = target_user_id
          )
          or exists (
            select 1
            from public.student_assignment_submissions as assignment_row
            where assignment_row.id = comment_row.assignment_submission_id
              and assignment_row.user_id = target_user_id
          )
          or exists (
            select 1
            from public.submission_comments as parent_row
            where parent_row.id = comment_row.parent_comment_id
              and parent_row.user_id = target_user_id
          )
        )
    );
$$;

revoke all on function private.can_mark_submission_comment_read(uuid, uuid)
from public, anon;
grant execute on function private.can_mark_submission_comment_read(uuid, uuid)
to authenticated;

alter table public.submission_comment_reads enable row level security;

create policy "submission_comment_reads_select_own_legal"
on public.submission_comment_reads
for select
to authenticated
using (
  user_id = (select auth.uid())
  and private.can_mark_submission_comment_read(comment_id, user_id)
);

create policy "submission_comment_reads_insert_own_legal"
on public.submission_comment_reads
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.can_mark_submission_comment_read(comment_id, user_id)
);

revoke all on public.submission_comment_reads from anon, authenticated;
grant select on public.submission_comment_reads to authenticated;
grant insert (user_id, comment_id) on public.submission_comment_reads to authenticated;

commit;
