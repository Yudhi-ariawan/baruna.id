-- ============================================================================
-- Data Master: topik Knowledge Hub
-- ============================================================================
-- Dicek 2 Nov 2026 (database intern-update, kode branch ini):
--
-- * 12 topik pilihan formulir kontribusi Knowledge Hub ditulis tetap di kode
--   (src/lib/resources.ts TOPIC_CATEGORIES). Slide 32/33: Taxonomy / Category
--   dikelola Admin Console, tidak hard-coded.
-- * Database tidak memeriksa topik sama sekali: _kr_payload_problem
--   (20261021050000) tidak membaca topicCategory, sehingga pengajuan lewat API boleh
--   memakai topik apa pun atau tanpa topik, lalu tayang di katalog.
-- * Data: 9 knowledge_resources dan 5 draf Knowledge Hub. Satu topik di luar
--   daftar sudah dipakai ("Konservasi Ekosistem Pesisir & Perikanan Berkelanjutan").
--   Publikasi jenis `module` menyimpan judul outline modul di kolom topics (dari
--   module_registry, bukan dari formulir ini), jadi tidak dihitung dan tidak disalin.
--
-- Perubahan:
-- * Tabel kh_topic_taxonomy: dibaca siapa saja (katalog dan formulir); tulis hanya
--   lewat RPC di bawah. 12 topik formulir dimasukkan dengan urutannya (aktif); topik
--   yang sudah dipakai publikasi/draf tetapi tidak ada di daftar ditambahkan nonaktif.
--   Bila Data Master topik sudah pernah dipakai (audit master_kh_topic_*), langkah
--   pengisian dilewati agar menjalankan ulang migrasi tidak menimpa perubahan.
-- * master_kh_topics_overview / master_kh_topic_save / master_kh_topic_set_active:
--   super_admin/admin/approver (_can_decide_review), sama dengan Data Master lain;
--   nama unik (tanpa beda huruf besar/kecil dan spasi); topik yang sudah dipakai tidak
--   bisa diganti namanya (publikasi tayang menyimpan nama itu); topik aktif terakhir
--   tidak bisa dinonaktifkan; setiap perubahan tercatat di audit trail.
-- * _kr_payload_problem: saat pengajuan dikirim, topik wajib ada dan wajib ada di
--   daftar (aktif atau nonaktif, agar publikasi lama tetap bisa diperbarui). Isi
--   lain fungsi itu sama persis dengan 20261021050000.
-- Butuh 20261023010000 (_master_norm, _master_code).

BEGIN;

CREATE TABLE IF NOT EXISTS public.kh_topic_taxonomy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS kh_topic_taxonomy_name_norm_uidx ON public.kh_topic_taxonomy (public._master_norm(name));
ALTER TABLE public.kh_topic_taxonomy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kh_topic_taxonomy_read ON public.kh_topic_taxonomy;
CREATE POLICY kh_topic_taxonomy_read ON public.kh_topic_taxonomy FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON public.kh_topic_taxonomy FROM anon, authenticated;
GRANT SELECT ON public.kh_topic_taxonomy TO anon, authenticated;
GRANT ALL ON public.kh_topic_taxonomy TO service_role;

