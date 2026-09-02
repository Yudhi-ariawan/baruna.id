
-- =========================================================
-- Phase 1.3 Increment 4 — module_registry
-- Governance/provenance/versioning canonical registry.
-- Does NOT read, write, or reference master_modules as a FK.
-- =========================================================

-- Enum: module type
DO $$ BEGIN
  CREATE TYPE public.module_type_v1 AS ENUM (
    'foundational','technical','applied','policy','managerial',
    'safety','compliance','soft_skills','field_practicum','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- Table: module_registry
-- =========================================================
CREATE TABLE public.module_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- shared provenance header
  source_type              text NOT NULL DEFAULT 'external_submission',
  source_submission_id     uuid,
  source_institution_id    uuid,
  original_contributor_id  uuid,
  created_by               uuid NOT NULL,
  approved_by              uuid,
  published_by             uuid,
  approval_date            timestamptz,
  publication_date         timestamptz,
  verification_status      public.verification_status_v1 NOT NULL DEFAULT 'unverified',
  visibility               public.registry_visibility_v1 NOT NULL DEFAULT 'private',
  version                  integer NOT NULL DEFAULT 1,
  previous_version_id      uuid,
  current_status           public.registry_status_v1 NOT NULL DEFAULT 'draft',
  audit_ref                uuid,

  -- module content (governance registry, NOT delivery)
  title                    text NOT NULL,
  summary                  text,
  language                 text,
  module_type              public.module_type_v1 NOT NULL DEFAULT 'other',
  target_participants      text,
  estimated_learning_hours numeric,

  learning_objectives      text[]  NOT NULL DEFAULT '{}',
  competency_refs          text[]  NOT NULL DEFAULT '{}',
  prerequisites            text[]  NOT NULL DEFAULT '{}',
  delivery_suitability     text[]  NOT NULL DEFAULT '{}',

  content_outline          jsonb   NOT NULL DEFAULT '{}',
  learning_activities      jsonb   NOT NULL DEFAULT '{}',
  assessment_approach      jsonb   NOT NULL DEFAULT '{}',

  author_expert_id         uuid,
  institution_id           uuid,
  related_resource_ids     uuid[]  NOT NULL DEFAULT '{}',

  -- informational-only provenance to Learning Engine (NEVER a FK, NEVER authoritative)
  legacy_master_module_ref text,

  metadata                 jsonb   NOT NULL DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT module_registry_source_type_chk CHECK (source_type IN (
    'admin_direct','admin_entry','admin_import','bulk_import',
    'institutional_intake','external_submission','invited_contributor',
    'system_sync','migration_legacy'
  ))
);

CREATE INDEX module_registry_created_by_idx     ON public.module_registry (created_by);
CREATE INDEX module_registry_status_idx         ON public.module_registry (current_status);
CREATE INDEX module_registry_visibility_idx     ON public.module_registry (visibility, verification_status);
CREATE INDEX module_registry_source_sub_idx     ON public.module_registry (source_submission_id);
CREATE INDEX module_registry_institution_idx    ON public.module_registry (institution_id);
CREATE INDEX module_registry_author_expert_idx  ON public.module_registry (author_expert_id);

GRANT SELECT, INSERT, UPDATE ON public.module_registry TO authenticated;
GRANT SELECT ON public.module_registry TO anon;
GRANT ALL ON public.module_registry TO service_role;

ALTER TABLE public.module_registry ENABLE ROW LEVEL SECURITY;

-- Public: only published + verified + public rows
CREATE POLICY mr_select_public
  ON public.module_registry
  FOR SELECT
  USING (
    current_status = 'published'
    AND visibility = 'public'
    AND verification_status IN ('institutionally_verified','governance_verified')
  );

-- Owner: read own
CREATE POLICY mr_select_own
  ON public.module_registry
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Admin / Management: read all
CREATE POLICY mr_select_admin_mgmt
  ON public.module_registry
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

-- QA Reviewer: assignment-scoped only (via source_submission_id → review_subjects.id)
CREATE POLICY mr_select_reviewer_assigned
  ON public.module_registry
  FOR SELECT TO authenticated
  USING (
    source_submission_id IS NOT NULL
    AND public.can_review_registry_subject(source_submission_id)
  );

