begin;

create or replace function public.get_camp_completed_assignment_count(target_camp_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or target_camp_id is null
    or not private.is_active_camp_member(target_camp_id) then
    raise exception 'active camp membership required';
  end if;

  return (
    select count(*)
    from (
      select assignment_row.user_id, assignment_row.course_id
      from public.student_assignment_submissions as assignment_row
      where assignment_row.camp_id = target_camp_id

      union

      select recording_row.user_id, recording_row.course_id
      from public.student_submissions as recording_row
      where recording_row.camp_id = target_camp_id

      union

      select photo_row.user_id, photo_row.course_id
      from public.student_photo_submissions as photo_row
      where photo_row.camp_id = target_camp_id
    ) as completed_assignments
  );
end;
$$;

revoke all on function public.get_camp_completed_assignment_count(uuid)
from public, anon;
grant execute on function public.get_camp_completed_assignment_count(uuid)
to authenticated;

commit;
