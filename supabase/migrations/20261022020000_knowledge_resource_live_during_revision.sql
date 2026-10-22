-- ============================================================================
-- Knowledge Hub: versi yang tayang tetap tayang selama revisi/pembaruan,
-- dan kontributor bisa memperbarui publikasinya sendiri
-- ============================================================================
-- Dicek 22 Okt 2026 (database intern-update, kode branch ini):
--
-- * admin_kr_decide (20261020060000) 'return_for_revision' dan 'reject' selalu
--   mengubah knowledge_resources menjadi archived + private. Untuk publikasi yang
--   SUDAH tayang, meminta revisi menghilangkannya dari katalog sampai revisi
--   disetujui. Terjadi di intern-update: "Teknologi Pemantauan Rumpon & Pe..."
--   (disetujui, lalu diminta revisi) sekarang archived/private.
-- * Kontributor tidak bisa memulai pembaruan sendiri: submit_draft_for_review
--   (20261021050000) hanya menerima draf tertaut saat kurator meminta revisi.
--   PB-KH (Slide 26-34) dan Slide 13: konten tayang hanya berubah lewat review.
--
-- Perubahan (pola yang sama dengan modul, 20261021120000 dan 20261022010000):
-- * Publikasi yang tayang tetap tayang selama revisi dan pembaruan. Disetujui:
--   isi katalog diganti dan versi naik (trigger trg_kr_version_snapshot mengisi
--   knowledge_resource_versions). Ditolak: versi lama tetap tayang, status kembali
--   'approved'. 'Tolak' tanpa pengajuan yang menunggu ditolak (pakai Arsipkan
--   untuk menarik tayang).
-- * Kurator meminta revisi publikasi tayang: draf baru berisi versi yang TAYANG
--   (revisi yang disetujui oleh keputusan knowledge_resources.audit_ref), bukan
--   draf terakhir yang bisa saja pembaruan yang ditolak.
-- * contributor_open_resource_update / contributor_cancel_resource_update:
--   pemilik membuka pembaruan (status tetap 'approved' sampai dikirim) dan bisa
--   membatalkannya sebelum dikirim. Pengiriman lewat jalur biasa
--   (kr_draft_submit -> submit_draft_for_review) dengan semua aturan berkas.
-- * Arsip saat pembaruan masih disiapkan membatalkan pembaruan itu. Pulihkan dari
--   arsip menayangkan lagi versi yang disetujui walau pengajuan kembali ke antrean.
-- * Perbaikan data: publikasi yang disembunyikan oleh permintaan revisi (bukan
--   oleh arsip) ditayangkan kembali.

BEGIN;