-- Publications (not modules) and Knowledge Hub drafts that use a topic.
CREATE OR REPLACE FUNCTION public._kh_topic_usage(_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH t AS (SELECT public._master_norm(name) AS n FROM public.kh_topic_taxonomy WHERE id = _id)
  SELECT (
    (SELECT count(*) FROM public.knowledge_resources r, t
      WHERE r.resource_type::text <> 'module'
        AND EXISTS (SELECT 1 FROM unnest(COALESCE(r.topics, '{}'::text[])) x WHERE public._master_norm(x) = t.n))
  + (SELECT count(*) FROM public.review_drafts d, t
      WHERE d.subject_kind = 'knowledge_resource'
        AND public._master_norm(COALESCE(d.payload->>'topicCategory', d.payload->>'topic')) = t.n)
  )::integer
$$;
REVOKE ALL ON FUNCTION public._kh_topic_usage(uuid) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- data
DO $$
DECLARE
  v_list text[] := ARRAY['Aquaculture', 'Fisheries Management', 'Fish Health', 'Fish Processing',
    'Marine Conservation', 'Blue Economy', 'Climate Change', 'Marine Spatial Planning',
    'Monitoring, Control and Surveillance (MCS)', 'IUU Fishing', 'Ocean Literacy', 'Capacity Development'];
  v_name text; v_i integer := 0; v_id uuid; v_code text;
  v_managed boolean := EXISTS (SELECT 1 FROM public.governance_audit_log WHERE event_type LIKE 'master_kh_topic_%');
BEGIN
  IF v_managed THEN RETURN; END IF;
  FOREACH v_name IN ARRAY v_list LOOP
    v_i := v_i + 1;
    SELECT id INTO v_id FROM public.kh_topic_taxonomy WHERE public._master_norm(name) = public._master_norm(v_name);
    IF v_id IS NULL THEN
      v_code := public._master_code(v_name);
      WHILE EXISTS (SELECT 1 FROM public.kh_topic_taxonomy WHERE code = v_code) LOOP
        v_code := v_code || '_' || left(replace(gen_random_uuid()::text, '-', ''), 4);
      END LOOP;
      INSERT INTO public.kh_topic_taxonomy (code, name, active, display_order) VALUES (v_code, v_name, true, v_i * 10);
    ELSE
      UPDATE public.kh_topic_taxonomy SET active = true, display_order = v_i * 10 WHERE id = v_id;
    END IF;
    v_id := NULL;
  END LOOP;

  -- Topics already used but missing from the list: kept (inactive) so those
  -- publications and drafts stay valid.
  FOR v_name IN
    SELECT DISTINCT btrim(x) FROM public.knowledge_resources r, unnest(COALESCE(r.topics, '{}'::text[])) x
     WHERE r.resource_type::text <> 'module' AND btrim(x) <> ''
    UNION
    SELECT DISTINCT btrim(COALESCE(d.payload->>'topicCategory', d.payload->>'topic')) FROM public.review_drafts d
     WHERE d.subject_kind = 'knowledge_resource' AND btrim(COALESCE(d.payload->>'topicCategory', d.payload->>'topic', '')) <> ''
  LOOP
    IF char_length(v_name) <= 120 AND NOT EXISTS (
         SELECT 1 FROM public.kh_topic_taxonomy WHERE public._master_norm(name) = public._master_norm(v_name)) THEN
      v_code := public._master_code(v_name);
      WHILE EXISTS (SELECT 1 FROM public.kh_topic_taxonomy WHERE code = v_code) LOOP
        v_code := v_code || '_' || left(replace(gen_random_uuid()::text, '-', ''), 4);
      END LOOP;
      INSERT INTO public.kh_topic_taxonomy (code, name, active, display_order) VALUES (v_code, v_name, false, 1000);
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------- read (console)
CREATE OR REPLACE FUNCTION public.master_kh_topics_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', t.id, 'code', t.code, 'name', t.name, 'description', t.description, 'active', t.active,
      'displayOrder', t.display_order, 'usage', public._kh_topic_usage(t.id), 'updatedAt', t.updated_at)
      ORDER BY t.active DESC, t.display_order, t.name) FROM public.kh_topic_taxonomy t), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.master_kh_topics_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_kh_topics_overview() TO authenticated;

