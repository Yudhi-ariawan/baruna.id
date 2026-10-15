-- Trainer pipeline hardening, part 2 (follow-up to 20261015020000).
-- BARUNA is used by many people at once from different devices, so every write
-- below is idempotent, serialised per user where it matters, and fails loudly.
--
-- 1. Rejecting / returning a revision of a LIVE module keeps the live version
--    published (admin_module_decide), matching request_published_module_revision.
-- 2. Level quota counts modules waiting in the review queue, not only approved ones.
-- 3. trainer_module_save: the whole trainer save/submit (create, update, submit,
--    review metadata) is one transaction.
-- 4. trainer_portal_bootstrap is bounded and returns the quota.
-- 5. trainer_status_backfill_self replaces the side-effecting provisioning that
--    ran on every portal GET; UNIQUE(expert_id, version) stops duplicate versions.
-- 6. Repairs subjects whose review_status was left at 'resubmitted'/'pending'
--    after they had already been approved.

-- ------------------------------------------------------------- quota
CREATE OR REPLACE FUNCTION public._trainer_module_quota(_uid uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_expert uuid; v_level text; v_live integer; v_queued integer;
BEGIN
  v_expert := public._active_trainer_expert_id(_uid);
  SELECT ts.trainer_level::text INTO v_level FROM public.expert_trainer_status ts
   WHERE ts.expert_id = v_expert AND ts.effective_from <= now()
     AND (ts.expires_at IS NULL OR ts.expires_at > now())
   ORDER BY ts.version DESC, ts.granted_at DESC LIMIT 1;
  SELECT count(*) INTO v_live FROM public.module_registry m
   WHERE m.current_status IN ('approved', 'published')
     AND (m.author_expert_id = v_expert OR m.original_contributor_id = _uid OR m.created_by = _uid);
  -- New modules waiting for a decision (revisions of a registry module are not new).
  SELECT count(*) INTO v_queued FROM public.review_subjects s
   WHERE s.kind = 'module' AND s.submitted_by = _uid
     AND s.current_status IN ('pending', 'under_review', 'decision_pending')
     AND NOT EXISTS (SELECT 1 FROM public.module_registry m WHERE m.source_submission_id = s.id);
  RETURN jsonb_build_object('limit', public._module_level_limit(v_level), 'used', v_live + v_queued,
                            'live', v_live, 'queued', v_queued, 'level', COALESCE(v_level, 'not_assigned'));
END $$;

CREATE OR REPLACE FUNCTION public.module_draft_create(
  _title text,
  _module_type module_type_v1 DEFAULT 'other',
  _source_type text DEFAULT 'external_submission'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid(); v_draft_id uuid; v_src source_type_v1;
  v_expert uuid; v_quota jsonb;
BEGIN
  v_expert := public._module_trainer_gate(v_uid);
  IF _title IS NULL OR length(trim(_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;
  IF _source_type IS DISTINCT FROM 'external_submission' THEN RAISE EXCEPTION 'invalid_source_type'; END IF;
  v_src := _source_type::source_type_v1;

  -- Serialise concurrent creates by the same trainer so the quota cannot be raced.
  PERFORM pg_advisory_xact_lock(hashtextextended('module_draft_create:' || v_uid::text, 0));

  v_quota := public._trainer_module_quota(v_uid);
  IF (v_quota->>'used')::int >= (v_quota->>'limit')::int THEN
    RAISE EXCEPTION 'module_level_limit: %', v_quota->>'limit';
  END IF;

  INSERT INTO public.review_drafts (submitter_id, subject_kind, title, payload)
  VALUES (v_uid, 'module', _title,
          jsonb_build_object('source_type', v_src, 'module_type', _module_type, 'title', _title))
  RETURNING id INTO v_draft_id;

  PERFORM public.emit_platform_event(
    'draft_created'::platform_event_type_v1,
    v_uid, v_draft_id, 'module', v_draft_id::text, 'module_registry',
    v_src, v_draft_id, NULL, NULL,
    jsonb_build_object('title', _title, 'module_type', _module_type));
  RETURN v_draft_id;
END $$;

-- ------------------------------------------------------------- one-transaction save
CREATE OR REPLACE FUNCTION public.trainer_module_save(
  _draft_id uuid, _title text, _module_type text, _payload jsonb, _submit boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_draft uuid := _draft_id;
  v_row public.review_drafts%ROWTYPE;
  v_active uuid;
  v_subject uuid;
  v_meta jsonb;
  v_revised boolean;
BEGIN
  PERFORM public._module_trainer_gate(v_uid);
  IF jsonb_typeof(_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_payload'; END IF;
  IF octet_length(_payload::text) > 1048576 THEN RAISE EXCEPTION 'payload_too_large'; END IF;
  IF char_length(btrim(COALESCE(_title, ''))) NOT BETWEEN 3 AND 240 THEN RAISE EXCEPTION 'title_required'; END IF;
  IF NOT (COALESCE(_module_type, '') = ANY (enum_range(NULL::module_type_v1)::text[])) THEN
    RAISE EXCEPTION 'invalid_module_type';
  END IF;

  -- One save per trainer at a time (double-clicks, two tabs, two devices).
  PERFORM pg_advisory_xact_lock(hashtextextended('trainer_module_save:' || v_uid::text, 0));

  IF v_draft IS NULL THEN
    v_draft := public.module_draft_create(btrim(_title), _module_type::module_type_v1, 'external_submission');
  END IF;

  SELECT * INTO v_row FROM public.review_drafts WHERE id = v_draft;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF v_row.submitter_id <> v_uid OR v_row.subject_kind <> 'module' THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF v_row.status = 'withdrawn' AND v_row.linked_subject_id IS NOT NULL THEN
    -- An old link to a superseded branch: continue on the active revision draft.
    SELECT id INTO v_active FROM public.review_drafts
     WHERE linked_subject_id = v_row.linked_subject_id AND submitter_id = v_uid AND status = 'draft'
     ORDER BY updated_at DESC LIMIT 1;
    IF v_active IS NOT NULL THEN v_draft := v_active; END IF;
  ELSIF _submit AND v_row.status = 'submitted' AND v_row.linked_subject_id IS NOT NULL THEN
    -- Replayed submit: already done, nothing to change.
    RETURN jsonb_build_object('draftId', v_draft, 'subjectId', v_row.linked_subject_id,
                              'status', 'submitted', 'alreadySubmitted', true);
  END IF;

  PERFORM public.module_draft_update(v_draft,
    CASE WHEN _submit THEN _payload || jsonb_build_object('last_submitted_at', now()) ELSE _payload END);
  IF NOT _submit THEN
    RETURN jsonb_build_object('draftId', v_draft, 'subjectId', NULL, 'status', 'draft', 'alreadySubmitted', false);
  END IF;

  v_subject := public.module_draft_submit(v_draft);
  IF v_subject IS NULL THEN RAISE EXCEPTION 'module_submission_subject_missing'; END IF;

  -- Review queue metadata is written in the same transaction as the submission.
  SELECT COALESCE(metadata, '{}'::jsonb) INTO v_meta FROM public.review_subjects WHERE id = v_subject FOR UPDATE;
  v_revised := v_meta->>'review_status' = 'revision_requested' OR jsonb_typeof(v_meta->'last_rationale') = 'string';
  UPDATE public.review_subjects
     SET title = btrim(_title), current_status = 'pending', updated_at = now(),
         metadata = v_meta || jsonb_build_object('review_status', CASE WHEN v_revised THEN 'resubmitted' ELSE 'pending' END)
                   || CASE WHEN v_revised THEN jsonb_build_object('resubmitted_at', now()) ELSE '{}'::jsonb END
   WHERE id = v_subject;

  RETURN jsonb_build_object('draftId', v_draft, 'subjectId', v_subject, 'status', 'submitted', 'alreadySubmitted', false);
END $$;

-- ------------------------------------------------------------- live revisions
CREATE OR REPLACE FUNCTION public.admin_module_decide(
  _subject_id uuid, _decision text, _rationale text DEFAULT NULL, _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub public.review_subjects%ROWTYPE;
  v_meta jsonb; v_review text; v_archived boolean; v_awaiting boolean;
  v_last_rev timestamptz; v_last_dec timestamptz;
  v_rationale text := NULLIF(btrim(COALESCE(_rationale, '')), '');
  v_prev_dec uuid; v_dec_id uuid; v_module uuid; v_target text; v_registry public.module_registry%ROWTYPE;
  v_live uuid;
BEGIN
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _decision NOT IN ('approve', 'reject', 'return_for_revision', 'archive', 'restore') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;
  IF char_length(COALESCE(v_rationale, '')) > 5000 THEN RAISE EXCEPTION 'rationale_too_long'; END IF;
  IF _decision IN ('reject', 'return_for_revision') AND v_rationale IS NULL THEN
    RAISE EXCEPTION 'rationale_required';
  END IF;

  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id FOR UPDATE;
  IF v_sub.id IS NULL OR v_sub.kind <> 'module' THEN RAISE EXCEPTION 'module_subject_not_found'; END IF;
  IF v_sub.submitted_by = v_uid THEN RAISE EXCEPTION 'self_decision_forbidden'; END IF;
  IF _expected_updated_at IS NOT NULL AND v_sub.updated_at <> _expected_updated_at THEN
    RAISE EXCEPTION 'stale_subject';
  END IF;

  v_meta := COALESCE(v_sub.metadata, '{}'::jsonb);
  v_review := v_meta->>'review_status';
  v_archived := v_sub.current_status = 'withdrawn' OR v_review = 'archived';
  SELECT max(submitted_at) INTO v_last_rev FROM public.review_subject_revisions WHERE subject_id = _subject_id;
  SELECT max(decided_at) INTO v_last_dec FROM public.review_decisions WHERE subject_id = _subject_id;
  -- A decision is due when a revision was submitted after the last decision.
  v_awaiting := NOT v_archived AND (
    (v_last_rev IS NOT NULL AND (v_last_dec IS NULL OR v_last_rev > v_last_dec))
    OR (v_last_rev IS NULL AND v_sub.current_status IN ('pending', 'under_review', 'decision_pending')));
  SELECT id INTO v_prev_dec FROM public.review_decisions WHERE subject_id = _subject_id
   ORDER BY created_at DESC, decided_at DESC LIMIT 1;
  -- A module that is live stays live while a revision of it is reviewed
  -- (same rule as request_published_module_revision).
  SELECT id INTO v_live FROM public.module_registry
   WHERE source_submission_id = _subject_id AND current_status = 'published' AND visibility = 'public' LIMIT 1;

  IF _decision = 'approve' THEN
    IF v_archived THEN RAISE EXCEPTION 'module_archived'; END IF;
    IF NOT v_awaiting THEN
      IF v_sub.current_status <> 'approved' THEN
        RAISE EXCEPTION 'invalid_transition: menunggu revisi dari trainer (status %)', COALESCE(v_review, v_sub.current_status);
      END IF;
      -- Repeated approve: no new decision; make sure the module is actually live.
      SELECT id INTO v_module FROM public.module_registry
       WHERE source_submission_id = _subject_id AND current_status = 'published' LIMIT 1;
      IF v_module IS NULL THEN
        SELECT id INTO v_dec_id FROM public.review_decisions
         WHERE subject_id = _subject_id AND decision = 'approve' ORDER BY created_at DESC LIMIT 1;
        v_module := public._publish_module_from_subject(_subject_id, v_dec_id, v_uid);
      END IF;
      RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'status', 'approved',
                                'changed', false, 'moduleId', v_module, 'project', true);
    END IF;

    INSERT INTO public.review_decisions (subject_id, decided_by, decision, rationale, supersedes_decision_id)
    VALUES (_subject_id, v_uid, 'approve', COALESCE(v_rationale, 'Modul disetujui & dipublikasikan.'), v_prev_dec)
    RETURNING id INTO v_dec_id;
    UPDATE public.review_subjects SET current_status = 'approved', updated_at = now(),
      metadata = v_meta || jsonb_build_object('review_status', 'approved', 'last_decision', 'approve',
        'last_rationale', COALESCE(v_rationale, 'Modul disetujui & dipublikasikan.'), 'approved_at', now(),
        'resubmitted_at', NULL, 'archived_at', NULL)
     WHERE id = _subject_id;
    UPDATE public.review_drafts SET status = 'submitted', updated_at = now()
     WHERE linked_subject_id = _subject_id AND status <> 'withdrawn';
    v_module := public._publish_module_from_subject(_subject_id, v_dec_id, v_uid);
    RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'decisionId', v_dec_id,
                              'status', 'approved', 'changed', true, 'moduleId', v_module, 'project', true);

  ELSIF _decision = 'reject' THEN
    IF v_archived THEN RAISE EXCEPTION 'module_archived'; END IF;
    IF NOT v_awaiting THEN
      IF v_sub.current_status = 'rejected' THEN
        RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'status', 'rejected', 'changed', false);
      END IF;
      RAISE EXCEPTION 'invalid_transition: tidak ada pengajuan yang menunggu keputusan (status %)', COALESCE(v_review, v_sub.current_status);
    END IF;
    INSERT INTO public.review_decisions (subject_id, decided_by, decision, rationale, supersedes_decision_id)
    VALUES (_subject_id, v_uid, 'reject', v_rationale, v_prev_dec) RETURNING id INTO v_dec_id;
    IF v_live IS NOT NULL THEN
      -- Rejecting a revision of a live module: the approved version stays published.
      UPDATE public.review_subjects SET current_status = 'approved', updated_at = now(),
        metadata = v_meta || jsonb_build_object('review_status', 'approved', 'last_decision', 'reject',
          'last_rationale', v_rationale, 'revision_rejected_at', now(), 'resubmitted_at', NULL)
       WHERE id = _subject_id;
      RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'decisionId', v_dec_id,
                                'status', 'approved', 'changed', true, 'liveVersionKept', true);
    END IF;
    UPDATE public.review_subjects SET current_status = 'rejected', updated_at = now(),
      metadata = v_meta || jsonb_build_object('review_status', 'rejected', 'last_decision', 'reject',
        'last_rationale', v_rationale, 'rejected_at', now())
     WHERE id = _subject_id;
    PERFORM public._archive_module_outputs(_subject_id);
    RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'decisionId', v_dec_id,
                              'status', 'rejected', 'changed', true);

  ELSIF _decision = 'return_for_revision' THEN
    IF v_archived THEN RAISE EXCEPTION 'module_archived'; END IF;
    IF NOT (v_awaiting OR v_sub.current_status = 'approved') THEN
      IF v_review = 'revision_requested' THEN
        RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'status', 'pending', 'changed', false);
      END IF;
      RAISE EXCEPTION 'invalid_transition: tidak ada pengajuan yang dapat dikembalikan (status %)', COALESCE(v_review, v_sub.current_status);
    END IF;
    INSERT INTO public.review_decisions (subject_id, decided_by, decision, rationale, supersedes_decision_id)
    VALUES (_subject_id, v_uid, 'return_for_revision', v_rationale, v_prev_dec) RETURNING id INTO v_dec_id;
    UPDATE public.review_subjects SET current_status = 'pending', updated_at = now(),
      metadata = v_meta || jsonb_build_object('review_status', 'revision_requested', 'last_decision', 'return_for_revision',
        'last_rationale', v_rationale, 'revised_at', now(), 'resubmitted_at', NULL)
        || CASE WHEN v_live IS NOT NULL THEN jsonb_build_object('revision_kind', 'published_module_update',
             'published_module_id', v_live) ELSE '{}'::jsonb END
     WHERE id = _subject_id;
    UPDATE public.review_drafts SET status = 'draft', updated_at = now()
     WHERE id = (SELECT d.id FROM public.review_drafts d
                  WHERE d.linked_subject_id = _subject_id AND d.status <> 'withdrawn'
                  ORDER BY d.updated_at DESC LIMIT 1);
    IF v_live IS NULL THEN
      PERFORM public._archive_module_outputs(_subject_id);
    END IF;
    RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'decisionId', v_dec_id,
                              'status', 'pending', 'changed', true, 'liveVersionKept', v_live IS NOT NULL);

  ELSIF _decision = 'archive' THEN
    IF v_archived THEN
      RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'status', 'withdrawn', 'changed', false);
    END IF;
    UPDATE public.review_subjects SET current_status = 'withdrawn', updated_at = now(),
      metadata = v_meta || jsonb_build_object('review_status', 'archived', 'last_decision', 'archive',
        'last_rationale', COALESCE(v_rationale, 'Modul diarsipkan dan ditarik dari tayang publik.'),
        'archived_at', now(), 'archived_from_status', v_sub.current_status,
        'archived_from_review_status', v_review)
     WHERE id = _subject_id;
    PERFORM public._archive_module_outputs(_subject_id);
    PERFORM public.log_governance_event('module_archived', v_uid, _subject_id, 'module_registry', _subject_id::text,
      jsonb_build_object('status', v_sub.current_status, 'review_status', v_review),
      jsonb_build_object('status', 'archived', 'rationale', v_rationale));
    RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'status', 'withdrawn', 'changed', true);

  ELSE -- restore
    IF NOT v_archived THEN RAISE EXCEPTION 'module_not_archived'; END IF;
    SELECT * INTO v_registry FROM public.module_registry
     WHERE source_submission_id = _subject_id ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
    IF v_registry.current_status = 'revoked' THEN RAISE EXCEPTION 'module_revoked'; END IF;

    -- Return to the state the module had before archiving. Older archives did not
    -- record it: a module that reached the registry was live; anything else goes
    -- back to the review queue instead of being published unreviewed.
    v_target := COALESCE(v_meta->>'archived_from_status', CASE WHEN v_registry.id IS NOT NULL THEN 'approved' ELSE 'pending' END);
    IF v_target NOT IN ('pending', 'under_review', 'decision_pending', 'approved', 'rejected') THEN v_target := 'pending'; END IF;
    IF v_target = 'approved' THEN
      IF v_registry.id IS NOT NULL THEN
        UPDATE public.module_registry SET current_status = 'published', visibility = 'public', updated_at = now()
         WHERE id = v_registry.id;
        v_module := v_registry.id;
      ELSE
        SELECT id INTO v_dec_id FROM public.review_decisions
         WHERE subject_id = _subject_id AND decision = 'approve' ORDER BY created_at DESC LIMIT 1;
        IF v_dec_id IS NULL THEN
          v_target := 'pending';
        ELSE
          v_module := public._publish_module_from_subject(_subject_id, v_dec_id, v_uid);
        END IF;
      END IF;
    END IF;

    UPDATE public.review_subjects SET current_status = v_target, updated_at = now(),
      metadata = (v_meta - 'archived_from_status' - 'archived_from_review_status') || jsonb_build_object(
        'review_status', COALESCE(v_meta->>'archived_from_review_status',
                                  CASE v_target WHEN 'approved' THEN 'approved' WHEN 'rejected' THEN 'rejected' ELSE 'pending' END),
        'last_decision', 'restore',
        'last_rationale', COALESCE(v_rationale, 'Modul dipulihkan dari arsip.'),
        'restored_at', now(), 'archived_at', NULL)
     WHERE id = _subject_id;
    PERFORM public.log_governance_event('module_restored', v_uid, _subject_id, 'module_registry', _subject_id::text,
      jsonb_build_object('status', 'withdrawn'), jsonb_build_object('status', v_target, 'rationale', v_rationale));
    RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'status', v_target,
                              'changed', true, 'moduleId', v_module, 'project', v_module IS NOT NULL);
  END IF;