-- ------------------------------------------------------------- live payload
-- The payload of the revision approved by the decision that published the
-- resource; the fallback (e.g. legacy rows without audit_ref) is the caller's draft.
CREATE OR REPLACE FUNCTION public._kr_live_payload(_subject_id uuid, _audit_ref uuid, _fallback jsonb)
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
REVOKE ALL ON FUNCTION public._kr_live_payload(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- decisions
CREATE OR REPLACE FUNCTION public.admin_kr_decide(
  _subject_id uuid,
  _decision text,
  _rationale text DEFAULT NULL,
  _expected_updated_at timestamptz DEFAULT NULL,
  _resource jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub public.review_subjects%ROWTYPE;
  v_draft public.review_drafts%ROWTYPE;
  v_kr public.knowledge_resources%ROWTYPE;
  v_meta jsonb; v_state text; v_title text; v_now timestamptz := now();
  v_rat text := NULLIF(btrim(COALESCE(_rationale, '')), '');
  v_dec_id uuid; v_sup uuid; v_last_final text; v_target text;
  v_type public.resource_type_v1; v_res_title text; v_year integer; v_expert uuid;
  v_res_id uuid; v_next integer; v_author uuid; v_meta_res jsonb;
  v_live boolean; v_live_payload jsonb; v_prev_draft uuid;
  -- Keys of an update branch; cleared by every decision that closes it.
  v_update_keys text[] := ARRAY['update_open', 'update_note', 'update_opened_at', 'previous_draft_id', 'live_version_kept'];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _decision NOT IN ('approve', 'return_for_revision', 'reject', 'archive', 'restore') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;
  IF char_length(COALESCE(v_rat, '')) > 5000 THEN RAISE EXCEPTION 'rationale_too_long'; END IF;

  SELECT * INTO v_sub FROM public.review_subjects
   WHERE id = _subject_id AND kind = 'knowledge_resource' FOR UPDATE;
  IF v_sub.id IS NULL THEN RAISE EXCEPTION 'subject_not_found'; END IF;
  IF v_sub.submitted_by = v_uid THEN RAISE EXCEPTION 'self_decision_forbidden' USING ERRCODE = '42501'; END IF;
  IF _expected_updated_at IS NOT NULL AND v_sub.updated_at <> _expected_updated_at THEN
    RAISE EXCEPTION 'stale_subject';
  END IF;

  -- Only the submitter's own draft counts.
  SELECT * INTO v_draft FROM public.review_drafts
   WHERE linked_subject_id = _subject_id AND submitter_id = v_sub.submitted_by AND status <> 'withdrawn'
   ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  SELECT * INTO v_kr FROM public.knowledge_resources
   WHERE source_submission_id = _subject_id ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  v_live := v_kr.id IS NOT NULL AND v_kr.current_status = 'published' AND v_kr.visibility = 'public';

  v_meta := COALESCE(v_sub.metadata, '{}'::jsonb);
  v_title := COALESCE(NULLIF(btrim(v_draft.payload->>'title'), ''), NULLIF(btrim(v_draft.title), ''), v_sub.title);
  v_state := CASE
    WHEN v_sub.current_status IN ('withdrawn', 'archived') OR v_meta->>'review_status' = 'archived'
         OR v_meta->>'last_decision' = 'archive' THEN 'archived'
    -- The owner is preparing an update of the live version (not sent yet).
    WHEN v_sub.current_status = 'approved' AND v_meta->>'update_open' = 'true' AND v_draft.status = 'draft'
      THEN 'update_drafting'
    WHEN v_sub.current_status = 'approved' THEN 'approved'
    WHEN v_sub.current_status = 'rejected' THEN 'rejected'
    WHEN v_meta->>'review_status' = 'revision_requested' AND COALESCE(v_draft.status, 'draft') = 'draft'
      THEN 'revision_requested'
    ELSE 'pending' END;

  -- ---------------------------------------------------------- transition rules
  IF v_state = 'archived' AND _decision <> 'restore' THEN RAISE EXCEPTION 'archived_restore_first'; END IF;
  IF _decision = 'restore' AND v_state <> 'archived' THEN RAISE EXCEPTION 'not_archived'; END IF;
  IF _decision IN ('approve', 'reject') AND v_state = 'update_drafting' THEN RAISE EXCEPTION 'awaiting_applicant_revision'; END IF;
  IF _decision = 'return_for_revision' AND v_state = 'update_drafting' THEN RAISE EXCEPTION 'contributor_update_open'; END IF;
  IF _decision = 'approve' AND v_state = 'approved' THEN RAISE EXCEPTION 'already_approved'; END IF;
  -- Nothing waits for a decision: taking a live publication down is 'archive'.
  IF _decision = 'reject' AND v_state = 'approved' THEN RAISE EXCEPTION 'nothing_to_decide'; END IF;
  IF _decision = 'approve' AND v_state = 'revision_requested' THEN RAISE EXCEPTION 'awaiting_applicant_revision'; END IF;
  IF _decision = 'reject' AND v_state = 'rejected' THEN RAISE EXCEPTION 'already_rejected'; END IF;
  IF _decision = 'return_for_revision' AND v_state = 'rejected' THEN RAISE EXCEPTION 'rejected_is_final'; END IF;
  IF _decision = 'return_for_revision' AND v_state = 'revision_requested' THEN RAISE EXCEPTION 'already_awaiting_revision'; END IF;

  -- ---------------------------------------------------------- archive
  IF _decision = 'archive' THEN
    v_rat := COALESCE(v_rat, 'Publikasi diarsipkan sementara dan ditarik dari katalog publik Knowledge Hub oleh Administrator.');
    IF v_state = 'update_drafting' THEN
      -- An unsent update is dropped; the draft it replaced comes back.
      UPDATE public.review_drafts SET status = 'withdrawn', updated_at = v_now WHERE id = v_draft.id;
      v_prev_draft := CASE WHEN v_meta->>'previous_draft_id' ~ '^[0-9a-f-]{36}$' THEN (v_meta->>'previous_draft_id')::uuid END;
      UPDATE public.review_drafts SET status = 'submitted', updated_at = v_now
       WHERE id = v_prev_draft AND linked_subject_id = _subject_id AND status = 'withdrawn';
      v_meta := v_meta - v_update_keys;
      v_title := v_sub.title;
    END IF;
    UPDATE public.review_subjects
       SET title = v_title, current_status = 'withdrawn', updated_at = v_now,
           metadata = v_meta || jsonb_build_object(
             'previous_status', v_sub.current_status, 'review_status', 'archived', 'last_decision', 'archive',
             'last_rationale', v_rat, 'archived_reason', v_rat, 'archived_at', v_now, 'archived_by', v_uid)
     WHERE id = _subject_id;
    UPDATE public.knowledge_resources SET current_status = 'archived', visibility = 'private', updated_at = v_now
     WHERE source_submission_id = _subject_id;
    PERFORM public.log_governance_event('publication_archived', v_uid, _subject_id, 'knowledge_resources',
      COALESCE(v_kr.id::text, _subject_id::text), jsonb_build_object('status', v_sub.current_status, 'state', v_state),
      jsonb_build_object('status', 'archived', 'rationale', v_rat, 'update_dropped', v_state = 'update_drafting'));
    RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'status', 'archived');
  END IF;

  -- ---------------------------------------------------------- restore
  IF _decision = 'restore' THEN
    SELECT d.decision INTO v_last_final FROM public.review_decisions d
     WHERE d.subject_id = _subject_id AND d.decision IN ('approve', 'reject', 'return_for_revision')
     ORDER BY d.decided_at DESC, d.created_at DESC LIMIT 1;
    -- Only something that was published before the archive goes back on air;
    -- anything archived while still under curation returns to the queue.
    IF v_kr.id IS NOT NULL AND v_last_final = 'approve'
       AND COALESCE(v_meta->>'previous_status', 'approved') = 'approved' THEN
      v_rat := COALESCE(v_rat, 'Publikasi dipulihkan dan ditayangkan kembali ke katalog publik Knowledge Hub.');
      UPDATE public.review_subjects
         SET title = v_title, current_status = 'approved', updated_at = v_now,
             metadata = v_meta || jsonb_build_object(
               'review_status', 'approved', 'last_decision', 'approve', 'last_rationale', v_rat,
               'archived_reason', NULL, 'restored_at', v_now, 'restored_by', v_uid)
       WHERE id = _subject_id;
      UPDATE public.knowledge_resources SET current_status = 'published', visibility = 'public', updated_at = v_now
       WHERE id = v_kr.id;
      v_target := 'approved';
    ELSE
      v_rat := COALESCE(v_rat, 'Publikasi dipulihkan ke antrean kurasi.');
      v_target := CASE WHEN v_meta->>'previous_status' IN ('pending', 'under_review', 'decision_pending', 'rejected')
                       THEN v_meta->>'previous_status' ELSE 'pending' END;
      UPDATE public.review_subjects
         SET title = v_title, current_status = v_target, updated_at = v_now,
             metadata = v_meta || jsonb_build_object(
               'review_status', CASE WHEN v_target = 'rejected' THEN 'rejected' ELSE 'pending' END,
               'last_decision', 'restore', 'last_rationale', v_rat,
               'archived_reason', NULL, 'restored_at', v_now, 'restored_by', v_uid)
       WHERE id = _subject_id;
      -- A version approved earlier goes back on air while the newer submission
      -- waits in the queue (same rule as a revision of a live publication).
      IF v_target <> 'rejected' AND v_kr.id IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.review_decisions d
            WHERE d.id = v_kr.audit_ref AND d.subject_id = _subject_id AND d.decision = 'approve') THEN
        UPDATE public.knowledge_resources SET current_status = 'published', visibility = 'public', updated_at = v_now
         WHERE id = v_kr.id;
        UPDATE public.review_subjects SET metadata = metadata || jsonb_build_object('live_version_kept', true)
         WHERE id = _subject_id;
      END IF;
    END IF;
    PERFORM public.log_governance_event('publication_restored', v_uid, _subject_id, 'knowledge_resources',
      COALESCE(v_kr.id::text, _subject_id::text), jsonb_build_object('status', 'archived'),
      jsonb_build_object('status', v_target, 'rationale', v_rat));
    RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'status', v_target);
  END IF;

  -- ---------------------------------------------------------- approve / reject / return
  v_rat := COALESCE(v_rat, CASE _decision
    WHEN 'return_for_revision' THEN 'Perlu perbaikan kelengkapan naskah publikasi atau dokumen terlampir.'
    WHEN 'approve' THEN 'Publikasi disetujui & ditayangkan ke publik di Knowledge Hub.'
    ELSE 'Publikasi ditolak.' END);

  IF _decision IN ('approve', 'reject') THEN
    SELECT id INTO v_sup FROM public.review_decisions
     WHERE subject_id = _subject_id AND supersedes_decision_id IS NULL AND decision IN ('approve', 'reject')
     LIMIT 1;
    IF v_sup IS NULL THEN
      SELECT id INTO v_sup FROM public.review_decisions WHERE subject_id = _subject_id
       ORDER BY created_at DESC LIMIT 1;
    END IF;
  END IF;
  INSERT INTO public.review_decisions (subject_id, decided_by, decision, rationale, supersedes_decision_id)
  VALUES (_subject_id, v_uid, _decision, v_rat, v_sup) RETURNING id INTO v_dec_id;

  IF _decision = 'return_for_revision' THEN
    IF v_live AND v_state = 'approved' THEN
      -- Revision of the live publication: a new draft holding the live version
      -- (after a rejected update the newest draft is the rejected one).
      v_live_payload := public._kr_live_payload(_subject_id, v_kr.audit_ref, v_draft.payload);
      UPDATE public.review_drafts SET status = 'withdrawn', updated_at = v_now
       WHERE linked_subject_id = _subject_id AND status <> 'withdrawn';
      INSERT INTO public.review_drafts (subject_kind, submitter_id, title, description, external_ref,
                                        payload, status, linked_subject_id)
      VALUES ('knowledge_resource', v_sub.submitted_by,
              COALESCE(NULLIF(btrim(v_live_payload->>'title'), ''), v_kr.title),
              v_sub.description, v_sub.external_ref, v_live_payload, 'draft', _subject_id);
      v_title := COALESCE(NULLIF(btrim(v_live_payload->>'title'), ''), v_kr.title);
    ELSIF v_draft.id IS NOT NULL THEN
      UPDATE public.review_drafts SET status = 'draft', updated_at = v_now WHERE id = v_draft.id;
    END IF;
    UPDATE public.review_subjects
       SET title = v_title, current_status = 'pending', updated_at = v_now,
           metadata = (v_meta - 'update_open' - 'previous_draft_id') || jsonb_build_object(
             'review_status', 'revision_requested', 'last_decision', 'return_for_revision', 'last_rationale', v_rat,
             'archived_reason', NULL, 'revised_at', v_now, 'resubmitted_at', NULL, 'live_version_kept', v_live)
     WHERE id = _subject_id;
    IF NOT v_live THEN
      UPDATE public.knowledge_resources SET current_status = 'archived', visibility = 'private', updated_at = v_now
       WHERE source_submission_id = _subject_id;
    END IF;

  ELSIF _decision = 'reject' THEN
    IF v_live THEN
      -- Rejecting an update of a live publication: the approved version stays on air.
      UPDATE public.review_subjects
         SET current_status = 'approved', updated_at = v_now,
             metadata = (v_meta - v_update_keys) || jsonb_build_object(
               'review_status', 'approved', 'last_decision', 'reject', 'last_rationale', v_rat,
               'archived_reason', NULL, 'resubmitted_at', NULL, 'revision_rejected_at', v_now)
       WHERE id = _subject_id;
    ELSE
      UPDATE public.review_subjects
         SET title = v_title, current_status = 'rejected', updated_at = v_now,
             metadata = v_meta || jsonb_build_object(
               'review_status', 'rejected', 'last_decision', 'reject', 'last_rationale', v_rat, 'archived_reason', NULL)
       WHERE id = _subject_id;
      UPDATE public.knowledge_resources SET current_status = 'archived', visibility = 'private', updated_at = v_now
       WHERE source_submission_id = _subject_id;
    END IF;

  ELSE -- approve: publish to the catalog
    IF _resource IS NULL OR jsonb_typeof(_resource) <> 'object' THEN RAISE EXCEPTION 'resource_required'; END IF;
    v_res_title := left(NULLIF(btrim(COALESCE(_resource->>'title', '')), ''), 500);
    IF v_res_title IS NULL THEN RAISE EXCEPTION 'resource_title_required'; END IF;
    BEGIN
      v_type := (_resource->>'resource_type')::public.resource_type_v1;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'invalid_resource_type';
    END;
    IF v_type IS NULL THEN RAISE EXCEPTION 'invalid_resource_type'; END IF;
    v_year := CASE WHEN (_resource->>'publication_year') ~ '^\d{4}$'
                    AND (_resource->>'publication_year')::integer BETWEEN 1900 AND 2100
                   THEN (_resource->>'publication_year')::integer END;
    v_meta_res := CASE WHEN jsonb_typeof(_resource->'metadata') = 'object' THEN _resource->'metadata' ELSE '{}'::jsonb END;
    SELECT e.id INTO v_expert FROM public.experts e
     WHERE e.original_contributor_id = v_sub.submitted_by AND e.current_status = 'published'
     ORDER BY e.updated_at DESC LIMIT 1;

    UPDATE public.review_subjects
       SET title = v_title, current_status = 'approved', updated_at = v_now,
           metadata = (v_meta - v_update_keys) || jsonb_build_object(
             'review_status', 'approved', 'last_decision', 'approve', 'last_rationale', v_rat,
             'archived_reason', NULL, 'approved_at', v_now, 'resubmitted_at', NULL)
     WHERE id = _subject_id;
    IF v_draft.id IS NOT NULL THEN
      UPDATE public.review_drafts SET status = 'submitted', updated_at = v_now WHERE id = v_draft.id;
    END IF;

    IF v_kr.id IS NOT NULL THEN
      v_next := GREATEST(v_kr.version,
        COALESCE((SELECT max(version) FROM public.knowledge_resource_versions WHERE resource_id = v_kr.id), 0)) + 1;
      UPDATE public.knowledge_resources SET
        current_status = 'published', visibility = 'public', verification_status = 'governance_verified',
        approved_by = v_uid, published_by = v_uid, approval_date = v_now, publication_date = v_now,
        audit_ref = v_dec_id, resource_type = v_type, title = v_res_title,
        summary = NULLIF(_resource->>'summary', ''), abstract = NULLIF(_resource->>'abstract', ''),
        language = NULLIF(left(_resource->>'language', 80), ''), publication_year = v_year,
        publisher = NULLIF(left(_resource->>'publisher', 300), ''),
        external_url = NULLIF(btrim(_resource->>'external_url'), ''),
        thumbnail_url = NULLIF(btrim(_resource->>'thumbnail_url'), ''),
        topics = public._kr_text_array(_resource->'topics'),
        keywords = public._kr_text_array(_resource->'keywords'),
        geographic_focus = public._kr_text_array(_resource->'geographic_focus'),
        related_expert_ids = CASE WHEN v_expert IS NOT NULL THEN ARRAY[v_expert] ELSE related_expert_ids END,
        metadata = v_meta_res, version = v_next, updated_at = v_now
      WHERE id = v_kr.id;
      v_res_id := v_kr.id;
    ELSE
      INSERT INTO public.knowledge_resources (
        source_type, source_submission_id, created_by, original_contributor_id, approved_by, published_by,
        approval_date, publication_date, verification_status, visibility, current_status, audit_ref,
        resource_type, title, summary, abstract, language, publication_year, publisher, external_url,
        thumbnail_url, topics, keywords, geographic_focus, related_expert_ids, metadata)
      VALUES (
        'external_submission', _subject_id, v_sub.submitted_by, v_sub.submitted_by, v_uid, v_uid,
        v_now, v_now, 'governance_verified', 'public', 'published', v_dec_id,
        v_type, v_res_title, NULLIF(_resource->>'summary', ''), NULLIF(_resource->>'abstract', ''),
        NULLIF(left(_resource->>'language', 80), ''), v_year, NULLIF(left(_resource->>'publisher', 300), ''),
        NULLIF(btrim(_resource->>'external_url'), ''), NULLIF(btrim(_resource->>'thumbnail_url'), ''),
        public._kr_text_array(_resource->'topics'), public._kr_text_array(_resource->'keywords'),
        public._kr_text_array(_resource->'geographic_focus'),
        CASE WHEN v_expert IS NOT NULL THEN ARRAY[v_expert] ELSE '{}'::uuid[] END, v_meta_res)
      RETURNING id INTO v_res_id;
    END IF;

    -- Canonical first author.
    SELECT id INTO v_author FROM public.knowledge_resource_authors
     WHERE resource_id = v_res_id AND display_order = 0 LIMIT 1 FOR UPDATE;
    IF v_author IS NOT NULL THEN
      UPDATE public.knowledge_resource_authors SET
        expert_id = v_expert,
        display_name = COALESCE(NULLIF(left(btrim(_resource->>'author_name'), 200), ''), 'BARUNA Contributor'),
        affiliation = NULLIF(left(btrim(COALESCE(_resource->>'author_affiliation', '')), 300), ''),
        role = COALESCE(NULLIF(_resource->>'author_role', ''), 'Author'), is_corresponding = true
      WHERE id = v_author;
    ELSE
      INSERT INTO public.knowledge_resource_authors (resource_id, expert_id, display_name, affiliation, role,
                                                     is_corresponding, display_order)
      VALUES (v_res_id, v_expert,
              COALESCE(NULLIF(left(btrim(_resource->>'author_name'), 200), ''), 'BARUNA Contributor'),
              NULLIF(left(btrim(COALESCE(_resource->>'author_affiliation', '')), 300), ''),
              COALESCE(NULLIF(_resource->>'author_role', ''), 'Author'), true, 0);
    END IF;
  END IF;

  PERFORM public.log_governance_event('publication_' || _decision, v_uid, _subject_id, 'review_decision',
    v_dec_id::text, jsonb_build_object('status', v_sub.current_status, 'state', v_state),
    jsonb_build_object('decision', _decision, 'rationale', v_rat, 'resource_id', COALESCE(v_res_id, v_kr.id),
                       'live_version_kept', v_live AND _decision <> 'approve'));

  RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'decisionId', v_dec_id,
                            'resourceId', v_res_id, 'liveVersionKept', v_live AND _decision <> 'approve',
                            'status', CASE _decision WHEN 'approve' THEN 'approved'
                                                     WHEN 'reject' THEN CASE WHEN v_live THEN 'approved' ELSE 'rejected' END
                                                     ELSE 'revision_requested' END);
