-- ============================================================
-- PHASE 1.4 INCREMENT 5 — COMPLETION EVALUATION DOMAIN
-- ============================================================

-- 1. DOMAINS -------------------------------------------------
CREATE DOMAIN public.completion_evaluation_context_v1 AS text
  CHECK (VALUE IN ('course','training','webinar','workshop','programme'));

CREATE DOMAIN public.completion_evaluation_submission_status_v1 AS text
  CHECK (VALUE IN ('draft','submitted'));

CREATE DOMAIN public.completion_evaluation_question_type_v1 AS text
  CHECK (VALUE IN ('single_choice','multiple_choice','rating_scale','yes_no','short_text','long_text'));

CREATE DOMAIN public.completion_evaluation_template_status_v1 AS text
  CHECK (VALUE IN ('draft','active','retired'));

-- extend platform event taxonomy
DO $$
DECLARE v_con text;
BEGIN
  SELECT c.conname INTO v_con FROM pg_constraint c
  JOIN pg_type t ON t.oid = c.contypid WHERE t.typname = 'platform_event_type_v1';
  EXECUTE format('ALTER DOMAIN public.platform_event_type_v1 DROP CONSTRAINT %I', v_con);
  EXECUTE $q$ALTER DOMAIN public.platform_event_type_v1 ADD CONSTRAINT platform_event_type_v1_check CHECK (VALUE = ANY (ARRAY[
    'draft_created','submission_started','submission_submitted','review_assigned','recommendation_submitted',
    'decision_recorded','returned_for_revision','approved','rejected','directly_published',
    'registry_record_created','registry_record_updated','registry_record_published','registry_record_archived',
    'self_paced_alternative_presented','self_paced_alternative_selected','self_paced_course_started',
    'training_request_avoided_by_existing_content','facilitated_training_requested',
    'training_need_converted_to_self_paced','training_need_converted_to_course_offering',
    'funding_preference_selected','funding_model_confirmed','zero_tariff_approved',
    'billing_requested','billing_issued','payment_confirmed',
    'offering_classification_updated','self_paced_access_model_updated','cohort_financial_model_updated',
    'cohort_payment_responsibility_updated',
    'completion_evaluation_started','completion_evaluation_submitted',
    'completion_evaluation_requirement_updated','completion_evaluation_template_assigned',
    'completion_evaluation_template_status_updated'
  ]))$q$;
END $$;

-- 2. TEMPLATES ----------------------------------------------
CREATE TABLE public.completion_evaluation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_name text NOT NULL UNIQUE,
  context public.completion_evaluation_context_v1 NOT NULL,
  title text NOT NULL,
  intro_text text,
  status public.completion_evaluation_template_status_v1 NOT NULL DEFAULT 'draft',
  -- Increment 6 immutable-version readiness (nullable pointer, no FK yet)
  active_version_id uuid,
  version_series integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.completion_evaluation_templates TO authenticated;
GRANT ALL ON public.completion_evaluation_templates TO service_role;
ALTER TABLE public.completion_evaluation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY cet_participant_read_active ON public.completion_evaluation_templates
  FOR SELECT TO authenticated USING (status = 'active');
CREATE POLICY cet_admin_read ON public.completion_evaluation_templates
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

-- 3. QUESTIONS ----------------------------------------------
CREATE TABLE public.completion_evaluation_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.completion_evaluation_templates(id) ON DELETE CASCADE,
  category text,
  question_text text NOT NULL,
  question_type public.completion_evaluation_question_type_v1 NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  rating_min integer,
  rating_max integer,
  help_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ceq_choices_is_array CHECK (jsonb_typeof(choices) = 'array'),
  CONSTRAINT ceq_choice_types_have_choices CHECK (
    (question_type IN ('single_choice','multiple_choice')) = (jsonb_array_length(choices) > 0)
  ),
  CONSTRAINT ceq_rating_range CHECK (
    (question_type = 'rating_scale' AND rating_min IS NOT NULL AND rating_max IS NOT NULL AND rating_max > rating_min)
    OR (question_type <> 'rating_scale' AND rating_min IS NULL AND rating_max IS NULL)
  ),
  UNIQUE (template_id, display_order)
);
GRANT SELECT ON public.completion_evaluation_questions TO authenticated;
GRANT ALL ON public.completion_evaluation_questions TO service_role;
ALTER TABLE public.completion_evaluation_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ceq_participant_read_active ON public.completion_evaluation_questions
  FOR SELECT TO authenticated USING (
    active AND EXISTS (SELECT 1 FROM public.completion_evaluation_templates t
                       WHERE t.id = template_id AND t.status = 'active')
  );