-- Writes: RPC-only. No INSERT/UPDATE policies for end users.
-- Admin/Mgmt writes via SECURITY DEFINER RPCs bypass RLS by design.
-- Explicit policy denies direct client writes:
CREATE POLICY mr_no_client_writes_insert ON public.module_registry FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY mr_no_client_writes_update ON public.module_registry FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

-- updated_at trigger
CREATE TRIGGER trg_mr_touch_updated_at
  BEFORE UPDATE ON public.module_registry
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

-- =========================================================
-- Table: module_registry_versions (append-only)
-- =========================================================
CREATE TABLE public.module_registry_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.module_registry(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  previous_version_id uuid,
  created_by uuid,
  publication_or_approval_ref uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, version)
);

CREATE INDEX module_registry_versions_module_idx ON public.module_registry_versions (module_id, version DESC);

GRANT SELECT ON public.module_registry_versions TO authenticated;
GRANT ALL ON public.module_registry_versions TO service_role;

ALTER TABLE public.module_registry_versions ENABLE ROW LEVEL SECURITY;

-- Read: only for actors who can read the parent module
CREATE POLICY mrv_select_scoped
  ON public.module_registry_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.module_registry m WHERE m.id = module_id AND (
      m.created_by = auth.uid()
      OR public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'management')
      OR (m.source_submission_id IS NOT NULL AND public.can_review_registry_subject(m.source_submission_id))
    ))
  );
-- Deny direct client writes (append-only via trigger, SECURITY DEFINER)
CREATE POLICY mrv_no_client_writes_insert ON public.module_registry_versions FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY mrv_no_client_writes_update ON public.module_registry_versions FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY mrv_no_client_writes_delete ON public.module_registry_versions FOR DELETE TO authenticated USING (false);

-- =========================================================
-- Version snapshot trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.emit_module_registry_version_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_snap jsonb; v_prev uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF (NEW.publication_date IS DISTINCT FROM OLD.publication_date AND NEW.publication_date IS NOT NULL)
     OR (NEW.version IS DISTINCT FROM OLD.version) THEN
    v_snap := jsonb_build_object('module', to_jsonb(NEW));
    SELECT id INTO v_prev FROM public.module_registry_versions
      WHERE module_id = NEW.id ORDER BY version DESC LIMIT 1;
    INSERT INTO public.module_registry_versions (module_id, version, snapshot, previous_version_id, created_by, publication_or_approval_ref)
    VALUES (NEW.id, NEW.version, v_snap, v_prev, auth.uid(), NEW.audit_ref);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_mr_version_snapshot
  AFTER UPDATE ON public.module_registry
  FOR EACH ROW EXECUTE FUNCTION public.emit_module_registry_version_snapshot();

-- =========================================================
-- Public view (approved + public + verified)
-- =========================================================
CREATE OR REPLACE VIEW public.module_registry_public_v
WITH (security_invoker = true)
AS
SELECT id, title, summary, language, module_type, target_participants,
       estimated_learning_hours, learning_objectives, competency_refs,
       prerequisites, delivery_suitability, content_outline, learning_activities,
       assessment_approach, author_expert_id, institution_id, related_resource_ids,
       version, publication_date, verification_status, visibility, current_status
FROM public.module_registry
WHERE current_status = 'published'
  AND visibility = 'public'
  AND verification_status IN ('institutionally_verified','governance_verified');

GRANT SELECT ON public.module_registry_public_v TO anon, authenticated;

-- =========================================================
-- RPCs (SECURITY DEFINER, search_path=public)
-- =========================================================

