-- Curated public projection for the BARUNA Expert Directory.
-- Only published/public canonical records and explicitly public child data
-- are exposed. Private contact, workflow, evidence, and audit data stay out.

ALTER TABLE public.experts
  ADD COLUMN IF NOT EXISTS slug text;

WITH normalized AS (
  SELECT
    id,
    trim(both '-' FROM regexp_replace(lower(display_name), '[^a-z0-9]+', '-', 'g')) AS base_slug,
    row_number() OVER (
      PARTITION BY trim(both '-' FROM regexp_replace(lower(display_name), '[^a-z0-9]+', '-', 'g'))
      ORDER BY created_at, id
    ) AS duplicate_number
  FROM public.experts
  WHERE slug IS NULL
)
UPDATE public.experts AS expert
SET slug = CASE
  WHEN normalized.duplicate_number = 1 THEN normalized.base_slug
  ELSE normalized.base_slug || '-' || left(expert.id::text, 8)
END
FROM normalized
WHERE expert.id = normalized.id;

ALTER TABLE public.experts
  ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.experts
  DROP CONSTRAINT IF EXISTS experts_slug_format_check;
ALTER TABLE public.experts
  ADD CONSTRAINT experts_slug_format_check
  CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

CREATE UNIQUE INDEX IF NOT EXISTS experts_slug_unique_idx
  ON public.experts (slug);

CREATE OR REPLACE VIEW public.experts_directory_v
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
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
  employment.organization AS institution,
  employment.role AS institution_role,
  COALESCE(trainer.trainer_status, 'candidate'::public.trainer_status_v1) AS trainer_status,
  COALESCE(trainer.trainer_level, 'not_assigned'::public.trainer_level_v1) AS trainer_level,
  trainer.unique_graduated_participants,
  trainer.effective_from AS trainer_effective_from,
  trainer.expires_at AS trainer_expires_at,
  rule.min_unique_graduated_participants AS recognition_min_participants,
  availability.availability_status,
  availability.available_modes,
  availability.next_available_from,
  expert.publication_date,
  expert.updated_at
FROM public.experts AS expert
LEFT JOIN LATERAL (
  SELECT item.organization, item.role
  FROM public.expert_employment AS item
  WHERE item.expert_id = expert.id
    AND item.visibility = 'public'
  ORDER BY item.is_current DESC, item.start_year DESC NULLS LAST, item.updated_at DESC
  LIMIT 1
) AS employment ON true
LEFT JOIN LATERAL (
  SELECT item.trainer_status, item.trainer_level,
         item.unique_graduated_participants, item.effective_from, item.expires_at
  FROM public.expert_trainer_status AS item
  WHERE item.expert_id = expert.id
    AND item.effective_from <= now()
    AND (item.expires_at IS NULL OR item.expires_at > now())
  ORDER BY item.version DESC, item.granted_at DESC
  LIMIT 1
) AS trainer ON true
LEFT JOIN LATERAL (
  SELECT item.min_unique_graduated_participants
  FROM public.trainer_level_rules AS item
  WHERE item.trainer_level = trainer.trainer_level
    AND item.effective_from <= now()
    AND (item.effective_until IS NULL OR item.effective_until > now())
  ORDER BY item.version DESC, item.effective_from DESC
  LIMIT 1
) AS rule ON true
LEFT JOIN LATERAL (
  SELECT item.availability_status, item.available_modes, item.next_available_from
  FROM public.expert_availability AS item
  WHERE item.expert_id = expert.id
    AND item.visibility = 'public'
  LIMIT 1
) AS availability ON true
WHERE expert.current_status = 'published'
  AND expert.visibility = 'public';

REVOKE ALL ON public.experts_directory_v FROM PUBLIC;
GRANT SELECT ON public.experts_directory_v TO anon, authenticated, service_role;

COMMENT ON VIEW public.experts_directory_v IS
  'Curated public-only Expert Directory projection. Excludes contacts, evidence, workflow, and audit data.';
