
-- =====================================================================
-- Phase 1.3 Increment 5 — Training Needs canonical registry + intake
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Canonical table
-- ---------------------------------------------------------------------
CREATE TABLE public.training_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Shared provenance header
  source_type source_type_v1 NOT NULL,
  source_submission_id uuid,
  source_institution_id uuid,
  original_contributor_id uuid,
  created_by uuid NOT NULL,
  approved_by uuid,
  published_by uuid,
  approval_date timestamptz,
  publication_date timestamptz,
  verification_status verification_status_v1 NOT NULL DEFAULT 'unverified',
  visibility registry_visibility_v1 NOT NULL DEFAULT 'private',
  version integer NOT NULL DEFAULT 1,
  previous_version_id uuid,
  current_status registry_status_v1 NOT NULL,
  audit_ref uuid,

  -- Domain content
  title text NOT NULL,
  summary text,
  target_participants text,
  target_participant_count integer,
  competency_gap text,
  proposed_topics text[] NOT NULL DEFAULT ARRAY[]::text[],
  geographic_focus text[] NOT NULL DEFAULT ARRAY[]::text[],
  preferred_start_date date,
  preferred_duration_days integer,
  delivery_preference text
    CHECK (delivery_preference IS NULL OR delivery_preference IN
      ('in_person','online','hybrid','self_paced','no_preference')),

  -- Self-paced alternative capture (corrected pointer)
  self_paced_alternative_found boolean NOT NULL DEFAULT false,
  recommended_self_paced_course_id uuid,
  recommended_self_paced_offering_id uuid REFERENCES public.course_offerings(id),
  requester_selected_learning_path text NOT NULL DEFAULT 'undecided'
    CHECK (requester_selected_learning_path IN ('self_paced','facilitated','undecided')),

  -- Funding preference (non-authoritative)
  funding_preference text
    CHECK (funding_preference IS NULL OR funding_preference IN (
      'government_funded','requesting_institution_funded','sponsor_or_partner_funded',
      'cost_sharing','participant_paid_potential_pnbp','institution_paid_potential_pnbp',
      'scholarship_or_approved_support','not_yet_determined')),
  proposed_payer text,
  indicative_budget numeric,
  indicative_budget_currency text NOT NULL DEFAULT 'IDR',
  participant_charge_preference text
    CHECK (participant_charge_preference IS NULL OR participant_charge_preference IN
      ('no_participant_charge','participant_paid','mixed','to_be_determined','not_applicable')),

  -- Logistics
  logistics_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  accommodation_required boolean NOT NULL DEFAULT false,
  meals_required boolean NOT NULL DEFAULT false,
  travel_support_required boolean NOT NULL DEFAULT false,
  equipment_required boolean NOT NULL DEFAULT false,

  -- Conversion routing (populated by convert_training_need)
  conversion_destination text
    CHECK (conversion_destination IS NULL OR conversion_destination IN
      ('self_paced_course','facilitated_training','custom_course_offering',
       'no_action','further_analysis')),
  conversion_target_ref text,
  converted_at timestamptz,
  converted_by uuid,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Canonical lifecycle guard (matches other registries)
  CONSTRAINT tn_status_canonical_ck CHECK (
    current_status IN ('approved','published','archived','deprecated','revoked')
  ),

  -- Self-paced conversion must carry both course + offering references
  CONSTRAINT tn_self_paced_pointer_ck CHECK (
    conversion_destination IS DISTINCT FROM 'self_paced_course'
    OR (recommended_self_paced_course_id IS NOT NULL
        AND recommended_self_paced_offering_id IS NOT NULL)
  )
);

CREATE INDEX training_needs_status_idx     ON public.training_needs (current_status);
CREATE INDEX training_needs_visibility_idx ON public.training_needs (visibility);
CREATE INDEX training_needs_submission_idx ON public.training_needs (source_submission_id);
CREATE INDEX training_needs_offering_idx   ON public.training_needs (recommended_self_paced_offering_id);

GRANT SELECT ON public.training_needs TO anon, authenticated;
GRANT ALL    ON public.training_needs TO service_role;

ALTER TABLE public.training_needs ENABLE ROW LEVEL SECURITY;