-- Create draft
CREATE OR REPLACE FUNCTION public.module_draft_create(
  _title text,
  _module_type public.module_type_v1 DEFAULT 'other',
  _source_type text DEFAULT 'external_submission'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _title IS NULL OR length(trim(_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;

  INSERT INTO public.module_registry (source_type, created_by, original_contributor_id, title, module_type)
  VALUES (_source_type, v_uid, v_uid, _title, _module_type)
  RETURNING id INTO v_id;

  PERFORM public.emit_platform_event(
    'draft_created'::public.platform_event_type_v1,
    v_uid, v_id, 'module_registry', v_id::text, 'module_registry',
    _source_type::public.source_type_v1,
    NULL, v_id, NULL,
    jsonb_build_object('title', _title, 'module_type', _module_type)
  );
  RETURN v_id;
END $$;

-- Update draft (rejects approved_zero_tariff)
CREATE OR REPLACE FUNCTION public.module_draft_update(_module_id uuid, _patch jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.module_registry%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.module_registry WHERE id = _module_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'module_not_found'; END IF;
  IF v_row.created_by <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.current_status NOT IN ('draft','changes_requested') THEN
    RAISE EXCEPTION 'module_not_editable';
  END IF;
  IF _patch ? 'approved_zero_tariff' THEN
    RAISE EXCEPTION 'zero_tariff_not_permitted';
  END IF;

  UPDATE public.module_registry SET
    title                    = COALESCE(_patch->>'title', title),
    summary                  = COALESCE(_patch->>'summary', summary),
    language                 = COALESCE(_patch->>'language', language),
    module_type              = COALESCE(NULLIF(_patch->>'module_type','')::public.module_type_v1, module_type),
    target_participants      = COALESCE(_patch->>'target_participants', target_participants),
    estimated_learning_hours = COALESCE(NULLIF(_patch->>'estimated_learning_hours','')::numeric, estimated_learning_hours),
    learning_objectives      = COALESCE(
      CASE WHEN _patch ? 'learning_objectives' THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'learning_objectives')) END,
      learning_objectives),
    competency_refs          = COALESCE(
      CASE WHEN _patch ? 'competency_refs' THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'competency_refs')) END,
      competency_refs),
    prerequisites            = COALESCE(
      CASE WHEN _patch ? 'prerequisites' THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'prerequisites')) END,
      prerequisites),
    delivery_suitability     = COALESCE(
      CASE WHEN _patch ? 'delivery_suitability' THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'delivery_suitability')) END,
      delivery_suitability),
    content_outline          = COALESCE(_patch->'content_outline', content_outline),
    learning_activities      = COALESCE(_patch->'learning_activities', learning_activities),
    assessment_approach      = COALESCE(_patch->'assessment_approach', assessment_approach),
    author_expert_id         = COALESCE(NULLIF(_patch->>'author_expert_id','')::uuid, author_expert_id),
    institution_id           = COALESCE(NULLIF(_patch->>'institution_id','')::uuid, institution_id),
    related_resource_ids     = COALESCE(
      CASE WHEN _patch ? 'related_resource_ids' THEN ARRAY(SELECT (jsonb_array_elements_text(_patch->'related_resource_ids'))::uuid) END,
      related_resource_ids),
    legacy_master_module_ref = COALESCE(_patch->>'legacy_master_module_ref', legacy_master_module_ref),
    metadata                 = COALESCE(_patch->'metadata', metadata)
  WHERE id = _module_id;

  PERFORM public.emit_platform_event(
    'registry_record_updated'::public.platform_event_type_v1,
    v_uid, _module_id, 'module_registry', _module_id::text, 'module_registry', v_row.source_type::public.source_type_v1,
    NULL, _module_id, NULL,
    jsonb_build_object('patch_keys', (SELECT jsonb_agg(k) FROM jsonb_object_keys(_patch) k))
  );
END $$;

