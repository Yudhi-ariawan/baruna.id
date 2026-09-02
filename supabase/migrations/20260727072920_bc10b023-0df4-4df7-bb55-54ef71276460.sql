
-- ============================================================================
-- Phase 1.2 — Governance Operations Workspace
-- Additive migration: 4 new tables + 1 nullable column on review_assignments
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. review_drafts
-- ----------------------------------------------------------------------------
CREATE TABLE public.review_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_kind text NOT NULL CHECK (subject_kind IN ('expert','module','knowledge_resource','training_need')),
  submitter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  external_ref text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','withdrawn')),
  linked_subject_id uuid NULL REFERENCES public.review_subjects(id) ON DELETE SET NULL,
  content_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_drafts TO authenticated;
GRANT ALL ON public.review_drafts TO service_role;

ALTER TABLE public.review_drafts ENABLE ROW LEVEL SECURITY;

-- Submitter full CRUD on own rows
CREATE POLICY "drafts_owner_select" ON public.review_drafts FOR SELECT TO authenticated
  USING (submitter_id = auth.uid());
CREATE POLICY "drafts_owner_insert" ON public.review_drafts FOR INSERT TO authenticated
  WITH CHECK (submitter_id = auth.uid());
CREATE POLICY "drafts_owner_update" ON public.review_drafts FOR UPDATE TO authenticated
  USING (submitter_id = auth.uid() AND status = 'draft')
  WITH CHECK (submitter_id = auth.uid());
CREATE POLICY "drafts_owner_delete" ON public.review_drafts FOR DELETE TO authenticated
  USING (submitter_id = auth.uid() AND status = 'draft');

-- Admin/management SELECT all
CREATE POLICY "drafts_admin_mgmt_select" ON public.review_drafts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

-- At most one editable draft per linked subject
CREATE UNIQUE INDEX review_drafts_one_editable_per_subject
  ON public.review_drafts (linked_subject_id)
  WHERE status = 'draft' AND linked_subject_id IS NOT NULL;

CREATE INDEX review_drafts_submitter_idx ON public.review_drafts (submitter_id, status);

CREATE TRIGGER review_drafts_touch_updated_at
  BEFORE UPDATE ON public.review_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 2. review_subject_revisions
-- ----------------------------------------------------------------------------
CREATE TABLE public.review_subject_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.review_subjects(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL REFERENCES public.review_drafts(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  snapshot jsonb NOT NULL,
  content_hash text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, revision),
  UNIQUE (draft_id, revision)
);

GRANT SELECT ON public.review_subject_revisions TO authenticated;
GRANT ALL ON public.review_subject_revisions TO service_role;

ALTER TABLE public.review_subject_revisions ENABLE ROW LEVEL SECURITY;

-- Revisions inherit parent subject visibility
CREATE POLICY "revisions_select_by_subject_visibility" ON public.review_subject_revisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.review_subjects s WHERE s.id = subject_id));

CREATE INDEX review_subject_revisions_subject_idx ON public.review_subject_revisions (subject_id, revision DESC);

-- ----------------------------------------------------------------------------
-- 3. review_templates
-- ----------------------------------------------------------------------------
CREATE TABLE public.review_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_kind text NOT NULL CHECK (subject_kind IN ('expert','module','knowledge_resource','training_need')),
  name text NOT NULL,
  active_version_id uuid NULL,
  deprecated_at timestamptz NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.review_templates TO authenticated;
GRANT ALL ON public.review_templates TO service_role;

ALTER TABLE public.review_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_governance_select" ON public.review_templates FOR SELECT TO authenticated
  USING (public.has_any_governance_role(auth.uid()));

CREATE TRIGGER review_templates_touch_updated_at
  BEFORE UPDATE ON public.review_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 4. review_template_versions
