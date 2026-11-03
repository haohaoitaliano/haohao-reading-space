begin;

alter table public.course_videos
  add column id uuid default extensions.gen_random_uuid(),
  add column position integer;

update public.course_videos
set position = 1
where position is null;

alter table public.course_videos
  drop constraint course_videos_pkey,
  alter column id set not null,
  alter column position set not null,
  add constraint course_videos_pkey primary key (id),
  add constraint course_videos_position_positive check (position > 0),
  add constraint course_videos_course_id_position_key unique (course_id, position);

create index course_videos_course_id_idx
on public.course_videos (course_id);

commit;