-- ------------------------------------------------------------- write
CREATE OR REPLACE FUNCTION public.master_kh_topic_save(
  _id uuid, _name text, _description text DEFAULT NULL, _display_order integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := regexp_replace(btrim(COALESCE(_name, '')), '\s+', ' ', 'g');
  v_desc text := NULLIF(btrim(COALESCE(_description, '')), '');
  v_row public.kh_topic_taxonomy%ROWTYPE; v_code text; v_order integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_name) < 2 OR char_length(v_name) > 120 OR v_name ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'kh_topic_name_invalid'; END IF;
  IF char_length(COALESCE(v_desc, '')) > 500 THEN RAISE EXCEPTION 'kh_topic_description_too_long'; END IF;
  IF _display_order IS NOT NULL AND (_display_order < 0 OR _display_order > 100000) THEN RAISE EXCEPTION 'kh_topic_order_invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('master_kh_topic'));

  IF EXISTS (SELECT 1 FROM public.kh_topic_taxonomy
              WHERE public._master_norm(name) = public._master_norm(v_name) AND id IS DISTINCT FROM _id) THEN
    RAISE EXCEPTION 'kh_topic_name_exists';
  END IF;

  IF _id IS NULL THEN
    v_code := public._master_code(v_name);
    WHILE EXISTS (SELECT 1 FROM public.kh_topic_taxonomy WHERE code = v_code) LOOP
      v_code := v_code || '_' || left(replace(gen_random_uuid()::text, '-', ''), 4);
    END LOOP;
    v_order := COALESCE(_display_order, (SELECT COALESCE(max(display_order), 0) + 10 FROM public.kh_topic_taxonomy WHERE active));
    INSERT INTO public.kh_topic_taxonomy (code, name, description, active, display_order)
    VALUES (v_code, v_name, v_desc, true, v_order) RETURNING * INTO v_row;
    PERFORM public.log_governance_event('master_kh_topic_created', v_uid, NULL, 'kh_topic_taxonomy', v_row.id::text,
      NULL, to_jsonb(v_row));
  ELSE
    SELECT * INTO v_row FROM public.kh_topic_taxonomy WHERE id = _id FOR UPDATE;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'kh_topic_not_found'; END IF;
    -- A name stored on published resources is not changed outside their review.
    IF v_row.name IS DISTINCT FROM v_name AND public._kh_topic_usage(_id) > 0 THEN
      RAISE EXCEPTION 'kh_topic_in_use_rename_forbidden';
    END IF;
    UPDATE public.kh_topic_taxonomy
       SET name = v_name, description = v_desc, display_order = COALESCE(_display_order, display_order), updated_at = now()
     WHERE id = _id;
    PERFORM public.log_governance_event('master_kh_topic_updated', v_uid, NULL, 'kh_topic_taxonomy', _id::text,
      to_jsonb(v_row), (SELECT to_jsonb(t) FROM public.kh_topic_taxonomy t WHERE t.id = _id));
    SELECT * INTO v_row FROM public.kh_topic_taxonomy WHERE id = _id;
  END IF;
  RETURN jsonb_build_object('id', v_row.id, 'code', v_row.code, 'name', v_row.name, 'active', v_row.active,
                            'displayOrder', v_row.display_order);
END $$;
REVOKE ALL ON FUNCTION public.master_kh_topic_save(uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_kh_topic_save(uuid, text, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.master_kh_topic_set_active(_id uuid, _active boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.kh_topic_taxonomy%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _active IS NULL THEN RAISE EXCEPTION 'kh_topic_active_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('master_kh_topic'));
  SELECT * INTO v_row FROM public.kh_topic_taxonomy WHERE id = _id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'kh_topic_not_found'; END IF;
  IF v_row.active = _active THEN RETURN jsonb_build_object('id', _id, 'active', _active, 'changed', false); END IF;
  -- The contribution form needs at least one topic to offer.
  IF NOT _active AND NOT EXISTS (SELECT 1 FROM public.kh_topic_taxonomy WHERE active AND id <> _id) THEN
    RAISE EXCEPTION 'kh_topic_last_active';
  END IF;
  UPDATE public.kh_topic_taxonomy SET active = _active, updated_at = now() WHERE id = _id;
  PERFORM public.log_governance_event(CASE WHEN _active THEN 'master_kh_topic_activated' ELSE 'master_kh_topic_deactivated' END,
    v_uid, NULL, 'kh_topic_taxonomy', _id::text, jsonb_build_object('active', v_row.active, 'name', v_row.name),
    jsonb_build_object('active', _active, 'usage', public._kh_topic_usage(_id)));
  RETURN jsonb_build_object('id', _id, 'active', _active, 'changed', true);
END $$;
REVOKE ALL ON FUNCTION public.master_kh_topic_set_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_kh_topic_set_active(uuid, boolean) TO authenticated;

-- ------------------------------------------------------------- submissions
-- Same as 20261021050000 plus the topic check (last block before RETURN NULL).
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
  v_topic text;
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

  -- Topic (Data Master): required, and from the list (active or inactive, so an
  -- older publication can still be updated with the topic it already has).
  v_topic := NULLIF(btrim(COALESCE(_p->>'topicCategory', _p->>'topic', '')), '');
  IF v_topic IS NULL THEN RETURN 'kr_topic_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kh_topic_taxonomy t WHERE public._master_norm(t.name) = public._master_norm(v_topic)) THEN
    RETURN 'kr_topic_unknown';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._kr_payload_problem(jsonb, uuid) FROM PUBLIC, anon, authenticated;

COMMIT;