-- ----------------------------------------------------------------------------
CREATE TABLE public.review_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.review_templates(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  criteria_schema jsonb NOT NULL,
  published_at timestamptz NULL,
  published_by uuid NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

GRANT SELECT ON public.review_template_versions TO authenticated;
GRANT ALL ON public.review_template_versions TO service_role;

ALTER TABLE public.review_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_versions_governance_select" ON public.review_template_versions FOR SELECT TO authenticated
  USING (public.has_any_governance_role(auth.uid()));

CREATE INDEX review_template_versions_template_idx ON public.review_template_versions (template_id, version DESC);

-- active_version_id FK (added after table exists to allow cross-ref)
ALTER TABLE public.review_templates
  ADD CONSTRAINT review_templates_active_version_fk
    FOREIGN KEY (active_version_id) REFERENCES public.review_template_versions(id) DEFERRABLE INITIALLY DEFERRED;

-- Trigger: enforce active_version belongs to same template AND is published
CREATE OR REPLACE FUNCTION public.enforce_active_template_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_tpl uuid; v_pub timestamptz;
BEGIN
  IF NEW.active_version_id IS NULL THEN RETURN NEW; END IF;
  SELECT template_id, published_at INTO v_tpl, v_pub
    FROM public.review_template_versions WHERE id = NEW.active_version_id;
  IF v_tpl IS NULL OR v_tpl <> NEW.id THEN
    RAISE EXCEPTION 'active_version_template_mismatch';
  END IF;
  IF v_pub IS NULL THEN
    RAISE EXCEPTION 'active_version_not_published';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_review_templates_active_version
  BEFORE INSERT OR UPDATE OF active_version_id ON public.review_templates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_template_version();

-- Trigger: template version immutability once published
CREATE OR REPLACE FUNCTION public.enforce_template_version_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'template_version_immutable';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'template_version_immutable';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_template_version_immutable
  BEFORE UPDATE OR DELETE ON public.review_template_versions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_template_version_immutable();

-- ----------------------------------------------------------------------------
-- 5. Additive column on review_assignments
-- ----------------------------------------------------------------------------
ALTER TABLE public.review_assignments
  ADD COLUMN template_version_id uuid NULL
    REFERENCES public.review_template_versions(id);

-- ============================================================================
-- SECURITY DEFINER RPCs
-- Uniform hardening: SET search_path = public;
-- REVOKE EXECUTE FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;
-- In-body auth via auth.uid() and/or public.has_role(...).
-- ============================================================================

-- ---- validate_review_criteria ---------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_review_criteria(_criteria jsonb, _schema jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_field text;
  v_spec jsonb;
  v_val jsonb;
  v_type text;
  v_required boolean;
  v_min numeric;
  v_max numeric;
  v_enum jsonb;
  v_num numeric;
BEGIN
  IF _schema IS NULL OR jsonb_typeof(_schema) <> 'object' THEN
    RAISE EXCEPTION 'criteria_invalid: schema: missing';
  END IF;
  FOR v_field, v_spec IN SELECT * FROM jsonb_each(COALESCE(_schema->'fields','{}'::jsonb)) LOOP
    v_required := COALESCE((v_spec->>'required')::boolean, false);
    v_type := COALESCE(v_spec->>'type','string');
    v_val := _criteria -> v_field;
    IF v_val IS NULL OR jsonb_typeof(v_val) = 'null' THEN
      IF v_required THEN RAISE EXCEPTION 'criteria_invalid: %: missing', v_field; END IF;
      CONTINUE;
    END IF;
    IF v_type = 'number' THEN
      IF jsonb_typeof(v_val) <> 'number' THEN RAISE EXCEPTION 'criteria_invalid: %: not_number', v_field; END IF;
      v_num := (v_val)::text::numeric;
      v_min := NULLIF(v_spec->>'min','')::numeric;
      v_max := NULLIF(v_spec->>'max','')::numeric;
      IF v_min IS NOT NULL AND v_num < v_min THEN RAISE EXCEPTION 'criteria_invalid: %: below_min', v_field; END IF;
      IF v_max IS NOT NULL AND v_num > v_max THEN RAISE EXCEPTION 'criteria_invalid: %: above_max', v_field; END IF;
    ELSIF v_type = 'string' THEN
      IF jsonb_typeof(v_val) <> 'string' THEN RAISE EXCEPTION 'criteria_invalid: %: not_string', v_field; END IF;
    ELSIF v_type = 'boolean' THEN
      IF jsonb_typeof(v_val) <> 'boolean' THEN RAISE EXCEPTION 'criteria_invalid: %: not_boolean', v_field; END IF;
    ELSIF v_type = 'enum' THEN
      v_enum := v_spec->'values';
      IF v_enum IS NULL OR jsonb_typeof(v_enum) <> 'array' THEN
        RAISE EXCEPTION 'criteria_invalid: %: enum_spec_missing', v_field;
      END IF;
      IF NOT (v_enum @> jsonb_build_array(v_val)) THEN
        RAISE EXCEPTION 'criteria_invalid: %: not_in_enum', v_field;
      END IF;
    ELSE
      RAISE EXCEPTION 'criteria_invalid: %: unknown_type', v_field;
    END IF;
  END LOOP;
END; $$;

REVOKE EXECUTE ON FUNCTION public.validate_review_criteria(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_review_criteria(jsonb, jsonb) TO authenticated;

-- ---- submit_draft_for_review ----------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_draft_for_review(_draft_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_draft public.review_drafts%ROWTYPE;
  v_hash text;
  v_subject_id uuid;
  v_prev_hash text;
  v_next_rev integer;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_draft FROM public.review_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_draft.id IS NULL THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF v_draft.submitter_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_draft.status <> 'draft' THEN RAISE EXCEPTION 'draft_already_submitted'; END IF;

  v_hash := encode(digest(
    COALESCE(v_draft.title,'') || '|' ||
    COALESCE(v_draft.description,'') || '|' ||
    COALESCE(v_draft.external_ref,'') || '|' ||
    COALESCE(v_draft.payload::text,'{}'),
    'sha256'), 'hex');

  IF v_draft.linked_subject_id IS NOT NULL THEN
    SELECT content_hash INTO v_prev_hash
      FROM public.review_subject_revisions
      WHERE subject_id = v_draft.linked_subject_id
      ORDER BY revision DESC LIMIT 1;
    IF v_prev_hash IS NOT NULL AND v_prev_hash = v_hash THEN
      RAISE EXCEPTION 'revision_unchanged';
    END IF;
    v_subject_id := v_draft.linked_subject_id;
  ELSE
    INSERT INTO public.review_subjects (kind, external_ref, title, description, submitted_by, current_status, required_recommendations, metadata)
    VALUES (v_draft.subject_kind, v_draft.external_ref, v_draft.title, v_draft.description, v_uid, 'pending', 1, '{}'::jsonb)
    RETURNING id INTO v_subject_id;
    UPDATE public.review_drafts SET linked_subject_id = v_subject_id WHERE id = v_draft.id;
  END IF;

  SELECT COALESCE(MAX(revision),0)+1 INTO v_next_rev
    FROM public.review_subject_revisions WHERE subject_id = v_subject_id;

  INSERT INTO public.review_subject_revisions (subject_id, draft_id, revision, snapshot, content_hash)
  VALUES (v_subject_id, v_draft.id,
          v_next_rev,
          jsonb_build_object(
            'title', v_draft.title,
            'description', v_draft.description,
            'external_ref', v_draft.external_ref,
            'payload', v_draft.payload,
            'subject_kind', v_draft.subject_kind
          ),
          v_hash);

  UPDATE public.review_drafts SET status = 'submitted', content_hash = v_hash WHERE id = v_draft.id;

  UPDATE public.review_subjects SET current_status = 'pending' WHERE id = v_subject_id AND current_status IN ('pending','withdrawn');

  PERFORM public.log_governance_event(
    'draft_submitted', v_uid, v_subject_id, 'review_draft', v_draft.id::text,
    NULL,
    jsonb_build_object('revision', v_next_rev, 'content_hash', v_hash));

  RETURN v_subject_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.submit_draft_for_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_draft_for_review(uuid) TO authenticated;

-- ---- finalize_decision (approve/reject) -----------------------------------
CREATE OR REPLACE FUNCTION public.finalize_decision(_subject_id uuid, _decision text, _rationale text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_decision_id uuid;
  v_before jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'management')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'invalid_decision'; END IF;

  SELECT to_jsonb(s) INTO v_before FROM public.review_subjects s WHERE s.id = _subject_id FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION 'subject_not_found'; END IF;

  INSERT INTO public.review_decisions (subject_id, decided_by, decision, rationale)
  VALUES (_subject_id, v_uid, _decision, _rationale)
  RETURNING id INTO v_decision_id;

  UPDATE public.review_subjects
    SET current_status = CASE WHEN _decision = 'approve' THEN 'approved' ELSE 'rejected' END
    WHERE id = _subject_id;

  PERFORM public.log_governance_event(
    'decision_' || _decision, v_uid, _subject_id, 'review_decision', v_decision_id::text,
    v_before,
    jsonb_build_object('decision', _decision, 'rationale', _rationale));

  RETURN v_decision_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.finalize_decision(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_decision(uuid, text, text) TO authenticated;

-- ---- return_for_revision ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.return_for_revision(_subject_id uuid, _rationale text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_subject public.review_subjects%ROWTYPE;
  v_decision_id uuid;
  v_new_draft_id uuid;
  v_latest jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'management')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_subject FROM public.review_subjects WHERE id = _subject_id FOR UPDATE;
  IF v_subject.id IS NULL THEN RAISE EXCEPTION 'subject_not_found'; END IF;

  INSERT INTO public.review_decisions (subject_id, decided_by, decision, rationale)
  VALUES (_subject_id, v_uid, 'return_for_revision', _rationale)
  RETURNING id INTO v_decision_id;

  UPDATE public.review_records SET status = 'superseded'
    WHERE subject_id = _subject_id AND status = 'submitted';

  UPDATE public.review_subjects SET current_status = 'pending' WHERE id = _subject_id;

  -- open a new editable draft revision for the submitter, seeded from latest revision snapshot
  SELECT snapshot INTO v_latest FROM public.review_subject_revisions
    WHERE subject_id = _subject_id ORDER BY revision DESC LIMIT 1;

  INSERT INTO public.review_drafts (subject_kind, submitter_id, title, description, external_ref, payload, status, linked_subject_id)
  VALUES (
    v_subject.kind,
    v_subject.submitted_by,
    COALESCE(v_latest->>'title', v_subject.title),
    COALESCE(v_latest->>'description', v_subject.description),
    COALESCE(v_latest->>'external_ref', v_subject.external_ref),
    COALESCE(v_latest->'payload','{}'::jsonb),
    'draft',
    _subject_id
  ) RETURNING id INTO v_new_draft_id;

  PERFORM public.log_governance_event(
    'decision_return_for_revision', v_uid, _subject_id, 'review_decision', v_decision_id::text,
    jsonb_build_object('previous_status', v_subject.current_status),
    jsonb_build_object('new_status','pending','new_draft_id', v_new_draft_id, 'rationale', _rationale));

  RETURN v_decision_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.return_for_revision(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_for_revision(uuid, text) TO authenticated;

-- ---- assignment operations -------------------------------------------------
CREATE OR REPLACE FUNCTION public._require_admin_or_mgmt() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public._require_admin_or_mgmt() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._require_admin_or_mgmt() TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_reviewer(_subject_id uuid, _reviewer_id uuid, _due_at timestamptz, _template_version_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  INSERT INTO public.review_assignments (subject_id, reviewer_id, assigned_by, due_at, status, conflict_of_interest_declared, template_version_id)
  VALUES (_subject_id, _reviewer_id, auth.uid(), _due_at, 'active', false, _template_version_id)
  RETURNING id INTO v_id;
  UPDATE public.review_subjects SET current_status = 'under_review'
    WHERE id = _subject_id AND current_status = 'pending';
  PERFORM public.log_governance_event('assignment_created', auth.uid(), _subject_id, 'review_assignment', v_id::text, NULL,
    jsonb_build_object('reviewer_id', _reviewer_id, 'template_version_id', _template_version_id));
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.assign_reviewer(uuid, uuid, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_reviewer(uuid, uuid, timestamptz, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reassign_reviewer(_assignment_id uuid, _new_reviewer_id uuid, _due_at timestamptz, _template_version_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old public.review_assignments%ROWTYPE; v_new uuid;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT * INTO v_old FROM public.review_assignments WHERE id = _assignment_id FOR UPDATE;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'assignment_not_found'; END IF;
  UPDATE public.review_assignments SET status = 'cancelled' WHERE id = _assignment_id;
  INSERT INTO public.review_assignments (subject_id, reviewer_id, assigned_by, due_at, status, conflict_of_interest_declared, template_version_id)
  VALUES (v_old.subject_id, _new_reviewer_id, auth.uid(), _due_at, 'active', false, COALESCE(_template_version_id, v_old.template_version_id))
  RETURNING id INTO v_new;
  PERFORM public.log_governance_event('assignment_reassigned', auth.uid(), v_old.subject_id, 'review_assignment', v_new::text,
    to_jsonb(v_old), jsonb_build_object('new_reviewer_id', _new_reviewer_id));
  RETURN v_new;
END; $$;
REVOKE EXECUTE ON FUNCTION public.reassign_reviewer(uuid, uuid, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reassign_reviewer(uuid, uuid, timestamptz, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_assignment(_assignment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old public.review_assignments%ROWTYPE;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT * INTO v_old FROM public.review_assignments WHERE id = _assignment_id FOR UPDATE;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'assignment_not_found'; END IF;
  UPDATE public.review_assignments SET status = 'cancelled' WHERE id = _assignment_id;
  PERFORM public.log_governance_event('assignment_cancelled', auth.uid(), v_old.subject_id, 'review_assignment', _assignment_id::text,
    to_jsonb(v_old), NULL);
END; $$;
REVOKE EXECUTE ON FUNCTION public.cancel_assignment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_assignment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_required_recommendations(_subject_id uuid, _n integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before jsonb;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  IF _n < 1 OR _n > 5 THEN RAISE EXCEPTION 'invalid_required_recommendations'; END IF;
  SELECT to_jsonb(s) INTO v_before FROM public.review_subjects s WHERE s.id = _subject_id;
  IF v_before IS NULL THEN RAISE EXCEPTION 'subject_not_found'; END IF;
  UPDATE public.review_subjects SET required_recommendations = _n WHERE id = _subject_id;
  PERFORM public.log_governance_event('required_recommendations_set', auth.uid(), _subject_id, 'review_subject', _subject_id::text,
    v_before, jsonb_build_object('required_recommendations', _n));
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_required_recommendations(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_required_recommendations(uuid, integer) TO authenticated;

-- ---- template operations ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_template(_subject_kind text, _name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  INSERT INTO public.review_templates (subject_kind, name, created_by)
  VALUES (_subject_kind, _name, auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.log_governance_event('template_created', auth.uid(), NULL, 'review_template', v_id::text, NULL,
    jsonb_build_object('subject_kind', _subject_kind, 'name', _name));
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.create_template(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_template(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_template_version(_template_id uuid, _criteria_schema jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_next integer; v_id uuid;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT COALESCE(MAX(version),0)+1 INTO v_next FROM public.review_template_versions WHERE template_id = _template_id;
  INSERT INTO public.review_template_versions (template_id, version, criteria_schema)
  VALUES (_template_id, v_next, _criteria_schema)
  RETURNING id INTO v_id;
  PERFORM public.log_governance_event('template_version_added', auth.uid(), NULL, 'review_template_version', v_id::text, NULL,
    jsonb_build_object('template_id', _template_id, 'version', v_next));
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.add_template_version(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_template_version(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_template_version(_version_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_v public.review_template_versions%ROWTYPE;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT * INTO v_v FROM public.review_template_versions WHERE id = _version_id;
  IF v_v.id IS NULL THEN RAISE EXCEPTION 'template_version_not_found'; END IF;
  IF v_v.published_at IS NOT NULL THEN RAISE EXCEPTION 'template_version_immutable'; END IF;
  UPDATE public.review_template_versions
    SET published_at = now(), published_by = auth.uid()
    WHERE id = _version_id;
  PERFORM public.log_governance_event('template_version_published', auth.uid(), NULL, 'review_template_version', _version_id::text, NULL,
    jsonb_build_object('template_id', v_v.template_id, 'version', v_v.version));
END; $$;
REVOKE EXECUTE ON FUNCTION public.publish_template_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_template_version(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_active_template_version(_template_id uuid, _version_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin_or_mgmt();
  UPDATE public.review_templates SET active_version_id = _version_id WHERE id = _template_id;
  PERFORM public.log_governance_event('template_active_version_set', auth.uid(), NULL, 'review_template', _template_id::text, NULL,
    jsonb_build_object('active_version_id', _version_id));
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_active_template_version(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_active_template_version(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.deprecate_template(_template_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin_or_mgmt();
  UPDATE public.review_templates SET deprecated_at = now() WHERE id = _template_id;
  PERFORM public.log_governance_event('template_deprecated', auth.uid(), NULL, 'review_template', _template_id::text, NULL, NULL);
END; $$;
REVOKE EXECUTE ON FUNCTION public.deprecate_template(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deprecate_template(uuid) TO authenticated;

-- ---- submit_review_recommendation -----------------------------------------
CREATE OR REPLACE FUNCTION public.submit_review_recommendation(_record_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rec public.review_records%ROWTYPE;
  v_asg public.review_assignments%ROWTYPE;
  v_schema jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_rec FROM public.review_records WHERE id = _record_id FOR UPDATE;
  IF v_rec.id IS NULL THEN RAISE EXCEPTION 'record_not_found'; END IF;
  IF v_rec.reviewer_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_rec.status <> 'draft' THEN RAISE EXCEPTION 'record_not_draft'; END IF;

  SELECT * INTO v_asg FROM public.review_assignments WHERE id = v_rec.assignment_id;
  IF v_asg.id IS NULL OR v_asg.status <> 'active' THEN RAISE EXCEPTION 'assignment_not_active'; END IF;
  IF v_asg.conflict_of_interest_declared THEN RAISE EXCEPTION 'unresolved_conflict_of_interest'; END IF;

  IF v_asg.template_version_id IS NOT NULL THEN
    SELECT criteria_schema INTO v_schema FROM public.review_template_versions WHERE id = v_asg.template_version_id;
    PERFORM public.validate_review_criteria(COALESCE(v_rec.criteria,'{}'::jsonb), v_schema);
  END IF;

  UPDATE public.review_records SET status = 'submitted', submitted_at = now() WHERE id = _record_id;

  PERFORM public.log_governance_event('review_submitted', v_uid, v_rec.subject_id, 'review_record', _record_id::text, NULL,
    jsonb_build_object('recommendation', v_rec.recommendation));
END; $$;
REVOKE EXECUTE ON FUNCTION public.submit_review_recommendation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_review_recommendation(uuid) TO authenticated;

-- ---- export_governance_audit_csv ------------------------------------------
CREATE OR REPLACE FUNCTION public.export_governance_audit_csv(
  _subject_id uuid DEFAULT NULL,
  _event_type text DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _limit integer DEFAULT 5000)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row record;
  v_csv text := 'created_at,event_type,actor_id,subject_id,entity_type,entity_id,before,after' || E'\n';
  v_count integer := 0;
  v_cells text[];
  v_c text;
  v_cell text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'management')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _limit IS NULL OR _limit < 1 OR _limit > 50000 THEN _limit := 5000; END IF;

  FOR v_row IN
    SELECT created_at, event_type, actor_id, subject_id, entity_type, entity_id, before, after
    FROM public.governance_audit_log
    WHERE (_subject_id IS NULL OR subject_id = _subject_id)
      AND (_event_type IS NULL OR event_type = _event_type)
      AND (_from IS NULL OR created_at >= _from)
      AND (_to IS NULL OR created_at <= _to)
    ORDER BY created_at DESC
    LIMIT _limit
  LOOP
    v_cells := ARRAY[
      v_row.created_at::text,
      v_row.event_type,
      COALESCE(v_row.actor_id::text,''),
      COALESCE(v_row.subject_id::text,''),
      COALESCE(v_row.entity_type,''),
      COALESCE(v_row.entity_id,''),
      COALESCE(v_row.before::text,''),
      COALESCE(v_row.after::text,'')
    ];
    v_c := '';
    FOR i IN 1..array_length(v_cells,1) LOOP
      v_cell := v_cells[i];
      -- neutralize spreadsheet formula injection
      IF length(v_cell) > 0 AND substr(v_cell,1,1) IN ('=','+','-','@',E'\t',E'\r') THEN
        v_cell := '''' || v_cell;
      END IF;
      -- RFC4180 quoting
      IF v_cell ~ '[",\n\r]' THEN
        v_cell := '"' || replace(v_cell,'"','""') || '"';
      END IF;
      IF i > 1 THEN v_c := v_c || ','; END IF;
      v_c := v_c || v_cell;
    END LOOP;
    v_csv := v_csv || v_c || E'\n';
    v_count := v_count + 1;
  END LOOP;

  PERFORM public.log_governance_event('audit_exported', v_uid, _subject_id, 'governance_audit_log', NULL, NULL,
    jsonb_build_object('row_count', v_count, 'event_type', _event_type, 'from', _from, 'to', _to));

  RETURN v_csv;
END; $$;
REVOKE EXECUTE ON FUNCTION public.export_governance_audit_csv(uuid, text, timestamptz, timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_governance_audit_csv(uuid, text, timestamptz, timestamptz, integer) TO authenticated;
