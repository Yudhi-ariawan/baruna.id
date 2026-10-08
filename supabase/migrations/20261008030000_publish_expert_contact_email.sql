-- Publish an expert's contact email only when explicitly enabled.
-- The profile copy is retained for account administration; public consumers
-- must read the curated experts_directory_v projection instead.

alter table public.profiles
  add column if not exists email text;

alter table public.experts
  add column if not exists contact_email text,
  add column if not exists show_email boolean not null default false;

comment on column public.experts.contact_email is
  'Professional contact email. Exposed publicly only when show_email is true.';
comment on column public.experts.show_email is
  'Explicit consent flag for publishing contact_email in curated public views.';

update public.profiles
set email = 'luh.komarini@kkp.go.id',
    updated_at = now()
where id = '1ee61688-2d03-4745-b1d6-39eb40bc3969'::uuid
  and email is distinct from 'luh.komarini@kkp.go.id';

update public.experts
set contact_email = 'luh.komarini@kkp.go.id',
    show_email = true,
    updated_at = now()
where id = '88bd82f8-86d2-4706-8057-18e982e77e7f'::uuid
  and (
    contact_email is distinct from 'luh.komarini@kkp.go.id'
    or show_email is distinct from true
  );

create or replace view public.experts_directory_v as
select
  expert.id,
  expert.slug,
  expert.display_name,
  expert.headline,
  expert.bio,
  expert.country,
  expert.city,
  expert.avatar_url,
  expert.expertise_areas,
  expert.languages,
  expert.verification_status,
  employment.organization as institution,
  employment.role as institution_role,
  coalesce(trainer.trainer_status, 'candidate'::public.trainer_status_v1) as trainer_status,
  coalesce(trainer.trainer_level, 'not_assigned'::public.trainer_level_v1) as trainer_level,
  trainer.unique_graduated_participants,
  trainer.effective_from as trainer_effective_from,
  trainer.expires_at as trainer_expires_at,
  rule.min_unique_graduated_participants as recognition_min_participants,
  availability.availability_status,
  availability.available_modes,
  availability.next_available_from,
  expert.publication_date,
  expert.updated_at,
  case when expert.show_email then expert.contact_email else null end as contact_email
from public.experts expert
left join lateral (
  select item.organization, item.role
  from public.expert_employment item
  where item.expert_id = expert.id
    and item.visibility = 'public'::public.registry_visibility_v1
  order by item.is_current desc, item.start_year desc nulls last, item.updated_at desc
  limit 1
) employment on true
left join lateral (
  select item.trainer_status, item.trainer_level,
         item.unique_graduated_participants, item.effective_from, item.expires_at
  from public.expert_trainer_status item
  where item.expert_id = expert.id
    and item.effective_from <= now()
    and (item.expires_at is null or item.expires_at > now())
  order by item.version desc, item.granted_at desc
  limit 1
) trainer on true
left join lateral (
  select item.min_unique_graduated_participants
  from public.trainer_level_rules item
  where item.trainer_level = trainer.trainer_level
    and item.effective_from <= now()
    and (item.effective_until is null or item.effective_until > now())
  order by item.version desc, item.effective_from desc
  limit 1
) rule on true
left join lateral (
  select item.availability_status, item.available_modes, item.next_available_from
  from public.expert_availability item
  where item.expert_id = expert.id
    and item.visibility = 'public'::public.registry_visibility_v1
  limit 1
) availability on true
where expert.current_status = 'published'::public.registry_status_v1
  and expert.visibility = 'public'::public.registry_visibility_v1;

insert into public.governance_audit_log (
  event_type,
  subject_id,
  entity_type,
  entity_id,
  after
)
select
  'expert_contact_email_published',
  '1ee61688-2d03-4745-b1d6-39eb40bc3969'::uuid,
  'expert',
  '88bd82f8-86d2-4706-8057-18e982e77e7f',
  jsonb_build_object(
    'contact_email', 'luh.komarini@kkp.go.id',
    'show_email', true
  )
where not exists (
  select 1
  from public.governance_audit_log
  where event_type = 'expert_contact_email_published'
    and entity_id = '88bd82f8-86d2-4706-8057-18e982e77e7f'
    and after ->> 'contact_email' = 'luh.komarini@kkp.go.id'
);
