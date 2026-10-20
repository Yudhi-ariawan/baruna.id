-- ============================================================================
-- Knowledge Hub: keputusan publikasi dalam SATU transaksi (admin_kr_decide)
-- ============================================================================
-- Sebelumnya recordAdminPublicationDecision (TypeScript, service role) menulis
-- review_subjects, review_decisions, review_drafts, knowledge_resources dan
-- knowledge_resource_authors dalam langkah terpisah:
--   * error sebagian langkah tidak diperiksa (bisa "sukses" padahal setengah jadi);
--   * tanpa kunci baris / pemeriksaan versi: klik ganda atau dua admin bersamaan
--     (data intern-update: satu publikasi punya 3 keputusan approve berturut-turut);
--   * tanpa aturan transisi: "pulihkan" menayangkan publikasi apa pun, termasuk yang
--     diarsipkan saat masih menunggu kurasi;
--   * tidak mencegah memutuskan pengajuan milik sendiri;
--   * qa_reviewer/verifier boleh mengarsipkan/memulihkan (keputusan final lain sudah
--     ditolak pemicu review_decisions);
--   * draf yang dipakai tidak difilter ke milik pengaju.
-- Sekarang semua langkah ada di fungsi ini. Bentuk data yang ditulis SAMA dengan
-- sebelumnya (status, kunci metadata), sehingga daftar admin dan Knowledge Hub
-- yang membacanya tidak berubah. Nilai katalog (jenis, judul, sampul, dsb.) tetap
-- dihitung server function dan dikirim sebagai _resource; sampul yang diunggah
-- disalin ke bucket publik SETELAH transaksi berhasil (operasi storage).

BEGIN;

CREATE OR REPLACE FUNCTION public._kr_text_array(_v jsonb)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(_v) = 'array'
              THEN ARRAY(SELECT left(btrim(x), 200) FROM jsonb_array_elements_text(_v) WITH ORDINALITY AS t(x, n)
                          WHERE btrim(x) <> '' ORDER BY n LIMIT 50)
              ELSE '{}'::text[] END
$$;
REVOKE ALL ON FUNCTION public._kr_text_array(jsonb) FROM PUBLIC, anon, authenticated;

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

  v_meta := COALESCE(v_sub.metadata, '{}'::jsonb);
  v_title := COALESCE(NULLIF(btrim(v_draft.payload->>'title'), ''), NULLIF(btrim(v_draft.title), ''), v_sub.title);
  v_state := CASE
    WHEN v_sub.current_status IN ('withdrawn', 'archived') OR v_meta->>'review_status' = 'archived'
         OR v_meta->>'last_decision' = 'archive' THEN 'archived'
    WHEN v_sub.current_status = 'approved' THEN 'approved'
    WHEN v_sub.current_status = 'rejected' THEN 'rejected'
    WHEN v_meta->>'review_status' = 'revision_requested' AND COALESCE(v_draft.status, 'draft') = 'draft'
      THEN 'revision_requested'
    ELSE 'pending' END;

  -- ---------------------------------------------------------- transition rules
  IF v_state = 'archived' AND _decision <> 'restore' THEN RAISE EXCEPTION 'archived_restore_first'; END IF;
  IF _decision = 'restore' AND v_state <> 'archived' THEN RAISE EXCEPTION 'not_archived'; END IF;
  IF _decision = 'approve' AND v_state = 'approved' THEN RAISE EXCEPTION 'already_approved'; END IF;
  IF _decision = 'approve' AND v_state = 'revision_requested' THEN RAISE EXCEPTION 'awaiting_applicant_revision'; END IF;
  IF _decision = 'reject' AND v_state = 'rejected' THEN RAISE EXCEPTION 'already_rejected'; END IF;
  IF _decision = 'return_for_revision' AND v_state = 'rejected' THEN RAISE EXCEPTION 'rejected_is_final'; END IF;
  IF _decision = 'return_for_revision' AND v_state = 'revision_requested' THEN RAISE EXCEPTION 'already_awaiting_revision'; END IF;

  -- ---------------------------------------------------------- archive
  IF _decision = 'archive' THEN
    v_rat := COALESCE(v_rat, 'Publikasi diarsipkan sementara dan ditarik dari katalog publik Knowledge Hub oleh Administrator.');
    UPDATE public.review_subjects
       SET title = v_title, current_status = 'withdrawn', updated_at = v_now,
           metadata = v_meta || jsonb_build_object(
             'previous_status', v_sub.current_status, 'review_status', 'archived', 'last_decision', 'archive',
             'last_rationale', v_rat, 'archived_reason', v_rat, 'archived_at', v_now, 'archived_by', v_uid)
     WHERE id = _subject_id;
    UPDATE public.knowledge_resources SET current_status = 'archived', visibility = 'private', updated_at = v_now
     WHERE source_submission_id = _subject_id;
    PERFORM public.log_governance_event('publication_archived', v_uid, _subject_id, 'knowledge_resources',
      COALESCE(v_kr.id::text, _subject_id::text), jsonb_build_object('status', v_sub.current_status),
      jsonb_build_object('status', 'archived', 'rationale', v_rat));
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
    UPDATE public.review_subjects
       SET title = v_title, current_status = 'pending', updated_at = v_now,
           metadata = v_meta || jsonb_build_object(
             'review_status', 'revision_requested', 'last_decision', 'return_for_revision', 'last_rationale', v_rat,
             'archived_reason', NULL, 'revised_at', v_now, 'resubmitted_at', NULL)
     WHERE id = _subject_id;
    IF v_draft.id IS NOT NULL THEN
      UPDATE public.review_drafts SET status = 'draft', updated_at = v_now WHERE id = v_draft.id;
    END IF;
    UPDATE public.knowledge_resources SET current_status = 'archived', visibility = 'private', updated_at = v_now
     WHERE source_submission_id = _subject_id;

  ELSIF _decision = 'reject' THEN
    UPDATE public.review_subjects
       SET title = v_title, current_status = 'rejected', updated_at = v_now,
           metadata = v_meta || jsonb_build_object(
             'review_status', 'rejected', 'last_decision', 'reject', 'last_rationale', v_rat, 'archived_reason', NULL)
     WHERE id = _subject_id;
    UPDATE public.knowledge_resources SET current_status = 'archived', visibility = 'private', updated_at = v_now
     WHERE source_submission_id = _subject_id;

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
           metadata = v_meta || jsonb_build_object(
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
    jsonb_build_object('decision', _decision, 'rationale', v_rat, 'resource_id', v_res_id));

  RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'decisionId', v_dec_id,
                            'resourceId', v_res_id,
                            'status', CASE _decision WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected'
                                                     ELSE 'revision_requested' END);
END $$;
REVOKE ALL ON FUNCTION public.admin_kr_decide(uuid, text, text, timestamptz, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kr_decide(uuid, text, text, timestamptz, jsonb) TO authenticated;

COMMIT;
