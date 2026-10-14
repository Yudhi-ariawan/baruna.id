-- ============================================================================
-- Trainer status: evaluate the LATEST version only (Slide 35 "Trainer Status")
-- ============================================================================
-- expert_trainer_status is an append-only history (upsert_expert_trainer_status
-- inserts a new version per change). trainer_portal_bootstrap already reads the
-- newest version, but _active_trainer_expert_id accepted ANY historic 'active'
-- row. A trainer deactivated by an administrator could therefore still upload
-- to module-attachments and be resolved as module author. Both now agree.

BEGIN;

CREATE OR REPLACE FUNCTION public._active_trainer_expert_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id
  FROM public.experts e
  WHERE (e.original_contributor_id = _user_id OR e.created_by = _user_id)
    AND e.current_status = 'published'
    AND e.visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM public.rbac_user_roles ur
      JOIN public.rbac_roles r ON r.id = ur.role_id
      WHERE ur.user_id = _user_id AND r.code = 'expert'
        AND COALESCE(ur.status, 'active') = 'active'
        AND COALESCE(ur.valid_from, ur.created_at) <= now()
        AND (ur.valid_until IS NULL OR ur.valid_until > now())
    )
    AND (
      SELECT ts.trainer_status
      FROM public.expert_trainer_status ts
      WHERE ts.expert_id = e.id
        AND ts.effective_from <= now()
        AND (ts.expires_at IS NULL OR ts.expires_at > now())
      ORDER BY ts.version DESC, ts.granted_at DESC
      LIMIT 1
    ) = 'active'
  ORDER BY e.updated_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._active_trainer_expert_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._active_trainer_expert_id(uuid) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS expert_trainer_status_expert_version_idx
  ON public.expert_trainer_status (expert_id, version DESC, granted_at DESC);

-- Module covers are commonly WebP; the bucket rejected them, which the client
-- previously hid by silently falling back to the expert-applications bucket.
UPDATE storage.buckets
   SET allowed_mime_types = (
     SELECT array_agg(DISTINCT m)
     FROM unnest(COALESCE(allowed_mime_types, ARRAY[]::text[]) || ARRAY['image/webp']) AS m
   )
 WHERE id = 'module-attachments';

COMMIT;
