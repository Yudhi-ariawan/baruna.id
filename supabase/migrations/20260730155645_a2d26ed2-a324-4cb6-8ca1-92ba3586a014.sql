-- Increment 5 closure: restore the validated pre-Increment-5 certificate boundary.
-- The Completion Evaluation domain is retained, but its submission is exposed ONLY
-- as an independent informational fact. Certificate Eligibility integration for the
-- Completion Evaluation domain is DEFERRED to Increment 7.
CREATE OR REPLACE FUNCTION public.check_certificate_eligibility(_enrolment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_enrolment RECORD;
  v_module_count integer;
  v_completed_count integer;
  v_evaluation_exists boolean;
  v_ce_submitted boolean;
BEGIN
  SELECT e.id, e.user_id, e.course_offering_id, o.master_course_id
  INTO v_enrolment
  FROM public.enrolments e
  JOIN public.course_offerings o ON o.id = e.course_offering_id
  WHERE e.id = _enrolment_id;

  IF v_enrolment.id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'enrolment_not_found');
  END IF;

  SELECT COUNT(*) INTO v_module_count
  FROM public.master_modules WHERE master_course_id = v_enrolment.master_course_id;

  SELECT COUNT(DISTINCT learning_activity_id) INTO v_completed_count
  FROM public.progress_records
  WHERE enrolment_id = _enrolment_id AND status = 'completed';

  SELECT EXISTS(SELECT 1 FROM public.evaluations WHERE enrolment_id = _enrolment_id)
    INTO v_evaluation_exists;

  -- Independent, NON-GATING fact only. Never used in any branch below.
  SELECT EXISTS(
    SELECT 1 FROM public.completion_evaluation_submissions s
    WHERE s.enrolment_id = _enrolment_id AND s.status = 'submitted'
  ) INTO v_ce_submitted;

  IF v_module_count = 0 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_modules_configured',
      'completion_evaluation_submitted', v_ce_submitted);
  END IF;

  IF v_completed_count < v_module_count THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'modules_incomplete',
      'completed', v_completed_count, 'required', v_module_count,
      'completion_evaluation_submitted', v_ce_submitted);
  END IF;

  IF NOT v_evaluation_exists THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'evaluation_missing',
      'completion_evaluation_submitted', v_ce_submitted);
  END IF;

  RETURN jsonb_build_object('eligible', true, 'completed', v_completed_count,
    'required', v_module_count,
    'completion_evaluation_submitted', v_ce_submitted);
END;
$$;

COMMENT ON FUNCTION public.check_certificate_eligibility(uuid) IS
'Certificate eligibility resolver restored to the validated pre-Increment-5 baseline. '
'Completion Evaluation submission is reported as an independent informational fact only '
'(completion_evaluation_submitted) and NEVER gates eligibility. Evaluation content, ratings '
'and comments never affect certificates. Certificate Eligibility integration for the '
'Completion Evaluation domain is deferred to Increment 7.';