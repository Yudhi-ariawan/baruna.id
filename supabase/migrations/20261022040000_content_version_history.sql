-- ============================================================================
-- Riwayat versi modul, publikasi Knowledge Hub, dan profil expert (dibaca saja)
-- ============================================================================
-- Dicek 22 Okt 2026 (database intern-update, kode branch ini):
--
-- module_registry_versions, knowledge_resource_versions dan expert_versions diisi
-- trigger setiap kali konten tayang naik versi (Slide 20/36/38: versioning), tetapi
-- tidak ada yang menampilkannya: pemilik dan Konsol Kurasi tidak bisa melihat v1,
-- v2, ... beserta tanggal dan penyetujunya. Versi 1 sering tidak punya baris (trigger
-- hanya saat UPDATE; baris pertama dibuat dengan INSERT).
--
-- content_version_history(subject): daftar versi untuk satu pengajuan, hanya
-- metadata (nomor versi, tanggal tayang, penyetuju, alasan keputusan). Snapshot
-- isi TIDAK dibuka (profil expert memuat kontak pribadi). Akses sama dengan
-- riwayat revisi: pemilik, reviewer yang ditugaskan, admin/approver
-- (can_read_review_subject), ditambah peran pemutus (_can_decide_review).
-- Versi 1 tanpa baris riwayat diisi dari keputusan approve pertama.

BEGIN;

CREATE OR REPLACE FUNCTION public.content_version_history(_subject_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub public.review_subjects%ROWTYPE;
  v_entity uuid; v_current integer; v_status text; v_visibility text;
  v_rows jsonb := '[]'::jsonb;
  v_first public.review_decisions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id;
  IF v_sub.id IS NULL OR NOT (public.can_read_review_subject(_subject_id) OR public._can_decide_review(v_uid)) THEN
    -- Someone else's submission is reported as missing, not as forbidden.
    RAISE EXCEPTION 'subject_not_found';
  END IF;

  IF v_sub.kind = 'module' THEN
    SELECT id, version, current_status::text, visibility::text INTO v_entity, v_current, v_status, v_visibility
      FROM public.module_registry WHERE source_submission_id = _subject_id ORDER BY updated_at DESC LIMIT 1;
    SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'version')::int DESC, x->>'publishedAt' DESC), '[]'::jsonb) INTO v_rows FROM (
      SELECT jsonb_build_object('version', v.version, 'publishedAt', v.created_at,
               'approvedBy', p.display_name, 'note', d.rationale,
               'source', CASE WHEN d.id IS NOT NULL THEN 'approval' ELSE 'resync' END) x
        FROM public.module_registry_versions v
        LEFT JOIN public.review_decisions d ON d.id = v.publication_or_approval_ref
        LEFT JOIN public.profiles p ON p.id = COALESCE(d.decided_by, v.created_by)
       WHERE v.module_id = v_entity
       ORDER BY v.version DESC, v.created_at DESC LIMIT 100) t;
  ELSIF v_sub.kind = 'knowledge_resource' THEN
    SELECT id, version, current_status::text, visibility::text INTO v_entity, v_current, v_status, v_visibility
      FROM public.knowledge_resources WHERE source_submission_id = _subject_id ORDER BY updated_at DESC LIMIT 1;
    SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'version')::int DESC, x->>'publishedAt' DESC), '[]'::jsonb) INTO v_rows FROM (
      SELECT jsonb_build_object('version', v.version, 'publishedAt', v.created_at,
               'approvedBy', p.display_name, 'note', d.rationale,
               'source', CASE WHEN d.id IS NOT NULL THEN 'approval' ELSE 'resync' END) x
        FROM public.knowledge_resource_versions v
        LEFT JOIN public.review_decisions d ON d.id = v.publication_or_approval_ref
        LEFT JOIN public.profiles p ON p.id = COALESCE(d.decided_by, v.created_by)
       WHERE v.resource_id = v_entity
       ORDER BY v.version DESC, v.created_at DESC LIMIT 100) t;
  ELSIF v_sub.kind = 'expert' THEN
    SELECT id, version, current_status::text, visibility::text INTO v_entity, v_current, v_status, v_visibility
      FROM public.experts WHERE source_submission_id = _subject_id LIMIT 1;
    SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'version')::int DESC, x->>'publishedAt' DESC), '[]'::jsonb) INTO v_rows FROM (
      SELECT jsonb_build_object('version', v.version, 'publishedAt', v.created_at,
               'approvedBy', p.display_name, 'note', d.rationale,
               'source', CASE WHEN d.id IS NOT NULL THEN 'approval' ELSE 'resync' END) x
        FROM public.expert_versions v
        LEFT JOIN public.review_decisions d ON d.id = v.publication_or_approval_ref
        LEFT JOIN public.profiles p ON p.id = COALESCE(d.decided_by, v.created_by)
       WHERE v.expert_id = v_entity
       ORDER BY v.version DESC, v.created_at DESC LIMIT 100) t;
  ELSE
    RETURN jsonb_build_object('kind', v_sub.kind, 'supported', false, 'versions', '[]'::jsonb);
  END IF;

  -- Version 1 is created by INSERT, which the snapshot triggers do not record:
  -- it comes from the first approval of this submission.
  IF v_entity IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_rows) e WHERE (e->>'version')::int = 1) THEN
    SELECT * INTO v_first FROM public.review_decisions
     WHERE subject_id = _subject_id AND decision = 'approve' ORDER BY decided_at, created_at LIMIT 1;
    IF v_first.id IS NOT NULL THEN
      v_rows := v_rows || jsonb_build_array(jsonb_build_object(
        'version', 1, 'publishedAt', v_first.decided_at,
        'approvedBy', (SELECT display_name FROM public.profiles WHERE id = v_first.decided_by),
        'note', v_first.rationale, 'source', 'initial'));
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'kind', v_sub.kind, 'supported', true, 'entityId', v_entity, 'currentVersion', v_current,
    'published', COALESCE(v_status = 'published' AND v_visibility = 'public', false),
    'versions', v_rows);
END $$;
REVOKE ALL ON FUNCTION public.content_version_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.content_version_history(uuid) TO authenticated;

COMMIT;
