-- Phase 1.3 Increment 5 — event-emission correction (defect from live E2E verification).
-- training_need_draft_submit was always emitting `facilitated_training_requested`,
-- never `submission_submitted`, and never `funding_preference_selected`. The
-- correct behaviour, per the approved spec:
--   * submission_submitted → emitted for every draft submission
--   * facilitated_training_requested → only when preferred approach is facilitated
--   * funding_preference_selected → only when a funding_preference value was chosen
-- Canonical training_needs rows are still not created until authorised publication.
CREATE OR REPLACE FUNCTION public.training_need_draft_submit(_draft_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.review_drafts%ROWTYPE;
  v_subject_id uuid;
  v_approach text;
  v_funding text;
  v_src public.source_type_v1;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.review_drafts WHERE id = _draft_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF v_row.submitter_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.subject_kind <> 'training_need' THEN RAISE EXCEPTION 'wrong_subject_kind'; END IF;

  v_subject_id := public.submit_draft_for_review(_draft_id);

  v_approach := NULLIF(v_row.payload->>'requester_selected_learning_path', '');
  v_funding  := NULLIF(v_row.payload->>'funding_preference', '');
  v_src      := NULLIF(v_row.payload->>'source_type','')::public.source_type_v1;

  -- Universal: submission recorded in the platform event stream.
  PERFORM public.emit_platform_event(
    'submission_submitted'::public.platform_event_type_v1,
    v_uid, v_subject_id, 'training_need', v_subject_id::text, 'training_needs',
    v_src, v_subject_id, NULL, NULL,
    jsonb_build_object('draft_id', _draft_id, 'learning_approach', v_approach));

  -- Facilitated only: signal that a facilitated engagement was requested.
  IF v_approach = 'facilitated' THEN
    PERFORM public.emit_platform_event(
      'facilitated_training_requested'::public.platform_event_type_v1,
      v_uid, v_subject_id, 'training_need', v_subject_id::text, 'training_needs',
      v_src, v_subject_id, NULL, NULL,
      jsonb_build_object('draft_id', _draft_id));
  END IF;

  -- Only when the requester actually chose a funding source.
  IF v_funding IS NOT NULL THEN
    PERFORM public.emit_platform_event(
      'funding_preference_selected'::public.platform_event_type_v1,
      v_uid, v_subject_id, 'training_need', v_subject_id::text, 'training_needs',
      v_src, v_subject_id, NULL, NULL,
      jsonb_build_object('draft_id', _draft_id, 'funding_preference', v_funding));
  END IF;

  RETURN v_subject_id;
END $function$;