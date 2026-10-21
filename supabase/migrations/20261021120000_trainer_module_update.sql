-- ============================================================================
-- Trainer memperbarui modul miliknya yang sedang tayang (pembaruan berkala)
-- ============================================================================
-- Dicek 21 Okt 2026 (database intern-update, kode branch ini):
--
-- Modul tayang hanya bisa direvisi lewat request_published_module_revision, yang
-- khusus Approver/Admin (20261015040000). Trainer yang ingin memperbarui materinya
-- secara berkala harus meminta admin lebih dulu. Slide 20 (PB-ACA-01) dan Slide 38:
-- Master Course/Module punya versioning dan approval; pembaruan tetap wajib
-- disetujui sebelum tayang.
--
-- Perubahan:
-- * trainer_open_module_update(subject, catatan): trainer aktif membuka cabang
--   pembaruan untuk modulnya sendiri yang sedang tayang. Sama dengan jalur admin:
--   versi tayang TIDAK berubah, draf lama ditandai 'withdrawn', satu draf baru
--   berisi versi tayang + kuis lengkap dan lampiran dari revisi yang disetujui
--   (bukan dari draf terakhir, yang bisa saja pembaruan yang ditolak). Bedanya: bukan
--   keputusan (tidak ada baris review_decisions) dan status pengajuan tetap
--   'approved' sampai trainer mengirim. Kiriman lewat trainer_module_save seperti
--   biasa; disetujui → versi naik (module_registry_versions), ditolak → versi
--   lama tetap tayang (admin_module_decide yang ada).
-- * trainer_cancel_module_update(subject): membatalkan pembaruan yang belum
--   dikirim; draf sebelumnya dipulihkan. Tidak bisa bila verifikator sudah
--   membuat keputusan sesudah pembaruan dibuka.
-- * Kuota level tidak berubah: _trainer_module_quota tidak menghitung revisi
--   modul yang sudah ada di registry.

BEGIN;

