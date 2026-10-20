-- ============================================================================
-- Materi modul tidak lagi terbaca pengunjung lewat API langsung (Nomor 4)
-- ============================================================================
-- Dibuktikan sebagai pengunjung tanpa login (21 Okt 2026, database intern-update):
--
-- 1. `select metadata from module_registry` BERHASIL: path lampiran
--    (`attached_resources`, `documents`) dan tautan video (`video_url`) dari semua
--    modul tayang. Policy baca publik berlaku untuk semua kolom. Gerbang isi modul
--    (`can_access_module_content`, 20261020020000) hanya menjaga server function.
--
-- 2. Proyeksi modul ke Knowledge Hub menyalin seluruh metadata modul ke
--    `knowledge_resources.metadata` (baris resource_type = 'module'), yang publik.
--    Lebih berat: `getKnowledgeResourceDownload` (tanpa login) menandatangani
--    lampiran pertama resource itu, sehingga BERKAS utama 3 modul tayang (PDF/PPTX
--    di bucket expert-applications) bisa diunduh siapa saja.
--
-- 3. Policy `krv_read` memberi semua pengguna login salinan versi resource
--    Knowledge Hub yang tayang; salinan versi modul akan berisi metadata lengkap.
--    (Saat dicek: 0 salinan versi modul, jadi belum ada yang bocor lewat jalur ini.)
--
-- Perbaikan:
--   a. Hak kolom: anon dan authenticated boleh membaca semua kolom module_registry
--      KECUALI `metadata`; izin tulis langsung dicabut (selama ini sudah ditolak
--      policy). Aplikasi membaca tabel ini hanya lewat service role.
--      Kolom baru di masa depan TIDAK otomatis terbaca publik; beri GRANT kolom
--      secara sadar bila memang perlu.
--   b. Metadata resource Knowledge Hub bertipe modul selalu dibersihkan dari
--      materi oleh pemicu (berlaku untuk semua jalur tulis), dan data lama
--      dibersihkan. Ringkasan berkas (nama, jenis, ukuran) tetap ada untuk label.
--   c. `krv_read`: cabang "tayang untuk publik" tidak berlaku untuk resource modul.
--   (Kode: proyeksi tidak lagi menyalin materi, dan unduhan Knowledge Hub menolak
--    resource modul.)
--
-- Pengaman: migrasi BATAL tanpa mengubah apa pun bila masih ada policy, view
-- security_invoker, atau fungsi SECURITY INVOKER (yang bisa dijalankan anon/
-- authenticated) yang membaca module_registry bersama kata `metadata`.

BEGIN;

-- --------------------------------------------------------------- pengaman
DO $$
DECLARE v_problems text;
BEGIN
  SELECT string_agg(item, E'\n  ') INTO v_problems FROM (
    SELECT format('policy %I pada %I.%I', policyname, schemaname, tablename) AS item
      FROM pg_policies
     WHERE (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) ~* 'module_registry'
       AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) ~* 'metadata'
    UNION ALL
    SELECT format('view %I.%I (security_invoker)', v.schemaname, v.viewname)
      FROM pg_views v
      JOIN pg_namespace n ON n.nspname = v.schemaname
      JOIN pg_class c ON c.relname = v.viewname AND c.relnamespace = n.oid
     WHERE v.definition ~* 'module_registry' AND v.definition ~* 'metadata'
       AND COALESCE(array_to_string(c.reloptions, ','), '') ~* 'security_invoker=(true|on|1)'
    UNION ALL
    SELECT format('fungsi %s (SECURITY INVOKER)', p.oid::regprocedure)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname IN ('public', 'storage')
       AND NOT p.prosecdef
       AND p.prosrc ~* 'module_registry' AND p.prosrc ~* 'metadata'
       AND (has_function_privilege('anon', p.oid, 'EXECUTE')
            OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  ) s;
  IF v_problems IS NOT NULL THEN
    RAISE EXCEPTION E'module_registry.metadata masih dibaca dengan hak pengguna oleh:\n  %', v_problems
      USING HINT = 'Tidak ada yang diubah. Jadikan objek di atas SECURITY DEFINER atau sesuaikan dulu.';
  END IF;
END $$;

-- ------------------------------------------- a. hak kolom module_registry
DO $$
DECLARE v_cols text;
BEGIN
  IF to_regclass('public.module_registry') IS NULL THEN RETURN; END IF;
  REVOKE ALL ON TABLE public.module_registry FROM anon, authenticated;
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'module_registry' AND column_name <> 'metadata';
  EXECUTE format('GRANT SELECT (%s) ON public.module_registry TO anon, authenticated', v_cols);
END $$;

-- ------------------------- b. metadata Knowledge Hub bertipe modul tanpa materi
-- Ringkasan berkas tanpa path/url/bucket; nama yang berupa URL dibuang.
CREATE OR REPLACE FUNCTION public._kr_module_public_metadata(_m jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (COALESCE(_m, '{}'::jsonb)
            - 'attached_resources' - 'documents' - 'video_url' - 'quiz_questions'
            - 'file' - 'filePath' - 'uploadedFilePath' - 'externalUrl')
         || CASE WHEN jsonb_typeof(_m -> 'attached_resources') = 'array' THEN
              jsonb_build_object('attached_resources', (
                SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                         'name',     CASE WHEN e ->> 'name'     ~* '^https?://' THEN NULL ELSE e -> 'name' END,
                         'fileName', CASE WHEN e ->> 'fileName' ~* '^https?://' THEN NULL ELSE e -> 'fileName' END,
                         'type',     e -> 'type',
                         'category', e -> 'category',
                         'fileType', e -> 'fileType',
                         'fileSize', e -> 'fileSize',
                         'size',     e -> 'size'))), '[]'::jsonb)
                  FROM jsonb_array_elements(_m -> 'attached_resources') AS e
                 WHERE jsonb_typeof(e) = 'object'))
            ELSE '{}'::jsonb END
$$;

CREATE OR REPLACE FUNCTION public._kr_module_metadata_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.resource_type::text = 'module' THEN
    NEW.metadata := public._kr_module_public_metadata(NEW.metadata);
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF to_regclass('public.knowledge_resources') IS NULL THEN RETURN; END IF;
  DROP TRIGGER IF EXISTS kr_module_metadata_guard ON public.knowledge_resources;
  CREATE TRIGGER kr_module_metadata_guard
    BEFORE INSERT OR UPDATE OF metadata, resource_type ON public.knowledge_resources
    FOR EACH ROW EXECUTE FUNCTION public._kr_module_metadata_guard();

  -- Data lama: pemicu di atas ikut membersihkan baris yang diperbarui.
  UPDATE public.knowledge_resources
     SET metadata = public._kr_module_public_metadata(metadata)
   WHERE resource_type::text = 'module'
     AND metadata IS DISTINCT FROM public._kr_module_public_metadata(metadata);
END $$;

-- ------------------------------ c. salinan versi resource modul tidak publik
DO $$
BEGIN
  IF to_regclass('public.knowledge_resource_versions') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS krv_read ON public.knowledge_resource_versions;
  CREATE POLICY krv_read ON public.knowledge_resource_versions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.knowledge_resources r
     WHERE r.id = knowledge_resource_versions.resource_id
       AND ( r.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'management')
          OR (r.source_submission_id IS NOT NULL AND public.can_review_registry_subject(r.source_submission_id))
          OR (r.current_status = 'published' AND r.visibility = 'public' AND r.resource_type::text <> 'module') )
  ));
END $$;

COMMIT;
