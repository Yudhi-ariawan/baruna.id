-- ============================================================================
-- Expert / draf: tutup jalur tulis langsung dari browser (SDK Supabase)
-- ============================================================================
-- Celah yang ditutup (semua bisa dipicu akun biasa lewat SDK browser):
--  1. review_drafts: pemilik bisa INSERT/UPDATE draf dengan linked_subject_id
--     pengajuan ORANG LAIN, mengubah status menjadi 'submitted', mengganti
--     subject_kind, dan membuat draf expert/modul tanpa RPC bergerbang.
--  2. submit_draft_for_review dipanggil langsung melewati pemeriksaan per jenis:
--     pengajuan expert tanpa cek kelengkapan / duplikat / kepemilikan dokumen,
--     modul tanpa gerbang trainer aktif dan cek lampiran.
--  3. expert_draft_update menerima path dokumen milik akun lain (admin lalu
--     membuat signed URL untuk CV orang lain).
--  4. Tabel turunan profil expert (bahasa, proyek, publikasi, pekerjaan,
--     pendidikan, sertifikasi, keahlian, portofolio, ketersediaan, ...) bisa
--     diubah langsung oleh pemilik walau profil sudah tayang (tanpa review).
--     Kontak privat juga bisa diubah langsung.
--  5. review_decisions bisa di-INSERT langsung oleh admin lama (tanpa mengubah
--     status subjek), sehingga status bisa tidak konsisten.
-- Semua alur aplikasi memakai RPC SECURITY DEFINER atau service role, sehingga
-- tidak ada fitur yang bergantung pada tulis langsung ini.

BEGIN;

-- ------------------------------------------------- 1. pengajuan: aturan per jenis
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

  PERFORM public.log_governance_event(
    'draft_submitted', v_uid, v_subject_id, 'review_draft', v_draft.id::text,
    NULL,
    jsonb_build_object('revision', v_next_rev, 'content_hash', v_hash));

  RETURN v_subject_id;
END; $function$;

