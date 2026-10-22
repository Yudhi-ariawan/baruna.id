-- ============================================================================
-- Expert: memperbarui profil yang sudah tayang lewat review (PB-EXP-01, Slide 36)
-- ============================================================================
-- Dicek 22 Okt 2026 (database intern-update, kode branch ini):
--
-- * Setelah disetujui, expert tidak bisa mengajukan pembaruan profil: pengajuan
--   baru ditolak (expert_profile_exists, 20261021050000) dan revisi hanya bisa
--   dikirim bila verifikator memintanya. Yang ada hanya admin/approver menyunting
--   langsung tanpa review (20261015070000). Slide 36: perbarui draf -> review ->
--   versi baru.
-- * admin_expert_decide (20261015060000) 'return_for_revision' dan 'reject' selalu
--   menjalankan _expert_deactivate_outputs: profil diarsipkan, status trainer
--   dinonaktifkan, dan role expert dicabut. Untuk expert yang sudah tayang, meminta
--   revisi (atau menolak pembaruan) mencabut akses portal trainernya dan menghapus
--   profilnya dari direktori.
--
-- Perubahan (pola yang sama dengan modul 20261021120000 dan Knowledge Hub
-- 20261022020000):
-- * expert_open_profile_update / expert_cancel_profile_update: pemilik membuka
--   pembaruan dari versi yang TAYANG (revisi yang disetujui keputusan
--   experts.audit_ref; cadangan: draf aktif terakhir). Status tetap 'approved'
--   sampai dikirim lewat expert_revision_resubmit (jalur revisi yang sudah ada,
--   dengan semua pemeriksaan kelengkapan dan kepemilikan dokumen).
-- * Profil, role expert, dan status trainer TIDAK dicabut selama pembaruan atau
--   revisi profil yang tayang. Disetujui: profil diperbarui, versi naik
--   (expert_versions). Ditolak: profil lama tetap, status kembali 'approved', draf
--   yang tayang dipulihkan (sinkron ulang tidak pernah menayangkan isi yang ditolak).
-- * 'Tolak' tanpa pengajuan yang menunggu ditolak (nothing_to_decide); untuk menarik
--   profil dari direktori gunakan Arsipkan. Selama pembaruan disiapkan, approver
--   tidak bisa memutuskan atau menyinkronkan (expert_update_open).
-- * Arsip saat pembaruan disiapkan membatalkan pembaruan itu; pulihkan dari arsip
--   menayangkan lagi profil yang disetujui walau pembaruan kembali ke antrean.
-- Pengajuan pertama (belum pernah tayang) tidak berubah.

BEGIN;

