-- ============================================================================
-- Phase 1.3 — Canonical Registry Boundary Correction
-- ============================================================================
-- Canonical tables hold only publication-lifecycle rows (approved / published /
-- archived). Draft, submitted, under_review, returned_for_revision, rejected,
-- and withdrawn belong exclusively in review_drafts + review_subjects.

-- ---------------------------------------------------------------------------
-- 1. Drop obsolete Phase 1.3 draft/publish RPC signatures (canonical-writing)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.expert_draft_create(text, source_type_v1);
DROP FUNCTION IF EXISTS public.expert_draft_update(uuid, jsonb);
DROP FUNCTION IF EXISTS public.expert_draft_submit(uuid);
DROP FUNCTION IF EXISTS public.expert_publish_direct(uuid, registry_visibility_v1, verification_status_v1, text);
DROP FUNCTION IF EXISTS public.expert_publish_from_decision(uuid, uuid, registry_visibility_v1, verification_status_v1);

DROP FUNCTION IF EXISTS public.kr_draft_create(text, resource_type_v1, source_type_v1);
DROP FUNCTION IF EXISTS public.kr_draft_update(uuid, jsonb);
DROP FUNCTION IF EXISTS public.kr_draft_submit(uuid);
DROP FUNCTION IF EXISTS public.kr_publish_direct(uuid, registry_visibility_v1, verification_status_v1, text);
DROP FUNCTION IF EXISTS public.kr_publish_from_decision(uuid, uuid, registry_visibility_v1, verification_status_v1);

DROP FUNCTION IF EXISTS public.module_draft_create(text, module_type_v1, text);
DROP FUNCTION IF EXISTS public.module_draft_update(uuid, jsonb);
DROP FUNCTION IF EXISTS public.module_draft_submit(uuid);
DROP FUNCTION IF EXISTS public.module_publish_direct(uuid, registry_visibility_v1, verification_status_v1, text);
DROP FUNCTION IF EXISTS public.module_publish_from_decision(uuid, uuid, registry_visibility_v1, verification_status_v1);

-- ---------------------------------------------------------------------------
-- 2. Canonical-only status guardrail + defaults
-- ---------------------------------------------------------------------------
-- Canonical tables must be empty of workflow rows (verified: 0 rows each).
-- Constrain current_status to publication lifecycle only.

ALTER TABLE public.experts ALTER COLUMN current_status DROP DEFAULT;
ALTER TABLE public.experts ALTER COLUMN current_status SET DEFAULT 'approved'::registry_status_v1;
ALTER TABLE public.experts DROP CONSTRAINT IF EXISTS experts_status_canonical_ck;
ALTER TABLE public.experts ADD CONSTRAINT experts_status_canonical_ck
  CHECK (current_status IN ('approved','published','archived'));

ALTER TABLE public.knowledge_resources ALTER COLUMN current_status DROP DEFAULT;
ALTER TABLE public.knowledge_resources ALTER COLUMN current_status SET DEFAULT 'approved'::registry_status_v1;
ALTER TABLE public.knowledge_resources DROP CONSTRAINT IF EXISTS kr_status_canonical_ck;
ALTER TABLE public.knowledge_resources ADD CONSTRAINT kr_status_canonical_ck
  CHECK (current_status IN ('approved','published','archived'));

ALTER TABLE public.module_registry ALTER COLUMN current_status DROP DEFAULT;
ALTER TABLE public.module_registry ALTER COLUMN current_status SET DEFAULT 'approved'::registry_status_v1;
ALTER TABLE public.module_registry DROP CONSTRAINT IF EXISTS mr_status_canonical_ck;
ALTER TABLE public.module_registry ADD CONSTRAINT mr_status_canonical_ck
  CHECK (current_status IN ('approved','published','archived'));

-- Idempotency: at most one canonical row per originating submission
CREATE UNIQUE INDEX IF NOT EXISTS experts_source_submission_uniq
  ON public.experts(source_submission_id) WHERE source_submission_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS kr_source_submission_uniq
  ON public.knowledge_resources(source_submission_id) WHERE source_submission_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mr_source_submission_uniq
  ON public.module_registry(source_submission_id) WHERE source_submission_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Remove owner-draft RLS on canonical; align to no-direct-writes
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS experts_owner_insert       ON public.experts;
DROP POLICY IF EXISTS experts_owner_update_draft ON public.experts;