END $$;

-- ------------------------------------------------------------- bounded bootstrap
CREATE OR REPLACE FUNCTION public.trainer_portal_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid(); v_expert public.experts%ROWTYPE; v_status public.expert_trainer_status%ROWTYPE;
  v_has_expert_role boolean := false; v_modules jsonb := '[]'; v_history jsonb := '[]';
  v_drafts jsonb := '[]'; v_certificates jsonb := '[]'; v_rules jsonb := '[]';
  v_countries jsonb := '[]'; v_organization text; v_training_roles jsonb := '[]';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.id=ur.role_id
    WHERE ur.user_id=v_uid AND r.code='expert' AND COALESCE(ur.status,'active')='active'
      AND COALESCE(ur.valid_from,ur.created_at)<=now() AND (ur.valid_until IS NULL OR ur.valid_until>now())) INTO v_has_expert_role;
  SELECT * INTO v_expert FROM public.experts e WHERE e.original_contributor_id=v_uid OR e.created_by=v_uid
    ORDER BY (e.current_status='published') DESC,e.updated_at DESC LIMIT 1;
  IF NOT v_has_expert_role OR v_expert.id IS NULL THEN RETURN jsonb_build_object('access','registered_user'); END IF;
  SELECT * INTO v_status FROM public.expert_trainer_status s WHERE s.expert_id=v_expert.id
    AND s.effective_from<=now() AND (s.expires_at IS NULL OR s.expires_at>now())
    ORDER BY s.version DESC,s.granted_at DESC LIMIT 1;
  IF v_status.id IS NULL OR v_status.trainer_status<>'active' THEN
    RETURN jsonb_build_object('access','expert_non_trainer','expertName',v_expert.display_name,
      'trainerStatus',COALESCE(v_status.trainer_status::text,'not_applied'));
  END IF;
  SELECT ee.organization INTO v_organization FROM public.expert_employment ee WHERE ee.expert_id=v_expert.id
    ORDER BY ee.is_current DESC,ee.updated_at DESC LIMIT 1;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'summary',m.summary,
    'status',m.current_status,'hours',m.estimated_learning_hours,'version',m.version,'language',m.language,
    'moduleType',m.module_type,'targetParticipants',m.target_participants,'updatedAt',m.updated_at)
    ORDER BY m.updated_at DESC),'[]') INTO v_modules FROM public.module_registry m WHERE m.author_expert_id=v_expert.id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',h.id,'title',h.activity_title,'organizer',h.organizer,
    'role',h.role,'startDate',h.start_date,'endDate',h.end_date,'participants',h.participant_count,
    'country',h.country) ORDER BY h.start_date DESC NULLS LAST),'[]') INTO v_history
    FROM public.expert_training_facilitation_history h WHERE h.expert_id=v_expert.id;
  -- Bounded: newest 100 drafts, newest 20 review events each. Withdrawn branches
  -- only carry their attachment lists (used to resolve old draft links and to
  -- inherit files), not the full payload.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'status',d.status,
    'subjectId',d.linked_subject_id,'reviewStatus',s.current_status,
    'payload',CASE WHEN d.status='withdrawn' THEN jsonb_strip_nulls(jsonb_build_object(
        'documents',d.payload->'documents','attachments',d.payload->'attachments',
        'metadata',jsonb_strip_nulls(jsonb_build_object('attached_resources',d.payload->'metadata'->'attached_resources'))))
      ELSE d.payload END,
    'createdAt',d.created_at,'updatedAt',d.updated_at,
    'reviewHistory',COALESCE((SELECT jsonb_agg(item ORDER BY item->>'at' DESC) FROM (
      SELECT item FROM (
        SELECT jsonb_build_object('kind','review','at',rr.submitted_at,'actor',COALESCE(p.display_name,'BARUNA Reviewer'),
          'decision',rr.recommendation,'comment',rr.rationale) item FROM public.review_records rr
          LEFT JOIN public.profiles p ON p.id=rr.reviewer_id WHERE rr.subject_id=s.id AND rr.status='submitted'
        UNION ALL
        SELECT jsonb_build_object('kind','decision','at',rd.decided_at,'actor',COALESCE(p.display_name,'BARUNA Approver'),
          'decision',rd.decision,'comment',rd.rationale) item FROM public.review_decisions rd
          LEFT JOIN public.profiles p ON p.id=rd.decided_by WHERE rd.subject_id=s.id
      ) all_events ORDER BY item->>'at' DESC LIMIT 20
    ) events),'[]'::jsonb)) ORDER BY d.updated_at DESC),'[]') INTO v_drafts
    FROM (SELECT * FROM public.review_drafts WHERE submitter_id=v_uid AND subject_kind='module'
          ORDER BY updated_at DESC LIMIT 100) d
    LEFT JOIN public.review_subjects s ON s.id=d.linked_subject_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'type',c.certificate_type,'title',c.title,
    'subtitle',c.subtitle,'number',c.certificate_number,'issueDate',c.issue_date,
    'documentUrl',c.document_url,'metadata',c.metadata) ORDER BY c.issue_date DESC),'[]') INTO v_certificates
    FROM public.expert_trainer_certificates c WHERE c.expert_id=v_expert.id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('level',r.trainer_level,'minimumParticipants',r.min_unique_graduated_participants,
    'evidenceRequirements',r.evidence_requirements) ORDER BY r.min_unique_graduated_participants),'[]') INTO v_rules
    FROM public.trainer_level_rules r WHERE r.effective_from<=now() AND (r.effective_until IS NULL OR r.effective_until>now());
  SELECT COALESCE(jsonb_agg(jsonb_build_object('country',country,'participants',participants) ORDER BY participants DESC),'[]') INTO v_countries
    FROM (SELECT COALESCE(h.country,'Unspecified') country,SUM(COALESCE(h.participant_count,0))::int participants
      FROM public.expert_training_facilitation_history h WHERE h.expert_id=v_expert.id GROUP BY COALESCE(h.country,'Unspecified')) x;
  SELECT COALESCE(jsonb_agg(role ORDER BY role),'[]') INTO v_training_roles FROM (
    SELECT DISTINCT h.role FROM public.expert_training_facilitation_history h
    WHERE h.expert_id=v_expert.id AND h.role IS NOT NULL AND trim(h.role)<>''
  ) roles;
  RETURN jsonb_build_object('access','active_trainer','trainer',jsonb_build_object(
    'expertId',v_expert.id,'fullName',v_expert.display_name,'title',v_expert.headline,'organization',v_organization,
    'country',v_expert.country,'expertiseAreas',v_expert.expertise_areas,'languages',v_expert.languages,
    'trainingRoles',v_training_roles,'level',v_status.trainer_level,'status',v_status.trainer_status,
    'approvedAt',v_status.granted_at,'uniqueSuccessfulParticipants',v_status.unique_graduated_participants),
    'modules',v_modules,'history',v_history,'moduleDrafts',v_drafts,'certificates',v_certificates,
    'moduleQuota',public._trainer_module_quota(v_uid),
    'recognitionRules',v_rules,'analytics',jsonb_build_object('countries',v_countries,
      'completionRate',NULL,'averageRating',NULL,'hasUnresolvedComplaint',NULL));
