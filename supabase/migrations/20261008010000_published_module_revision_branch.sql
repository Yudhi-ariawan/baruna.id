-- Safely branch an editable trainer revision from an already-published module.
-- The canonical module and its Knowledge Hub projection remain published until
-- the branched revision completes governance approval.

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
  v_latest_payload jsonb := '{}'::jsonb;
  v_payload jsonb;
  v_subject_meta jsonb;
  v_draft_id uuid;
  v_decision_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF COALESCE(length(trim(_rationale)), 0) < 5 THEN
    RAISE EXCEPTION 'revision_rationale_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.rbac_user_roles ur
    JOIN public.rbac_roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_uid
      AND r.code IN ('super_admin', 'admin')
      AND COALESCE(ur.status, 'active') = 'active'
      AND COALESCE(ur.valid_from, ur.created_at) <= now()
      AND (ur.valid_until IS NULL OR ur.valid_until > now())
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_subject
  FROM public.review_subjects
  WHERE id = _subject_id AND kind = 'module'
  FOR UPDATE;
  IF v_subject.id IS NULL THEN RAISE EXCEPTION 'module_subject_not_found'; END IF;

  SELECT * INTO v_module
  FROM public.module_registry
  WHERE source_submission_id = _subject_id
    AND current_status = 'published'
    AND visibility = 'public'
  FOR UPDATE;
  IF v_module.id IS NULL THEN RAISE EXCEPTION 'published_module_not_found'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.review_drafts
    WHERE linked_subject_id = _subject_id AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'published_revision_already_open';
  END IF;

  SELECT payload INTO v_latest_payload
  FROM public.review_drafts
  WHERE linked_subject_id = _subject_id
  ORDER BY updated_at DESC
  LIMIT 1;

  v_latest_payload := COALESCE(v_latest_payload, '{}'::jsonb);
  v_payload := v_latest_payload || jsonb_build_object(
    'title', v_module.title,
    'summary', v_module.summary,
    'language', v_module.language,
    'module_type', v_module.module_type,
    'target_participants', v_module.target_participants,
    'estimated_learning_hours', v_module.estimated_learning_hours,
    'learning_objectives', COALESCE(to_jsonb(v_module.learning_objectives), '[]'::jsonb),
    'content_outline', COALESCE(v_module.content_outline, '{}'::jsonb),
    'assessment_approach', COALESCE(v_module.assessment_approach, '{}'::jsonb),
    'metadata', COALESCE(v_latest_payload->'metadata', '{}'::jsonb)
      || COALESCE(v_module.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'revision_kind', 'published_module_update',
        'published_module_id', v_module.id,
        'base_version', v_module.version,
        'revision_rationale', trim(_rationale),
        'revision_requested_by', v_uid,
        'revision_requested_at', now()
      )
  );

  -- Retain old submissions as immutable history and create a fresh editable branch.
  UPDATE public.review_drafts
  SET status = 'withdrawn', updated_at = now()
  WHERE linked_subject_id = _subject_id AND status <> 'withdrawn';

  INSERT INTO public.review_drafts (
    subject_kind, submitter_id, title, description, external_ref,
    payload, status, linked_subject_id
  ) VALUES (
    'module', v_subject.submitted_by, v_module.title, v_subject.description,
    v_subject.external_ref, v_payload, 'draft', _subject_id
  ) RETURNING id INTO v_draft_id;

  INSERT INTO public.review_decisions (
    subject_id, decided_by, decision, rationale
  ) VALUES (
    _subject_id, v_uid, 'return_for_revision', trim(_rationale)
  ) RETURNING id INTO v_decision_id;

  v_subject_meta := COALESCE(v_subject.metadata, '{}'::jsonb);
  UPDATE public.review_subjects
  SET current_status = 'pending',
      metadata = v_subject_meta || jsonb_build_object(
        'review_status', 'revision_requested',
        'revision_kind', 'published_module_update',
        'published_module_id', v_module.id,
        'base_version', v_module.version,
        'active_revision_draft_id', v_draft_id,
        'last_decision', 'return_for_revision',
        'last_rationale', trim(_rationale),
        'revision_requested_by', v_uid,
        'revision_requested_at', now()
      ),
      updated_at = now()
  WHERE id = _subject_id;

  PERFORM public.log_governance_event(
    'returned_for_revision', v_uid, _subject_id, 'review_draft', v_draft_id::text,
    jsonb_build_object(
      'module_id', v_module.id,
      'published_version', v_module.version,
      'module_status', v_module.current_status
    ),
    jsonb_build_object(
      'draft_id', v_draft_id,
      'review_status', 'revision_requested',
      'rationale', trim(_rationale),
      'published_module_unchanged', true
    )
  );

  RETURN v_draft_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_published_module_revision(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_published_module_revision(uuid, text) TO authenticated;

