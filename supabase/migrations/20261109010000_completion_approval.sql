-- ============================================================================
-- Academy: Completion Record dan persetujuan kelulusan (PB-ACA-05, Slide 24, 26, 27).
-- CATATAN_PERBAIKAN 2ar. Dibuktikan dengan `npm run test:completion-approval`.
--
-- Panduan:
-- * Slide 24: agregasi learning record -> hitung completion -> validasi eligibility
--   -> Review Completion -> Memenuhi syarat? -> Approval Completion (atau Remedial /
--   Follow-Up) -> Certificate Record. Peserta melihat status dan mengunduh.
--   "payment (jika ada) tidak menentukan kelulusan"; "sertifikat diterbitkan melalui
--   backend resmi dan tercatat pada audit trail".
-- * Slide 26: objek Completion terpisah dari objek Certificate.
-- * Slide 27: Completion & Certificate dikerjakan Admin + Reviewer; peserta mengunduh.
--
-- Sebelum migrasi: peserta menerbitkan sertifikatnya sendiri (issue_my_certificate),
-- tanpa review dan persetujuan; status selesai baru tertulis saat sertifikat terbit,
-- sehingga penahanan sertifikat course berbayar ikut menahan kelulusan.
--
-- Sesudah migrasi:
-- * course_completions: satu Completion Record per pendaftaran. Dibentuk otomatis
--   oleh database saat syarat terpenuhi (trigger pada progres dan evaluasi akhir),
--   berstatus pending_review.
-- * completion_decide / completion_decide_many: hanya pemutus (_can_decide_review),
--   bukan pesertanya sendiri. Setuju: pendaftaran menjadi selesai dan sertifikat
--   terbit (kecuali course berbayar: lulus, sertifikat ditahan). Remedial: wajib
--   alasan, dan bisa disetujui kemudian. Syarat diperiksa ulang saat disetujui.
-- * issue_my_certificate tidak lagi menerbitkan; mengembalikan sertifikat yang sudah
--   ada, atau menolak 'certificate_requires_approval'.
-- * check_certificate_eligibility: pembayaran tidak lagi menjadi syarat; hasilnya
--   ditambah status Completion Record.
-- * Sertifikat yang sudah terbit tetap berlaku dan dicatat sebagai approved.
-- Aman dijalankan ulang.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.course_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolment_id uuid NOT NULL UNIQUE REFERENCES public.enrolments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_offering_id uuid NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'remedial')),
  modules_completed integer NOT NULL DEFAULT 0,
  modules_required integer NOT NULL DEFAULT 0,
  evaluation_submitted boolean NOT NULL DEFAULT false,
  certificate_id uuid REFERENCES public.certificates(id) ON DELETE SET NULL,
  certificate_held_reason text,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS course_completions_status_idx ON public.course_completions (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS course_completions_user_idx ON public.course_completions (user_id);
ALTER TABLE public.course_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_completions FROM anon, authenticated;
GRANT SELECT ON public.course_completions TO authenticated;
GRANT ALL ON public.course_completions TO service_role;
DROP POLICY IF EXISTS course_completions_own_read ON public.course_completions;
CREATE POLICY course_completions_own_read ON public.course_completions FOR SELECT USING (auth.uid() = user_id);

-- Requirements for completion. Payment is deliberately not one of them (Slide 24).
CREATE OR REPLACE FUNCTION public.check_certificate_eligibility(_enrolment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_enrolment RECORD; v_module_count integer; v_completed_count integer; v_ce_submitted boolean;
  v_completion RECORD; v_extra jsonb;
BEGIN
  SELECT e.id, e.user_id, e.course_offering_id, e.enrolment_status, o.master_course_id,
         COALESCE(o.completion_evaluation_required, false) AS evaluation_required,
         o.completion_evaluation_template_id AS evaluation_template_id,
         o.self_paced_access_model::text AS access_model,
         (SELECT t.status FROM public.completion_evaluation_templates t WHERE t.id = o.completion_evaluation_template_id) AS template_status
    INTO v_enrolment
    FROM public.enrolments e JOIN public.course_offerings o ON o.id = e.course_offering_id
   WHERE e.id = _enrolment_id;
  IF v_enrolment.id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'enrolment_not_found');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.completion_evaluation_submissions s
                  WHERE s.enrolment_id = _enrolment_id AND s.status = 'submitted') INTO v_ce_submitted;
  SELECT c.status, c.decision_note, c.certificate_held_reason INTO v_completion
    FROM public.course_completions c WHERE c.enrolment_id = _enrolment_id;
  v_extra := jsonb_build_object('completion_evaluation_submitted', v_ce_submitted,
    'completion_status', v_completion.status, 'decision_note', v_completion.decision_note,
    'certificate_held_reason', v_completion.certificate_held_reason,
    'payment_required', COALESCE(v_enrolment.access_model IN ('paid', 'free_to_learn'), false));

  IF v_enrolment.enrolment_status = 'withdrawn' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'enrolment_not_active') || v_extra;
  END IF;

  SELECT COUNT(*) INTO v_module_count FROM public.master_modules WHERE master_course_id = v_enrolment.master_course_id;
  SELECT COUNT(DISTINCT p.learning_activity_id) INTO v_completed_count
    FROM public.progress_records p
    JOIN public.master_modules mm ON mm.master_course_id = v_enrolment.master_course_id
                                 AND p.learning_activity_id = 'module:' || mm.module_code
   WHERE p.enrolment_id = _enrolment_id AND p.status = 'completed';

  IF v_module_count = 0 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_modules_configured') || v_extra;
  END IF;
  IF v_completed_count < v_module_count THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'modules_incomplete',
      'completed', v_completed_count, 'required', v_module_count) || v_extra;
  END IF;
  IF v_enrolment.evaluation_required THEN
    -- A retired template cannot be started any more: that is for the admin to fix, not the participant.
    IF v_enrolment.evaluation_template_id IS NULL OR v_enrolment.template_status IS DISTINCT FROM 'active' THEN
      -- An evaluation already sent counts even if the template was retired later.
      IF NOT v_ce_submitted THEN
        RETURN jsonb_build_object('eligible', false, 'reason', 'completion_evaluation_not_configured',
          'completed', v_completed_count, 'required', v_module_count) || v_extra;
      END IF;
    ELSIF NOT v_ce_submitted THEN
      RETURN jsonb_build_object('eligible', false, 'reason', 'completion_evaluation_missing',
        'completed', v_completed_count, 'required', v_module_count) || v_extra;
    END IF;
  END IF;
  RETURN jsonb_build_object('eligible', true, 'completed', v_completed_count, 'required', v_module_count) || v_extra;