-- ------------------------------------------------------------- live payload
CREATE OR REPLACE FUNCTION public._expert_live_payload(_subject_id uuid, _audit_ref uuid, _fallback jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  SELECT r.snapshot->'payload' INTO v
    FROM public.review_subject_revisions r
    JOIN public.review_decisions d ON d.id = _audit_ref AND d.subject_id = _subject_id AND d.decision = 'approve'
   WHERE r.subject_id = _subject_id AND r.submitted_at <= d.decided_at
   ORDER BY r.revision DESC LIMIT 1;
  RETURN CASE WHEN jsonb_typeof(v) = 'object' THEN v
              WHEN jsonb_typeof(_fallback) = 'object' THEN _fallback
              ELSE '{}'::jsonb END;
END $$;
REVOKE ALL ON FUNCTION public._expert_live_payload(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- owner opens / cancels
CREATE OR REPLACE FUNCTION public.expert_open_profile_update(_subject_id uuid, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_note text := btrim(COALESCE(_note, ''));
  v_sub public.review_subjects%ROWTYPE;
  v_meta jsonb;
  v_expert public.experts%ROWTYPE;
  v_prev public.review_drafts%ROWTYPE;
  v_payload jsonb;
  v_draft_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF char_length(v_note) < 5 THEN RAISE EXCEPTION 'update_note_required'; END IF;
  IF char_length(v_note) > 2000 THEN RAISE EXCEPTION 'update_note_too_long'; END IF;

  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id AND kind = 'expert' FOR UPDATE;
  -- Someone else's profile is reported as missing, not as forbidden.
  IF v_sub.id IS NULL OR v_sub.submitted_by <> v_uid THEN RAISE EXCEPTION 'expert_subject_not_found'; END IF;
  v_meta := COALESCE(v_sub.metadata, '{}'::jsonb);

  SELECT * INTO v_expert FROM public.experts
   WHERE source_submission_id = _subject_id AND current_status = 'published' AND visibility = 'public'
   FOR UPDATE;
  IF v_expert.id IS NULL THEN RAISE EXCEPTION 'published_profile_not_found'; END IF;

  IF EXISTS (SELECT 1 FROM public.review_drafts WHERE linked_subject_id = _subject_id AND status = 'draft') THEN
    RAISE EXCEPTION 'profile_update_already_open';
  END IF;
  -- A submitted update (or a verifier's revision request) is still running.
  IF v_sub.current_status <> 'approved' THEN RAISE EXCEPTION 'expert_review_in_progress'; END IF;

  SELECT * INTO v_prev FROM public.review_drafts
   WHERE linked_subject_id = _subject_id AND submitter_id = v_uid AND status <> 'withdrawn'
   ORDER BY updated_at DESC LIMIT 1;
  v_payload := public._expert_live_payload(_subject_id, v_expert.audit_ref, v_prev.payload);

  UPDATE public.review_drafts SET status = 'withdrawn', updated_at = now()
   WHERE linked_subject_id = _subject_id AND status <> 'withdrawn';
  INSERT INTO public.review_drafts (subject_kind, submitter_id, title, payload, status, linked_subject_id)
  VALUES ('expert', v_uid, COALESCE(public._jtext(v_payload, 'fullName'), v_expert.display_name),
          v_payload, 'draft', _subject_id)
  RETURNING id INTO v_draft_id;

  -- Status stays 'approved' (the published profile is the approved one) until sent.
  UPDATE public.review_subjects
     SET updated_at = now(),
         metadata = v_meta || jsonb_build_object(
           'update_open', true, 'update_note', v_note, 'update_opened_at', now(),
           'previous_draft_id', v_prev.id, 'update_cancelled_at', NULL)
   WHERE id = _subject_id;

  PERFORM public._expert_audit('expert_profile_update_opened', v_uid, _subject_id, v_expert.id::text,
    jsonb_build_object('version', v_expert.version, 'previous_draft_id', v_prev.id),
    jsonb_build_object('draft_id', v_draft_id, 'note', v_note, 'published_profile_unchanged', true));
  RETURN v_draft_id;
END $$;
REVOKE ALL ON FUNCTION public.expert_open_profile_update(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expert_open_profile_update(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.expert_cancel_profile_update(_subject_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub public.review_subjects%ROWTYPE;
  v_meta jsonb; v_draft uuid; v_prev uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id AND kind = 'expert' FOR UPDATE;
  IF v_sub.id IS NULL OR v_sub.submitted_by <> v_uid THEN RAISE EXCEPTION 'expert_subject_not_found'; END IF;
  v_meta := COALESCE(v_sub.metadata, '{}'::jsonb);

  SELECT id INTO v_draft FROM public.review_drafts
   WHERE linked_subject_id = _subject_id AND submitter_id = v_uid AND status = 'draft'
   ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  -- Only an unsent update the owner opened; a verifier's revision request is not theirs to drop.
  IF v_draft IS NULL OR v_sub.current_status <> 'approved' OR v_meta->>'update_open' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'no_profile_update_open';
  END IF;

  UPDATE public.review_drafts SET status = 'withdrawn', updated_at = now() WHERE id = v_draft;
  v_prev := CASE WHEN v_meta->>'previous_draft_id' ~ '^[0-9a-f-]{36}$' THEN (v_meta->>'previous_draft_id')::uuid END;
  UPDATE public.review_drafts SET status = 'submitted', updated_at = now()
   WHERE id = v_prev AND linked_subject_id = _subject_id AND status = 'withdrawn';

  UPDATE public.review_subjects
     SET updated_at = now(),
         metadata = (v_meta - 'update_open' - 'update_note' - 'update_opened_at' - 'previous_draft_id')
                    || jsonb_build_object('update_cancelled_at', now())
   WHERE id = _subject_id;

  PERFORM public._expert_audit('expert_profile_update_cancelled', v_uid, _subject_id, _subject_id::text,
    jsonb_build_object('draft_id', v_draft), jsonb_build_object('restored_draft_id', v_prev));
END $$;
REVOKE ALL ON FUNCTION public.expert_cancel_profile_update(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expert_cancel_profile_update(uuid) TO authenticated;

-- ------------------------------------------------------------- resubmit (revision or update)
CREATE OR REPLACE FUNCTION public.expert_revision_resubmit(
  _subject_id uuid, _draft_id uuid, _display_name text, _payload jsonb,
  _notes text DEFAULT NULL, _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_sub public.review_subjects%ROWTYPE; v_draft public.review_drafts%ROWTYPE;
  v_problem text; v_rev integer; v_now timestamptz := now(); v_is_update boolean;
  v_name text := NULLIF(btrim(COALESCE(_display_name, '')), '');
  v_notes text := COALESCE(NULLIF(btrim(COALESCE(_notes, '')), ''), 'Dokumen revisi dikirimkan ulang oleh calon expert.');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF v_name IS NULL OR char_length(v_name) > 160 THEN RAISE EXCEPTION 'display_name_required'; END IF;
  IF char_length(v_notes) > 2000 THEN RAISE EXCEPTION 'notes_too_long'; END IF;
  v_problem := public._expert_payload_problem(_payload, v_uid, true);
  IF v_problem IS NOT NULL THEN RAISE EXCEPTION '%', v_problem; END IF;

  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id FOR UPDATE;
  IF v_sub.id IS NULL OR v_sub.kind <> 'expert' OR v_sub.submitted_by <> v_uid THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF _expected_updated_at IS NOT NULL AND v_sub.updated_at <> _expected_updated_at THEN RAISE EXCEPTION 'stale_subject'; END IF;

  -- Draf yang bisa diedit milik pemohon untuk subjek ini (draft id lama boleh sudah tergantikan).
  SELECT * INTO v_draft FROM public.review_drafts
   WHERE linked_subject_id = _subject_id AND submitter_id = v_uid AND status <> 'withdrawn'
   ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  -- The owner's update of the published profile (status stays approved until sent).
  v_is_update := v_sub.current_status = 'approved' AND v_sub.metadata->>'update_open' = 'true'
                 AND v_draft.status = 'draft';
  IF NOT v_is_update AND (public._expert_effective_status(_subject_id) <> 'revision_requested'
     OR v_draft.id IS NULL OR v_draft.status <> 'draft') THEN
    RAISE EXCEPTION 'not_awaiting_revision';
  END IF;

  UPDATE public.review_subjects
     SET current_status = 'pending', title = v_name, updated_at = v_now,
         metadata = (COALESCE(metadata, '{}'::jsonb) - 'update_open') || jsonb_build_object(
           'review_status', 'resubmitted', 'resubmitted_at', v_now, 'resubmission_notes', v_notes)
           || CASE WHEN v_is_update THEN jsonb_build_object('live_version_kept', true) ELSE '{}'::jsonb END
   WHERE id = _subject_id;
  UPDATE public.review_drafts SET payload = _payload, status = 'submitted', title = v_name WHERE id = v_draft.id;
  SELECT COALESCE(max(revision), 0) + 1 INTO v_rev FROM public.review_subject_revisions WHERE subject_id = _subject_id;
  INSERT INTO public.review_subject_revisions (subject_id, draft_id, revision, snapshot, content_hash, submitted_at)
  VALUES (_subject_id, v_draft.id, v_rev,
          jsonb_build_object('payload', _payload, 'resubmitted_at', v_now, 'notes', v_notes, 'title', v_name),
          md5(_payload::text) || '-' || v_rev, v_now);
  RETURN jsonb_build_object('success', true, 'subjectId', _subject_id, 'revision', v_rev, 'profileUpdate', v_is_update);
END $$;
REVOKE ALL ON FUNCTION public.expert_revision_resubmit(uuid, uuid, text, jsonb, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expert_revision_resubmit(uuid, uuid, text, jsonb, text, timestamptz) TO authenticated, service_role;

-- ------------------------------------------------------------- decisions
CREATE OR REPLACE FUNCTION public.admin_expert_decide(
  _subject_id uuid, _decision text, _rationale text DEFAULT NULL, _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub public.review_subjects%ROWTYPE;
  v_meta jsonb; v_eff text; v_prev uuid; v_dec uuid; v_pub jsonb; v_draft public.review_drafts%ROWTYPE;
  v_snap jsonb; v_reason text := NULLIF(btrim(COALESCE(_rationale, '')), '');
  v_expert public.experts%ROWTYPE; v_live boolean; v_payload jsonb; v_prev_draft uuid;
  v_update_keys text[] := ARRAY['update_open', 'update_note', 'update_opened_at', 'previous_draft_id', 'live_version_kept'];
BEGIN
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _decision NOT IN ('approve', 'reject', 'return_for_revision', 'sync') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF char_length(COALESCE(v_reason, '')) > 5000 THEN RAISE EXCEPTION 'rationale_too_long'; END IF;

  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id FOR UPDATE;
  IF v_sub.id IS NULL OR v_sub.kind <> 'expert' THEN RAISE EXCEPTION 'expert_subject_not_found'; END IF;
  IF v_sub.submitted_by = v_uid THEN RAISE EXCEPTION 'self_decision_forbidden'; END IF;
  IF _expected_updated_at IS NOT NULL AND v_sub.updated_at <> _expected_updated_at THEN
    RAISE EXCEPTION 'stale_subject';
  END IF;
  v_meta := COALESCE(v_sub.metadata, '{}'::jsonb);
  v_eff := public._expert_effective_status(_subject_id);
  SELECT * INTO v_expert FROM public.experts WHERE source_submission_id = _subject_id FOR UPDATE;
  v_live := v_expert.id IS NOT NULL AND v_expert.current_status = 'published' AND v_expert.visibility = 'public';

  -- The owner is preparing an update (not sent): nothing to decide, and a re-sync
  -- would publish the unsent draft.
  IF v_sub.current_status = 'approved' AND v_meta->>'update_open' = 'true'
     AND EXISTS (SELECT 1 FROM public.review_drafts WHERE linked_subject_id = _subject_id
                  AND submitter_id = v_sub.submitted_by AND status = 'draft') THEN
    RAISE EXCEPTION 'expert_update_open';
  END IF;

  IF _decision = 'sync' OR (_decision = 'approve' AND v_eff = 'approved') THEN
    IF v_eff <> 'approved' THEN RAISE EXCEPTION 'expert_not_approved'; END IF;
    v_pub := public._expert_publish_from_subject(_subject_id, NULL, v_uid, false);
    RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'status', 'approved',
                              'changed', false, 'resynced', true) || v_pub;
  END IF;

  IF v_eff = 'archived' THEN RAISE EXCEPTION 'expert_archived'; END IF;
  IF _decision = 'approve' AND v_eff = 'revision_requested' THEN RAISE EXCEPTION 'awaiting_applicant_revision'; END IF;
  -- Nothing waits for a decision: taking a published profile down is 'archive'.
  IF _decision = 'reject' AND v_eff = 'approved' THEN RAISE EXCEPTION 'nothing_to_decide'; END IF;
  IF _decision = 'reject' AND v_eff = 'rejected' THEN RAISE EXCEPTION 'already_rejected'; END IF;
  IF _decision = 'return_for_revision' AND v_eff = 'revision_requested' THEN RAISE EXCEPTION 'already_awaiting_revision'; END IF;
  IF _decision = 'return_for_revision' AND v_eff = 'rejected' THEN RAISE EXCEPTION 'rejected_is_final'; END IF;

  SELECT id INTO v_prev FROM public.review_decisions WHERE subject_id = _subject_id
   ORDER BY created_at DESC, decided_at DESC LIMIT 1;

  IF _decision = 'approve' THEN
    v_reason := COALESCE(v_reason, 'Pengajuan telah diverifikasi dan disetujui.');
    INSERT INTO public.review_decisions (subject_id, decided_by, decision, rationale, supersedes_decision_id)
    VALUES (_subject_id, v_uid, 'approve', v_reason, v_prev) RETURNING id INTO v_dec;
    UPDATE public.review_subjects
       SET current_status = 'approved',
           metadata = (v_meta - v_update_keys) || jsonb_build_object('review_status', 'approved', 'last_decision', 'approve',
             'last_rationale', v_reason, 'approved_at', now(), 'resubmitted_at', NULL,
             'archived_at', NULL, 'archive_rationale', NULL)
     WHERE id = _subject_id;
    UPDATE public.review_drafts SET status = 'submitted'
     WHERE linked_subject_id = _subject_id AND submitter_id = v_sub.submitted_by AND status = 'draft';
    v_pub := public._expert_publish_from_subject(_subject_id, v_dec, v_uid, true);
    RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'decisionId', v_dec,
                              'status', 'approved', 'changed', true) || v_pub;
  END IF;

  IF _decision = 'reject' THEN
    v_reason := COALESCE(v_reason, 'Pengajuan ditolak.');
    INSERT INTO public.review_decisions (subject_id, decided_by, decision, rationale, supersedes_decision_id)
    VALUES (_subject_id, v_uid, 'reject', v_reason, v_prev) RETURNING id INTO v_dec;
    IF v_live THEN
      -- Rejecting an update of a published profile: the approved profile, role and
      -- trainer status stay; the draft that is live becomes the active one again,
      -- so a later re-sync never publishes the rejected content.
      UPDATE public.review_drafts SET status = 'withdrawn', updated_at = now()
       WHERE linked_subject_id = _subject_id AND status <> 'withdrawn';
      v_prev_draft := CASE WHEN v_meta->>'previous_draft_id' ~ '^[0-9a-f-]{36}$' THEN (v_meta->>'previous_draft_id')::uuid END;
      UPDATE public.review_drafts SET status = 'submitted', updated_at = now()
       WHERE id = v_prev_draft AND linked_subject_id = _subject_id;
      IF NOT FOUND THEN
        INSERT INTO public.review_drafts (subject_kind, submitter_id, title, payload, status, linked_subject_id)
        VALUES ('expert', v_sub.submitted_by, v_expert.display_name,
                public._expert_live_payload(_subject_id, v_expert.audit_ref, '{}'::jsonb), 'submitted', _subject_id);
      END IF;
      UPDATE public.review_subjects
         SET current_status = 'approved', title = v_expert.display_name,
             metadata = (v_meta - v_update_keys) || jsonb_build_object('review_status', 'approved', 'last_decision', 'reject',
               'last_rationale', v_reason, 'resubmitted_at', NULL, 'revision_rejected_at', now())
       WHERE id = _subject_id;
      PERFORM public._expert_audit('expert_profile_update_rejected', v_uid, _subject_id, v_expert.id::text,
        jsonb_build_object('status', v_sub.current_status), jsonb_build_object('rationale', v_reason, 'live_version_kept', true));
      RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'decisionId', v_dec,
                                'status', 'approved', 'changed', true, 'liveVersionKept', true);
    END IF;
    UPDATE public.review_subjects
       SET current_status = 'rejected',
           metadata = v_meta || jsonb_build_object('review_status', 'rejected', 'last_decision', 'reject',
             'last_rationale', v_reason, 'rejected_at', now())
     WHERE id = _subject_id;
    PERFORM public._expert_deactivate_outputs(_subject_id, v_uid, 'expert_application_rejected');
    RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'decisionId', v_dec,
                              'status', 'rejected', 'changed', true);
  END IF;

  -- return_for_revision
  v_reason := COALESCE(v_reason, 'Perlu revisi kelengkapan dokumen.');
  INSERT INTO public.review_decisions (subject_id, decided_by, decision, rationale, supersedes_decision_id)
  VALUES (_subject_id, v_uid, 'return_for_revision', v_reason, v_prev) RETURNING id INTO v_dec;

  IF v_live AND v_eff = 'approved' THEN
    -- Revision of the published profile: a new draft holding the published version;
    -- the profile, role and trainer status stay.
    SELECT * INTO v_draft FROM public.review_drafts
     WHERE linked_subject_id = _subject_id AND submitter_id = v_sub.submitted_by AND status <> 'withdrawn'
     ORDER BY updated_at DESC LIMIT 1;
    v_payload := public._expert_live_payload(_subject_id, v_expert.audit_ref, v_draft.payload);
    UPDATE public.review_drafts SET status = 'withdrawn', updated_at = now()
     WHERE linked_subject_id = _subject_id AND status <> 'withdrawn';
    INSERT INTO public.review_drafts (subject_kind, submitter_id, title, payload, status, linked_subject_id)
    VALUES ('expert', v_sub.submitted_by, COALESCE(public._jtext(v_payload, 'fullName'), v_expert.display_name),
            v_payload, 'draft', _subject_id);
    v_meta := v_meta || jsonb_build_object('previous_draft_id', v_draft.id);
  ELSIF NOT EXISTS (SELECT 1 FROM public.review_drafts WHERE linked_subject_id = _subject_id AND status = 'draft') THEN
    -- Buka kembali TEPAT SATU draf milik pemohon (indeks unik satu draf per subjek).
    SELECT * INTO v_draft FROM public.review_drafts
     WHERE linked_subject_id = _subject_id AND submitter_id = v_sub.submitted_by AND status <> 'withdrawn'
     ORDER BY updated_at DESC LIMIT 1;
    IF v_draft.id IS NOT NULL THEN
      UPDATE public.review_drafts SET status = 'draft' WHERE id = v_draft.id;
    ELSE
      SELECT snapshot INTO v_snap FROM public.review_subject_revisions
       WHERE subject_id = _subject_id ORDER BY revision DESC LIMIT 1;
      INSERT INTO public.review_drafts (subject_kind, submitter_id, title, payload, status, linked_subject_id)
      VALUES ('expert', v_sub.submitted_by,
              COALESCE(public._jtext(v_snap, 'title'), v_sub.title, 'Pengajuan Expert'),
              CASE WHEN jsonb_typeof(v_snap->'payload') = 'object' THEN v_snap->'payload' ELSE '{}'::jsonb END,
              'draft', _subject_id);
    END IF;
  END IF;

  UPDATE public.review_subjects
     SET current_status = 'pending',
         metadata = (v_meta - 'update_open') || jsonb_build_object('review_status', 'revision_requested',
           'last_decision', 'return_for_revision', 'last_rationale', v_reason,
           'revised_at', now(), 'resubmitted_at', NULL)
           || CASE WHEN v_live THEN jsonb_build_object('live_version_kept', true) ELSE '{}'::jsonb END
   WHERE id = _subject_id;
  IF NOT v_live THEN
    PERFORM public._expert_deactivate_outputs(_subject_id, v_uid, 'expert_returned_for_revision');
  END IF;
  RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'decisionId', v_dec,
                            'status', 'revision_requested', 'changed', true, 'liveVersionKept', v_live);
END $$;
REVOKE ALL ON FUNCTION public.admin_expert_decide(uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_expert_decide(uuid, text, text, timestamptz) TO authenticated, service_role;

-- ------------------------------------------------------------- archive / restore
CREATE OR REPLACE FUNCTION public.admin_expert_archive(
  _subject_id uuid, _rationale text DEFAULT NULL, _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_sub public.review_subjects%ROWTYPE; v_meta jsonb; v_expert uuid;
  v_latest public.expert_trainer_status; v_open uuid; v_prev_draft uuid;
  v_reason text := COALESCE(NULLIF(btrim(COALESCE(_rationale, '')), ''), 'Diarsipkan oleh Administrator.');
BEGIN
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_reason) > 1000 THEN RAISE EXCEPTION 'rationale_too_long'; END IF;
  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id FOR UPDATE;
  IF v_sub.id IS NULL OR v_sub.kind <> 'expert' THEN RAISE EXCEPTION 'expert_subject_not_found'; END IF;
  IF v_sub.submitted_by = v_uid THEN RAISE EXCEPTION 'self_decision_forbidden'; END IF;
  IF _expected_updated_at IS NOT NULL AND v_sub.updated_at <> _expected_updated_at THEN RAISE EXCEPTION 'stale_subject'; END IF;
  IF public._expert_effective_status(_subject_id) = 'archived' THEN RAISE EXCEPTION 'already_archived'; END IF;

  v_meta := COALESCE(v_sub.metadata, '{}'::jsonb);
  -- An unsent update of the profile is dropped; the draft it replaced comes back.
  IF v_sub.current_status = 'approved' AND v_meta->>'update_open' = 'true' THEN
    SELECT id INTO v_open FROM public.review_drafts
     WHERE linked_subject_id = _subject_id AND submitter_id = v_sub.submitted_by AND status = 'draft' LIMIT 1;
    IF v_open IS NOT NULL THEN
      UPDATE public.review_drafts SET status = 'withdrawn', updated_at = now() WHERE id = v_open;
      v_prev_draft := CASE WHEN v_meta->>'previous_draft_id' ~ '^[0-9a-f-]{36}$' THEN (v_meta->>'previous_draft_id')::uuid END;
      UPDATE public.review_drafts SET status = 'submitted', updated_at = now()
       WHERE id = v_prev_draft AND linked_subject_id = _subject_id AND status = 'withdrawn';
    END IF;
    v_meta := v_meta - 'update_open' - 'update_note' - 'update_opened_at' - 'previous_draft_id';
  END IF;

  v_meta := v_meta || jsonb_build_object(
    'previous_status', v_sub.current_status, 'review_status', 'archived', 'archived_at', now(),
    'archived_by', v_uid, 'archive_rationale', v_reason);
  UPDATE public.review_subjects SET current_status = 'archived', metadata = v_meta WHERE id = _subject_id;

  SELECT id INTO v_expert FROM public.experts WHERE source_submission_id = _subject_id FOR UPDATE;
  IF v_expert IS NOT NULL THEN
    UPDATE public.experts SET current_status = 'archived', visibility = 'private' WHERE id = v_expert;
    SELECT * INTO v_latest FROM public.expert_trainer_status
     WHERE expert_id = v_expert ORDER BY version DESC, granted_at DESC LIMIT 1;
    IF v_latest.id IS NOT NULL AND v_latest.trainer_status <> 'inactive' THEN
      PERFORM public._expert_trainer_append(v_expert, 'inactive', v_uid,
        'expert_archived;previous=' || v_latest.trainer_status::text);
    END IF;
  END IF;
  PERFORM public._expert_set_role(v_sub.submitted_by, v_uid, false, 'expert_archived');
  PERFORM public._expert_audit('expert_archived', v_uid, _subject_id, COALESCE(v_expert, _subject_id)::text,
    jsonb_build_object('status', v_sub.current_status), jsonb_build_object('status', 'archived', 'rationale', v_reason));
  RETURN jsonb_build_object('subjectId', _subject_id, 'status', 'archived');
END $$;

CREATE OR REPLACE FUNCTION public.admin_expert_restore(
  _subject_id uuid, _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_sub public.review_subjects%ROWTYPE; v_meta jsonb; v_prev text;
  v_expert uuid; v_pub jsonb := '{}'::jsonb;
BEGIN
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id FOR UPDATE;
  IF v_sub.id IS NULL OR v_sub.kind <> 'expert' THEN RAISE EXCEPTION 'expert_subject_not_found'; END IF;
  IF v_sub.submitted_by = v_uid THEN RAISE EXCEPTION 'self_decision_forbidden'; END IF;
  IF _expected_updated_at IS NOT NULL AND v_sub.updated_at <> _expected_updated_at THEN RAISE EXCEPTION 'stale_subject'; END IF;
  IF public._expert_effective_status(_subject_id) <> 'archived' THEN RAISE EXCEPTION 'not_archived'; END IF;

  v_meta := COALESCE(v_sub.metadata, '{}'::jsonb);
  v_prev := CASE WHEN jsonb_typeof(v_meta->'previous_status') = 'string'
                  AND v_meta->>'previous_status' IN ('pending', 'under_review', 'decision_pending', 'approved', 'rejected')
                 THEN v_meta->>'previous_status' ELSE 'approved' END;
  UPDATE public.review_subjects
     SET current_status = v_prev,
         metadata = v_meta || jsonb_build_object('review_status', v_prev, 'unarchived_at', now(), 'unarchived_by', v_uid)
   WHERE id = _subject_id;

  IF v_prev = 'approved' THEN
    SELECT id INTO v_expert FROM public.experts WHERE source_submission_id = _subject_id FOR UPDATE;
    IF v_expert IS NOT NULL THEN
      UPDATE public.experts SET current_status = 'published', visibility = 'public' WHERE id = v_expert;
      PERFORM public._expert_trainer_restore(v_expert, v_uid, 'expert_archived;previous=', 'expert_unarchived');
      PERFORM public._expert_set_role(v_sub.submitted_by, v_uid, true, 'expert_unarchived');
    ELSE
      v_pub := public._expert_publish_from_subject(_subject_id, NULL, v_uid, false);
      v_expert := (v_pub->>'expertId')::uuid;
    END IF;
  ELSIF v_prev <> 'rejected' AND v_meta->>'live_version_kept' = 'true' THEN
    -- An update of a published profile was waiting: the approved profile goes
    -- back on air while the update returns to the queue.
    SELECT id INTO v_expert FROM public.experts WHERE source_submission_id = _subject_id FOR UPDATE;
    IF v_expert IS NOT NULL THEN
      UPDATE public.experts SET current_status = 'published', visibility = 'public' WHERE id = v_expert;
      PERFORM public._expert_trainer_restore(v_expert, v_uid, 'expert_archived;previous=', 'expert_unarchived');
      PERFORM public._expert_set_role(v_sub.submitted_by, v_uid, true, 'expert_unarchived');
    END IF;
  END IF;
  PERFORM public._expert_audit('expert_unarchived', v_uid, _subject_id, COALESCE(v_expert, _subject_id)::text,
    jsonb_build_object('status', v_sub.current_status), jsonb_build_object('status', v_prev));
  RETURN jsonb_build_object('subjectId', _subject_id,
                            'status', CASE WHEN v_prev = 'approved' THEN 'published' ELSE v_prev END) || v_pub;
END $$;
REVOKE ALL ON FUNCTION public.admin_expert_archive(uuid, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_expert_restore(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_expert_archive(uuid, text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_expert_restore(uuid, timestamptz) TO authenticated, service_role;

COMMIT;