CREATE OR REPLACE FUNCTION public.trainer_open_module_update(_subject_id uuid, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_note text := btrim(COALESCE(_note, ''));
  v_subject public.review_subjects%ROWTYPE;
  v_meta jsonb;
  v_module public.module_registry%ROWTYPE;
  v_prev public.review_drafts%ROWTYPE;
  v_latest jsonb;
  v_latest_meta jsonb;
  v_payload jsonb;
  v_draft_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  PERFORM public._module_trainer_gate(v_uid);
  IF char_length(v_note) < 5 THEN RAISE EXCEPTION 'update_note_required'; END IF;
  IF char_length(v_note) > 2000 THEN RAISE EXCEPTION 'update_note_too_long'; END IF;

  SELECT * INTO v_subject FROM public.review_subjects
   WHERE id = _subject_id AND kind = 'module' FOR UPDATE;
  -- Someone else's module is reported as missing, not as forbidden.
  IF v_subject.id IS NULL OR v_subject.submitted_by <> v_uid THEN RAISE EXCEPTION 'module_subject_not_found'; END IF;
  v_meta := COALESCE(v_subject.metadata, '{}'::jsonb);
  IF v_subject.current_status = 'withdrawn' OR v_meta->>'review_status' = 'archived' THEN
    RAISE EXCEPTION 'module_archived';
  END IF;

  SELECT * INTO v_module FROM public.module_registry
   WHERE source_submission_id = _subject_id AND current_status = 'published' AND visibility = 'public'
   ORDER BY updated_at DESC LIMIT 1
   FOR UPDATE;
  IF v_module.id IS NULL THEN RAISE EXCEPTION 'published_module_not_found'; END IF;

  IF EXISTS (SELECT 1 FROM public.review_drafts WHERE linked_subject_id = _subject_id AND status = 'draft') THEN
    RAISE EXCEPTION 'module_update_already_open';
  END IF;
  -- A submitted update (or any review) still running: wait for its decision.
  IF v_subject.current_status <> 'approved' THEN RAISE EXCEPTION 'module_review_in_progress'; END IF;

  -- The draft to restore if the update is cancelled: the current active branch.
  SELECT * INTO v_prev FROM public.review_drafts
   WHERE linked_subject_id = _subject_id
   ORDER BY (status <> 'withdrawn') DESC, updated_at DESC
   LIMIT 1;
  -- The update starts from what is actually live: the revision approved by the
  -- decision that published the module (module_registry.audit_ref). After a
  -- rejected update the newest draft is the rejected one, so it is not used.
  SELECT r.snapshot->'payload' INTO v_latest
    FROM public.review_subject_revisions r
    JOIN public.review_decisions d ON d.id = v_module.audit_ref AND d.subject_id = _subject_id
   WHERE r.subject_id = _subject_id AND r.submitted_at <= d.decided_at
   ORDER BY r.revision DESC LIMIT 1;
  IF jsonb_typeof(v_latest) IS DISTINCT FROM 'object' THEN
    v_latest := CASE WHEN jsonb_typeof(v_prev.payload) = 'object' THEN v_prev.payload ELSE '{}'::jsonb END;
  END IF;
  v_latest_meta := CASE WHEN jsonb_typeof(v_latest->'metadata') = 'object' THEN v_latest->'metadata' ELSE '{}'::jsonb END;

  -- Descriptive fields from the live module, the full quiz (with answer keys,
  -- which module_registry no longer holds) and attachments from the live revision.
  v_payload := v_latest || jsonb_build_object(
    'title', v_module.title,
    'summary', v_module.summary,
    'language', v_module.language,
    'module_type', v_module.module_type,
    'target_participants', v_module.target_participants,
    'estimated_learning_hours', v_module.estimated_learning_hours,
    'learning_objectives', COALESCE(to_jsonb(v_module.learning_objectives), '[]'::jsonb),
    'content_outline', COALESCE(v_module.content_outline, '{}'::jsonb),
    'assessment_approach', CASE WHEN jsonb_typeof(v_latest->'assessment_approach') = 'object'
                                THEN v_latest->'assessment_approach'
                                ELSE COALESCE(v_module.assessment_approach, '{}'::jsonb) END,
    'metadata', COALESCE(v_module.metadata, '{}'::jsonb) || v_latest_meta || jsonb_build_object(
      'revision_kind', 'published_module_update',
      'revision_initiated_by', 'trainer',
      'published_module_id', v_module.id,
      'base_version', v_module.version,
      'update_note', v_note,
      'update_opened_at', now()
    )
  );

  UPDATE public.review_drafts SET status = 'withdrawn', updated_at = now()
   WHERE linked_subject_id = _subject_id AND status <> 'withdrawn';

  INSERT INTO public.review_drafts (subject_kind, submitter_id, title, description, external_ref,
                                    payload, status, linked_subject_id)
  VALUES ('module', v_uid, v_module.title, v_subject.description, v_subject.external_ref,
          v_payload, 'draft', _subject_id)
  RETURNING id INTO v_draft_id;

  -- Status stays 'approved' (the live version is the approved one); the metadata
  -- tells the portals that an update branch is open, on the trainer's side.
  UPDATE public.review_subjects
     SET updated_at = now(),
         metadata = v_meta || jsonb_build_object(
           'review_status', 'revision_requested',
           'revision_kind', 'published_module_update',
           'revision_initiated_by', 'trainer',
           'published_module_id', v_module.id,
           'base_version', v_module.version,
           'active_revision_draft_id', v_draft_id,
           'previous_draft_id', v_prev.id,
           'update_note', v_note,
           'update_opened_at', now(),
           'resubmitted_at', NULL)
   WHERE id = _subject_id;

  PERFORM public.log_governance_event(
    'module_update_opened', v_uid, _subject_id, 'review_draft', v_draft_id::text,
    jsonb_build_object('module_id', v_module.id, 'published_version', v_module.version, 'previous_draft_id', v_prev.id),
    jsonb_build_object('draft_id', v_draft_id, 'note', v_note, 'published_module_unchanged', true));

  RETURN v_draft_id;
END $$;
REVOKE ALL ON FUNCTION public.trainer_open_module_update(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trainer_open_module_update(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.trainer_cancel_module_update(_subject_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_subject public.review_subjects%ROWTYPE;
  v_meta jsonb;
  v_draft uuid;
  v_prev uuid;
  v_opened timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  SELECT * INTO v_subject FROM public.review_subjects
   WHERE id = _subject_id AND kind = 'module' FOR UPDATE;
  IF v_subject.id IS NULL OR v_subject.submitted_by <> v_uid THEN RAISE EXCEPTION 'module_subject_not_found'; END IF;
  v_meta := COALESCE(v_subject.metadata, '{}'::jsonb);
  v_opened := CASE WHEN v_meta->>'update_opened_at' IS NOT NULL THEN (v_meta->>'update_opened_at')::timestamptz END;

  SELECT id INTO v_draft FROM public.review_drafts
   WHERE linked_subject_id = _subject_id AND submitter_id = v_uid AND status = 'draft'
   ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  IF v_draft IS NULL
     OR v_subject.current_status <> 'approved'
     OR v_meta->>'revision_initiated_by' IS DISTINCT FROM 'trainer'
     OR v_meta->>'review_status' IS DISTINCT FROM 'revision_requested'
     OR v_opened IS NULL THEN
    RAISE EXCEPTION 'no_module_update_open';
  END IF;
  -- A verifier asked for changes after the update was opened: no longer the trainer's to drop.
  IF EXISTS (SELECT 1 FROM public.review_decisions WHERE subject_id = _subject_id AND decided_at > v_opened) THEN
    RAISE EXCEPTION 'module_update_has_decision';
  END IF;

  UPDATE public.review_drafts SET status = 'withdrawn', updated_at = now() WHERE id = v_draft;
  v_prev := CASE WHEN v_meta->>'previous_draft_id' ~ '^[0-9a-f-]{36}$' THEN (v_meta->>'previous_draft_id')::uuid END;
  UPDATE public.review_drafts SET status = 'submitted', updated_at = now()
   WHERE id = v_prev AND linked_subject_id = _subject_id AND status = 'withdrawn';

  UPDATE public.review_subjects
     SET updated_at = now(),
         metadata = (v_meta - 'revision_initiated_by' - 'active_revision_draft_id' - 'previous_draft_id'
                           - 'update_note' - 'update_opened_at' - 'revision_kind')
                    || jsonb_build_object('review_status', 'approved', 'update_cancelled_at', now())
   WHERE id = _subject_id;

  PERFORM public.log_governance_event(
    'module_update_cancelled', v_uid, _subject_id, 'review_draft', v_draft::text,
    jsonb_build_object('draft_id', v_draft), jsonb_build_object('restored_draft_id', v_prev));
END $$;
REVOKE ALL ON FUNCTION public.trainer_cancel_module_update(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trainer_cancel_module_update(uuid) TO authenticated;

COMMIT;
