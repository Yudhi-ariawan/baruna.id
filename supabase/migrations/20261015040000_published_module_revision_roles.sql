-- "Buka revisi modul tayang" becomes a single atomic call (follow-up to 20261008010000).
--
-- * Same decision roles as admin_module_decide (_can_decide_review: super_admin,
--   admin, approver + legacy admin/management). Reviewers/verifiers review only.
-- * The submitter cannot open a revision on their own module.
-- * Quiz content (assessment_approach + metadata) comes from the latest draft, NOT
--   from module_registry: since 20261015020000 the registry copy has no answer
--   keys, and copying it into the revision would make the resubmitted quiz
--   ungradeable. Descriptive fields still come from the live module.
-- * Prefers the latest non-withdrawn draft as the source; writes everything the
--   TypeScript fallback used to patch afterwards, in the same transaction.
-- Concurrency: the subject row is locked FOR UPDATE and an open revision draft
-- makes a second call fail with published_revision_already_open.

CREATE OR REPLACE FUNCTION public.request_published_module_revision(
  _subject_id uuid,
  _rationale text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_subject public.review_subjects%ROWTYPE;
  v_module public.module_registry%ROWTYPE;
  v_latest jsonb := '{}'::jsonb;
  v_latest_meta jsonb;
  v_payload jsonb;
  v_rationale text := btrim(COALESCE(_rationale, ''));
  v_draft_id uuid;
  v_prev_dec uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_rationale) < 5 THEN RAISE EXCEPTION 'revision_rationale_required'; END IF;
  IF char_length(v_rationale) > 5000 THEN RAISE EXCEPTION 'rationale_too_long'; END IF;

  SELECT * INTO v_subject FROM public.review_subjects
   WHERE id = _subject_id AND kind = 'module' FOR UPDATE;
  IF v_subject.id IS NULL THEN RAISE EXCEPTION 'module_subject_not_found'; END IF;
  IF v_subject.submitted_by = v_uid THEN RAISE EXCEPTION 'self_decision_forbidden'; END IF;

  SELECT * INTO v_module FROM public.module_registry
   WHERE source_submission_id = _subject_id AND current_status = 'published' AND visibility = 'public'
   ORDER BY updated_at DESC LIMIT 1
   FOR UPDATE;
  IF v_module.id IS NULL THEN RAISE EXCEPTION 'published_module_not_found'; END IF;

  IF EXISTS (SELECT 1 FROM public.review_drafts WHERE linked_subject_id = _subject_id AND status = 'draft') THEN
    RAISE EXCEPTION 'published_revision_already_open';
  END IF;

  SELECT payload INTO v_latest FROM public.review_drafts
   WHERE linked_subject_id = _subject_id
   ORDER BY (status <> 'withdrawn') DESC, updated_at DESC
   LIMIT 1;
  v_latest := CASE WHEN jsonb_typeof(v_latest) = 'object' THEN v_latest ELSE '{}'::jsonb END;
  v_latest_meta := CASE WHEN jsonb_typeof(v_latest->'metadata') = 'object' THEN v_latest->'metadata' ELSE '{}'::jsonb END;

  v_payload := v_latest || jsonb_build_object(
    'title', v_module.title,
    'summary', v_module.summary,
    'language', v_module.language,
    'module_type', v_module.module_type,
    'target_participants', v_module.target_participants,
    'estimated_learning_hours', v_module.estimated_learning_hours,
    'learning_objectives', COALESCE(to_jsonb(v_module.learning_objectives), '[]'::jsonb),
    'content_outline', COALESCE(v_module.content_outline, '{}'::jsonb),
    -- The draft keeps the full quiz (with answer keys); the registry copy does not.
    'assessment_approach', CASE WHEN jsonb_typeof(v_latest->'assessment_approach') = 'object'
                                THEN v_latest->'assessment_approach'
                                ELSE COALESCE(v_module.assessment_approach, '{}'::jsonb) END,
    'metadata', COALESCE(v_module.metadata, '{}'::jsonb) || v_latest_meta || jsonb_build_object(
      'revision_kind', 'published_module_update',
      'published_module_id', v_module.id,
      'base_version', v_module.version,
      'revision_rationale', v_rationale,
      'revision_requested_by', v_uid,
      'revision_requested_at', now()
    )
  );

  UPDATE public.review_drafts SET status = 'withdrawn', updated_at = now()
   WHERE linked_subject_id = _subject_id AND status <> 'withdrawn';

  INSERT INTO public.review_drafts (subject_kind, submitter_id, title, description, external_ref,
                                    payload, status, linked_subject_id)
  VALUES ('module', v_subject.submitted_by, v_module.title, v_subject.description, v_subject.external_ref,
          v_payload, 'draft', _subject_id)
  RETURNING id INTO v_draft_id;

  SELECT id INTO v_prev_dec FROM public.review_decisions WHERE subject_id = _subject_id
   ORDER BY created_at DESC, decided_at DESC LIMIT 1;
  INSERT INTO public.review_decisions (subject_id, decided_by, decision, rationale, supersedes_decision_id)
  VALUES (_subject_id, v_uid, 'return_for_revision', v_rationale, v_prev_dec);

  UPDATE public.review_subjects
     SET current_status = 'pending', updated_at = now(),
         metadata = COALESCE(v_subject.metadata, '{}'::jsonb) || jsonb_build_object(
           'review_status', 'revision_requested',
           'revision_kind', 'published_module_update',
           'published_module_id', v_module.id,
           'base_version', v_module.version,
           'active_revision_draft_id', v_draft_id,
           'last_decision', 'return_for_revision',
           'last_rationale', v_rationale,
           'revision_requested_by', v_uid,
           'revision_requested_at', now(),
           'revised_at', now(),
           'resubmitted_at', NULL)
   WHERE id = _subject_id;

  PERFORM public.log_governance_event(
    'returned_for_revision', v_uid, _subject_id, 'review_draft', v_draft_id::text,
    jsonb_build_object('module_id', v_module.id, 'published_version', v_module.version,
                       'module_status', v_module.current_status),
    jsonb_build_object('draft_id', v_draft_id, 'review_status', 'revision_requested',
                       'rationale', v_rationale, 'published_module_unchanged', true));

  RETURN v_draft_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_published_module_revision(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_published_module_revision(uuid, text) TO authenticated;