END $$;

-- ------------------------------------------------------------- trainer status backfill
-- Unique version per expert: concurrent writers now fail loudly instead of
-- creating two "version 1" rows. Skipped (with a notice) if duplicates exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.expert_trainer_status GROUP BY expert_id, version HAVING count(*) > 1) THEN
    RAISE NOTICE 'expert_trainer_status has duplicate (expert_id, version) rows; unique index not created';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS expert_trainer_status_expert_version_uidx
      ON public.expert_trainer_status (expert_id, version);
  END IF;
END $$;

-- Legacy published experts created before trainer status existed get their first
-- status row once. Never re-activates: any existing row (even inactive) wins.
CREATE OR REPLACE FUNCTION public.trainer_status_backfill_self()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_expert public.experts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('trainer_status_backfill:' || v_uid::text, 0));
  SELECT * INTO v_expert FROM public.experts e
   WHERE (e.original_contributor_id = v_uid OR e.created_by = v_uid) AND e.current_status = 'published'
   ORDER BY e.updated_at DESC LIMIT 1;
  IF v_expert.id IS NULL OR NOT public.has_rbac_role(v_uid, 'expert') THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.expert_trainer_status WHERE expert_id = v_expert.id) THEN RETURN false; END IF;
  INSERT INTO public.expert_trainer_status (expert_id, trainer_status, trainer_level, unique_graduated_participants,
                                            granted_by, granted_at, effective_from, rationale, version)
  VALUES (v_expert.id, 'active', 'certified', 0, v_expert.approved_by, now(), now(), 'legacy_backfill', 1);
  RETURN true;
