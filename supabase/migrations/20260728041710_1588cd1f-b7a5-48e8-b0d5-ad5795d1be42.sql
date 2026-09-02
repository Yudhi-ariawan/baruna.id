
CREATE OR REPLACE FUNCTION public.submit_draft_for_review(_draft_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  v_hash := encode(extensions.digest(
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
  VALUES (v_subject_id, v_draft.id, v_next_rev,
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
END; $function$;