-- ------------------------------------------------- 2. edit draf expert
CREATE OR REPLACE FUNCTION public.expert_draft_update(
  _draft_id uuid, _patch jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.review_drafts%ROWTYPE; v_next jsonb; v_problem text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF jsonb_typeof(_patch) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'payload_invalid'; END IF;
  IF _patch ? 'approved_zero_tariff' THEN
    RAISE EXCEPTION 'approved_zero_tariff not accepted in Phase 1.3';
  END IF;
  SELECT * INTO v_row FROM public.review_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF v_row.submitter_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.subject_kind <> 'expert' THEN RAISE EXCEPTION 'wrong_subject_kind'; END IF;
  IF v_row.status <> 'draft' THEN RAISE EXCEPTION 'draft_not_editable'; END IF;

  v_next := COALESCE(v_row.payload, '{}'::jsonb) || _patch;
  v_problem := public._expert_payload_problem(v_next, v_uid, false);
  IF v_problem IS NOT NULL THEN RAISE EXCEPTION '%', v_problem; END IF;

  UPDATE public.review_drafts
     SET payload = v_next,
         title = COALESCE(NULLIF(left(btrim(_patch->>'display_name'), 160), ''), title)
   WHERE id = _draft_id;
END $$;

-- ------------------------------------------------- 3. RLS review_drafts
-- Draf baru langsung dari browser hanya untuk jenis tanpa gerbang khusus, tanpa
-- tautan ke pengajuan; expert dan modul wajib lewat RPC masing-masing.
DROP POLICY IF EXISTS "drafts_owner_insert" ON public.review_drafts;
CREATE POLICY "drafts_owner_insert" ON public.review_drafts FOR INSERT TO authenticated
  WITH CHECK (submitter_id = auth.uid() AND status = 'draft' AND linked_subject_id IS NULL
              AND subject_kind IN ('knowledge_resource', 'training_need'));

DROP POLICY IF EXISTS "drafts_owner_delete" ON public.review_drafts;
CREATE POLICY "drafts_owner_delete" ON public.review_drafts FOR DELETE TO authenticated
  USING (submitter_id = auth.uid() AND status = 'draft' AND linked_subject_id IS NULL);

-- UPDATE langsung: hanya isi draf jenis tanpa gerbang, atau menarik (withdraw)
-- draf yang belum tertaut. Kolom kepemilikan/tautan/status kirim terkunci.
-- Tulis lewat RPC (SECURITY DEFINER) dan service role tidak dibatasi pemicu ini.
CREATE OR REPLACE FUNCTION public.review_drafts_guard_client_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF NEW.submitter_id IS DISTINCT FROM OLD.submitter_id
     OR NEW.subject_kind IS DISTINCT FROM OLD.subject_kind
     OR NEW.linked_subject_id IS DISTINCT FROM OLD.linked_subject_id
     OR NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
    RAISE EXCEPTION 'draft_field_locked' USING ERRCODE = '42501';
  END IF;
  IF NEW.status NOT IN ('draft', 'withdrawn') THEN
    RAISE EXCEPTION 'draft_submit_requires_rpc' USING ERRCODE = '42501';
  END IF;
  IF OLD.subject_kind IN ('expert', 'module') AND (
       NEW.payload IS DISTINCT FROM OLD.payload OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description OR NEW.external_ref IS DISTINCT FROM OLD.external_ref
       OR (NEW.status = 'withdrawn' AND OLD.linked_subject_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'draft_requires_rpc' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS review_drafts_guard_client_update ON public.review_drafts;
CREATE TRIGGER review_drafts_guard_client_update BEFORE UPDATE ON public.review_drafts
  FOR EACH ROW EXECUTE FUNCTION public.review_drafts_guard_client_update();

-- ------------------------------------------------- 4. tabel turunan expert
-- Hanya tata kelola (admin/management lama, admin/super admin/approver) yang
-- boleh menulis langsung. Perubahan profil oleh expert harus lewat pengajuan
-- dan persetujuan (PB-EXP-01 versioning), bukan edit langsung.
CREATE OR REPLACE FUNCTION public._expert_child_write(_expert_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'management')
      OR public._can_decide_review(auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public._expert_child_write(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._expert_child_write(uuid) TO authenticated;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['expert_education','expert_employment','expert_certifications','expert_publications'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_manage', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_governance_manage', t);
      EXECUTE format($f$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
                       USING (public._expert_child_write(expert_id))
                       WITH CHECK (public._expert_child_write(expert_id))$f$, t || '_governance_manage', t);
    END IF;
  END LOOP;
END $$;

-- Kontak privat: pemilik hanya membaca; ditulis saat publikasi yang disetujui.
DROP POLICY IF EXISTS expert_contact_private_owner ON public.expert_contact_private;
DROP POLICY IF EXISTS expert_contact_private_owner_read ON public.expert_contact_private;
CREATE POLICY expert_contact_private_owner_read ON public.expert_contact_private
  FOR SELECT TO authenticated USING (public._expert_is_owner(expert_id));
REVOKE INSERT, UPDATE, DELETE ON public.expert_contact_private FROM authenticated;

-- Profil expert: tidak ada baris yang bisa berstatus draft (experts_status_canonical_ck),
-- jadi kebijakan tulis pemilik tidak pernah berlaku; dihapus agar tidak dibuka lagi tanpa sengaja.
DROP POLICY IF EXISTS experts_owner_insert ON public.experts;
DROP POLICY IF EXISTS experts_owner_update_draft ON public.experts;
REVOKE INSERT, UPDATE, DELETE ON public.experts FROM authenticated;

-- ------------------------------------------------- 5. keputusan hanya lewat RPC
DROP POLICY IF EXISTS review_decisions_admin_write ON public.review_decisions;
REVOKE INSERT, UPDATE, DELETE ON public.review_decisions FROM authenticated;

-- ------------------------------------------------- 6. pemeriksaan data lama
-- Draf yang tertaut ke pengajuan milik akun lain dilepas (tidak dihapus) agar
-- tidak pernah ikut dipublikasikan. Jumlahnya dilaporkan sebagai NOTICE.
DO $$ DECLARE v_count integer; BEGIN
  UPDATE public.review_drafts d SET linked_subject_id = NULL, status = 'withdrawn'
    FROM public.review_subjects s
   WHERE d.linked_subject_id = s.id AND (d.submitter_id <> s.submitted_by OR d.subject_kind <> s.kind);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'review_drafts dilepas dari pengajuan akun lain: %', v_count;
END $$;

COMMIT;
