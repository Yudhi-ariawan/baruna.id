-- ============================================================================
-- "Buka revisi modul tayang" (approver/admin) mulai dari versi yang tayang
-- ============================================================================
-- Dicek 22 Okt 2026 (database intern-update, kode branch ini):
--
-- request_published_module_revision (20261015040000) mengambil kuis lengkap dan
-- lampiran dari draf TERBARU. Setelah pembaruan modul ditolak, draf terbaru adalah
-- isi yang ditolak (admin_module_decide 'reject' membiarkan versi lama tayang tetapi
-- tidak mengembalikan draf), jadi revisi yang dibuka admin membawa kembali kuis dan
-- lampiran yang ditolak, bukan yang sedang tayang.
--
-- Selain itu fungsi ini tidak memeriksa status pengajuan: bila trainer sudah
-- MENGIRIM pembaruan dan pembaruan itu menunggu keputusan (di intern-update: modul
-- "Ministry Professional English Program", status pending/resubmitted), membuka
-- revisi menarik kiriman itu ('withdrawn') tanpa keputusan atas isinya. Kiriman yang
-- menunggu diputuskan lewat Setujui / Tolak / Minta Revisi (admin_module_decide).
--
-- Perubahan (sama dengan trainer_open_module_update, 20261021120000):
-- * Isi awal revisi: kuis lengkap dan lampiran dari revisi yang disetujui oleh
--   keputusan yang menayangkan modul (module_registry.audit_ref); cadangan bila tidak
--   ada: draf aktif terakhir (perilaku lama).
-- * Ditolak dengan module_review_in_progress bila status pengajuan bukan 'approved'.
-- Peran, larangan memutuskan milik sendiri, kunci baris, dan bentuk hasil tidak berubah.

BEGIN;

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
  v_prev_payload jsonb;
  v_latest jsonb;
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
  -- A submitted update waits for its decision; it is decided, not silently withdrawn.
  IF v_subject.current_status <> 'approved' THEN RAISE EXCEPTION 'module_review_in_progress'; END IF;

  SELECT payload INTO v_prev_payload FROM public.review_drafts
   WHERE linked_subject_id = _subject_id
   ORDER BY (status <> 'withdrawn') DESC, updated_at DESC
   LIMIT 1;
  -- The revision starts from what is actually live: the revision approved by the
  -- decision that published the module. After a rejected update the newest draft
  -- is the rejected one, so it is only the fallback.
  SELECT r.snapshot->'payload' INTO v_latest
    FROM public.review_subject_revisions r
    JOIN public.review_decisions d ON d.id = v_module.audit_ref AND d.subject_id = _subject_id
   WHERE r.subject_id = _subject_id AND r.submitted_at <= d.decided_at
   ORDER BY r.revision DESC LIMIT 1;
  IF jsonb_typeof(v_latest) IS DISTINCT FROM 'object' THEN
    v_latest := CASE WHEN jsonb_typeof(v_prev_payload) = 'object' THEN v_prev_payload ELSE '{}'::jsonb END;
  END IF;
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
    -- The revision keeps the full quiz (with answer keys); the registry copy does not.
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

COMMIT;
