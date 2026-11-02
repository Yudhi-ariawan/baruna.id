-- ============================================================================
-- Data Master: satu daftar bahasa
-- ============================================================================
-- Dicek 2 Nov 2026 (database intern-update, kode branch ini):
--
-- * Tabel languages_taxonomy (17 bahasa, kode ISO) ada di database dan dipakai
--   expert_languages (foreign key) dan _expert_language_code (20261015090000),
--   tetapi TIDAK ada di file migrasi repo: database lain (main, database baru) tidak
--   mendapatkannya dari migrasi.
-- * Daftar bahasa di kode berbeda-beda: formulir Knowledge Hub (8 pilihan, termasuk
--   Swahili yang tidak ada di tabel dan "Other"), Request a Training (5 pilihan),
--   tombol cepat formulir Expert (7). Slide 32 (metadata bahasa) dan Slide 39
--   (Language & Communication): metadata standar, tidak hard-coded.
-- * Bahasa publikasi Knowledge Hub tidak diperiksa sama sekali; datanya sudah tidak
--   seragam: "Bahasa Indonesia", "Indonesian", "Bahasa Indonesia & Bahasa Inggris".
-- * _expert_language_code hanya mengenali bahasa aktif: bila kurator menonaktifkan
--   satu bahasa, pembaruan profil expert yang memakainya diam-diam kehilangan bahasa
--   itu dari expert_languages.
--
-- Perubahan:
-- * languages_taxonomy dibuat bila belum ada (kolom sama dengan yang ada di
--   database), 17 bahasa yang ada + Swahili (dari formulir Knowledge Hub) diisi
--   dengan ON CONFLICT DO NOTHING: baris yang ada tidak diubah.
-- * Tulis langsung dicabut dari anon/authenticated; baca tetap terbuka.
-- * master_languages_overview / master_language_save / master_language_set_active
--   (super_admin/admin/approver), sama dengan Data Master lain: kode ISO 639
--   (2-3 huruf, boleh varian mis. pt-br) unik dan TIDAK bisa diubah setelah dibuat
--   (dipakai foreign key); nama unik; bahasa yang sudah dipakai tidak bisa diganti
--   namanya; bahasa aktif terakhir dilindungi; audit trail.
-- * _expert_language_code: mengenali bahasa aktif maupun nonaktif (yang aktif
--   didahulukan), agar data lama tetap terbaca. Selebihnya sama dengan 20261015090000.
-- * _kr_payload_problem: saat pengajuan Knowledge Hub dikirim, bahasa wajib dan harus
--   dikenali dari daftar (nama, nama asli, kode, atau sebutan umum seperti "Bahasa
--   Indonesia"/"Inggris"). Isi lain sama dengan 20261102020000.
-- Butuh 20261023010000 (_master_norm) dan 20261102020000 (topik).

BEGIN;

CREATE TABLE IF NOT EXISTS public.languages_taxonomy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  native_name text,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.languages_taxonomy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS languages_taxonomy_read_all ON public.languages_taxonomy;
CREATE POLICY languages_taxonomy_read_all ON public.languages_taxonomy FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.languages_taxonomy FROM anon, authenticated;
GRANT SELECT ON public.languages_taxonomy TO anon, authenticated;
GRANT ALL ON public.languages_taxonomy TO service_role;

INSERT INTO public.languages_taxonomy (code, name, native_name, active, display_order) VALUES
  ('id', 'Indonesian', 'Bahasa Indonesia', true, 10), ('en', 'English', 'English', true, 20),
  ('ms', 'Malay', 'Bahasa Melayu', true, 30), ('zh', 'Chinese (Mandarin)', '中文', true, 40),
  ('ja', 'Japanese', '日本語', true, 50), ('ko', 'Korean', '한국어', true, 60),
  ('tl', 'Tagalog / Filipino', 'Tagalog', true, 70), ('vi', 'Vietnamese', 'Tiếng Việt', true, 80),
  ('th', 'Thai', 'ไทย', true, 90), ('es', 'Spanish', 'Español', true, 100),
  ('fr', 'French', 'Français', true, 110), ('de', 'German', 'Deutsch', true, 120),
  ('pt', 'Portuguese', 'Português', true, 130), ('ar', 'Arabic', 'العربية', true, 140),
  ('ru', 'Russian', 'Русский', true, 150), ('nl', 'Dutch', 'Nederlands', true, 160),
  ('hi', 'Hindi', 'हिन्दी', true, 170), ('sw', 'Swahili', 'Kiswahili', true, 180)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------- name -> code
-- Same as 20261015090000, but inactive languages are recognised too (active first),
-- so data that already uses a deactivated language keeps its code.
CREATE OR REPLACE FUNCTION public._expert_language_code(_name text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n text; v_s text; v_alias text; v_code text;
BEGIN
  v_n := lower(btrim(regexp_replace(COALESCE(_name, ''), '\s*\([^)]*\)', '', 'g')));
  IF v_n = '' THEN RETURN NULL; END IF;
  IF to_regclass('public.languages_taxonomy') IS NULL THEN
    RETURN NULLIF(left(regexp_replace(v_n, '[^a-z0-9]', '', 'g'), 12), '');
  END IF;
  v_s := regexp_replace(v_n, '^bahasa\s+', '');
  v_alias := CASE v_s
    WHEN 'indonesia' THEN 'id' WHEN 'indonesian' THEN 'id' WHEN 'inggris' THEN 'en'
    WHEN 'melayu' THEN 'ms' WHEN 'malaysia' THEN 'ms' WHEN 'mandarin' THEN 'zh' WHEN 'china' THEN 'zh'
    WHEN 'filipino' THEN 'tl' WHEN 'tagalog' THEN 'tl' WHEN 'jepang' THEN 'ja' WHEN 'korea' THEN 'ko'
    WHEN 'jerman' THEN 'de' WHEN 'prancis' THEN 'fr' WHEN 'perancis' THEN 'fr' WHEN 'spanyol' THEN 'es'
    WHEN 'arab' THEN 'ar' WHEN 'belanda' THEN 'nl' WHEN 'rusia' THEN 'ru' WHEN 'portugis' THEN 'pt'
    WHEN 'vietnam' THEN 'vi' WHEN 'thailand' THEN 'th' ELSE NULL END;
  EXECUTE $q$
    SELECT code FROM public.languages_taxonomy
     WHERE (lower(code) = $1 OR lower(name) = $2 OR lower(native_name) = $2
            OR $2 = ANY (regexp_split_to_array(lower(regexp_replace(name, '\s*\([^)]*\)', '', 'g')), '\s*/\s*')))
     ORDER BY active DESC, display_order, code LIMIT 1$q$
    INTO v_code USING COALESCE(v_alias, v_s), v_s;
  RETURN v_code;
END $$;

-- Expert profiles (structured rows and the directory list) and Knowledge Hub
-- publications (not modules) and drafts that use a language.
CREATE OR REPLACE FUNCTION public._language_usage(_code text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    (SELECT count(DISTINCT expert_id) FROM public.expert_languages WHERE language_code = _code)
  + (SELECT count(*) FROM public.experts e
      WHERE NOT EXISTS (SELECT 1 FROM public.expert_languages l WHERE l.expert_id = e.id AND l.language_code = _code)
        AND EXISTS (SELECT 1 FROM unnest(COALESCE(e.languages, '{}'::text[])) x WHERE public._expert_language_code(x) = _code))
  + (SELECT count(*) FROM public.knowledge_resources r
      WHERE r.resource_type::text <> 'module' AND public._expert_language_code(r.language) = _code)
  + (SELECT count(*) FROM public.review_drafts d
      WHERE d.subject_kind = 'knowledge_resource' AND public._expert_language_code(d.payload->>'language') = _code)
  )::integer
$$;
REVOKE ALL ON FUNCTION public._language_usage(text) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- read (console)
CREATE OR REPLACE FUNCTION public.master_languages_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', t.id, 'code', t.code, 'name', t.name, 'nativeName', t.native_name, 'active', t.active,
      'displayOrder', t.display_order, 'usage', public._language_usage(t.code), 'updatedAt', t.updated_at)
      ORDER BY t.active DESC, t.display_order, t.name) FROM public.languages_taxonomy t), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.master_languages_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_languages_overview() TO authenticated;

