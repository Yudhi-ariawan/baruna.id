-- Restore official contact emails for the existing curated expert directory.
-- New/unverified experts remain private by default; only published,
-- governance-verified experts with an official KKP login email are backfilled.

with verified_accounts as (
  select
    expert.id as expert_id,
    expert.original_contributor_id as user_id,
    lower(trim(auth_user.email)) as official_email
  from public.experts expert
  join auth.users auth_user
    on auth_user.id = expert.original_contributor_id
  where expert.current_status = 'published'::public.registry_status_v1
    and expert.visibility = 'public'::public.registry_visibility_v1
    and expert.verification_status = 'governance_verified'::public.verification_status_v1
    and lower(trim(auth_user.email)) ~ '^[^@[:space:]]+@kkp\.go\.id$'
)
update public.profiles profile
set email = account.official_email,
    updated_at = now()
from verified_accounts account
where profile.id = account.user_id
  and profile.email is distinct from account.official_email;

with verified_accounts as (
  select
    expert.id as expert_id,
    lower(trim(auth_user.email)) as official_email
  from public.experts expert
  join auth.users auth_user
    on auth_user.id = expert.original_contributor_id
  where expert.current_status = 'published'::public.registry_status_v1
    and expert.visibility = 'public'::public.registry_visibility_v1
    and expert.verification_status = 'governance_verified'::public.verification_status_v1
    and lower(trim(auth_user.email)) ~ '^[^@[:space:]]+@kkp\.go\.id$'
)
update public.experts expert
set contact_email = account.official_email,
    show_email = true,
    updated_at = now()
from verified_accounts account
where expert.id = account.expert_id
  and (
    expert.contact_email is distinct from account.official_email
    or expert.show_email is distinct from true
  );

insert into public.governance_audit_log (
  event_type,
  subject_id,
  entity_type,
  entity_id,
  after
)
select
  'verified_expert_contact_email_published',
  expert.original_contributor_id,
  'expert',
  expert.id::text,
  jsonb_build_object(
    'contact_email', expert.contact_email,
    'show_email', expert.show_email,
    'source', 'verified_auth_account_backfill'
  )
from public.experts expert
where expert.current_status = 'published'::public.registry_status_v1
  and expert.visibility = 'public'::public.registry_visibility_v1
  and expert.verification_status = 'governance_verified'::public.verification_status_v1
  and expert.show_email = true
  and expert.contact_email ~* '^[^@[:space:]]+@kkp\.go\.id$'
  and not exists (
    select 1
    from public.governance_audit_log audit
    where audit.event_type = 'verified_expert_contact_email_published'
      and audit.entity_id = expert.id::text
      and audit.after ->> 'contact_email' = expert.contact_email
  );
