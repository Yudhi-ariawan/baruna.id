CREATE OR REPLACE FUNCTION public.check_certificate_eligibility(_enrolment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_enrolment RECORD;
  v_module_count integer;
  v_completed_count integer;
  v_required boolean;
  v_eval_submitted boolean;
BEGIN
  SELECT e.id, e.user_id, e.course_offering_id, o.master_course_id,
         o.completion_evaluation_required
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

  IF v_module_count = 0 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_modules_configured');
  END IF;

  IF v_completed_count < v_module_count THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'modules_incomplete',
      'completed', v_completed_count, 'required', v_module_count);
  END IF;

  v_required := COALESCE(v_enrolment.completion_evaluation_required, false);

  IF v_required THEN
    -- Only the FACT of submission is considered. Answer content, ratings and
    -- comments never influence eligibility.
    SELECT EXISTS (
      SELECT 1 FROM public.completion_evaluation_submissions s
      WHERE s.enrolment_id = _enrolment_id AND s.status = 'submitted'
    ) INTO v_eval_submitted;

    IF NOT v_eval_submitted THEN
      RETURN jsonb_build_object('eligible', false, 'reason', 'completion_evaluation_missing',
        'completed', v_completed_count, 'required', v_module_count);
    END IF;
  END IF;

  RETURN jsonb_build_object('eligible', true, 'completed', v_completed_count,
    'required', v_module_count, 'completion_evaluation_required', v_required);
END $$;