-- ------------------------------------------------------------- write
-- _id NULL = new language (code required); otherwise the code is ignored: it never changes.
CREATE OR REPLACE FUNCTION public.master_language_save(
  _id uuid, _code text, _name text, _native_name text DEFAULT NULL, _display_order integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text := lower(btrim(COALESCE(_code, '')));
  v_name text := regexp_replace(btrim(COALESCE(_name, '')), '\s+', ' ', 'g');
  v_native text := NULLIF(regexp_replace(btrim(COALESCE(_native_name, '')), '\s+', ' ', 'g'), '');
  v_row public.languages_taxonomy%ROWTYPE; v_order integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_name) < 2 OR char_length(v_name) > 80 OR v_name ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'language_name_invalid'; END IF;
  IF char_length(COALESCE(v_native, '')) > 80 OR COALESCE(v_native, '') ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'language_native_invalid'; END IF;
  IF _display_order IS NOT NULL AND (_display_order < 0 OR _display_order > 100000) THEN RAISE EXCEPTION 'language_order_invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('master_language'));

  IF EXISTS (SELECT 1 FROM public.languages_taxonomy
              WHERE public._master_norm(name) = public._master_norm(v_name) AND id IS DISTINCT FROM _id) THEN
    RAISE EXCEPTION 'language_name_exists';
  END IF;

  IF _id IS NULL THEN
    IF v_code !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$' THEN RAISE EXCEPTION 'language_code_invalid'; END IF;
    IF EXISTS (SELECT 1 FROM public.languages_taxonomy WHERE lower(code) = v_code) THEN RAISE EXCEPTION 'language_code_exists'; END IF;
    v_order := COALESCE(_display_order, (SELECT COALESCE(max(display_order), 0) + 10 FROM public.languages_taxonomy WHERE active));
    INSERT INTO public.languages_taxonomy (code, name, native_name, active, display_order)
    VALUES (v_code, v_name, v_native, true, v_order) RETURNING * INTO v_row;
    PERFORM public.log_governance_event('master_language_created', v_uid, NULL, 'languages_taxonomy', v_row.code,
      NULL, to_jsonb(v_row));
  ELSE
    SELECT * INTO v_row FROM public.languages_taxonomy WHERE id = _id FOR UPDATE;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'language_not_found'; END IF;
    -- A name stored on profiles and publications is not changed outside their review.
    IF v_row.name IS DISTINCT FROM v_name AND public._language_usage(v_row.code) > 0 THEN
      RAISE EXCEPTION 'language_in_use_rename_forbidden';
    END IF;
    UPDATE public.languages_taxonomy
       SET name = v_name, native_name = v_native, display_order = COALESCE(_display_order, display_order), updated_at = now()
     WHERE id = _id;
    PERFORM public.log_governance_event('master_language_updated', v_uid, NULL, 'languages_taxonomy', v_row.code,
      to_jsonb(v_row), (SELECT to_jsonb(t) FROM public.languages_taxonomy t WHERE t.id = _id));
    SELECT * INTO v_row FROM public.languages_taxonomy WHERE id = _id;
  END IF;
  RETURN jsonb_build_object('id', v_row.id, 'code', v_row.code, 'name', v_row.name, 'active', v_row.active,
                            'displayOrder', v_row.display_order);
