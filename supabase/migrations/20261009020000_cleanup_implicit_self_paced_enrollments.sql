-- Remove enrollments that were created by the legacy LMS auto-open behavior.
-- A legitimate self-paced enrollment must have an approved application when
-- it has no learning activity at all. This migration is safe to rerun.

begin;

create temporary table if not exists implicit_self_paced_cleanup
on commit drop as
select enrollment.user_id, enrollment.code
from public.self_paced_enrollments enrollment
where enrollment.completed is false
  and not (
    coalesce((enrollment.completed_steps ->> 'video')::boolean, false)
    or coalesce((enrollment.completed_steps ->> 'pdf')::boolean, false)
    or coalesce((enrollment.completed_steps ->> 'ppt')::boolean, false)
    or coalesce((enrollment.completed_steps ->> 'quiz')::boolean, false)
  )
  and not exists (
    select 1
    from public.course_enrollment_applications application
    where application.user_id = enrollment.user_id
      and application.course_id = enrollment.code
      and application.status = 'approved'
  );

-- Remove the same implicit course keys from Auth metadata first, otherwise an
-- old metadata fallback could recreate them during the next cloud sync.
with cleanup_by_user as (
  select user_id, array_agg(code) as codes
  from implicit_self_paced_cleanup
  group by user_id
)
update auth.users auth_user
set raw_user_meta_data = jsonb_set(
  coalesce(auth_user.raw_user_meta_data, '{}'::jsonb),
  '{self_paced_courses}',
  coalesce(auth_user.raw_user_meta_data -> 'self_paced_courses', '{}'::jsonb) - cleanup.codes,
  true
)
from cleanup_by_user cleanup
where auth_user.id = cleanup.user_id;

delete from public.self_paced_enrollments enrollment
using implicit_self_paced_cleanup cleanup
where enrollment.user_id = cleanup.user_id
  and enrollment.code = cleanup.code;

commit;
