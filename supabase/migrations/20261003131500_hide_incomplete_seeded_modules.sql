-- Official curricula imported from frontend master data are working drafts until
-- their owner uploads the required learning package and governance publishes it.
-- Keep the canonical/resource records so trainers can complete them, but ensure
-- that an incomplete package can never appear in the public catalogue.

-- Canonical registries originally accepted only post-approval states. The
-- imported curricula are intentionally pre-publication records, so allow the
-- explicit draft state while retaining the existing terminal states.
ALTER TABLE public.module_registry DROP CONSTRAINT IF EXISTS mr_status_canonical_ck;
ALTER TABLE public.module_registry ADD CONSTRAINT mr_status_canonical_ck
  CHECK (current_status IN ('draft','approved','published','archived','deprecated','revoked'));

ALTER TABLE public.knowledge_resources DROP CONSTRAINT IF EXISTS kr_status_canonical_ck;
ALTER TABLE public.knowledge_resources ADD CONSTRAINT kr_status_canonical_ck
  CHECK (current_status IN ('draft','approved','published','archived','deprecated','revoked'));

UPDATE public.module_registry
SET current_status = 'draft'::public.registry_status_v1,
    visibility = 'private'::public.registry_visibility_v1,
    verification_status = 'unverified'::public.verification_status_v1,
    approved_by = NULL,
    published_by = NULL,
    approval_date = NULL,
    publication_date = NULL,
    updated_at = now()
WHERE metadata->>'migrated_from' = 'src/data/masterModules.ts'
  AND COALESCE(jsonb_array_length(COALESCE(metadata->'attached_resources', '[]'::jsonb)), 0) = 0;

UPDATE public.knowledge_resources AS resource
SET current_status = 'draft'::public.registry_status_v1,
    visibility = 'private'::public.registry_visibility_v1,
    verification_status = 'unverified'::public.verification_status_v1,
    approved_by = NULL,
    published_by = NULL,
    approval_date = NULL,
    publication_date = NULL,
    updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM public.module_registry AS module
  WHERE module.id = resource.id
    AND module.metadata->>'migrated_from' = 'src/data/masterModules.ts'
    AND COALESCE(jsonb_array_length(COALESCE(module.metadata->'attached_resources', '[]'::jsonb)), 0) = 0
);