CREATE POLICY ceq_admin_read ON public.completion_evaluation_questions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

-- 4. OFFERING CONFIGURATION ---------------------------------
ALTER TABLE public.course_offerings
  ADD COLUMN completion_evaluation_required boolean NOT NULL DEFAULT false,
  ADD COLUMN completion_evaluation_context public.completion_evaluation_context_v1,
  ADD COLUMN completion_evaluation_template_id uuid REFERENCES public.completion_evaluation_templates(id) ON DELETE SET NULL,
  ADD COLUMN completion_evaluation_version integer NOT NULL DEFAULT 1,
  ADD COLUMN completion_evaluation_source text NOT NULL DEFAULT 'migration_backfill',
  ADD COLUMN completion_evaluation_updated_at timestamptz,
  ADD COLUMN completion_evaluation_updated_by uuid;

ALTER TABLE public.course_offerings
  ADD CONSTRAINT course_offerings_completion_evaluation_chk
  CHECK (completion_evaluation_required = false OR completion_evaluation_context IS NOT NULL);

-- 5. SUBMISSIONS --------------------------------------------
CREATE TABLE public.completion_evaluation_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_offering_id uuid NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  enrolment_id uuid NOT NULL REFERENCES public.enrolments(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.completion_evaluation_templates(id) ON DELETE RESTRICT,
  context public.completion_evaluation_context_v1 NOT NULL,
  status public.completion_evaluation_submission_status_v1 NOT NULL DEFAULT 'draft',
  draft_version integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ces_submitted_at_chk CHECK (
    (status = 'submitted' AND submitted_at IS NOT NULL) OR (status = 'draft' AND submitted_at IS NULL)
  )
);
-- at most one draft, and at most one submitted baseline, per participation+template
CREATE UNIQUE INDEX ces_one_draft_idx ON public.completion_evaluation_submissions (enrolment_id, template_id)
  WHERE status = 'draft';
CREATE UNIQUE INDEX ces_one_submitted_idx ON public.completion_evaluation_submissions (enrolment_id, template_id)
  WHERE status = 'submitted';

GRANT SELECT ON public.completion_evaluation_submissions TO authenticated;
GRANT ALL ON public.completion_evaluation_submissions TO service_role;
ALTER TABLE public.completion_evaluation_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ces_own_read ON public.completion_evaluation_submissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ces_admin_read ON public.completion_evaluation_submissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
-- no INSERT/UPDATE/DELETE policies: writes only via SECURITY DEFINER operations

-- 6. RESPONSES ----------------------------------------------
CREATE TABLE public.completion_evaluation_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.completion_evaluation_submissions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.completion_evaluation_questions(id) ON DELETE RESTRICT,
  value_text text,
  value_number numeric,
  value_choices text[],
  value_bool boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, question_id)
);
GRANT SELECT ON public.completion_evaluation_responses TO authenticated;
GRANT ALL ON public.completion_evaluation_responses TO service_role;
ALTER TABLE public.completion_evaluation_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY cer_own_read ON public.completion_evaluation_responses
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.completion_evaluation_submissions s
            WHERE s.id = submission_id AND s.user_id = auth.uid())
  );
-- deliberately no admin/QA response-read policy: participant answers stay protected
-- until a dedicated authorized-results increment defines the scope.

-- 7. TOUCH TRIGGERS -----------------------------------------
CREATE TRIGGER cet_touch BEFORE UPDATE ON public.completion_evaluation_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ceq_touch BEFORE UPDATE ON public.completion_evaluation_questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ces_touch BEFORE UPDATE ON public.completion_evaluation_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER cer_touch BEFORE UPDATE ON public.completion_evaluation_responses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. IMMUTABILITY GUARD -------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_completion_evaluation_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'completion_evaluation_responses' THEN
    IF EXISTS (SELECT 1 FROM public.completion_evaluation_submissions s
               WHERE s.id = COALESCE(NEW.submission_id, OLD.submission_id) AND s.status = 'submitted') THEN
      RAISE EXCEPTION 'submitted evaluation answers are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.template_id IS DISTINCT FROM OLD.template_id THEN
      RAISE EXCEPTION 'submitted completion evaluation is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'submission ownership cannot change' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_completion_evaluation_immutable() FROM PUBLIC;

