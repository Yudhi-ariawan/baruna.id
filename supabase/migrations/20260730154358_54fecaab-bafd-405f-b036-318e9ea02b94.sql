CREATE OR REPLACE FUNCTION public.save_completion_evaluation_draft(
  _submission_id uuid, _expected_version integer, _answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub public.completion_evaluation_submissions%ROWTYPE;
  v_q public.completion_evaluation_questions%ROWTYPE;
  v_key text; v_ans jsonb; v_changed boolean := false;
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

REVOKE ALL ON FUNCTION public.save_completion_evaluation_draft(uuid, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_completion_evaluation_draft(uuid, integer, jsonb) TO authenticated, service_role;

-- also lock table-level privileges away from signed-out callers
REVOKE ALL ON public.completion_evaluation_templates FROM anon;
REVOKE ALL ON public.completion_evaluation_questions FROM anon;
REVOKE ALL ON public.completion_evaluation_submissions FROM anon;
REVOKE ALL ON public.completion_evaluation_responses FROM anon;