-- No client INSERT/UPDATE/DELETE — RPC-only writes.
CREATE POLICY training_needs_public_select ON public.training_needs
  FOR SELECT TO anon, authenticated
  USING (current_status = 'published' AND visibility = 'public');

CREATE POLICY training_needs_admin_mgmt_select ON public.training_needs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin')
         OR public.has_role(auth.uid(),'management'));

CREATE POLICY training_needs_reviewer_select ON public.training_needs
  FOR SELECT TO authenticated
  USING (source_submission_id IS NOT NULL
         AND public.can_review_registry_subject(source_submission_id));

CREATE TRIGGER touch_training_needs
  BEFORE UPDATE ON public.training_needs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

-- ---------------------------------------------------------------------
-- 2) Append-only version snapshots
-- ---------------------------------------------------------------------
CREATE TABLE public.training_needs_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_need_id uuid NOT NULL REFERENCES public.training_needs(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  previous_version_id uuid,
  created_by uuid,
  publication_or_approval_ref uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (training_need_id, version)
);

GRANT SELECT ON public.training_needs_versions TO authenticated;
GRANT ALL    ON public.training_needs_versions TO service_role;

ALTER TABLE public.training_needs_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tnv_admin_mgmt_select ON public.training_needs_versions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin')
         OR public.has_role(auth.uid(),'management'));

CREATE POLICY tnv_reviewer_select ON public.training_needs_versions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.training_needs t
    WHERE t.id = training_needs_versions.training_need_id
      AND t.source_submission_id IS NOT NULL
      AND public.can_review_registry_subject(t.source_submission_id)
  ));

-- Immutable append-only trigger (mirrors other registries)
CREATE OR REPLACE FUNCTION public.emit_training_need_version_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.training_needs_versions
    (training_need_id, version, snapshot, previous_version_id, created_by, publication_or_approval_ref)
  VALUES
    (NEW.id, NEW.version, to_jsonb(NEW), NEW.previous_version_id, NEW.created_by, NEW.audit_ref);
  RETURN NEW;
END $$;

CREATE TRIGGER training_needs_version_snapshot
  AFTER INSERT ON public.training_needs
  FOR EACH ROW EXECUTE FUNCTION public.emit_training_need_version_snapshot();

-- ---------------------------------------------------------------------
-- 3) Public view (published + verified + public only)
-- ---------------------------------------------------------------------
CREATE VIEW public.training_needs_public_v
WITH (security_invoker = true) AS
SELECT
  id, title, summary, target_participants, target_participant_count,
  competency_gap, proposed_topics, geographic_focus,
  preferred_start_date, preferred_duration_days, delivery_preference,
  self_paced_alternative_found, recommended_self_paced_offering_id,
  requester_selected_learning_path,
  funding_preference, participant_charge_preference,
  conversion_destination, converted_at,
  version, publication_date, verification_status, visibility, current_status,
  created_at, updated_at
FROM public.training_needs
WHERE current_status = 'published'
  AND visibility = 'public'
  AND verification_status IN
      ('institutionally_verified','governance_verified','self_declared');