CREATE TRIGGER ces_immutable BEFORE UPDATE ON public.completion_evaluation_submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_completion_evaluation_immutable();
CREATE TRIGGER cer_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.completion_evaluation_responses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_completion_evaluation_immutable();

-- 9. STATE RESOLVER -----------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_completion_evaluation_state(_enrolment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_enr RECORD; v_off RECORD; v_sub RECORD; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_enr FROM public.enrolments WHERE id = _enrolment_id;
  IF v_enr.id IS NULL THEN RAISE EXCEPTION 'enrolment not found' USING ERRCODE = 'P0002'; END IF;
  IF v_enr.user_id <> v_uid
     AND NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'management')) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT o.id, o.completion_evaluation_required, o.completion_evaluation_context,
         o.completion_evaluation_template_id, o.learning_model
    INTO v_off FROM public.course_offerings o WHERE o.id = v_enr.course_offering_id;

  IF NOT v_off.completion_evaluation_required THEN
    RETURN jsonb_build_object('state','not_required','completion_evaluation_submitted',false,
                              'context', v_off.completion_evaluation_context);
  END IF;

  SELECT * INTO v_sub FROM public.completion_evaluation_submissions
   WHERE enrolment_id = _enrolment_id AND user_id = v_enr.user_id
   ORDER BY (status = 'submitted') DESC, created_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'state', CASE WHEN v_sub.id IS NULL THEN 'not_started'
                  WHEN v_sub.status = 'submitted' THEN 'submitted'
                  ELSE 'in_progress' END,
    'completion_evaluation_submitted', COALESCE(v_sub.status = 'submitted', false),
    'submission_id', v_sub.id,
    'draft_version', v_sub.draft_version,
    'context', v_off.completion_evaluation_context,
    'template_id', v_off.completion_evaluation_template_id,
    'submitted_at', v_sub.submitted_at
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.resolve_completion_evaluation_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_completion_evaluation_state(uuid) TO authenticated;