-- Submit draft for review
CREATE OR REPLACE FUNCTION public.module_draft_submit(_module_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.module_registry%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.module_registry WHERE id = _module_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'module_not_found'; END IF;
  IF v_row.created_by <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.current_status NOT IN ('draft','changes_requested') THEN
    RAISE EXCEPTION 'module_not_submittable';
  END IF;

  UPDATE public.module_registry SET current_status = 'submitted' WHERE id = _module_id;

  PERFORM public.emit_platform_event(
    'submission_submitted'::public.platform_event_type_v1,
    v_uid, _module_id, 'module_registry', _module_id::text, 'module_registry', v_row.source_type::public.source_type_v1,
    NULL, _module_id, NULL, '{}'::jsonb
  );
END $$;

-- Publish direct (admin/mgmt)
CREATE OR REPLACE FUNCTION public.module_publish_direct(
  _module_id uuid,
  _visibility public.registry_visibility_v1 DEFAULT 'public',
  _verification public.verification_status_v1 DEFAULT 'governance_verified',
  _rationale text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.module_registry%ROWTYPE;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT * INTO v_row FROM public.module_registry WHERE id = _module_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'module_not_found'; END IF;
  IF v_row.current_status = 'published' THEN RETURN; END IF;

  UPDATE public.module_registry SET
    current_status = 'published',
    visibility = _visibility,
    verification_status = _verification,
    approved_by = COALESCE(approved_by, v_uid),
    published_by = v_uid,
    approval_date = COALESCE(approval_date, now()),
    publication_date = now()
  WHERE id = _module_id;

  PERFORM public.emit_platform_event(
    'directly_published'::public.platform_event_type_v1,
    v_uid, _module_id, 'module_registry', _module_id::text, 'module_registry', v_row.source_type::public.source_type_v1,
    NULL, _module_id, NULL,
    jsonb_build_object('rationale', _rationale, 'visibility', _visibility, 'verification', _verification)
  );
  PERFORM public.emit_platform_event(
    'registry_record_published'::public.platform_event_type_v1,
    v_uid, _module_id, 'module_registry', _module_id::text, 'module_registry', v_row.source_type::public.source_type_v1,
    NULL, _module_id, NULL, '{}'::jsonb
  );
END $$;

-- Publish from governance decision
CREATE OR REPLACE FUNCTION public.module_publish_from_decision(
  _module_id uuid,
  _decision_id uuid,
  _visibility public.registry_visibility_v1 DEFAULT 'public',
  _verification public.verification_status_v1 DEFAULT 'governance_verified'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.module_registry%ROWTYPE; v_dec public.review_decisions%ROWTYPE;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT * INTO v_dec FROM public.review_decisions WHERE id = _decision_id;
  IF v_dec.id IS NULL OR v_dec.decision <> 'approve' THEN
    RAISE EXCEPTION 'decision_not_approve';
  END IF;
  SELECT * INTO v_row FROM public.module_registry WHERE id = _module_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'module_not_found'; END IF;
  IF v_row.current_status = 'published' THEN RETURN; END IF;

  UPDATE public.module_registry SET
    current_status = 'published',
    visibility = _visibility,
    verification_status = _verification,
    approved_by = v_dec.decided_by,
    published_by = v_uid,
    approval_date = v_dec.decided_at,
    publication_date = now(),
    audit_ref = _decision_id
  WHERE id = _module_id;

  PERFORM public.emit_platform_event(
    'approved'::public.platform_event_type_v1,
    v_uid, _module_id, 'module_registry', _module_id::text, 'module_registry', v_row.source_type::public.source_type_v1,
    NULL, _module_id, NULL, jsonb_build_object('decision_id', _decision_id)
  );
  PERFORM public.emit_platform_event(
    'registry_record_published'::public.platform_event_type_v1,
    v_uid, _module_id, 'module_registry', _module_id::text, 'module_registry', v_row.source_type::public.source_type_v1,
    NULL, _module_id, NULL, '{}'::jsonb
  );
END $$;

-- Archive
CREATE OR REPLACE FUNCTION public.module_archive(_module_id uuid, _rationale text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.module_registry%ROWTYPE;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT * INTO v_row FROM public.module_registry WHERE id = _module_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'module_not_found'; END IF;
  UPDATE public.module_registry SET current_status = 'archived' WHERE id = _module_id;
  PERFORM public.emit_platform_event(
    'registry_record_archived'::public.platform_event_type_v1,
    v_uid, _module_id, 'module_registry', _module_id::text, 'module_registry', v_row.source_type::public.source_type_v1,
    NULL, _module_id, NULL, jsonb_build_object('rationale', _rationale)
  );
END $$;

-- Revoke public / anon EXECUTE on all new RPCs; grant to authenticated only
REVOKE EXECUTE ON FUNCTION public.module_draft_create(text, public.module_type_v1, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.module_draft_update(uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.module_draft_submit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.module_publish_direct(uuid, public.registry_visibility_v1, public.verification_status_v1, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.module_publish_from_decision(uuid, uuid, public.registry_visibility_v1, public.verification_status_v1) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.module_archive(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.emit_module_registry_version_snapshot() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.module_draft_create(text, public.module_type_v1, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.module_draft_update(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.module_draft_submit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.module_publish_direct(uuid, public.registry_visibility_v1, public.verification_status_v1, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.module_publish_from_decision(uuid, uuid, public.registry_visibility_v1, public.verification_status_v1) TO authenticated;
GRANT EXECUTE ON FUNCTION public.module_archive(uuid, text) TO authenticated;
