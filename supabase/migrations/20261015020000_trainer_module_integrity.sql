-- Trainer module pipeline integrity (Slide 41 Experts -> Academy, PB-ACA-01).
--
-- 1. module_draft_create/update/submit enforce the same gates as the server
--    function (active trainer, level quota, own attachments). They are granted
--    to every authenticated user, so before this a registered user could submit
--    modules straight from the browser SDK.
-- 2. admin_module_decide: one transaction per decision (subject, decision row,
--    drafts, module_registry, knowledge_resources), a state guard, a row lock and
--    an optional optimistic lock. Restore never publishes a never-approved module.
-- 3. review_decisions accepts the official decision roles (super_admin, admin,
--    approver). The legacy trigger only knew the old public.user_roles 'admin'.
-- 4. Quiz answer keys never reach the publicly readable module_registry: a
--    trigger moves them into module_quiz_answer_keys (service role only), on
--    every write path. Grading happens server-side.

-- ------------------------------------------------------------- 1. trainer gate
CREATE OR REPLACE FUNCTION public._module_trainer_gate(_uid uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_expert uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  v_expert := public._active_trainer_expert_id(_uid);
  IF v_expert IS NULL THEN RAISE EXCEPTION 'active_trainer_required' USING ERRCODE = '42501'; END IF;
  RETURN v_expert;
END $$;

-- Mirrors LEVEL_MODULE_LIMIT in src/lib/trainerModules.ts.
CREATE OR REPLACE FUNCTION public._module_level_limit(_level text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _level WHEN 'certified' THEN 2 WHEN 'advanced' THEN 5 WHEN 'senior' THEN 10
                     WHEN 'master' THEN 999 ELSE 0 END
$$;

-- Same rule as assertModuleAttachments (module-submission-validation.ts).
CREATE OR REPLACE FUNCTION public._assert_module_attachments(_payload jsonb, _uid uuid, _submit boolean)
RETURNS void LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_list jsonb; v_item jsonb; v_label text; v_path text; v_bucket text; v_size numeric;
BEGIN
  v_list := CASE
    WHEN jsonb_typeof(_payload->'attachments') = 'array' AND jsonb_array_length(_payload->'attachments') > 0 THEN _payload->'attachments'
    WHEN jsonb_typeof(_payload->'documents') = 'array' AND jsonb_array_length(_payload->'documents') > 0 THEN _payload->'documents'
    WHEN jsonb_typeof(_payload->'metadata'->'attached_resources') = 'array' THEN _payload->'metadata'->'attached_resources'
    ELSE '[]'::jsonb END;

  FOR v_item IN SELECT e FROM jsonb_array_elements(v_list) e WHERE jsonb_typeof(e) = 'object' LOOP
    v_label := COALESCE(v_item->>'fileName', v_item->>'name', v_item->>'type', 'lampiran');
    v_path := btrim(COALESCE(v_item->>'path', ''));
    v_size := CASE WHEN COALESCE(v_item->>'fileSize', v_item->>'size', '') ~ '^\d+(\.\d+)?$'
                   THEN COALESCE(v_item->>'fileSize', v_item->>'size')::numeric ELSE 0 END;
    IF v_size > 104857600 THEN RAISE EXCEPTION 'attachment_too_large: %', v_label; END IF;
    IF v_path = '' THEN
      IF _submit THEN RAISE EXCEPTION 'attachment_not_uploaded: %', v_label; END IF;
      CONTINUE;
    END IF;
    CONTINUE WHEN v_path ~* '^https?://';
    v_bucket := COALESCE(NULLIF(v_item->>'bucket', ''), 'module-attachments');
    IF v_bucket NOT IN ('module-attachments', 'expert-applications')
       OR left(v_path, char_length('users/' || _uid::text || '/')) <> 'users/' || _uid::text || '/'
       OR position('..' IN v_path) > 0 THEN
      RAISE EXCEPTION 'attachment_not_owned: %', v_label;
    END IF;
  END LOOP;
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
  v_expert uuid; v_level text; v_active integer;
BEGIN
  v_expert := public._module_trainer_gate(v_uid);
  IF _title IS NULL OR length(trim(_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;
  IF _source_type IS DISTINCT FROM 'external_submission' THEN RAISE EXCEPTION 'invalid_source_type'; END IF;
  v_src := _source_type::source_type_v1;

  -- Serialise concurrent creates by the same trainer so the quota cannot be raced.
  PERFORM pg_advisory_xact_lock(hashtextextended('module_draft_create:' || v_uid::text, 0));

  SELECT ts.trainer_level::text INTO v_level FROM public.expert_trainer_status ts
   WHERE ts.expert_id = v_expert AND ts.effective_from <= now()
     AND (ts.expires_at IS NULL OR ts.expires_at > now())
   ORDER BY ts.version DESC, ts.granted_at DESC LIMIT 1;
  SELECT count(*) INTO v_active FROM public.module_registry m
   WHERE m.current_status IN ('approved', 'published')
     AND (m.author_expert_id = v_expert OR m.original_contributor_id = v_uid OR m.created_by = v_uid);
  IF v_active >= public._module_level_limit(v_level) THEN
    RAISE EXCEPTION 'module_level_limit: %', public._module_level_limit(v_level);
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

CREATE OR REPLACE FUNCTION public.module_draft_update(_draft_id uuid, _patch jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.review_drafts%ROWTYPE;
BEGIN
  PERFORM public._module_trainer_gate(v_uid);
  IF _patch ? 'approved_zero_tariff' THEN
    RAISE EXCEPTION 'approved_zero_tariff not accepted in Phase 1.3';
  END IF;
  SELECT * INTO v_row FROM public.review_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF v_row.submitter_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.subject_kind <> 'module' THEN RAISE EXCEPTION 'wrong_subject_kind'; END IF;
  IF v_row.status <> 'draft' THEN RAISE EXCEPTION 'draft_not_editable'; END IF;
  -- Provenance is set at creation; an invalid value would break publication later.
  IF _patch ? 'source_type' AND (_patch->>'source_type') IS DISTINCT FROM (v_row.payload->>'source_type') THEN
    RAISE EXCEPTION 'source_type_immutable';
  END IF;
  IF _patch ? 'module_type' AND NOT ((_patch->>'module_type') = ANY (enum_range(NULL::module_type_v1)::text[])) THEN
    RAISE EXCEPTION 'invalid_module_type';
  END IF;
  PERFORM public._assert_module_attachments(COALESCE(v_row.payload, '{}'::jsonb) || COALESCE(_patch, '{}'::jsonb), v_uid, false);

  UPDATE public.review_drafts
     SET payload = COALESCE(payload,'{}'::jsonb) || COALESCE(_patch,'{}'::jsonb),
         title = COALESCE(_patch->>'title', title)
   WHERE id = _draft_id;
END $$;

CREATE OR REPLACE FUNCTION public.module_draft_submit(_draft_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.review_drafts%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.review_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF v_row.submitter_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.subject_kind <> 'module' THEN RAISE EXCEPTION 'wrong_subject_kind'; END IF;
  -- A replayed submit (double-click / retry) is resolved by the caller.
  IF v_row.status <> 'draft' THEN RAISE EXCEPTION 'draft_not_editable'; END IF;
  PERFORM public._module_trainer_gate(v_uid);
  PERFORM public._assert_module_attachments(COALESCE(v_row.payload, '{}'::jsonb), v_uid, true);
  RETURN public.submit_draft_for_review(_draft_id);
END $$;

-- ------------------------------------------------------------- 3. decision roles
CREATE OR REPLACE FUNCTION public._can_decide_review(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    public.has_rbac_role(_uid, 'super_admin') OR public.has_rbac_role(_uid, 'admin')
    OR public.has_rbac_role(_uid, 'approver')
    OR public.has_role(_uid, 'admin') OR public.has_role(_uid, 'management'))
$$;

CREATE OR REPLACE FUNCTION public.enforce_review_decision_rules()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public._can_decide_review(NEW.decided_by) THEN
    RAISE EXCEPTION 'decider_role_required';
  END IF;
  RETURN NEW;
END; $$;

-- ------------------------------------------------------------- 4. quiz answer keys
CREATE TABLE IF NOT EXISTS public.module_quiz_answer_keys (
  module_id uuid PRIMARY KEY,
  questions jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.module_quiz_answer_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.module_quiz_answer_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.module_quiz_answer_keys TO service_role;

CREATE OR REPLACE FUNCTION public._quiz_has_keys(_q jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(_q) = 'array' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(_q) e
     WHERE jsonb_typeof(e) = 'object' AND (e ? 'correctAnswer' OR e ? 'correctIndex' OR e ? 'explanation'))
$$;

CREATE OR REPLACE FUNCTION public._quiz_strip(_q jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(_q) <> 'array' THEN _q ELSE (
    SELECT COALESCE(jsonb_agg(CASE WHEN jsonb_typeof(e) = 'object'
                                   THEN e - 'correctAnswer' - 'correctIndex' - 'explanation' ELSE e END
                              ORDER BY ord), '[]'::jsonb)
      FROM jsonb_array_elements(_q) WITH ORDINALITY t(e, ord)) END
$$;

CREATE OR REPLACE FUNCTION public._quiz_keys(_q jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'index', ord - 1, 'id', e->'id',
           'correctAnswer', COALESCE(e->'correctAnswer', e->'correctIndex'),
           'explanation', e->'explanation') ORDER BY ord), '[]'::jsonb)
    FROM jsonb_array_elements(_q) WITH ORDINALITY t(e, ord)
$$;

-- The reader (getPublishedModuleDetail) uses metadata.quiz_questions first and
-- falls back to assessment_approach.quiz_questions; keys follow the same rule.
CREATE OR REPLACE FUNCTION public.module_registry_extract_quiz_keys()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_src jsonb;
BEGIN
  v_src := CASE
    WHEN jsonb_typeof(NEW.metadata->'quiz_questions') = 'array' AND jsonb_array_length(NEW.metadata->'quiz_questions') > 0
      THEN NEW.metadata->'quiz_questions'
    ELSE NEW.assessment_approach->'quiz_questions' END;
  IF public._quiz_has_keys(v_src) THEN
    INSERT INTO public.module_quiz_answer_keys (module_id, questions, updated_at)
    VALUES (NEW.id, public._quiz_keys(v_src), now())
    ON CONFLICT (module_id) DO UPDATE SET questions = EXCLUDED.questions, updated_at = now();
  END IF;
  IF NEW.metadata ? 'quiz_questions' THEN
    NEW.metadata := jsonb_set(NEW.metadata, '{quiz_questions}', public._quiz_strip(NEW.metadata->'quiz_questions'));
  END IF;
  IF NEW.assessment_approach ? 'quiz_questions' THEN
    NEW.assessment_approach := jsonb_set(NEW.assessment_approach, '{quiz_questions}', public._quiz_strip(NEW.assessment_approach->'quiz_questions'));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mr_extract_quiz_keys ON public.module_registry;
CREATE TRIGGER trg_mr_extract_quiz_keys
  BEFORE INSERT OR UPDATE ON public.module_registry
  FOR EACH ROW EXECUTE FUNCTION public.module_registry_extract_quiz_keys();

CREATE OR REPLACE FUNCTION public.module_registry_drop_quiz_keys()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.module_quiz_answer_keys WHERE module_id = OLD.id;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_mr_drop_quiz_keys ON public.module_registry;
CREATE TRIGGER trg_mr_drop_quiz_keys
  AFTER DELETE ON public.module_registry
  FOR EACH ROW EXECUTE FUNCTION public.module_registry_drop_quiz_keys();

-- Move keys out of rows already published (fires the trigger above).
UPDATE public.module_registry
   SET metadata = metadata
 WHERE public._quiz_has_keys(metadata->'quiz_questions')
    OR public._quiz_has_keys(assessment_approach->'quiz_questions');

-- ------------------------------------------------------------- 2. admin decision
-- Publishes the last SUBMITTED revision (what reviewers saw), never an open draft.
CREATE OR REPLACE FUNCTION public._publish_module_from_subject(_subject_id uuid, _decision_id uuid, _actor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub public.review_subjects%ROWTYPE;
  v_payload jsonb; v_expert uuid; v_existing public.module_registry%ROWTYPE;
  v_mt module_type_v1; v_title text; v_objectives text[]; v_hours numeric; v_next integer;
  v_decided_at timestamptz; v_id uuid;
BEGIN
  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id;
  SELECT r.snapshot->'payload' INTO v_payload FROM public.review_subject_revisions r
   WHERE r.subject_id = _subject_id ORDER BY r.revision DESC LIMIT 1;
  IF v_payload IS NULL OR jsonb_typeof(v_payload) <> 'object' OR v_payload = '{}'::jsonb THEN
    SELECT d.payload INTO v_payload FROM public.review_drafts d
     WHERE d.linked_subject_id = _subject_id AND d.status <> 'withdrawn'
     ORDER BY d.updated_at DESC LIMIT 1;
  END IF;
  v_payload := CASE WHEN jsonb_typeof(v_payload) = 'object' THEN v_payload ELSE '{}'::jsonb END;

  -- Prefer the published profile; a stale archived profile must not become the author.
  SELECT e.id INTO v_expert FROM public.experts e
   WHERE e.original_contributor_id = v_sub.submitted_by OR e.created_by = v_sub.submitted_by
   ORDER BY (e.current_status = 'published') DESC, e.updated_at DESC LIMIT 1;

  v_mt := CASE WHEN (v_payload->>'module_type') = ANY (enum_range(NULL::module_type_v1)::text[])
               THEN (v_payload->>'module_type')::module_type_v1 ELSE 'technical' END;
  v_title := COALESCE(NULLIF(btrim(v_payload->>'title'), ''), v_sub.title, 'Untitled Module');
  v_objectives := CASE WHEN jsonb_typeof(v_payload->'learning_objectives') = 'array'
                       THEN ARRAY(SELECT jsonb_array_elements_text(v_payload->'learning_objectives'))
                       ELSE '{}'::text[] END;
  v_hours := CASE WHEN (v_payload->>'estimated_learning_hours') ~ '^\d+(\.\d+)?$'
                  THEN (v_payload->>'estimated_learning_hours')::numeric ELSE 0 END;
  SELECT decided_at INTO v_decided_at FROM public.review_decisions WHERE id = _decision_id;

  SELECT * INTO v_existing FROM public.module_registry
   WHERE source_submission_id = _subject_id ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    v_next := GREATEST(v_existing.version,
      COALESCE((SELECT max(version) FROM public.module_registry_versions WHERE module_id = v_existing.id), 0)) + 1;
    UPDATE public.module_registry SET
      approved_by = _actor, published_by = _actor,
      approval_date = COALESCE(v_decided_at, now()), publication_date = now(),
      verification_status = 'governance_verified', visibility = 'public', current_status = 'published',
      audit_ref = _decision_id, title = v_title,
      summary = CASE WHEN jsonb_typeof(v_payload->'summary') = 'string' THEN v_payload->>'summary' END,
      language = COALESCE(NULLIF(v_payload->>'language', ''), 'English'),
      module_type = v_mt,
      target_participants = CASE WHEN jsonb_typeof(v_payload->'target_participants') = 'string' THEN v_payload->>'target_participants' END,
      estimated_learning_hours = v_hours, learning_objectives = v_objectives,
      content_outline = CASE WHEN jsonb_typeof(v_payload->'content_outline') = 'object' THEN v_payload->'content_outline' ELSE '{}'::jsonb END,
      assessment_approach = CASE WHEN jsonb_typeof(v_payload->'assessment_approach') = 'object' THEN v_payload->'assessment_approach' ELSE '{}'::jsonb END,
      author_expert_id = v_expert,
      metadata = CASE WHEN jsonb_typeof(v_payload->'metadata') = 'object' THEN v_payload->'metadata' ELSE '{}'::jsonb END,
      version = v_next, updated_at = now()
    WHERE id = v_existing.id;
    RETURN v_existing.id;
  END IF;

  INSERT INTO public.module_registry (
    source_type, source_submission_id, original_contributor_id, created_by, approved_by, published_by,
    approval_date, publication_date, verification_status, visibility, current_status, audit_ref,
    title, summary, language, module_type, target_participants, estimated_learning_hours,
    learning_objectives, content_outline, assessment_approach, author_expert_id, metadata
  ) VALUES (
    'external_submission', _subject_id, v_sub.submitted_by, v_sub.submitted_by, _actor, _actor,
    COALESCE(v_decided_at, now()), now(), 'governance_verified', 'public', 'published', _decision_id,
    v_title,
    CASE WHEN jsonb_typeof(v_payload->'summary') = 'string' THEN v_payload->>'summary' END,
    COALESCE(NULLIF(v_payload->>'language', ''), 'English'), v_mt,
    CASE WHEN jsonb_typeof(v_payload->'target_participants') = 'string' THEN v_payload->>'target_participants' END,
    v_hours, v_objectives,
    CASE WHEN jsonb_typeof(v_payload->'content_outline') = 'object' THEN v_payload->'content_outline' ELSE '{}'::jsonb END,
    CASE WHEN jsonb_typeof(v_payload->'assessment_approach') = 'object' THEN v_payload->'assessment_approach' ELSE '{}'::jsonb END,
    v_expert,
    CASE WHEN jsonb_typeof(v_payload->'metadata') = 'object' THEN v_payload->'metadata' ELSE '{}'::jsonb END
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public._archive_module_outputs(_subject_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.module_registry SET current_status = 'archived', visibility = 'private', updated_at = now()
   WHERE source_submission_id = _subject_id AND current_status <> 'revoked';
  UPDATE public.knowledge_resources SET current_status = 'archived', visibility = 'private', updated_at = now()
   WHERE source_submission_id = _subject_id AND resource_type = 'module';
$$;

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
     WHERE id = _subject_id;
    UPDATE public.review_drafts SET status = 'draft', updated_at = now()
     WHERE id = (SELECT d.id FROM public.review_drafts d
                  WHERE d.linked_subject_id = _subject_id AND d.status <> 'withdrawn'
                  ORDER BY d.updated_at DESC LIMIT 1);
    PERFORM public._archive_module_outputs(_subject_id);
    RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'decisionId', v_dec_id,
                              'status', 'pending', 'changed', true);

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

REVOKE ALL ON FUNCTION public._module_trainer_gate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._assert_module_attachments(jsonb, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._can_decide_review(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._publish_module_from_subject(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._archive_module_outputs(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_module_decide(uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_module_decide(uuid, text, text, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.module_draft_create(text, module_type_v1, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.module_draft_update(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.module_draft_submit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.module_draft_create(text, module_type_v1, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.module_draft_update(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.module_draft_submit(uuid) TO authenticated;