-- 10. START --------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_completion_evaluation(_enrolment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_enr RECORD; v_off RECORD; v_tpl RECORD; v_sub RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_enr FROM public.enrolments WHERE id = _enrolment_id AND user_id = v_uid;
  IF v_enr.id IS NULL THEN RAISE EXCEPTION 'enrolment not found or not owned by caller' USING ERRCODE = '42501'; END IF;
  IF v_enr.enrolment_status = 'withdrawn' THEN
    RAISE EXCEPTION 'enrolment is not active' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_off FROM public.course_offerings WHERE id = v_enr.course_offering_id;
  IF NOT v_off.completion_evaluation_required THEN
    RAISE EXCEPTION 'completion evaluation is not required for this offering' USING ERRCODE = '23514'; END IF;
  IF v_off.completion_evaluation_template_id IS NULL THEN
    RAISE EXCEPTION 'no completion evaluation template assigned' USING ERRCODE = '23514'; END IF;

  SELECT * INTO v_tpl FROM public.completion_evaluation_templates
    WHERE id = v_off.completion_evaluation_template_id;
  IF v_tpl.status <> 'active' THEN
    RAISE EXCEPTION 'completion evaluation template is not active' USING ERRCODE = '23514'; END IF;

  -- idempotent: return existing submitted or draft
  SELECT * INTO v_sub FROM public.completion_evaluation_submissions
    WHERE enrolment_id = _enrolment_id AND template_id = v_tpl.id
    ORDER BY (status = 'submitted') DESC, created_at DESC LIMIT 1;
  IF v_sub.id IS NOT NULL THEN
    RETURN jsonb_build_object('submission_id', v_sub.id, 'status', v_sub.status,
      'draft_version', v_sub.draft_version, 'context', v_sub.context, 'created', false);
  END IF;

  INSERT INTO public.completion_evaluation_submissions
    (user_id, course_offering_id, enrolment_id, template_id, context)
  VALUES (v_uid, v_off.id, _enrolment_id, v_tpl.id, v_off.completion_evaluation_context)
  RETURNING * INTO v_sub;

  PERFORM public.emit_platform_event(
    'completion_evaluation_started', v_uid, v_uid, 'completion_evaluation_submission',
    v_sub.id::text, 'learning', NULL, NULL, NULL, v_off.id,
    jsonb_build_object('submission_id', v_sub.id, 'course_offering_id', v_off.id,
      'evaluation_context', v_sub.context, 'previous_status', NULL, 'new_status', 'draft',
      'operational_source', 'participant_action'));

  RETURN jsonb_build_object('submission_id', v_sub.id, 'status', v_sub.status,
    'draft_version', v_sub.draft_version, 'context', v_sub.context, 'created', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.start_completion_evaluation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_completion_evaluation(uuid) TO authenticated;

-- 11. VALIDATION HELPER --------------------------------------
CREATE OR REPLACE FUNCTION public._validate_completion_evaluation_answer(_q public.completion_evaluation_questions, _ans jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v text; v_num numeric; v_max integer;
BEGIN
  CASE _q.question_type
    WHEN 'rating_scale' THEN
      IF jsonb_typeof(_ans) <> 'number' THEN RAISE EXCEPTION 'question % expects a numeric rating', _q.id USING ERRCODE='23514'; END IF;
      v_num := (_ans #>> '{}')::numeric;
      IF v_num < _q.rating_min OR v_num > _q.rating_max THEN
        RAISE EXCEPTION 'rating out of range for question %', _q.id USING ERRCODE='23514'; END IF;
    WHEN 'yes_no' THEN
      IF jsonb_typeof(_ans) <> 'boolean' THEN RAISE EXCEPTION 'question % expects yes/no', _q.id USING ERRCODE='23514'; END IF;
    WHEN 'short_text','long_text' THEN
      IF jsonb_typeof(_ans) <> 'string' THEN RAISE EXCEPTION 'question % expects text', _q.id USING ERRCODE='23514'; END IF;
      IF _q.question_type = 'short_text' THEN v_max := 500; ELSE v_max := 5000; END IF;
      IF length(_ans #>> '{}') > v_max THEN
        RAISE EXCEPTION 'answer too long for question %', _q.id USING ERRCODE='23514';
      END IF;
    WHEN 'single_choice' THEN
      IF jsonb_typeof(_ans) <> 'string' THEN RAISE EXCEPTION 'question % expects one choice', _q.id USING ERRCODE='23514'; END IF;
      IF NOT (_q.choices ? (_ans #>> '{}')) THEN
        RAISE EXCEPTION 'invalid choice for question %', _q.id USING ERRCODE='23514'; END IF;
    WHEN 'multiple_choice' THEN
      IF jsonb_typeof(_ans) <> 'array' THEN RAISE EXCEPTION 'question % expects a choice list', _q.id USING ERRCODE='23514'; END IF;
      FOR v IN SELECT jsonb_array_elements_text(_ans) LOOP
        IF NOT (_q.choices ? v) THEN RAISE EXCEPTION 'invalid choice for question %', _q.id USING ERRCODE='23514'; END IF;
      END LOOP;
    ELSE
      NULL;
  END CASE;
END $$;
REVOKE EXECUTE ON FUNCTION public._validate_completion_evaluation_answer(public.completion_evaluation_questions, jsonb) FROM PUBLIC;

-- 12. SAVE DRAFT ---------------------------------------------
CREATE OR REPLACE FUNCTION public.save_completion_evaluation_draft(
  _submission_id uuid, _expected_version integer, _answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_sub RECORD; v_q RECORD; v_key text; v_ans jsonb; v_changed boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(COALESCE(_answers,'{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'answers must be an object' USING ERRCODE='23514'; END IF;

  SELECT * INTO v_sub FROM public.completion_evaluation_submissions
    WHERE id = _submission_id AND user_id = v_uid FOR UPDATE;
  IF v_sub.id IS NULL THEN RAISE EXCEPTION 'submission not found or not owned by caller' USING ERRCODE='42501'; END IF;
  IF v_sub.status <> 'draft' THEN RAISE EXCEPTION 'submitted evaluation cannot be edited' USING ERRCODE='23514'; END IF;
  IF _expected_version IS DISTINCT FROM v_sub.draft_version THEN
    RAISE EXCEPTION 'stale draft version (current %)', v_sub.draft_version USING ERRCODE='23514'; END IF;

  FOR v_key, v_ans IN SELECT * FROM jsonb_each(COALESCE(_answers,'{}'::jsonb)) LOOP
    SELECT * INTO v_q FROM public.completion_evaluation_questions
      WHERE id = v_key::uuid AND template_id = v_sub.template_id AND active;
    IF v_q.id IS NULL THEN RAISE EXCEPTION 'question % is not part of this template', v_key USING ERRCODE='23514'; END IF;
    PERFORM public._validate_completion_evaluation_answer(v_q, v_ans);

    INSERT INTO public.completion_evaluation_responses
      (submission_id, question_id, value_text, value_number, value_choices, value_bool)
    VALUES (
      v_sub.id, v_q.id,
      CASE WHEN v_q.question_type IN ('short_text','long_text','single_choice') THEN (v_ans #>> '{}') END,
      CASE WHEN v_q.question_type = 'rating_scale' THEN (v_ans #>> '{}')::numeric END,
      CASE WHEN v_q.question_type = 'multiple_choice'
           THEN ARRAY(SELECT jsonb_array_elements_text(v_ans)) END,
      CASE WHEN v_q.question_type = 'yes_no' THEN (v_ans #>> '{}')::boolean END)
    ON CONFLICT (submission_id, question_id) DO UPDATE SET
      value_text = EXCLUDED.value_text, value_number = EXCLUDED.value_number,
      value_choices = EXCLUDED.value_choices, value_bool = EXCLUDED.value_bool,
      updated_at = now();
    v_changed := true;
  END LOOP;

  IF v_changed THEN
    UPDATE public.completion_evaluation_submissions
      SET draft_version = draft_version + 1 WHERE id = v_sub.id
      RETURNING * INTO v_sub;
  END IF;

  RETURN jsonb_build_object('submission_id', v_sub.id, 'status', v_sub.status,
    'draft_version', v_sub.draft_version, 'no_op', NOT v_changed);
END $$;
REVOKE EXECUTE ON FUNCTION public.save_completion_evaluation_draft(uuid, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_completion_evaluation_draft(uuid, integer, jsonb) TO authenticated;

-- 13. SUBMIT -------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_completion_evaluation(
  _submission_id uuid, _expected_version integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_sub RECORD; v_missing integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_sub FROM public.completion_evaluation_submissions
    WHERE id = _submission_id AND user_id = v_uid FOR UPDATE;
  IF v_sub.id IS NULL THEN RAISE EXCEPTION 'submission not found or not owned by caller' USING ERRCODE='42501'; END IF;

  IF v_sub.status = 'submitted' THEN
    RETURN jsonb_build_object('submission_id', v_sub.id, 'status','submitted',
      'submitted_at', v_sub.submitted_at, 'no_op', true);
  END IF;
  IF _expected_version IS NOT NULL AND _expected_version <> v_sub.draft_version THEN
    RAISE EXCEPTION 'stale draft version (current %)', v_sub.draft_version USING ERRCODE='23514'; END IF;

  SELECT count(*) INTO v_missing FROM public.completion_evaluation_questions q
   WHERE q.template_id = v_sub.template_id AND q.active AND q.is_required
     AND NOT EXISTS (SELECT 1 FROM public.completion_evaluation_responses r
                     WHERE r.submission_id = v_sub.id AND r.question_id = q.id
                       AND (r.value_text IS NOT NULL OR r.value_number IS NOT NULL
                            OR r.value_bool IS NOT NULL OR r.value_choices IS NOT NULL));
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'required questions unanswered (% remaining)', v_missing USING ERRCODE='23514'; END IF;

  UPDATE public.completion_evaluation_submissions
    SET status = 'submitted', submitted_at = now(), draft_version = draft_version + 1
    WHERE id = v_sub.id RETURNING * INTO v_sub;

  PERFORM public.emit_platform_event(
    'completion_evaluation_submitted', v_uid, v_uid, 'completion_evaluation_submission',
    v_sub.id::text, 'learning', NULL, NULL, NULL, v_sub.course_offering_id,
    jsonb_build_object('submission_id', v_sub.id, 'course_offering_id', v_sub.course_offering_id,
      'evaluation_context', v_sub.context, 'previous_status','draft','new_status','submitted',
      'operational_source','participant_action'));

  RETURN jsonb_build_object('submission_id', v_sub.id, 'status','submitted',
    'submitted_at', v_sub.submitted_at, 'no_op', false);
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_completion_evaluation(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_completion_evaluation(uuid, integer) TO authenticated;

-- 14. ADMIN OPERATIONS ---------------------------------------
CREATE OR REPLACE FUNCTION public.create_completion_evaluation_template(
  _internal_name text, _context public.completion_evaluation_context_v1,
  _title text, _intro_text text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  INSERT INTO public.completion_evaluation_templates
    (internal_name, context, title, intro_text, created_by, updated_by)
  VALUES (_internal_name, _context, _title, _intro_text, auth.uid(), auth.uid())
  ON CONFLICT (internal_name) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.completion_evaluation_templates WHERE internal_name = _internal_name;
  END IF;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_completion_evaluation_template(text, public.completion_evaluation_context_v1, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_completion_evaluation_template(text, public.completion_evaluation_context_v1, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_completion_evaluation_question(
  _template_id uuid, _category text, _question_text text,
  _question_type public.completion_evaluation_question_type_v1,
  _is_required boolean, _display_order integer,
  _choices jsonb DEFAULT '[]'::jsonb, _rating_min integer DEFAULT NULL,
  _rating_max integer DEFAULT NULL, _help_text text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_status text;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT status INTO v_status FROM public.completion_evaluation_templates WHERE id = _template_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'template not found' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.completion_evaluation_questions
    (template_id, category, question_text, question_type, is_required, display_order,
     choices, rating_min, rating_max, help_text)
  VALUES (_template_id, _category, _question_text, _question_type, _is_required, _display_order,
     COALESCE(_choices,'[]'::jsonb), _rating_min, _rating_max, _help_text)
  ON CONFLICT (template_id, display_order) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.completion_evaluation_questions
     WHERE template_id = _template_id AND display_order = _display_order;
  END IF;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.add_completion_evaluation_question(uuid, text, text, public.completion_evaluation_question_type_v1, boolean, integer, jsonb, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_completion_evaluation_question(uuid, text, text, public.completion_evaluation_question_type_v1, boolean, integer, jsonb, integer, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_completion_evaluation_template_status(
  _template_id uuid, _status public.completion_evaluation_template_status_v1, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev text;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'a change reason is required' USING ERRCODE='23514'; END IF;
  SELECT status INTO v_prev FROM public.completion_evaluation_templates WHERE id = _template_id FOR UPDATE;
  IF v_prev IS NULL THEN RAISE EXCEPTION 'template not found' USING ERRCODE='P0002'; END IF;
  IF v_prev = _status THEN
    RETURN jsonb_build_object('template_id',_template_id,'status',v_prev,'no_op',true); END IF;

  UPDATE public.completion_evaluation_templates
    SET status = _status, updated_by = auth.uid() WHERE id = _template_id;

  PERFORM public.emit_platform_event(
    'completion_evaluation_template_status_updated', auth.uid(), NULL,
    'completion_evaluation_template', _template_id::text, 'learning', NULL, NULL, NULL, NULL,
    jsonb_build_object('template_id',_template_id,'previous_status',v_prev,'new_status',_status,
      'operational_source','admin_action'));
  RETURN jsonb_build_object('template_id',_template_id,'status',_status,'no_op',false);
END $$;
REVOKE EXECUTE ON FUNCTION public.set_completion_evaluation_template_status(uuid, public.completion_evaluation_template_status_v1, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_completion_evaluation_template_status(uuid, public.completion_evaluation_template_status_v1, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.configure_completion_evaluation_requirement(
  _offering_id uuid, _required boolean, _context public.completion_evaluation_context_v1,
  _expected_version integer, _source text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_off RECORD;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'a change reason is required' USING ERRCODE='23514'; END IF;
  SELECT * INTO v_off FROM public.course_offerings WHERE id = _offering_id FOR UPDATE;
  IF v_off.id IS NULL THEN RAISE EXCEPTION 'offering not found' USING ERRCODE='P0002'; END IF;
  IF _expected_version IS DISTINCT FROM v_off.completion_evaluation_version THEN
    RAISE EXCEPTION 'stale version (current %)', v_off.completion_evaluation_version USING ERRCODE='23514'; END IF;
  IF _required AND _context IS NULL THEN
    RAISE EXCEPTION 'context required when completion evaluation is required' USING ERRCODE='23514'; END IF;

  IF v_off.completion_evaluation_required = _required
     AND v_off.completion_evaluation_context IS NOT DISTINCT FROM _context THEN
    RETURN jsonb_build_object('offering_id',_offering_id,'no_op',true,
      'version', v_off.completion_evaluation_version);
  END IF;

  UPDATE public.course_offerings SET
    completion_evaluation_required = _required,
    completion_evaluation_context = _context,
    completion_evaluation_version = completion_evaluation_version + 1,
    completion_evaluation_source = COALESCE(_source,'admin_update'),
    completion_evaluation_updated_at = now(),
    completion_evaluation_updated_by = auth.uid()
  WHERE id = _offering_id RETURNING * INTO v_off;

  PERFORM public.emit_platform_event(
    'completion_evaluation_requirement_updated', auth.uid(), NULL, 'course_offering',
    _offering_id::text, 'learning', NULL, NULL, NULL, _offering_id,
    jsonb_build_object('course_offering_id',_offering_id,'required',_required,
      'evaluation_context',_context,'new_version',v_off.completion_evaluation_version,
      'operational_source', COALESCE(_source,'admin_update')));
  RETURN jsonb_build_object('offering_id',_offering_id,'no_op',false,
    'version', v_off.completion_evaluation_version);
END $$;
REVOKE EXECUTE ON FUNCTION public.configure_completion_evaluation_requirement(uuid, boolean, public.completion_evaluation_context_v1, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.configure_completion_evaluation_requirement(uuid, boolean, public.completion_evaluation_context_v1, integer, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_completion_evaluation_template(
  _offering_id uuid, _template_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_off RECORD; v_tpl RECORD;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'a change reason is required' USING ERRCODE='23514'; END IF;
  SELECT * INTO v_off FROM public.course_offerings WHERE id = _offering_id FOR UPDATE;
  IF v_off.id IS NULL THEN RAISE EXCEPTION 'offering not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_tpl FROM public.completion_evaluation_templates WHERE id = _template_id;
  IF v_tpl.id IS NULL THEN RAISE EXCEPTION 'template not found' USING ERRCODE='P0002'; END IF;
  IF v_off.completion_evaluation_context IS DISTINCT FROM v_tpl.context THEN
    RAISE EXCEPTION 'template context % does not match offering context %',
      v_tpl.context, v_off.completion_evaluation_context USING ERRCODE='23514'; END IF;
  IF v_off.completion_evaluation_template_id IS NOT DISTINCT FROM _template_id THEN
    RETURN jsonb_build_object('offering_id',_offering_id,'template_id',_template_id,'no_op',true); END IF;

  UPDATE public.course_offerings SET
    completion_evaluation_template_id = _template_id,
    completion_evaluation_updated_at = now(),
    completion_evaluation_updated_by = auth.uid()
  WHERE id = _offering_id;

  PERFORM public.emit_platform_event(
    'completion_evaluation_template_assigned', auth.uid(), NULL, 'course_offering',
    _offering_id::text, 'learning', NULL, NULL, NULL, _offering_id,
    jsonb_build_object('course_offering_id',_offering_id,'template_id',_template_id,
      'evaluation_context', v_tpl.context, 'operational_source','admin_action'));
  RETURN jsonb_build_object('offering_id',_offering_id,'template_id',_template_id,'no_op',false);
END $$;
REVOKE EXECUTE ON FUNCTION public.assign_completion_evaluation_template(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_completion_evaluation_template(uuid, uuid, text) TO authenticated;

-- 15. BASELINE TEMPLATES + QUESTIONS -------------------------
DO $$
DECLARE v_course uuid; v_training uuid;
BEGIN
  INSERT INTO public.completion_evaluation_templates (internal_name, context, title, intro_text, status)
  VALUES ('baseline_course_completion_evaluation_v1','course','End-of-Course Evaluation',
    'Your feedback helps us improve this course. Your answers never affect your results, completion, or certificate.','active')
  RETURNING id INTO v_course;

  INSERT INTO public.completion_evaluation_templates (internal_name, context, title, intro_text, status)
  VALUES ('baseline_training_completion_evaluation_v1','training','End-of-Training Evaluation',
    'Your feedback helps us improve this training. Your answers never affect your results, completion, or certificate.','active')
  RETURNING id INTO v_training;

  INSERT INTO public.completion_evaluation_questions
    (template_id, category, question_text, question_type, is_required, display_order, choices, rating_min, rating_max, help_text)
  VALUES
    (v_course,'content_relevance','The learning content was relevant to my work.','rating_scale',true,1,'[]',1,5,'1 = strongly disagree, 5 = strongly agree'),
    (v_course,'objectives','The stated learning objectives were achieved.','rating_scale',true,2,'[]',1,5,NULL),
    (v_course,'materials','The materials were clear and of good quality.','rating_scale',true,3,'[]',1,5,NULL),
    (v_course,'platform','The learning platform was easy to use.','rating_scale',true,4,'[]',1,5,NULL),
    (v_course,'application','I expect to apply this learning in my work.','rating_scale',true,5,'[]',1,5,NULL),
    (v_course,'overall_satisfaction','Overall, I am satisfied with this course.','rating_scale',true,6,'[]',1,5,NULL),
    (v_course,'improvement','Suggestions for improvement','long_text',false,7,'[]',NULL,NULL,'Optional.'),
    (v_course,'testimonial_consent','I consent to my feedback being used publicly as a testimonial.','yes_no',false,8,'[]',NULL,NULL,'Optional and entirely separate from your evaluation.'),

    (v_training,'content_relevance','The training content was relevant to my work.','rating_scale',true,1,'[]',1,5,'1 = strongly disagree, 5 = strongly agree'),
    (v_training,'objectives','The stated training objectives were achieved.','rating_scale',true,2,'[]',1,5,NULL),
    (v_training,'materials','The materials were clear and of good quality.','rating_scale',true,3,'[]',1,5,NULL),
    (v_training,'facilitator','The facilitators were effective.','rating_scale',true,4,'[]',1,5,NULL),
    (v_training,'platform','The online learning platform was easy to use.','rating_scale',true,5,'[]',1,5,NULL),
    (v_training,'venue_logistics','The venue and logistics were satisfactory.','rating_scale',true,6,'[]',1,5,NULL),
    (v_training,'application','I expect to apply this learning in my work.','rating_scale',true,7,'[]',1,5,NULL),
    (v_training,'overall_satisfaction','Overall, I am satisfied with this training.','rating_scale',true,8,'[]',1,5,NULL),
    (v_training,'improvement','Suggestions for improvement','long_text',false,9,'[]',NULL,NULL,'Optional.'),
    (v_training,'testimonial_consent','I consent to my feedback being used publicly as a testimonial.','yes_no',false,10,'[]',NULL,NULL,'Optional and entirely separate from your evaluation.');

  -- 16. OFFERING BACKFILL (no participant data created)
  UPDATE public.course_offerings SET
    completion_evaluation_required = true,
    completion_evaluation_context = 'course',
    completion_evaluation_template_id = v_course,
    completion_evaluation_source = 'migration_backfill',
    completion_evaluation_updated_at = now()
  WHERE offering_code IN ('of-ocean-literacy-open-2026','of-aza-open-2026');

  UPDATE public.course_offerings SET
    completion_evaluation_required = true,
    completion_evaluation_context = 'training',
    completion_evaluation_template_id = v_training,
    completion_evaluation_source = 'migration_backfill',
    completion_evaluation_updated_at = now()
  WHERE offering_code IN ('of-africa-fisheries-2024','of-africa-fisheries-2026');
END $$;

-- 17. PUBLIC CLASSIFICATION VIEW — add safe evaluation labels
DROP VIEW IF EXISTS public.course_offering_classification_public_v;
CREATE VIEW public.course_offering_classification_public_v
WITH (security_invoker = true) AS
SELECT
  o.id AS course_offering_id,
  o.offering_code,
  o.offering_title,
  o.learning_model,
  o.delivery_format,
  o.enrolment_access_rule,
  o.self_paced_access_model,
  public.offering_venue_rule(o.learning_model, o.delivery_format) AS venue_rule,
  o.classification_version,
  o.self_paced_access_model_version,
  public.cohort_payment_responsibility_public_label(o.learning_model::text, o.cohort_payment_responsibility::text) AS payment_responsibility_label,
  o.completion_evaluation_required,
  o.completion_evaluation_context,
  CASE o.completion_evaluation_context
    WHEN 'course' THEN 'End-of-Course Evaluation'
    WHEN 'training' THEN 'End-of-Training Evaluation'
    WHEN 'webinar' THEN 'Webinar Evaluation'
    WHEN 'workshop' THEN 'Workshop Evaluation'
    WHEN 'programme' THEN 'Programme Evaluation'
  END AS completion_evaluation_label
FROM public.course_offerings o;
GRANT SELECT ON public.course_offering_classification_public_v TO anon, authenticated;