END $$;
REVOKE ALL ON FUNCTION public.master_language_save(uuid, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_language_save(uuid, text, text, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.master_language_set_active(_id uuid, _active boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.languages_taxonomy%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _active IS NULL THEN RAISE EXCEPTION 'language_active_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('master_language'));
  SELECT * INTO v_row FROM public.languages_taxonomy WHERE id = _id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'language_not_found'; END IF;
  IF v_row.active = _active THEN RETURN jsonb_build_object('id', _id, 'active', _active, 'changed', false); END IF;
  IF NOT _active AND NOT EXISTS (SELECT 1 FROM public.languages_taxonomy WHERE active AND id <> _id) THEN
    RAISE EXCEPTION 'language_last_active';
  END IF;
  UPDATE public.languages_taxonomy SET active = _active, updated_at = now() WHERE id = _id;
  PERFORM public.log_governance_event(CASE WHEN _active THEN 'master_language_activated' ELSE 'master_language_deactivated' END,
    v_uid, NULL, 'languages_taxonomy', v_row.code, jsonb_build_object('active', v_row.active, 'name', v_row.name),
    jsonb_build_object('active', _active, 'usage', public._language_usage(v_row.code)));
  RETURN jsonb_build_object('id', _id, 'active', _active, 'changed', true);
END $$;
REVOKE ALL ON FUNCTION public.master_language_set_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_language_set_active(uuid, boolean) TO authenticated;

-- ------------------------------------------------------------- submissions
-- Same as 20261102020000 plus the language check (last block before RETURN NULL).
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
  v_topic text; v_lang text;
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

  -- Language (Data Master): required, and recognised from the list.
  v_lang := NULLIF(btrim(COALESCE(_p->>'language', '')), '');
  IF v_lang IS NULL THEN RETURN 'kr_language_required'; END IF;
  IF public._expert_language_code(v_lang) IS NULL THEN RETURN 'kr_language_unknown'; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._kr_payload_problem(jsonb, uuid) FROM PUBLIC, anon, authenticated;

COMMIT;