DROP POLICY IF EXISTS experts_no_direct_insert ON public.experts;
DROP POLICY IF EXISTS experts_no_direct_update ON public.experts;
CREATE POLICY experts_no_direct_insert ON public.experts
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY experts_no_direct_update ON public.experts
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

-- knowledge_resources / module_registry already have no-direct-insert/update
-- policies from earlier increments; no changes needed there.

-- ---------------------------------------------------------------------------
-- 4. Governance-mediated intake RPCs (write to review_drafts, not canonical)
-- ---------------------------------------------------------------------------

-- Shared helper: enforce actor owns draft and it is editable
-- (No new helper needed; inline checks below.)

-- ---- EXPERTS ----
CREATE OR REPLACE FUNCTION public.expert_draft_create(
  _display_name text,
  _source_type source_type_v1 DEFAULT 'external_submission'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_draft_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _display_name IS NULL OR length(trim(_display_name)) = 0 THEN
    RAISE EXCEPTION 'display_name_required';
  END IF;

  INSERT INTO public.review_drafts (submitter_id, subject_kind, title, payload)
  VALUES (v_uid, 'expert', _display_name,
          jsonb_build_object('source_type', _source_type,
                             'display_name', _display_name))
  RETURNING id INTO v_draft_id;

  PERFORM public.emit_platform_event(
    'draft_created'::platform_event_type_v1,
    v_uid, v_draft_id, 'expert', v_draft_id::text, 'experts',
    _source_type, v_draft_id, NULL, NULL,
    jsonb_build_object('display_name', _display_name));
  RETURN v_draft_id;
END $$;

CREATE OR REPLACE FUNCTION public.expert_draft_update(
  _draft_id uuid, _patch jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.review_drafts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _patch ? 'approved_zero_tariff' THEN
    RAISE EXCEPTION 'approved_zero_tariff not accepted in Phase 1.3';
  END IF;
  SELECT * INTO v_row FROM public.review_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF v_row.submitter_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.subject_kind <> 'expert' THEN RAISE EXCEPTION 'wrong_subject_kind'; END IF;
  IF v_row.status <> 'draft' THEN RAISE EXCEPTION 'draft_not_editable'; END IF;

  UPDATE public.review_drafts
     SET payload = COALESCE(payload,'{}'::jsonb) || COALESCE(_patch,'{}'::jsonb),
         title = COALESCE(_patch->>'display_name', title)
   WHERE id = _draft_id;
END $$;

CREATE OR REPLACE FUNCTION public.expert_draft_submit(_draft_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public.submit_draft_for_review(_draft_id);
END $$;

-- ---- KNOWLEDGE RESOURCES ----
CREATE OR REPLACE FUNCTION public.kr_draft_create(
  _title text,
  _resource_type resource_type_v1,
  _source_type source_type_v1 DEFAULT 'external_submission'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_draft_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _title IS NULL OR length(trim(_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;

  INSERT INTO public.review_drafts (submitter_id, subject_kind, title, payload)
  VALUES (v_uid, 'knowledge_resource', _title,
          jsonb_build_object('source_type', _source_type,
                             'resource_type', _resource_type,
                             'title', _title))
  RETURNING id INTO v_draft_id;

  PERFORM public.emit_platform_event(
    'draft_created'::platform_event_type_v1,
    v_uid, v_draft_id, 'knowledge_resource', v_draft_id::text, 'knowledge_resources',
    _source_type, v_draft_id, NULL, NULL,
    jsonb_build_object('title', _title, 'resource_type', _resource_type));
  RETURN v_draft_id;
END $$;

CREATE OR REPLACE FUNCTION public.kr_draft_update(_draft_id uuid, _patch jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.review_drafts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _patch ? 'approved_zero_tariff' THEN
    RAISE EXCEPTION 'approved_zero_tariff not accepted in Phase 1.3';
  END IF;
  SELECT * INTO v_row FROM public.review_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF v_row.submitter_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.subject_kind <> 'knowledge_resource' THEN RAISE EXCEPTION 'wrong_subject_kind'; END IF;
  IF v_row.status <> 'draft' THEN RAISE EXCEPTION 'draft_not_editable'; END IF;

  UPDATE public.review_drafts
     SET payload = COALESCE(payload,'{}'::jsonb) || COALESCE(_patch,'{}'::jsonb),
         title = COALESCE(_patch->>'title', title)
   WHERE id = _draft_id;
END $$;

CREATE OR REPLACE FUNCTION public.kr_draft_submit(_draft_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public.submit_draft_for_review(_draft_id);
END $$;

-- ---- MODULE REGISTRY ----
CREATE OR REPLACE FUNCTION public.module_draft_create(
  _title text,
  _module_type module_type_v1 DEFAULT 'other',
  _source_type text DEFAULT 'external_submission'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_draft_id uuid; v_src source_type_v1;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _title IS NULL OR length(trim(_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;
  v_src := _source_type::source_type_v1;

  INSERT INTO public.review_drafts (submitter_id, subject_kind, title, payload)
  VALUES (v_uid, 'module', _title,
          jsonb_build_object('source_type', v_src,
                             'module_type', _module_type,
                             'title', _title))
  RETURNING id INTO v_draft_id;

  PERFORM public.emit_platform_event(
    'draft_created'::platform_event_type_v1,
    v_uid, v_draft_id, 'module', v_draft_id::text, 'module_registry',
    v_src, v_draft_id, NULL, NULL,
    jsonb_build_object('title', _title, 'module_type', _module_type));
  RETURN v_draft_id;
END $$;

CREATE OR REPLACE FUNCTION public.module_draft_update(_draft_id uuid, _patch jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.review_drafts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _patch ? 'approved_zero_tariff' THEN
    RAISE EXCEPTION 'approved_zero_tariff not accepted in Phase 1.3';
  END IF;
  SELECT * INTO v_row FROM public.review_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF v_row.submitter_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.subject_kind <> 'module' THEN RAISE EXCEPTION 'wrong_subject_kind'; END IF;
  IF v_row.status <> 'draft' THEN RAISE EXCEPTION 'draft_not_editable'; END IF;

  UPDATE public.review_drafts
     SET payload = COALESCE(payload,'{}'::jsonb) || COALESCE(_patch,'{}'::jsonb),
         title = COALESCE(_patch->>'title', title)
   WHERE id = _draft_id;
END $$;

CREATE OR REPLACE FUNCTION public.module_draft_submit(_draft_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public.submit_draft_for_review(_draft_id);
END $$;

-- ---------------------------------------------------------------------------
-- 5. Governance-approved publication RPCs (subject → canonical, idempotent)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.expert_publish_from_decision(
  _subject_id uuid,
  _decision_id uuid,
  _visibility registry_visibility_v1 DEFAULT 'public',
  _verification verification_status_v1 DEFAULT 'governance_verified'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub public.review_subjects%ROWTYPE;
  v_dec public.review_decisions%ROWTYPE;
  v_snap jsonb;
  v_payload jsonb;
  v_src source_type_v1;
  v_existing uuid;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public._require_admin_or_mgmt();

  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id;
  IF v_sub.id IS NULL THEN RAISE EXCEPTION 'subject_not_found'; END IF;
  IF v_sub.kind <> 'expert' THEN RAISE EXCEPTION 'wrong_subject_kind'; END IF;

  SELECT * INTO v_dec FROM public.review_decisions
    WHERE id = _decision_id AND subject_id = _subject_id;
  IF v_dec.id IS NULL THEN RAISE EXCEPTION 'decision_not_found'; END IF;
  IF v_dec.decision <> 'approved' THEN RAISE EXCEPTION 'decision_not_approved'; END IF;

  -- Idempotency
  SELECT id INTO v_existing FROM public.experts WHERE source_submission_id = _subject_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  SELECT snapshot INTO v_snap FROM public.review_subject_revisions
    WHERE subject_id = _subject_id ORDER BY revision DESC LIMIT 1;
  IF v_snap IS NULL THEN RAISE EXCEPTION 'no_revision_snapshot'; END IF;
  v_payload := COALESCE(v_snap->'payload','{}'::jsonb);
  v_src := COALESCE(v_payload->>'source_type','external_submission')::source_type_v1;

  INSERT INTO public.experts (
    source_type, source_submission_id, created_by,
    original_contributor_id, approved_by, published_by,
    approval_date, publication_date,
    verification_status, visibility, current_status,
    audit_ref, display_name, headline, bio, country, city,
    languages, expertise_areas, orcid, personal_url, avatar_url
  ) VALUES (
    v_src, _subject_id, v_sub.submitted_by,
    v_sub.submitted_by, v_dec.decided_by, v_uid,
    v_dec.decided_at, now(),
    _verification, _visibility, 'published',
    _decision_id,
    COALESCE(v_payload->>'display_name', v_snap->>'title'),
    v_payload->>'headline', v_payload->>'bio',
    v_payload->>'country', v_payload->>'city',
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(v_payload->'languages') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(v_payload->'expertise_areas') x), ARRAY[]::text[]),
    v_payload->>'orcid', v_payload->>'personal_url', v_payload->>'avatar_url'
  ) RETURNING id INTO v_id;

  PERFORM public.emit_platform_event(
    'record_approved'::platform_event_type_v1,
    v_uid, v_id, 'expert', v_id::text, 'experts',
    v_src, _subject_id, v_id, NULL,
    jsonb_build_object('decision_id', _decision_id));
  PERFORM public.emit_platform_event(
    'record_published'::platform_event_type_v1,
    v_uid, v_id, 'expert', v_id::text, 'experts',
    v_src, _subject_id, v_id, NULL,
    jsonb_build_object('visibility', _visibility, 'verification_status', _verification));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.kr_publish_from_decision(
  _subject_id uuid,
  _decision_id uuid,
  _visibility registry_visibility_v1 DEFAULT 'public',
  _verification verification_status_v1 DEFAULT 'governance_verified'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub public.review_subjects%ROWTYPE;
  v_dec public.review_decisions%ROWTYPE;
  v_snap jsonb; v_payload jsonb; v_src source_type_v1;
  v_existing uuid; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public._require_admin_or_mgmt();

  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id;
  IF v_sub.id IS NULL THEN RAISE EXCEPTION 'subject_not_found'; END IF;
  IF v_sub.kind <> 'knowledge_resource' THEN RAISE EXCEPTION 'wrong_subject_kind'; END IF;

  SELECT * INTO v_dec FROM public.review_decisions
    WHERE id = _decision_id AND subject_id = _subject_id;
  IF v_dec.id IS NULL THEN RAISE EXCEPTION 'decision_not_found'; END IF;
  IF v_dec.decision <> 'approved' THEN RAISE EXCEPTION 'decision_not_approved'; END IF;

  SELECT id INTO v_existing FROM public.knowledge_resources WHERE source_submission_id = _subject_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  SELECT snapshot INTO v_snap FROM public.review_subject_revisions
    WHERE subject_id = _subject_id ORDER BY revision DESC LIMIT 1;
  IF v_snap IS NULL THEN RAISE EXCEPTION 'no_revision_snapshot'; END IF;
  v_payload := COALESCE(v_snap->'payload','{}'::jsonb);
  v_src := COALESCE(v_payload->>'source_type','external_submission')::source_type_v1;

  INSERT INTO public.knowledge_resources (
    source_type, source_submission_id, created_by,
    original_contributor_id, approved_by, published_by,
    approval_date, publication_date,
    verification_status, visibility, current_status,
    audit_ref, resource_type, title, subtitle, summary, abstract,
    language, publication_year, publisher, venue,
    doi, isbn, external_url, thumbnail_url,
    topics, keywords, geographic_focus, related_expert_ids, related_module_refs,
    metadata, citation_text, citation_key
  ) VALUES (
    v_src, _subject_id, v_sub.submitted_by,
    v_sub.submitted_by, v_dec.decided_by, v_uid,
    v_dec.decided_at, now(),
    _verification, _visibility, 'published',
    _decision_id,
    COALESCE(v_payload->>'resource_type','other')::resource_type_v1,
    COALESCE(v_payload->>'title', v_snap->>'title'),
    v_payload->>'subtitle', v_payload->>'summary', v_payload->>'abstract',
    v_payload->>'language',
    NULLIF(v_payload->>'publication_year','')::int,
    v_payload->>'publisher', v_payload->>'venue',
    v_payload->>'doi', v_payload->>'isbn',
    v_payload->>'external_url', v_payload->>'thumbnail_url',
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(v_payload->'topics') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(v_payload->'keywords') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(v_payload->'geographic_focus') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(v_payload->'related_expert_ids') x), ARRAY[]::uuid[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(v_payload->'related_module_refs') x), ARRAY[]::text[]),
    COALESCE(v_payload->'metadata','{}'::jsonb),
    v_payload->>'citation_text', v_payload->>'citation_key'
  ) RETURNING id INTO v_id;

  PERFORM public.emit_platform_event(
    'record_approved'::platform_event_type_v1,
    v_uid, v_id, 'knowledge_resource', v_id::text, 'knowledge_resources',
    v_src, _subject_id, v_id, NULL,
    jsonb_build_object('decision_id', _decision_id));
  PERFORM public.emit_platform_event(
    'record_published'::platform_event_type_v1,
    v_uid, v_id, 'knowledge_resource', v_id::text, 'knowledge_resources',
    v_src, _subject_id, v_id, NULL,
    jsonb_build_object('visibility', _visibility, 'verification_status', _verification));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.module_publish_from_decision(
  _subject_id uuid,
  _decision_id uuid,
  _visibility registry_visibility_v1 DEFAULT 'public',
  _verification verification_status_v1 DEFAULT 'governance_verified'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub public.review_subjects%ROWTYPE;
  v_dec public.review_decisions%ROWTYPE;
  v_snap jsonb; v_payload jsonb; v_src source_type_v1;
  v_existing uuid; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public._require_admin_or_mgmt();

  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id;
  IF v_sub.id IS NULL THEN RAISE EXCEPTION 'subject_not_found'; END IF;
  IF v_sub.kind <> 'module' THEN RAISE EXCEPTION 'wrong_subject_kind'; END IF;

  SELECT * INTO v_dec FROM public.review_decisions
    WHERE id = _decision_id AND subject_id = _subject_id;
  IF v_dec.id IS NULL THEN RAISE EXCEPTION 'decision_not_found'; END IF;
  IF v_dec.decision <> 'approved' THEN RAISE EXCEPTION 'decision_not_approved'; END IF;

  SELECT id INTO v_existing FROM public.module_registry WHERE source_submission_id = _subject_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  SELECT snapshot INTO v_snap FROM public.review_subject_revisions
    WHERE subject_id = _subject_id ORDER BY revision DESC LIMIT 1;
  IF v_snap IS NULL THEN RAISE EXCEPTION 'no_revision_snapshot'; END IF;
  v_payload := COALESCE(v_snap->'payload','{}'::jsonb);
  v_src := COALESCE(v_payload->>'source_type','external_submission')::source_type_v1;

  INSERT INTO public.module_registry (
    source_type, source_submission_id, created_by,
    original_contributor_id, approved_by, published_by,
    approval_date, publication_date,
    verification_status, visibility, current_status,
    audit_ref, title, summary, language, module_type,
    target_participants, estimated_learning_hours,
    learning_objectives, competency_refs, prerequisites, delivery_suitability,
    content_outline, learning_activities, assessment_approach,
    author_expert_id, institution_id, related_resource_ids,
    legacy_master_module_ref, metadata
  ) VALUES (
    v_src, _subject_id, v_sub.submitted_by,
    v_sub.submitted_by, v_dec.decided_by, v_uid,
    v_dec.decided_at, now(),
    _verification, _visibility, 'published',
    _decision_id,
    COALESCE(v_payload->>'title', v_snap->>'title'),
    v_payload->>'summary', v_payload->>'language',
    COALESCE(v_payload->>'module_type','other')::module_type_v1,
    v_payload->>'target_participants',
    NULLIF(v_payload->>'estimated_learning_hours','')::numeric,
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(v_payload->'learning_objectives') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(v_payload->'competency_refs') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(v_payload->'prerequisites') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(v_payload->'delivery_suitability') x), ARRAY[]::text[]),
    COALESCE(v_payload->'content_outline','{}'::jsonb),
    COALESCE(v_payload->'learning_activities','{}'::jsonb),
    COALESCE(v_payload->'assessment_approach','{}'::jsonb),
    NULLIF(v_payload->>'author_expert_id','')::uuid,
    NULLIF(v_payload->>'institution_id','')::uuid,
    COALESCE((SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(v_payload->'related_resource_ids') x), ARRAY[]::uuid[]),
    v_payload->>'legacy_master_module_ref',
    COALESCE(v_payload->'metadata','{}'::jsonb)
  ) RETURNING id INTO v_id;

  PERFORM public.emit_platform_event(
    'record_approved'::platform_event_type_v1,
    v_uid, v_id, 'module', v_id::text, 'module_registry',
    v_src, _subject_id, v_id, NULL,
    jsonb_build_object('decision_id', _decision_id));
  PERFORM public.emit_platform_event(
    'record_published'::platform_event_type_v1,
    v_uid, v_id, 'module', v_id::text, 'module_registry',
    v_src, _subject_id, v_id, NULL,
    jsonb_build_object('visibility', _visibility, 'verification_status', _verification));
  RETURN v_id;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Direct-publication RPCs (Admin/Management only, from payload)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.expert_publish_direct(
  _payload jsonb,
  _visibility registry_visibility_v1 DEFAULT 'public',
  _verification verification_status_v1 DEFAULT 'institutionally_verified',
  _rationale text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public._require_admin_or_mgmt();
  IF _rationale IS NULL OR length(trim(_rationale)) = 0 THEN
    RAISE EXCEPTION 'rationale_required';
  END IF;
  v_name := COALESCE(_payload->>'display_name','');
  IF length(trim(v_name)) = 0 THEN RAISE EXCEPTION 'display_name_required'; END IF;

  INSERT INTO public.experts (
    source_type, created_by, original_contributor_id,
    approved_by, published_by, approval_date, publication_date,
    verification_status, visibility, current_status,
    display_name, headline, bio, country, city,
    languages, expertise_areas, orcid, personal_url, avatar_url
  ) VALUES (
    'admin_direct', v_uid, v_uid,
    v_uid, v_uid, now(), now(),
    _verification, _visibility, 'published',
    v_name, _payload->>'headline', _payload->>'bio',
    _payload->>'country', _payload->>'city',
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(_payload->'languages') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(_payload->'expertise_areas') x), ARRAY[]::text[]),
    _payload->>'orcid', _payload->>'personal_url', _payload->>'avatar_url'
  ) RETURNING id INTO v_id;

  PERFORM public.log_governance_event(
    'expert_direct_published', v_uid, v_id, 'expert', v_id::text,
    NULL, jsonb_build_object('rationale', _rationale));
  PERFORM public.emit_platform_event(
    'record_published'::platform_event_type_v1,
    v_uid, v_id, 'expert', v_id::text, 'experts',
    'admin_direct', NULL, v_id, NULL,
    jsonb_build_object('rationale', _rationale, 'visibility', _visibility));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.kr_publish_direct(
  _payload jsonb,
  _visibility registry_visibility_v1 DEFAULT 'public',
  _verification verification_status_v1 DEFAULT 'institutionally_verified',
  _rationale text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_title text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public._require_admin_or_mgmt();
  IF _rationale IS NULL OR length(trim(_rationale)) = 0 THEN RAISE EXCEPTION 'rationale_required'; END IF;
  v_title := COALESCE(_payload->>'title','');
  IF length(trim(v_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;

  INSERT INTO public.knowledge_resources (
    source_type, created_by, original_contributor_id,
    approved_by, published_by, approval_date, publication_date,
    verification_status, visibility, current_status,
    resource_type, title, subtitle, summary, abstract,
    language, publication_year, publisher, venue,
    doi, isbn, external_url, thumbnail_url,
    topics, keywords, geographic_focus,
    metadata, citation_text, citation_key
  ) VALUES (
    'admin_direct', v_uid, v_uid,
    v_uid, v_uid, now(), now(),
    _verification, _visibility, 'published',
    COALESCE(_payload->>'resource_type','other')::resource_type_v1,
    v_title, _payload->>'subtitle', _payload->>'summary', _payload->>'abstract',
    _payload->>'language', NULLIF(_payload->>'publication_year','')::int,
    _payload->>'publisher', _payload->>'venue',
    _payload->>'doi', _payload->>'isbn',
    _payload->>'external_url', _payload->>'thumbnail_url',
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(_payload->'topics') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(_payload->'keywords') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(_payload->'geographic_focus') x), ARRAY[]::text[]),
    COALESCE(_payload->'metadata','{}'::jsonb),
    _payload->>'citation_text', _payload->>'citation_key'
  ) RETURNING id INTO v_id;

  PERFORM public.log_governance_event(
    'kr_direct_published', v_uid, v_id, 'knowledge_resource', v_id::text,
    NULL, jsonb_build_object('rationale', _rationale));
  PERFORM public.emit_platform_event(
    'record_published'::platform_event_type_v1,
    v_uid, v_id, 'knowledge_resource', v_id::text, 'knowledge_resources',
    'admin_direct', NULL, v_id, NULL,
    jsonb_build_object('rationale', _rationale, 'visibility', _visibility));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.module_publish_direct(
  _payload jsonb,
  _visibility registry_visibility_v1 DEFAULT 'public',
  _verification verification_status_v1 DEFAULT 'institutionally_verified',
  _rationale text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_title text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public._require_admin_or_mgmt();
  IF _rationale IS NULL OR length(trim(_rationale)) = 0 THEN RAISE EXCEPTION 'rationale_required'; END IF;
  v_title := COALESCE(_payload->>'title','');
  IF length(trim(v_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;

  INSERT INTO public.module_registry (
    source_type, created_by, original_contributor_id,
    approved_by, published_by, approval_date, publication_date,
    verification_status, visibility, current_status,
    title, summary, language, module_type,
    target_participants, estimated_learning_hours,
    learning_objectives, competency_refs, prerequisites, delivery_suitability,
    content_outline, learning_activities, assessment_approach,
    author_expert_id, institution_id, related_resource_ids,
    legacy_master_module_ref, metadata
  ) VALUES (
    'admin_direct', v_uid, v_uid,
    v_uid, v_uid, now(), now(),
    _verification, _visibility, 'published',
    v_title, _payload->>'summary', _payload->>'language',
    COALESCE(_payload->>'module_type','other')::module_type_v1,
    _payload->>'target_participants',
    NULLIF(_payload->>'estimated_learning_hours','')::numeric,
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(_payload->'learning_objectives') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(_payload->'competency_refs') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(_payload->'prerequisites') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(_payload->'delivery_suitability') x), ARRAY[]::text[]),
    COALESCE(_payload->'content_outline','{}'::jsonb),
    COALESCE(_payload->'learning_activities','{}'::jsonb),
    COALESCE(_payload->'assessment_approach','{}'::jsonb),
    NULLIF(_payload->>'author_expert_id','')::uuid,
    NULLIF(_payload->>'institution_id','')::uuid,
    COALESCE((SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(_payload->'related_resource_ids') x), ARRAY[]::uuid[]),
    _payload->>'legacy_master_module_ref',
    COALESCE(_payload->'metadata','{}'::jsonb)
  ) RETURNING id INTO v_id;

  PERFORM public.log_governance_event(
    'module_direct_published', v_uid, v_id, 'module', v_id::text,
    NULL, jsonb_build_object('rationale', _rationale));
  PERFORM public.emit_platform_event(
    'record_published'::platform_event_type_v1,
    v_uid, v_id, 'module', v_id::text, 'module_registry',
    'admin_direct', NULL, v_id, NULL,
    jsonb_build_object('rationale', _rationale, 'visibility', _visibility));
  RETURN v_id;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Lock down EXECUTE grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.expert_draft_create(text, source_type_v1) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expert_draft_update(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expert_draft_submit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expert_publish_from_decision(uuid, uuid, registry_visibility_v1, verification_status_v1) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expert_publish_direct(jsonb, registry_visibility_v1, verification_status_v1, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expert_draft_create(text, source_type_v1) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expert_draft_update(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expert_draft_submit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expert_publish_from_decision(uuid, uuid, registry_visibility_v1, verification_status_v1) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expert_publish_direct(jsonb, registry_visibility_v1, verification_status_v1, text) TO authenticated;

REVOKE ALL ON FUNCTION public.kr_draft_create(text, resource_type_v1, source_type_v1) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kr_draft_update(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kr_draft_submit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kr_publish_from_decision(uuid, uuid, registry_visibility_v1, verification_status_v1) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kr_publish_direct(jsonb, registry_visibility_v1, verification_status_v1, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kr_draft_create(text, resource_type_v1, source_type_v1) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kr_draft_update(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kr_draft_submit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kr_publish_from_decision(uuid, uuid, registry_visibility_v1, verification_status_v1) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kr_publish_direct(jsonb, registry_visibility_v1, verification_status_v1, text) TO authenticated;

REVOKE ALL ON FUNCTION public.module_draft_create(text, module_type_v1, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.module_draft_update(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.module_draft_submit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.module_publish_from_decision(uuid, uuid, registry_visibility_v1, verification_status_v1) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.module_publish_direct(jsonb, registry_visibility_v1, verification_status_v1, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.module_draft_create(text, module_type_v1, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.module_draft_update(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.module_draft_submit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.module_publish_from_decision(uuid, uuid, registry_visibility_v1, verification_status_v1) TO authenticated;
GRANT EXECUTE ON FUNCTION public.module_publish_direct(jsonb, registry_visibility_v1, verification_status_v1, text) TO authenticated;