END $$;
REVOKE ALL ON FUNCTION public.admin_kr_decide(uuid, text, text, timestamptz, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kr_decide(uuid, text, text, timestamptz, jsonb) TO authenticated;

-- ------------------------------------------------------------- owner opens an update
CREATE OR REPLACE FUNCTION public.contributor_open_resource_update(_subject_id uuid, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_note text := btrim(COALESCE(_note, ''));
  v_subject public.review_subjects%ROWTYPE;
  v_meta jsonb;
  v_kr public.knowledge_resources%ROWTYPE;
  v_prev public.review_drafts%ROWTYPE;
  v_payload jsonb;
  v_draft_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF char_length(v_note) < 5 THEN RAISE EXCEPTION 'update_note_required'; END IF;
  IF char_length(v_note) > 2000 THEN RAISE EXCEPTION 'update_note_too_long'; END IF;

  SELECT * INTO v_subject FROM public.review_subjects
   WHERE id = _subject_id AND kind = 'knowledge_resource' FOR UPDATE;
  -- Someone else's publication is reported as missing, not as forbidden.
  IF v_subject.id IS NULL OR v_subject.submitted_by <> v_uid THEN RAISE EXCEPTION 'resource_subject_not_found'; END IF;
  v_meta := COALESCE(v_subject.metadata, '{}'::jsonb);
  IF v_subject.current_status IN ('withdrawn', 'archived') OR v_meta->>'review_status' = 'archived' THEN
    RAISE EXCEPTION 'resource_archived';
  END IF;

  SELECT * INTO v_kr FROM public.knowledge_resources
   WHERE source_submission_id = _subject_id AND current_status = 'published' AND visibility = 'public'
   ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  IF v_kr.id IS NULL THEN RAISE EXCEPTION 'published_resource_not_found'; END IF;

  IF EXISTS (SELECT 1 FROM public.review_drafts WHERE linked_subject_id = _subject_id AND status = 'draft') THEN
    RAISE EXCEPTION 'resource_update_already_open';
  END IF;
  -- A submitted update (or a curator's revision request) is still running.
  IF v_subject.current_status <> 'approved' THEN RAISE EXCEPTION 'resource_review_in_progress'; END IF;

  SELECT * INTO v_prev FROM public.review_drafts
   WHERE linked_subject_id = _subject_id AND submitter_id = v_uid AND status <> 'withdrawn'
   ORDER BY updated_at DESC LIMIT 1;
  v_payload := public._kr_live_payload(_subject_id, v_kr.audit_ref, v_prev.payload);

  UPDATE public.review_drafts SET status = 'withdrawn', updated_at = now()
   WHERE linked_subject_id = _subject_id AND status <> 'withdrawn';
  INSERT INTO public.review_drafts (subject_kind, submitter_id, title, description, external_ref,
                                    payload, status, linked_subject_id)
  VALUES ('knowledge_resource', v_uid, COALESCE(NULLIF(btrim(v_payload->>'title'), ''), v_kr.title),
          v_subject.description, v_subject.external_ref, v_payload, 'draft', _subject_id)
  RETURNING id INTO v_draft_id;

  -- Status stays 'approved' (the live version is the approved one) until the
  -- owner sends the update.
  UPDATE public.review_subjects
     SET updated_at = now(),
         metadata = v_meta || jsonb_build_object(
           'update_open', true, 'update_note', v_note, 'update_opened_at', now(),
           'previous_draft_id', v_prev.id, 'update_cancelled_at', NULL)
   WHERE id = _subject_id;

  PERFORM public.log_governance_event(
    'resource_update_opened', v_uid, _subject_id, 'review_draft', v_draft_id::text,
    jsonb_build_object('resource_id', v_kr.id, 'published_version', v_kr.version, 'previous_draft_id', v_prev.id),
    jsonb_build_object('draft_id', v_draft_id, 'note', v_note, 'published_resource_unchanged', true));

  RETURN v_draft_id;
END $$;
REVOKE ALL ON FUNCTION public.contributor_open_resource_update(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contributor_open_resource_update(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.contributor_cancel_resource_update(_subject_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_subject public.review_subjects%ROWTYPE;
  v_meta jsonb;
  v_draft uuid;
  v_prev uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_subject FROM public.review_subjects
   WHERE id = _subject_id AND kind = 'knowledge_resource' FOR UPDATE;
  IF v_subject.id IS NULL OR v_subject.submitted_by <> v_uid THEN RAISE EXCEPTION 'resource_subject_not_found'; END IF;
  v_meta := COALESCE(v_subject.metadata, '{}'::jsonb);

  SELECT id INTO v_draft FROM public.review_drafts
   WHERE linked_subject_id = _subject_id AND submitter_id = v_uid AND status = 'draft'
   ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  -- Only an unsent update the owner opened; a curator's revision request is not theirs to drop.
  IF v_draft IS NULL OR v_subject.current_status <> 'approved' OR v_meta->>'update_open' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'no_resource_update_open';
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

  PERFORM public.log_governance_event(
    'resource_update_cancelled', v_uid, _subject_id, 'review_draft', v_draft::text,
    jsonb_build_object('draft_id', v_draft), jsonb_build_object('restored_draft_id', v_prev));
END $$;
REVOKE ALL ON FUNCTION public.contributor_cancel_resource_update(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contributor_cancel_resource_update(uuid) TO authenticated;

-- ------------------------------------------------------------- submission
-- Latest definition (20261021050000); the knowledge_resource branch also accepts
-- an update the owner opened on a live publication.
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
  v_problem text;
  v_linked public.review_subjects%ROWTYPE;
  v_was_revised boolean;
  v_is_update boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_draft FROM public.review_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_draft.id IS NULL THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF v_draft.submitter_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_draft.status <> 'draft' THEN RAISE EXCEPTION 'draft_already_submitted'; END IF;

  -- Draf hanya boleh menuju pengajuan milik sendiri dengan jenis yang sama.
  IF v_draft.linked_subject_id IS NOT NULL THEN
    SELECT * INTO v_linked FROM public.review_subjects WHERE id = v_draft.linked_subject_id FOR UPDATE;
    IF v_linked.id IS NULL OR v_linked.submitted_by <> v_uid OR v_linked.kind <> v_draft.subject_kind THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  IF v_draft.subject_kind = 'expert' THEN
    v_problem := public._expert_payload_problem(COALESCE(v_draft.payload, '{}'::jsonb), v_uid, true);
    IF v_problem IS NOT NULL THEN RAISE EXCEPTION '%', v_problem; END IF;
    IF v_draft.linked_subject_id IS NULL THEN
      -- PB-EXP-02: satu pengajuan aktif dan satu profil per akun.
      PERFORM pg_advisory_xact_lock(hashtextextended('expert_submit:' || v_uid::text, 0));
      IF EXISTS (SELECT 1 FROM public.experts
                  WHERE (original_contributor_id = v_uid OR created_by = v_uid)
                    AND current_status IN ('approved', 'published')) THEN
        RAISE EXCEPTION 'expert_profile_exists';
      END IF;
      IF EXISTS (SELECT 1 FROM public.review_subjects
                  WHERE kind = 'expert' AND submitted_by = v_uid
                    AND current_status IN ('pending', 'under_review', 'decision_pending')
                    AND metadata->>'review_status' = 'revision_requested') THEN
        RAISE EXCEPTION 'expert_revision_pending';
      END IF;
      IF EXISTS (SELECT 1 FROM public.review_subjects
                  WHERE kind = 'expert' AND submitted_by = v_uid
                    AND current_status IN ('pending', 'under_review', 'decision_pending')) THEN
        RAISE EXCEPTION 'expert_application_already_pending';
      END IF;
    ELSIF public._expert_effective_status(v_draft.linked_subject_id) <> 'revision_requested' THEN
      RAISE EXCEPTION 'not_awaiting_revision';
    END IF;
  ELSIF v_draft.subject_kind = 'module' THEN
    PERFORM public._module_trainer_gate(v_uid);
    PERFORM public._assert_module_attachments(COALESCE(v_draft.payload, '{}'::jsonb), v_uid, true);
  ELSIF v_draft.subject_kind = 'knowledge_resource' THEN
    v_problem := public._kr_payload_problem(COALESCE(v_draft.payload, '{}'::jsonb), v_uid);
    IF v_problem IS NOT NULL THEN RAISE EXCEPTION '%', v_problem; END IF;
    IF v_draft.linked_subject_id IS NOT NULL THEN
      -- An update the owner opened on the live publication (status stays approved).
      v_is_update := v_linked.current_status = 'approved' AND v_linked.metadata->>'update_open' = 'true';
      -- Otherwise a linked submission is only re-sent while a curator has asked for a revision.
      IF NOT v_is_update AND (
           v_linked.current_status <> 'pending'
           OR COALESCE(v_linked.metadata->>'review_status', '') NOT IN ('revision_requested', 'pending', 'resubmitted')) THEN
        RAISE EXCEPTION 'not_awaiting_revision';
      END IF;
    END IF;
  END IF;

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

  -- Revisi expert yang dikirim ulang: status antrean ditulis di transaksi yang sama
  -- (dulu disinkronkan server function sesudahnya dan kegagalannya hanya dilog).
  IF v_draft.subject_kind = 'expert' AND v_draft.linked_subject_id IS NOT NULL THEN
    UPDATE public.review_subjects
       SET current_status = 'pending', title = v_draft.title,
           metadata = COALESCE(metadata, '{}'::jsonb)
                      || jsonb_build_object('review_status', 'resubmitted', 'resubmitted_at', now())
     WHERE id = v_subject_id;
  END IF;

  -- Knowledge Hub: same rule the server function applied afterwards, now atomic.
  -- An owner's update joins the queue as a resubmission; the live version stays on air.
  IF v_draft.subject_kind = 'knowledge_resource' AND v_draft.linked_subject_id IS NOT NULL THEN
    v_was_revised := v_is_update
                     OR COALESCE(v_linked.metadata->>'review_status', '') = 'revision_requested'
                     OR jsonb_typeof(v_linked.metadata->'last_rationale') = 'string';
    UPDATE public.review_subjects
       SET current_status = 'pending',
           title = COALESCE(NULLIF(btrim(v_draft.payload->>'title'), ''), v_draft.title),
           metadata = (COALESCE(metadata, '{}'::jsonb) - 'update_open' - 'previous_draft_id')
                      || CASE WHEN v_was_revised
                              THEN jsonb_build_object('review_status', 'resubmitted', 'resubmitted_at', now())
                              ELSE jsonb_build_object('review_status', 'pending') END
                      || CASE WHEN v_is_update THEN jsonb_build_object('live_version_kept', true) ELSE '{}'::jsonb END,
           updated_at = now()
     WHERE id = v_subject_id;
  END IF;

  PERFORM public.log_governance_event(
    'draft_submitted', v_uid, v_subject_id, 'review_draft', v_draft.id::text,
    NULL,
    jsonb_build_object('revision', v_next_rev, 'content_hash', v_hash, 'live_update', v_is_update));

  RETURN v_subject_id;
END; $function$;

-- ------------------------------------------------------------- data repair
-- Publications hidden by a revision request (the old rule), not by an archive:
-- the approved version goes back on air while the revision is pending.
WITH hidden AS (
  SELECT kr.id AS resource_id, s.id AS subject_id
    FROM public.knowledge_resources kr
    JOIN public.review_subjects s ON s.id = kr.source_submission_id AND s.kind = 'knowledge_resource'
    JOIN public.review_decisions ok ON ok.id = kr.audit_ref AND ok.subject_id = s.id AND ok.decision = 'approve'
   WHERE s.current_status = 'pending'
     AND s.metadata->>'review_status' IN ('revision_requested', 'resubmitted')
     AND kr.current_status = 'archived' AND kr.visibility = 'private'
     AND (SELECT d.decision FROM public.review_decisions d WHERE d.subject_id = s.id
           ORDER BY d.decided_at DESC, d.created_at DESC LIMIT 1) = 'return_for_revision'
     AND NOT EXISTS (SELECT 1 FROM public.governance_audit_log g
                      WHERE g.subject_id = s.id AND g.event_type = 'publication_archived'
                        AND g.created_at > ok.decided_at)
), shown AS (
  UPDATE public.knowledge_resources kr SET current_status = 'published', visibility = 'public', updated_at = now()
    FROM hidden h WHERE kr.id = h.resource_id
  RETURNING kr.id, h.subject_id
)
UPDATE public.review_subjects s SET metadata = COALESCE(s.metadata, '{}'::jsonb) || jsonb_build_object('live_version_kept', true)
  FROM shown WHERE s.id = shown.subject_id;

COMMIT;