END $$;
REVOKE ALL ON FUNCTION public.check_certificate_eligibility(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_certificate_eligibility(uuid) TO authenticated, service_role;

-- Forms the Completion Record once the requirements are met. Locks the enrolment so
-- the last module and the evaluation sent at the same moment on two devices cannot
-- both miss each other.
CREATE OR REPLACE FUNCTION public._completion_sync(_enrolment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_enr public.enrolments; v_elig jsonb; v_id uuid;
BEGIN
  SELECT * INTO v_enr FROM public.enrolments WHERE id = _enrolment_id FOR UPDATE;
  IF v_enr.id IS NULL OR v_enr.enrolment_status = 'withdrawn' THEN RETURN; END IF;
  v_elig := public.check_certificate_eligibility(_enrolment_id);
  IF NOT COALESCE((v_elig->>'eligible')::boolean, false) THEN RETURN; END IF;

  INSERT INTO public.course_completions (enrolment_id, user_id, course_offering_id, modules_completed, modules_required, evaluation_submitted)
  VALUES (v_enr.id, v_enr.user_id, v_enr.course_offering_id, (v_elig->>'completed')::integer, (v_elig->>'required')::integer,
          COALESCE((v_elig->>'completion_evaluation_submitted')::boolean, false))
  ON CONFLICT (enrolment_id) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    PERFORM public._learning_audit('completion_submitted', v_enr.user_id, 'course_completion', v_id::text,
      jsonb_build_object('enrolment_id', v_enr.id, 'offering_id', v_enr.course_offering_id));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public._completion_sync(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._completion_sync_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._completion_sync(NEW.enrolment_id);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._completion_sync_trg() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_completion_sync_progress ON public.progress_records;
CREATE TRIGGER trg_completion_sync_progress AFTER INSERT OR UPDATE OF status ON public.progress_records
  FOR EACH ROW WHEN (NEW.status = 'completed') EXECUTE FUNCTION public._completion_sync_trg();
DROP TRIGGER IF EXISTS trg_completion_sync_evaluation ON public.completion_evaluation_submissions;
CREATE TRIGGER trg_completion_sync_evaluation AFTER INSERT OR UPDATE OF status ON public.completion_evaluation_submissions
  FOR EACH ROW WHEN (NEW.status = 'submitted') EXECUTE FUNCTION public._completion_sync_trg();

-- Internal: creates the certificate of completion for an approved completion.
CREATE OR REPLACE FUNCTION public._completion_issue_certificate(_enr public.enrolments, _actor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cert public.certificates; v_serial text;
BEGIN
  SELECT * INTO v_cert FROM public.certificates
   WHERE learner_id = _enr.user_id AND course_offering_id = _enr.course_offering_id AND certificate_type = 'completion';
  IF v_cert.id IS NOT NULL THEN RETURN v_cert.id; END IF;
  -- Temporary number format (official STTP numbering not decided yet). The random
  -- suffix makes numbers impossible to enumerate on the public verification page.
  v_serial := 'BARUNA-COMPLETION-' || to_char(now(), 'YYYY') || '-'
              || lpad(nextval('public.certificate_serial_seq')::text, 6, '0') || '-'
              || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  INSERT INTO public.certificates (learner_id, enrolment_id, course_offering_id, certificate_type,
                                   certificate_number, verification_reference, certificate_status, source_system)
  VALUES (_enr.user_id, _enr.id, _enr.course_offering_id, 'completion', v_serial,
          '/academy/certification?verify=' || v_serial, 'issued', 'shared_v1')
  RETURNING * INTO v_cert;
  PERFORM public._learning_audit('certificate_issued', _actor, 'certificate', v_cert.id::text,
    jsonb_build_object('serial', v_serial, 'learner_id', _enr.user_id));
  RETURN v_cert.id;
END $$;
REVOKE ALL ON FUNCTION public._completion_issue_certificate(public.enrolments, uuid) FROM PUBLIC, anon, authenticated;

-- One decision. Raises an error code when it cannot be taken.
CREATE OR REPLACE FUNCTION public._completion_decide_one(_id uuid, _decision text, _note text, _uid uuid, _expected timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_eid uuid; v_enr public.enrolments; v_c public.course_completions; v_elig jsonb; v_cert uuid; v_access text; v_held text;
  v_note text := NULLIF(btrim(COALESCE(_note, '')), '');
BEGIN
  SELECT enrolment_id INTO v_eid FROM public.course_completions WHERE id = _id;
  IF v_eid IS NULL THEN RAISE EXCEPTION 'completion_not_found'; END IF;
  -- Same lock order as _completion_sync: enrolment first.
  SELECT * INTO v_enr FROM public.enrolments WHERE id = v_eid FOR UPDATE;
  SELECT * INTO v_c FROM public.course_completions WHERE id = _id FOR UPDATE;
  IF v_c.user_id = _uid THEN RAISE EXCEPTION 'completion_self_decision_forbidden'; END IF;
  IF v_c.status = 'approved' THEN RAISE EXCEPTION 'completion_already_decided'; END IF;
  IF _expected IS NOT NULL AND _expected <> v_c.updated_at THEN RAISE EXCEPTION 'completion_stale'; END IF;
  IF v_enr.enrolment_status = 'withdrawn' THEN RAISE EXCEPTION 'enrolment_not_active'; END IF;
  IF char_length(COALESCE(v_note, '')) > 2000 THEN RAISE EXCEPTION 'completion_note_too_long'; END IF;

  IF _decision = 'remedial' THEN
    IF v_note IS NULL OR char_length(v_note) < 5 THEN RAISE EXCEPTION 'completion_note_required'; END IF;
    UPDATE public.course_completions SET status = 'remedial', decided_by = _uid, decided_at = clock_timestamp(),
           decision_note = v_note, updated_at = clock_timestamp() WHERE id = _id;
    PERFORM public.log_governance_event('completion_remedial', _uid, NULL, 'course_completion', _id::text,
      jsonb_build_object('status', v_c.status), jsonb_build_object('status', 'remedial', 'note', v_note));
    RETURN jsonb_build_object('id', _id, 'status', 'remedial');
  ELSIF _decision <> 'approve' OR _decision IS NULL THEN
    RAISE EXCEPTION 'completion_decision_invalid';
  END IF;

  -- Re-checked here: the rules may have changed since the record was formed.
  v_elig := public.check_certificate_eligibility(v_enr.id);
  IF NOT COALESCE((v_elig->>'eligible')::boolean, false) THEN
    RAISE EXCEPTION 'completion_requirements_not_met:%', COALESCE(v_elig->>'reason', 'unknown');
  END IF;

  -- Passing never depends on payment (Slide 24); only the certificate is held.
  SELECT o.self_paced_access_model::text INTO v_access FROM public.course_offerings o WHERE o.id = v_enr.course_offering_id;
  IF v_access IN ('paid', 'free_to_learn') THEN
    v_held := 'certificate_payment_required';
  ELSE
    v_cert := public._completion_issue_certificate(v_enr, _uid);
  END IF;
  UPDATE public.enrolments SET completion_status = 'completed', completion_date = COALESCE(completion_date, now())
   WHERE id = v_enr.id AND completion_status <> 'completed';
  UPDATE public.course_completions
     SET status = 'approved', certificate_id = v_cert, certificate_held_reason = v_held, decided_by = _uid,
         decided_at = clock_timestamp(), decision_note = v_note, updated_at = clock_timestamp()
   WHERE id = _id;
  PERFORM public.log_governance_event('completion_approved', _uid, NULL, 'course_completion', _id::text,
    jsonb_build_object('status', v_c.status),
    jsonb_build_object('status', 'approved', 'certificate_id', v_cert, 'certificate_held_reason', v_held, 'note', v_note));
  RETURN jsonb_build_object('id', _id, 'status', 'approved', 'certificate_id', v_cert, 'certificate_held_reason', v_held);
END $$;
REVOKE ALL ON FUNCTION public._completion_decide_one(uuid, text, text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.completion_decide(_id uuid, _decision text, _note text, _expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _expected_updated_at IS NULL THEN RAISE EXCEPTION 'completion_stale'; END IF;
  RETURN public._completion_decide_one(_id, _decision, _note, v_uid, _expected_updated_at);
END $$;
REVOKE ALL ON FUNCTION public.completion_decide(uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.completion_decide(uuid, text, text, timestamptz) TO authenticated;

-- Approve several at once. Each one stands alone: a row that cannot be approved is
-- reported and does not undo the others.
CREATE OR REPLACE FUNCTION public.completion_decide_many(_ids uuid[], _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_ok integer := 0; v_skipped jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN RAISE EXCEPTION 'completion_selection_empty'; END IF;
  IF array_length(_ids, 1) > 200 THEN RAISE EXCEPTION 'completion_selection_too_many'; END IF;
  FOREACH v_id IN ARRAY (SELECT array_agg(DISTINCT x) FROM unnest(_ids) x) LOOP
    BEGIN
      PERFORM public._completion_decide_one(v_id, 'approve', _note, v_uid, NULL);
      v_ok := v_ok + 1;
    EXCEPTION WHEN raise_exception THEN
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'reason', SQLERRM);
    END;
  END LOOP;
  RETURN jsonb_build_object('approved', v_ok, 'skipped', v_skipped);
END $$;
REVOKE ALL ON FUNCTION public.completion_decide_many(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.completion_decide_many(uuid[], text) TO authenticated;

-- Queue for the console: operators and reviewers read, deciders decide.
CREATE OR REPLACE FUNCTION public.completion_overview(_status text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT (public._can_decide_review(v_uid) OR public.has_rbac_role(v_uid, 'operator') OR public.has_rbac_role(v_uid, 'reviewer')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('pending_review', 'remedial', 'approved') OR _status IS NULL THEN RAISE EXCEPTION 'completion_status_invalid'; END IF;
  RETURN jsonb_build_object(
    'canDecide', public._can_decide_review(v_uid),
    'counts', (SELECT jsonb_build_object(
        'pending_review', count(*) FILTER (WHERE status = 'pending_review'),
        'remedial', count(*) FILTER (WHERE status = 'remedial'),
        'approved', count(*) FILTER (WHERE status = 'approved')) FROM public.course_completions),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'status', c.status, 'updatedAt', c.updated_at, 'createdAt', c.created_at, 'decidedAt', c.decided_at,
        'decisionNote', c.decision_note, 'mine', c.user_id = v_uid,
        'participantName', COALESCE(NULLIF(btrim((SELECT p.display_name FROM public.profiles p WHERE p.id = c.user_id)), ''), 'Peserta'),
        'decidedBy', (SELECT p.display_name FROM public.profiles p WHERE p.id = c.decided_by),
        'offeringCode', o.offering_code, 'offeringTitle', o.offering_title, 'courseTitle', m.title,
        'modulesCompleted', c.modules_completed, 'modulesRequired', c.modules_required,
        'evaluationRequired', COALESCE(o.completion_evaluation_required, false), 'evaluationSubmitted', c.evaluation_submitted,
        'enrolmentStatus', e.enrolment_status,
        'certificateNumber', (SELECT ce.certificate_number FROM public.certificates ce WHERE ce.id = c.certificate_id),
        'certificateHeldReason', c.certificate_held_reason)
        ORDER BY c.updated_at DESC)
      FROM (SELECT * FROM public.course_completions WHERE status = _status ORDER BY updated_at DESC LIMIT 500) c
      JOIN public.enrolments e ON e.id = c.enrolment_id
      JOIN public.course_offerings o ON o.id = c.course_offering_id
      JOIN public.master_courses m ON m.id = o.master_course_id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.completion_overview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.completion_overview(text) TO authenticated;

-- The participant no longer issues. Kept so a double click or an old screen gets the
-- certificate that already exists, or a clear reason.
CREATE OR REPLACE FUNCTION public.issue_my_certificate(_enrolment_id uuid, _certificate_type text DEFAULT 'completion')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_enr public.enrolments; v_elig jsonb; v_cert public.certificates;
BEGIN
  IF _certificate_type NOT IN ('completion', 'participation', 'program', 'applied-achievement', 'competency', 'statement-of-result') THEN
    RAISE EXCEPTION 'invalid_certificate_type';
  END IF;
  IF _certificate_type <> 'completion' THEN RAISE EXCEPTION 'certificate_type_not_available'; END IF;
  v_enr := public._learning_own_active_enrolment(_enrolment_id);
  SELECT * INTO v_cert FROM public.certificates
   WHERE learner_id = v_uid AND course_offering_id = v_enr.course_offering_id AND certificate_type = _certificate_type;
  IF v_cert.id IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_cert.id, 'certificate_number', v_cert.certificate_number,
      'verification_reference', v_cert.verification_reference, 'certificate_type', v_cert.certificate_type,
      'issue_date', v_cert.issue_date, 'created', false);
  END IF;
  v_elig := public.check_certificate_eligibility(_enrolment_id);
  IF NOT COALESCE((v_elig->>'eligible')::boolean, false) THEN
    RAISE EXCEPTION 'not_eligible:%', COALESCE(v_elig->>'reason', 'unknown');
  END IF;
  RAISE EXCEPTION 'certificate_requires_approval';
END $$;
REVOKE ALL ON FUNCTION public.issue_my_certificate(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_my_certificate(uuid, text) TO authenticated, service_role;

-- Existing certificates stay valid and count as approved.
INSERT INTO public.course_completions (enrolment_id, user_id, course_offering_id, status, certificate_id, decided_at, decision_note, evaluation_submitted)
SELECT DISTINCT ON (c.enrolment_id) c.enrolment_id, c.learner_id, c.course_offering_id, 'approved', c.id, c.issue_date,
       'Sertifikat terbit sebelum persetujuan kelulusan diberlakukan (migrasi 20261109010000).',
       EXISTS (SELECT 1 FROM public.completion_evaluation_submissions s WHERE s.enrolment_id = c.enrolment_id AND s.status = 'submitted')
  FROM public.certificates c
 WHERE c.enrolment_id IS NOT NULL
 ORDER BY c.enrolment_id, (c.certificate_type = 'completion') DESC, c.issue_date
ON CONFLICT (enrolment_id) DO NOTHING;

-- Participants who already met the requirements enter the queue now.
DO $$
DECLARE v_id uuid;
BEGIN
  FOR v_id IN SELECT e.id FROM public.enrolments e
               WHERE e.enrolment_status <> 'withdrawn'
                 AND NOT EXISTS (SELECT 1 FROM public.course_completions c WHERE c.enrolment_id = e.id)
  LOOP
    PERFORM public._completion_sync(v_id);
  END LOOP;
END $$;

COMMIT;
