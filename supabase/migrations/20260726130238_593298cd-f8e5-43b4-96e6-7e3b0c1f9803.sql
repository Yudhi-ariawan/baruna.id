
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

  SELECT EXISTS(SELECT 1 FROM public.evaluations WHERE enrolment_id = _enrolment_id) INTO v_evaluation_exists;

  IF v_module_count = 0 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_modules_configured');
  END IF;

  IF v_completed_count < v_module_count THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'modules_incomplete',
      'completed', v_completed_count, 'required', v_module_count);
  END IF;

  IF NOT v_evaluation_exists THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'evaluation_missing');
  END IF;

  RETURN jsonb_build_object('eligible', true, 'completed', v_completed_count, 'required', v_module_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
