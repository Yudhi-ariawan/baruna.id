-- ============================================================================
-- Knowledge Hub: aturan pengajuan di database (Nomor 7, CATATAN_PERBAIKAN 2l)
-- ============================================================================
-- kr_draft_submit hanya memanggil submit_draft_for_review, yang punya aturan
-- khusus untuk expert dan modul saja. Pemeriksaan Knowledge Hub hanya ada di
-- server function (contribution.functions.ts), dan bahkan di sana LOKASI BERKAS
-- tidak diperiksa: `file.storagePath` / `coverFile.storagePath` diambil apa adanya
-- dari browser. Pengaju bisa menunjuk berkas pengguna lain di bucket privat
-- `knowledge-resource-submissions`; bila disetujui, sampulnya disalin ke bucket
-- publik dan berkasnya bisa diunduh dari katalog. Satu-satunya pengaman: admin.
--
-- Selain itu status "dikirim ulang setelah revisi" ditulis server function
-- dengan perintah terpisah setelah pengiriman (tidak atomik).
--
-- Sekarang (aturan sama dengan server function, ditegakkan untuk semua jalur):
--   * judul wajib, maks 300 karakter; jenis valid dan bukan `module`
--     (modul wajib lewat Portal Pengajuan Modul);
--   * setiap lokasi berkas (berkas utama dan sampul) wajib berada di folder milik
--     pengaju sendiri: users/<id-pengaju>/...;
--   * ukuran: PDF <= 10 MB, PPT/PPTX <= 25 MB, berkas lain <= 50 MB, sampul <= 2 MB;
--   * tautan eksternal hanya http/https; wajib ada berkas ATAU tautan;
--   * Best Practice: isian struktur praktik wajib lengkap;
--   * kirim ulang hanya bila pengajuan memang menunggu revisi; status
--     "resubmitted" ditulis di transaksi yang sama.
-- Data intern-update (21 Okt): 5 draf Knowledge Hub, semua lokasi berkas milik
-- pengajunya sendiri dan lolos aturan ini.

BEGIN;

CREATE OR REPLACE FUNCTION public._kr_payload_problem(_p jsonb, _uid uuid)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_title text := btrim(COALESCE(_p->>'title', ''));
  v_type text := COALESCE(_p->>'resource_type', '');
  v_url text := NULLIF(btrim(COALESCE(_p->>'externalUrl', '')), '');
  v_file_path text := COALESCE(NULLIF(btrim(COALESCE(_p->'file'->>'storagePath', '')), ''),
                               NULLIF(btrim(COALESCE(_p->>'uploadedFilePath', '')), ''),
                               NULLIF(btrim(COALESCE(_p->>'filePath', '')), ''));
  v_name text := lower(COALESCE(_p->'file'->>'name', _p->>'fileName', ''));
  v_size numeric; v_cover_size numeric; v_path text; v_ps jsonb;
  v_prefix text := 'users/' || _uid::text || '/';
BEGIN
  IF _p IS NULL OR jsonb_typeof(_p) <> 'object' THEN RETURN 'kr_payload_invalid'; END IF;
  IF v_title = '' THEN RETURN 'kr_title_required'; END IF;
  IF char_length(v_title) > 300 THEN RETURN 'kr_title_too_long'; END IF;
  IF v_type = 'module' THEN RETURN 'kr_module_requires_portal'; END IF;
  IF NOT (v_type = ANY (enum_range(NULL::public.resource_type_v1)::text[])) THEN RETURN 'kr_type_invalid'; END IF;

  -- Every stored file location (main file and cover, in all its legacy keys).
  FOR v_path IN
    SELECT btrim(x) FROM unnest(ARRAY[
      _p->'file'->>'storagePath', _p->>'uploadedFilePath', _p->>'filePath',
      _p->'coverFile'->>'storagePath', _p->>'coverFilePath']) AS x
     WHERE x IS NOT NULL AND btrim(x) <> ''
  LOOP
    IF char_length(v_path) > 500 OR position('..' IN v_path) > 0 OR left(v_path, char_length(v_prefix)) <> v_prefix THEN
      RETURN 'kr_file_not_owned';
    END IF;
  END LOOP;

  IF v_url IS NOT NULL AND (char_length(v_url) > 2000 OR v_url !~* '^https?://[^\s]+$') THEN
    RETURN 'kr_external_url_invalid';
  END IF;
  IF v_file_path IS NULL AND v_url IS NULL THEN RETURN 'kr_file_or_url_required'; END IF;

  v_size := CASE WHEN jsonb_typeof(_p->'file'->'size') = 'number' THEN (_p->'file'->>'size')::numeric END;
  IF v_size IS NOT NULL THEN
    IF v_name ~ '\.pdf$' AND v_size > 10 * 1024 * 1024 THEN RETURN 'kr_pdf_too_large'; END IF;
    IF v_name ~ '\.pptx?$' AND v_size > 25 * 1024 * 1024 THEN RETURN 'kr_ppt_too_large'; END IF;
    IF v_size > 50 * 1024 * 1024 THEN RETURN 'kr_file_too_large'; END IF;
  END IF;
  v_cover_size := CASE WHEN jsonb_typeof(_p->'coverFile'->'size') = 'number' THEN (_p->'coverFile'->>'size')::numeric END;
  IF v_cover_size IS NOT NULL AND v_cover_size > 2 * 1024 * 1024 THEN RETURN 'kr_cover_too_large'; END IF;

  IF v_type = 'best_practice' THEN
    v_ps := CASE WHEN jsonb_typeof(_p->'practiceStructure') = 'object' THEN _p->'practiceStructure' ELSE '{}'::jsonb END;
    IF EXISTS (SELECT 1 FROM unnest(ARRAY['challenge', 'context', 'intervention', 'steps', 'results', 'lessons']) k
                WHERE btrim(COALESCE(v_ps->>k, '')) = '') THEN
      RETURN 'kr_best_practice_incomplete';
    END IF;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._kr_payload_problem(jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- Latest definition (20261015070000) plus the knowledge_resource branch.
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
    -- A linked submission is only re-sent while a curator has asked for a revision.
    IF v_draft.linked_subject_id IS NOT NULL AND (
         v_linked.current_status <> 'pending'
         OR COALESCE(v_linked.metadata->>'review_status', '') NOT IN ('revision_requested', 'pending', 'resubmitted')) THEN
      RAISE EXCEPTION 'not_awaiting_revision';
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
  IF v_draft.subject_kind = 'knowledge_resource' AND v_draft.linked_subject_id IS NOT NULL THEN
    v_was_revised := COALESCE(v_linked.metadata->>'review_status', '') = 'revision_requested'
                     OR jsonb_typeof(v_linked.metadata->'last_rationale') = 'string';
    UPDATE public.review_subjects
       SET current_status = 'pending',
           title = COALESCE(NULLIF(btrim(v_draft.payload->>'title'), ''), v_draft.title),
           metadata = COALESCE(metadata, '{}'::jsonb)
                      || CASE WHEN v_was_revised
                              THEN jsonb_build_object('review_status', 'resubmitted', 'resubmitted_at', now())
                              ELSE jsonb_build_object('review_status', 'pending') END,
           updated_at = now()
     WHERE id = v_subject_id;
  END IF;

  PERFORM public.log_governance_event(
    'draft_submitted', v_uid, v_subject_id, 'review_draft', v_draft.id::text,
    NULL,
    jsonb_build_object('revision', v_next_rev, 'content_hash', v_hash));

  RETURN v_subject_id;
END; $function$;

COMMIT;