END $$;

-- ------------------------------------------------------------- data repair
-- Approved after the last submission, but the review label still says
-- resubmitted/pending (left by the old non-transactional save).
UPDATE public.review_subjects s
   SET metadata = s.metadata || jsonb_build_object('review_status', 'approved', 'resubmitted_at', NULL)
 WHERE s.kind = 'module' AND s.current_status = 'approved'
   AND s.metadata->>'review_status' IN ('resubmitted', 'pending')
   AND (SELECT d.decision FROM public.review_decisions d WHERE d.subject_id = s.id
         ORDER BY d.decided_at DESC LIMIT 1) = 'approve'
   AND COALESCE((SELECT max(r.submitted_at) FROM public.review_subject_revisions r WHERE r.subject_id = s.id), '-infinity')
       <= (SELECT max(d.decided_at) FROM public.review_decisions d WHERE d.subject_id = s.id AND d.decision = 'approve');

REVOKE ALL ON FUNCTION public._trainer_module_quota(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trainer_module_save(uuid, text, text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trainer_module_save(uuid, text, text, jsonb, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.trainer_status_backfill_self() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trainer_status_backfill_self() TO authenticated;
REVOKE ALL ON FUNCTION public.module_draft_create(text, module_type_v1, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.module_draft_create(text, module_type_v1, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_module_decide(uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_module_decide(uuid, text, text, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.trainer_portal_bootstrap() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trainer_portal_bootstrap() TO authenticated;