GRANT SELECT ON public.training_needs_public_v TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) Draft lifecycle RPCs (facilitated path)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.training_need_draft_create(
  _title text,
  _source_type source_type_v1 DEFAULT 'external_submission'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_draft_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _title IS NULL OR length(trim(_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;

  INSERT INTO public.review_drafts (submitter_id, subject_kind, title, payload)
  VALUES (v_uid, 'training_need', _title,
          jsonb_build_object('source_type', _source_type, 'title', _title))
  RETURNING id INTO v_draft_id;

  PERFORM public.emit_platform_event(
    'draft_created'::platform_event_type_v1,
    v_uid, v_draft_id, 'training_need', v_draft_id::text, 'training_needs',
    _source_type, v_draft_id, NULL, NULL,
    jsonb_build_object('title', _title));
  RETURN v_draft_id;
END $$;

CREATE OR REPLACE FUNCTION public.training_need_draft_update(
  _draft_id uuid, _patch jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.review_drafts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _patch ? 'approved_zero_tariff' THEN
    RAISE EXCEPTION 'approved_zero_tariff not accepted in Phase 1.3';
  END IF;
  SELECT * INTO v_row FROM public.review_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF v_row.submitter_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.subject_kind <> 'training_need' THEN RAISE EXCEPTION 'wrong_subject_kind'; END IF;
  IF v_row.status <> 'draft' THEN RAISE EXCEPTION 'draft_not_editable'; END IF;

  UPDATE public.review_drafts
     SET payload = COALESCE(payload,'{}'::jsonb) || COALESCE(_patch,'{}'::jsonb),
         title = COALESCE(_patch->>'title', title)
   WHERE id = _draft_id;

  IF _patch ? 'funding_preference' THEN
    PERFORM public.emit_platform_event(
      'funding_preference_selected'::platform_event_type_v1,
      v_uid, _draft_id, 'training_need', _draft_id::text, 'training_needs',
      NULL, _draft_id, NULL, NULL,
      jsonb_build_object('funding_preference', _patch->>'funding_preference'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.training_need_draft_submit(_draft_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.review_drafts%ROWTYPE; v_subject_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.review_drafts WHERE id = _draft_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF v_row.submitter_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.subject_kind <> 'training_need' THEN RAISE EXCEPTION 'wrong_subject_kind'; END IF;

  v_subject_id := public.submit_draft_for_review(_draft_id);

  PERFORM public.emit_platform_event(
    'facilitated_training_requested'::platform_event_type_v1,
    v_uid, v_subject_id, 'training_need', v_subject_id::text, 'training_needs',
    NULLIF(v_row.payload->>'source_type','')::source_type_v1,
    v_subject_id, NULL, NULL,
    jsonb_build_object('draft_id', _draft_id));
  RETURN v_subject_id;
END $$;

-- ---------------------------------------------------------------------
-- 5) Self-paced-first branching RPCs (stateless, event-only)
-- ---------------------------------------------------------------------
-- Eligible self-paced delivery modes: those whose feature_flags say the
-- pathway carries no trainer, schedule, or attendance obligations.
CREATE OR REPLACE FUNCTION public._is_self_paced_delivery_mode(_mode_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT active
       AND COALESCE((feature_flags->>'trainer')::boolean, false) = false
       AND COALESCE((feature_flags->>'schedule')::boolean, false) = false
       AND COALESCE((feature_flags->>'attendance')::boolean, false) = false
     FROM public.delivery_modes WHERE id = _mode_id),
  false);
$$;

CREATE OR REPLACE FUNCTION public.training_need_present_self_paced(
  _offering_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_off public.course_offerings%ROWTYPE;
  v_available boolean := false;
  v_reason text := NULL;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_off FROM public.course_offerings WHERE id = _offering_id;
  IF v_off.id IS NULL THEN
    v_reason := 'offering_not_found';
  ELSIF v_off.status IS DISTINCT FROM 'published' THEN
    v_reason := 'offering_not_enabled';
  ELSIF v_off.delivery_mode_id IS NULL
     OR NOT public._is_self_paced_delivery_mode(v_off.delivery_mode_id) THEN
    v_reason := 'delivery_mode_not_self_paced';
  ELSE
    v_available := true;
  END IF;

  PERFORM public.emit_platform_event(
    'self_paced_alternative_presented'::platform_event_type_v1,
    v_uid, _offering_id, 'course_offering', _offering_id::text, 'training_needs',
    NULL, NULL, NULL, _offering_id,
    jsonb_build_object('available', v_available, 'reason', v_reason,
                       'master_course_id', v_off.master_course_id));
  RETURN jsonb_build_object(
    'offering_id', _offering_id,
    'available', v_available,
    'reason', v_reason,
    'master_course_id', v_off.master_course_id);
END $$;

CREATE OR REPLACE FUNCTION public.training_need_accept_self_paced(
  _offering_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_off public.course_offerings%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_off FROM public.course_offerings WHERE id = _offering_id;
  IF v_off.id IS NULL THEN RAISE EXCEPTION 'offering_not_found'; END IF;
  IF v_off.status IS DISTINCT FROM 'published' THEN RAISE EXCEPTION 'offering_not_enabled'; END IF;
  IF v_off.delivery_mode_id IS NULL
     OR NOT public._is_self_paced_delivery_mode(v_off.delivery_mode_id) THEN
    RAISE EXCEPTION 'delivery_mode_not_self_paced';
  END IF;

  PERFORM public.emit_platform_event(
    'self_paced_alternative_selected'::platform_event_type_v1,
    v_uid, _offering_id, 'course_offering', _offering_id::text, 'training_needs',
    NULL, NULL, NULL, _offering_id, '{}'::jsonb);
  PERFORM public.emit_platform_event(
    'training_need_converted_to_self_paced'::platform_event_type_v1,
    v_uid, _offering_id, 'course_offering', _offering_id::text, 'training_needs',
    NULL, NULL, NULL, _offering_id,
    jsonb_build_object('master_course_id', v_off.master_course_id));
  RETURN _offering_id;
END $$;

-- ---------------------------------------------------------------------
-- 6) Publication + archival
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.training_need_publish_from_decision(
  _subject_id uuid,
  _decision_id uuid,
  _visibility registry_visibility_v1 DEFAULT 'public',
  _verification verification_status_v1 DEFAULT 'governance_verified'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  IF v_sub.kind <> 'training_need' THEN RAISE EXCEPTION 'wrong_subject_kind'; END IF;

  SELECT * INTO v_dec FROM public.review_decisions
   WHERE id = _decision_id AND subject_id = _subject_id;
  IF v_dec.id IS NULL THEN RAISE EXCEPTION 'decision_not_found'; END IF;
  IF v_dec.decision NOT IN ('approve','approved') THEN RAISE EXCEPTION 'decision_not_approved'; END IF;

  SELECT id INTO v_existing FROM public.training_needs WHERE source_submission_id = _subject_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  SELECT snapshot INTO v_snap FROM public.review_subject_revisions
   WHERE subject_id = _subject_id ORDER BY revision DESC LIMIT 1;
  IF v_snap IS NULL THEN RAISE EXCEPTION 'no_revision_snapshot'; END IF;
  v_payload := COALESCE(v_snap->'payload','{}'::jsonb);
  v_src := COALESCE(v_payload->>'source_type','external_submission')::source_type_v1;

  IF v_payload ? 'approved_zero_tariff' THEN
    RAISE EXCEPTION 'approved_zero_tariff not accepted in Phase 1.3';
  END IF;

  INSERT INTO public.training_needs (
    source_type, source_submission_id, created_by,
    original_contributor_id, approved_by, published_by,
    approval_date, publication_date,
    verification_status, visibility, current_status, audit_ref,
    title, summary, target_participants, target_participant_count,
    competency_gap, proposed_topics, geographic_focus,
    preferred_start_date, preferred_duration_days, delivery_preference,
    self_paced_alternative_found,
    recommended_self_paced_course_id, recommended_self_paced_offering_id,
    requester_selected_learning_path,
    funding_preference, proposed_payer, indicative_budget, indicative_budget_currency,
    participant_charge_preference,
    logistics_requirements, accommodation_required, meals_required,
    travel_support_required, equipment_required,
    metadata
  ) VALUES (
    v_src, _subject_id, v_sub.submitted_by,
    v_sub.submitted_by, v_dec.decided_by, v_uid,
    v_dec.decided_at, now(),
    _verification, _visibility, 'published', _decision_id,
    COALESCE(v_payload->>'title', v_snap->>'title'),
    v_payload->>'summary', v_payload->>'target_participants',
    NULLIF(v_payload->>'target_participant_count','')::int,
    v_payload->>'competency_gap',
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(v_payload->'proposed_topics') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(v_payload->'geographic_focus') x), ARRAY[]::text[]),
    NULLIF(v_payload->>'preferred_start_date','')::date,
    NULLIF(v_payload->>'preferred_duration_days','')::int,
    v_payload->>'delivery_preference',
    COALESCE((v_payload->>'self_paced_alternative_found')::boolean, false),
    NULLIF(v_payload->>'recommended_self_paced_course_id','')::uuid,
    NULLIF(v_payload->>'recommended_self_paced_offering_id','')::uuid,
    COALESCE(v_payload->>'requester_selected_learning_path','undecided'),
    v_payload->>'funding_preference', v_payload->>'proposed_payer',
    NULLIF(v_payload->>'indicative_budget','')::numeric,
    COALESCE(v_payload->>'indicative_budget_currency','IDR'),
    v_payload->>'participant_charge_preference',
    COALESCE(v_payload->'logistics_requirements','{}'::jsonb),
    COALESCE((v_payload->>'accommodation_required')::boolean, false),
    COALESCE((v_payload->>'meals_required')::boolean, false),
    COALESCE((v_payload->>'travel_support_required')::boolean, false),
    COALESCE((v_payload->>'equipment_required')::boolean, false),
    COALESCE(v_payload->'metadata','{}'::jsonb)
  ) RETURNING id INTO v_id;

  PERFORM public.emit_platform_event(
    'registry_record_created'::platform_event_type_v1,
    v_uid, v_id, 'training_need', v_id::text, 'training_needs',
    v_src, _subject_id, v_id, NULL,
    jsonb_build_object('decision_id', _decision_id));
  PERFORM public.emit_platform_event(
    'approved'::platform_event_type_v1,
    v_uid, v_id, 'training_need', v_id::text, 'training_needs',
    v_src, _subject_id, v_id, NULL,
    jsonb_build_object('decision_id', _decision_id));
  PERFORM public.emit_platform_event(
    'registry_record_published'::platform_event_type_v1,
    v_uid, v_id, 'training_need', v_id::text, 'training_needs',
    v_src, _subject_id, v_id, NULL,
    jsonb_build_object('visibility', _visibility, 'verification_status', _verification));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.training_need_publish_direct(
  _payload jsonb,
  _visibility registry_visibility_v1 DEFAULT 'public',
  _verification verification_status_v1 DEFAULT 'institutionally_verified',
  _rationale text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_title text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public._require_admin_or_mgmt();
  IF _rationale IS NULL OR length(trim(_rationale)) = 0 THEN RAISE EXCEPTION 'rationale_required'; END IF;
  IF _payload ? 'approved_zero_tariff' THEN
    RAISE EXCEPTION 'approved_zero_tariff not accepted in Phase 1.3';
  END IF;
  v_title := COALESCE(_payload->>'title','');
  IF length(trim(v_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;

  INSERT INTO public.training_needs (
    source_type, created_by, original_contributor_id,
    approved_by, published_by, approval_date, publication_date,
    verification_status, visibility, current_status,
    title, summary, target_participants, target_participant_count,
    competency_gap, proposed_topics, geographic_focus,
    preferred_start_date, preferred_duration_days, delivery_preference,
    self_paced_alternative_found,
    recommended_self_paced_course_id, recommended_self_paced_offering_id,
    requester_selected_learning_path,
    funding_preference, proposed_payer, indicative_budget, indicative_budget_currency,
    participant_charge_preference,
    logistics_requirements, accommodation_required, meals_required,
    travel_support_required, equipment_required,
    metadata
  ) VALUES (
    'admin_direct', v_uid, v_uid,
    v_uid, v_uid, now(), now(),
    _verification, _visibility, 'published',
    v_title, _payload->>'summary', _payload->>'target_participants',
    NULLIF(_payload->>'target_participant_count','')::int,
    _payload->>'competency_gap',
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(_payload->'proposed_topics') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(_payload->'geographic_focus') x), ARRAY[]::text[]),
    NULLIF(_payload->>'preferred_start_date','')::date,
    NULLIF(_payload->>'preferred_duration_days','')::int,
    _payload->>'delivery_preference',
    COALESCE((_payload->>'self_paced_alternative_found')::boolean, false),
    NULLIF(_payload->>'recommended_self_paced_course_id','')::uuid,
    NULLIF(_payload->>'recommended_self_paced_offering_id','')::uuid,
    COALESCE(_payload->>'requester_selected_learning_path','undecided'),
    _payload->>'funding_preference', _payload->>'proposed_payer',
    NULLIF(_payload->>'indicative_budget','')::numeric,
    COALESCE(_payload->>'indicative_budget_currency','IDR'),
    _payload->>'participant_charge_preference',
    COALESCE(_payload->'logistics_requirements','{}'::jsonb),
    COALESCE((_payload->>'accommodation_required')::boolean, false),
    COALESCE((_payload->>'meals_required')::boolean, false),
    COALESCE((_payload->>'travel_support_required')::boolean, false),
    COALESCE((_payload->>'equipment_required')::boolean, false),
    COALESCE(_payload->'metadata','{}'::jsonb)
  ) RETURNING id INTO v_id;

  PERFORM public.emit_platform_event(
    'directly_published'::platform_event_type_v1,
    v_uid, v_id, 'training_need', v_id::text, 'training_needs',
    'admin_direct'::source_type_v1, NULL, v_id, NULL,
    jsonb_build_object('rationale', _rationale,
                       'visibility', _visibility,
                       'verification_status', _verification));
  PERFORM public.emit_platform_event(
    'registry_record_published'::platform_event_type_v1,
    v_uid, v_id, 'training_need', v_id::text, 'training_needs',
    'admin_direct'::source_type_v1, NULL, v_id, NULL,
    jsonb_build_object('visibility', _visibility, 'verification_status', _verification));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.training_need_archive(
  _need_id uuid, _rationale text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public._require_admin_or_mgmt();
  IF _rationale IS NULL OR length(trim(_rationale)) = 0 THEN RAISE EXCEPTION 'rationale_required'; END IF;

  UPDATE public.training_needs
     SET current_status = 'archived', updated_at = now()
   WHERE id = _need_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'need_not_found'; END IF;

  PERFORM public.emit_platform_event(
    'registry_record_archived'::platform_event_type_v1,
    v_uid, _need_id, 'training_need', _need_id::text, 'training_needs',
    NULL, NULL, _need_id, NULL,
    jsonb_build_object('rationale', _rationale));
END $$;

-- ---------------------------------------------------------------------
-- 7) Post-publication conversion routing
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_training_need(
  _need_id uuid,
  _destination text,
  _target_ref text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.training_needs%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public._require_admin_or_mgmt();

  IF _destination NOT IN ('self_paced_course','facilitated_training','custom_course_offering','no_action','further_analysis') THEN
    RAISE EXCEPTION 'invalid_destination';
  END IF;

  SELECT * INTO v_row FROM public.training_needs WHERE id = _need_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'need_not_found'; END IF;

  IF _destination = 'self_paced_course' THEN
    IF v_row.recommended_self_paced_course_id IS NULL
       OR v_row.recommended_self_paced_offering_id IS NULL THEN
      RAISE EXCEPTION 'self_paced_pointer_incomplete';
    END IF;
  END IF;

  IF _destination IN ('custom_course_offering','facilitated_training')
     AND (_target_ref IS NULL OR length(trim(_target_ref)) = 0) THEN
    RAISE EXCEPTION 'target_ref_required';
  END IF;

  UPDATE public.training_needs
     SET conversion_destination = _destination,
         conversion_target_ref  = _target_ref,
         converted_at           = now(),
         converted_by           = v_uid,
         updated_at             = now()
   WHERE id = _need_id;

  IF _destination = 'self_paced_course' THEN
    PERFORM public.emit_platform_event(
      'training_need_converted_to_self_paced'::platform_event_type_v1,
      v_uid, _need_id, 'training_need', _need_id::text, 'training_needs',
      NULL, v_row.source_submission_id, _need_id, v_row.recommended_self_paced_offering_id,
      jsonb_build_object('offering_id', v_row.recommended_self_paced_offering_id,
                         'course_id',   v_row.recommended_self_paced_course_id));
  ELSIF _destination IN ('custom_course_offering','facilitated_training') THEN
    PERFORM public.emit_platform_event(
      'training_need_converted_to_course_offering'::platform_event_type_v1,
      v_uid, _need_id, 'training_need', _need_id::text, 'training_needs',
      NULL, v_row.source_submission_id, _need_id, NULL,
      jsonb_build_object('destination', _destination, 'target_ref', _target_ref));
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 8) Lock down execution — canonical writes are RPC-only, no anon paths
-- ---------------------------------------------------------------------
DO $$
DECLARE fn text;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'training_need_draft_create(text, source_type_v1)',
    'training_need_draft_update(uuid, jsonb)',
    'training_need_draft_submit(uuid)',
    'training_need_present_self_paced(uuid)',
    'training_need_accept_self_paced(uuid)',
    'training_need_publish_from_decision(uuid, uuid, registry_visibility_v1, verification_status_v1)',
    'training_need_publish_direct(jsonb, registry_visibility_v1, verification_status_v1, text)',
    'training_need_archive(uuid, text)',
    'convert_training_need(uuid, text, text)'
  ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END $$;
