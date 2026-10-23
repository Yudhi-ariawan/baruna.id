-- ============================================================================
-- Data Master: bidang keahlian expert dan aturan level trainer
-- ============================================================================
-- Dicek 23 Okt 2026 (database intern-update, kode branch ini):
--
-- * Daftar bidang keahlian di formulir Become an Expert ditulis tetap di kode
--   (src/lib/experts.ts, 15 bidang), sedangkan tabel expertise_taxonomy berisi 9
--   bidang lain yang tidak pernah dipakai formulir. ENGINEERING_STANDARDS melarang
--   data master ditulis tetap di kode, dan tidak ada halaman untuk mengubahnya.
-- * trainer_level_rules (4 level) hanya bisa diubah lewat SQL Editor.
-- * Kedua tabel bisa ditulis langsung lewat API oleh pemegang role lama
--   admin|management (policy *_admin_write), tanpa audit trail dan tanpa validasi.
-- * Isi expertise pada pengajuan expert tidak diperiksa: teks apa pun bisa dikirim
--   lewat API dan ditayangkan di direktori.
--
-- Slide 16: Approver (dan Admin) punya akses penuh pada domain Experts dan Academy.
--
-- Perubahan:
-- * Data: 15 bidang dari formulir dimasukkan/diselaraskan (urutan sama dengan
--   formulir, aktif). Tiga bidang bawaan tabel yang tidak pernah tampil di formulir
--   (Ocean Governance, Fisheries Surveillance, Fish Processing and Value Addition)
--   dinonaktifkan bila tidak dipakai; nilai yang sudah dipakai expert/draf tetapi
--   tidak ada di daftar ditambahkan sebagai nonaktif. Tidak ada baris yang dihapus.
--   Bila Data Master sudah pernah dipakai (ada audit master_expertise_*), langkah
--   penyelarasan dilewati agar menjalankan ulang migrasi tidak menimpa perubahan.
-- * Tulis langsung ditutup (policy lama dihapus, INSERT/UPDATE/DELETE dicabut dari
--   anon/authenticated). Perubahan hanya lewat RPC di bawah (super_admin, admin,
--   approver: _can_decide_review), dengan validasi dan audit trail.
-- * master_expertise_save / master_expertise_set_active: nama unik (tanpa beda huruf
--   besar/kecil); bidang yang sudah dipakai tidak bisa diganti namanya (profil tayang
--   menyimpan nama itu; mengubahnya tanpa review menyalahi Slide 13); bidang aktif
--   terakhir tidak bisa dinonaktifkan.
-- * master_trainer_levels_set: aturan berversi (versi lama ditutup effective_until,
--   versi baru effective_from now); empat level wajib, angka naik berurutan, alasan
--   wajib. Semua pembaca (direktori, portal) sudah memilih versi yang berlaku.
-- * _expert_payload_problem: saat pengajuan dikirim, setiap bidang keahlian wajib
--   ada di daftar (aktif atau nonaktif, agar profil lama tetap bisa diperbarui),
--   maksimal 20 bidang.

BEGIN;

-- ------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION public._master_norm(_v text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(regexp_replace(btrim(COALESCE(_v, '')), '\s+', ' ', 'g'))
$$;
REVOKE ALL ON FUNCTION public._master_norm(text) FROM PUBLIC, anon, authenticated;

-- Whether a bidang keahlian is used by a profile, an expert draft/revision or a link row.
CREATE OR REPLACE FUNCTION public._expertise_usage(_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH t AS (SELECT public._master_norm(name) AS n FROM public.expertise_taxonomy WHERE id = _id)
  SELECT (
    (SELECT count(*) FROM public.experts e, t
      WHERE EXISTS (SELECT 1 FROM unnest(COALESCE(e.expertise_areas, '{}'::text[])) a WHERE public._master_norm(a) = t.n))
  + (SELECT count(*) FROM public.review_drafts d, t
      WHERE d.subject_kind = 'expert' AND jsonb_typeof(d.payload->'expertise') = 'array'
        AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(d.payload->'expertise') a WHERE public._master_norm(a) = t.n))
  + (SELECT count(*) FROM public.expert_expertise x WHERE x.expertise_taxonomy_id = _id)
  )::integer
$$;
REVOKE ALL ON FUNCTION public._expertise_usage(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._master_code(_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(NULLIF(btrim(regexp_replace(lower(COALESCE(_name, '')), '[^a-z0-9]+', '_', 'g'), '_'), ''), 'bidang')
$$;
REVOKE ALL ON FUNCTION public._master_code(text) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- data
DO $$
DECLARE
  v_list text[] := ARRAY['Aquaculture', 'Hatchery Management', 'Fish Health', 'Feed Development', 'Fish Processing',
    'Quality Assurance', 'Fisheries Management', 'Marine Conservation', 'Blue Economy', 'Climate Change',
    'Marine Spatial Planning', 'Monitoring, Control and Surveillance (MCS)', 'IUU Fishing', 'Ocean Literacy',
    'Capacity Development'];
  v_name text; v_i integer := 0; v_id uuid; v_code text;
  -- Once Data Master has been used, a re-run must not undo the curators' changes.
  v_managed boolean := EXISTS (SELECT 1 FROM public.governance_audit_log WHERE event_type LIKE 'master_expertise_%');
BEGIN
  -- The 15 bidang the form offered, in the form's order, active.
  FOREACH v_name IN ARRAY v_list LOOP
    EXIT WHEN v_managed;
    v_i := v_i + 1;
    SELECT id INTO v_id FROM public.expertise_taxonomy WHERE public._master_norm(name) = public._master_norm(v_name) LIMIT 1;
    IF v_id IS NULL THEN
      v_code := public._master_code(v_name);
      WHILE EXISTS (SELECT 1 FROM public.expertise_taxonomy WHERE code = v_code) LOOP
        v_code := v_code || '_' || left(replace(gen_random_uuid()::text, '-', ''), 4);
      END LOOP;
      INSERT INTO public.expertise_taxonomy (code, name, domain, active, display_order)
      VALUES (v_code, v_name, 'marine_fisheries', true, v_i * 10);
    ELSE
      UPDATE public.expertise_taxonomy SET active = true, display_order = v_i * 10 WHERE id = v_id;
    END IF;
    v_id := NULL;
  END LOOP;

  -- Values already used by profiles or expert drafts but missing from the list:
  -- kept (inactive) so those profiles stay valid.
  FOR v_name IN
    SELECT DISTINCT btrim(a) FROM public.experts e, unnest(COALESCE(e.expertise_areas, '{}'::text[])) a WHERE btrim(a) <> ''
    UNION
    SELECT DISTINCT btrim(a) FROM public.review_drafts d, jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(d.payload->'expertise') = 'array' THEN d.payload->'expertise' ELSE '[]'::jsonb END) a
     WHERE d.subject_kind = 'expert' AND btrim(a) <> ''
  LOOP
    IF char_length(v_name) <= 120 AND NOT EXISTS (
         SELECT 1 FROM public.expertise_taxonomy WHERE public._master_norm(name) = public._master_norm(v_name)) THEN
      v_code := public._master_code(v_name);
      WHILE EXISTS (SELECT 1 FROM public.expertise_taxonomy WHERE code = v_code) LOOP
        v_code := v_code || '_' || left(replace(gen_random_uuid()::text, '-', ''), 4);
      END LOOP;
      INSERT INTO public.expertise_taxonomy (code, name, domain, active, display_order)
      VALUES (v_code, v_name, 'legacy', false, 1000);
    END IF;
  END LOOP;

  -- The seed bidang the form never offered (20260728124923): inactive unless used.
  IF NOT v_managed THEN
    UPDATE public.expertise_taxonomy t SET active = false
     WHERE t.code IN ('ocean_governance', 'fisheries_surveillance', 'fish_processing_value_addition')
       AND NOT (public._master_norm(t.name) = ANY (ARRAY(SELECT public._master_norm(x) FROM unnest(v_list) x)))
       AND public._expertise_usage(t.id) = 0;
  END IF;
END $$;

-- ------------------------------------------------------------- lock direct writes
DROP POLICY IF EXISTS expertise_taxonomy_admin_write ON public.expertise_taxonomy;
DROP POLICY IF EXISTS trainer_level_rules_admin_write ON public.trainer_level_rules;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.expertise_taxonomy FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.trainer_level_rules FROM anon, authenticated;

-- ------------------------------------------------------------- read (console)
CREATE OR REPLACE FUNCTION public.master_data_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'expertise', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'code', t.code, 'name', t.name, 'description', t.description, 'active', t.active,
        'displayOrder', t.display_order, 'usage', public._expertise_usage(t.id), 'updatedAt', t.updated_at)
        ORDER BY t.active DESC, t.display_order, t.name) FROM public.expertise_taxonomy t), '[]'::jsonb),
    'trainerLevels', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'level', r.trainer_level, 'minParticipants', r.min_unique_graduated_participants,
        'evidence', r.evidence_requirements, 'version', r.version, 'effectiveFrom', r.effective_from)
        ORDER BY r.min_unique_graduated_participants)
        FROM public.trainer_level_rules r
       WHERE r.effective_from <= now() AND (r.effective_until IS NULL OR r.effective_until > now())), '[]'::jsonb),
    'trainerLevelVersions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'version', v.version, 'effectiveFrom', v.effective_from, 'effectiveUntil', v.effective_until,
        'createdBy', (SELECT display_name FROM public.profiles WHERE id = v.created_by))
        ORDER BY v.version DESC)
        FROM (SELECT DISTINCT ON (version) version, effective_from, effective_until, created_by
                FROM public.trainer_level_rules ORDER BY version, effective_from) v), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.master_data_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_data_overview() TO authenticated;

-- ------------------------------------------------------------- bidang keahlian
CREATE OR REPLACE FUNCTION public.master_expertise_save(
  _id uuid, _name text, _description text DEFAULT NULL, _display_order integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := regexp_replace(btrim(COALESCE(_name, '')), '\s+', ' ', 'g');
  v_desc text := NULLIF(btrim(COALESCE(_description, '')), '');
  v_row public.expertise_taxonomy%ROWTYPE; v_code text; v_order integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_name) < 2 OR char_length(v_name) > 120 THEN RAISE EXCEPTION 'expertise_name_invalid'; END IF;
  IF v_name ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'expertise_name_invalid'; END IF;
  IF char_length(COALESCE(v_desc, '')) > 500 THEN RAISE EXCEPTION 'expertise_description_too_long'; END IF;
  IF _display_order IS NOT NULL AND (_display_order < 0 OR _display_order > 100000) THEN RAISE EXCEPTION 'expertise_order_invalid'; END IF;
  -- One writer at a time: the unique-name check below is then reliable.
  PERFORM pg_advisory_xact_lock(hashtext('master_expertise'));

  IF EXISTS (SELECT 1 FROM public.expertise_taxonomy
              WHERE public._master_norm(name) = public._master_norm(v_name) AND id IS DISTINCT FROM _id) THEN
    RAISE EXCEPTION 'expertise_name_exists';
  END IF;

  IF _id IS NULL THEN
    v_code := public._master_code(v_name);
    WHILE EXISTS (SELECT 1 FROM public.expertise_taxonomy WHERE code = v_code) LOOP
      v_code := v_code || '_' || left(replace(gen_random_uuid()::text, '-', ''), 4);
    END LOOP;
    v_order := COALESCE(_display_order, (SELECT COALESCE(max(display_order), 0) + 10 FROM public.expertise_taxonomy WHERE active));
    INSERT INTO public.expertise_taxonomy (code, name, description, domain, active, display_order)
    VALUES (v_code, v_name, v_desc, 'marine_fisheries', true, v_order)
    RETURNING * INTO v_row;
    PERFORM public.log_governance_event('master_expertise_created', v_uid, NULL, 'expertise_taxonomy', v_row.id::text,
      NULL, to_jsonb(v_row));
  ELSE
    SELECT * INTO v_row FROM public.expertise_taxonomy WHERE id = _id FOR UPDATE;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'expertise_not_found'; END IF;
    -- A name stored on published profiles is not changed outside their review.
    IF v_row.name IS DISTINCT FROM v_name AND public._expertise_usage(_id) > 0 THEN
      RAISE EXCEPTION 'expertise_in_use_rename_forbidden';
    END IF;
    UPDATE public.expertise_taxonomy
       SET name = v_name, description = v_desc, display_order = COALESCE(_display_order, display_order)
     WHERE id = _id;
    PERFORM public.log_governance_event('master_expertise_updated', v_uid, NULL, 'expertise_taxonomy', _id::text,
      to_jsonb(v_row), (SELECT to_jsonb(t) FROM public.expertise_taxonomy t WHERE t.id = _id));
    SELECT * INTO v_row FROM public.expertise_taxonomy WHERE id = _id;
  END IF;
  RETURN jsonb_build_object('id', v_row.id, 'code', v_row.code, 'name', v_row.name, 'active', v_row.active,
                            'displayOrder', v_row.display_order);
END $$;
REVOKE ALL ON FUNCTION public.master_expertise_save(uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_expertise_save(uuid, text, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.master_expertise_set_active(_id uuid, _active boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.expertise_taxonomy%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _active IS NULL THEN RAISE EXCEPTION 'expertise_active_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('master_expertise'));
  SELECT * INTO v_row FROM public.expertise_taxonomy WHERE id = _id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'expertise_not_found'; END IF;
  IF v_row.active = _active THEN
    RETURN jsonb_build_object('id', _id, 'active', _active, 'changed', false);
  END IF;
  -- The form needs at least one bidang to offer.
  IF NOT _active AND NOT EXISTS (SELECT 1 FROM public.expertise_taxonomy WHERE active AND id <> _id) THEN
    RAISE EXCEPTION 'expertise_last_active';
  END IF;
  UPDATE public.expertise_taxonomy SET active = _active WHERE id = _id;
  PERFORM public.log_governance_event(CASE WHEN _active THEN 'master_expertise_activated' ELSE 'master_expertise_deactivated' END,
    v_uid, NULL, 'expertise_taxonomy', _id::text, jsonb_build_object('active', v_row.active, 'name', v_row.name),
    jsonb_build_object('active', _active, 'usage', public._expertise_usage(_id)));
  RETURN jsonb_build_object('id', _id, 'active', _active, 'changed', true);
END $$;
REVOKE ALL ON FUNCTION public.master_expertise_set_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_expertise_set_active(uuid, boolean) TO authenticated;

-- ------------------------------------------------------------- aturan level trainer
CREATE OR REPLACE FUNCTION public.master_trainer_levels_set(_rules jsonb, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_note text := btrim(COALESCE(_note, ''));
  v_levels text[] := ARRAY['certified', 'advanced', 'senior', 'master'];
  v_level text; v_min integer; v_prev integer := 0; v_evidence text; v_item jsonb;
  v_next integer; v_now timestamptz := now(); v_before jsonb; v_after jsonb; v_same boolean := true;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_note) < 5 OR char_length(v_note) > 500 THEN RAISE EXCEPTION 'trainer_levels_note_required'; END IF;
  IF jsonb_typeof(_rules) IS DISTINCT FROM 'array' OR jsonb_array_length(_rules) <> 4 THEN
    RAISE EXCEPTION 'trainer_levels_invalid';
  END IF;
  -- Exactly the four levels, each once.
  IF (SELECT count(DISTINCT e->>'level') FROM jsonb_array_elements(_rules) e WHERE e->>'level' = ANY (v_levels)) <> 4 THEN
    RAISE EXCEPTION 'trainer_levels_invalid';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('master_trainer_levels'));

  SELECT COALESCE(jsonb_agg(jsonb_build_object('level', trainer_level, 'min', min_unique_graduated_participants,
           'evidence', evidence_requirements) ORDER BY min_unique_graduated_participants), '[]'::jsonb)
    INTO v_before FROM public.trainer_level_rules
   WHERE effective_from <= v_now AND (effective_until IS NULL OR effective_until > v_now);

  -- Thresholds strictly increase in level order (certified < advanced < senior < master).
  FOREACH v_level IN ARRAY v_levels LOOP
    SELECT e INTO v_item FROM jsonb_array_elements(_rules) e WHERE e->>'level' = v_level LIMIT 1;
    IF jsonb_typeof(v_item->'minParticipants') IS DISTINCT FROM 'number'
       OR (v_item->>'minParticipants') !~ '^\d{1,7}$' THEN
      RAISE EXCEPTION 'trainer_levels_min_invalid';
    END IF;
    v_min := (v_item->>'minParticipants')::integer;
    IF v_min < 1 OR v_min > 1000000 THEN RAISE EXCEPTION 'trainer_levels_min_invalid'; END IF;
    IF v_min <= v_prev THEN RAISE EXCEPTION 'trainer_levels_not_increasing'; END IF;
    v_evidence := NULLIF(btrim(COALESCE(v_item->>'evidence', '')), '');
    IF char_length(COALESCE(v_evidence, '')) > 500 THEN RAISE EXCEPTION 'trainer_levels_evidence_too_long'; END IF;
    v_prev := v_min;
    IF NOT EXISTS (SELECT 1 FROM public.trainer_level_rules r
                    WHERE r.trainer_level::text = v_level AND r.min_unique_graduated_participants = v_min
                      AND r.evidence_requirements IS NOT DISTINCT FROM v_evidence
                      AND r.effective_from <= v_now AND (r.effective_until IS NULL OR r.effective_until > v_now)) THEN
      v_same := false;
    END IF;
  END LOOP;
  IF v_same THEN RAISE EXCEPTION 'trainer_levels_unchanged'; END IF;

  SELECT COALESCE(max(version), 0) + 1 INTO v_next FROM public.trainer_level_rules;
  UPDATE public.trainer_level_rules SET effective_until = v_now
   WHERE effective_until IS NULL OR effective_until > v_now;
  FOREACH v_level IN ARRAY v_levels LOOP
    SELECT e INTO v_item FROM jsonb_array_elements(_rules) e WHERE e->>'level' = v_level LIMIT 1;
    INSERT INTO public.trainer_level_rules (version, trainer_level, min_unique_graduated_participants,
                                            evidence_requirements, effective_from, created_by)
    VALUES (v_next, v_level::public.trainer_level_v1, (v_item->>'minParticipants')::integer,
            NULLIF(btrim(COALESCE(v_item->>'evidence', '')), ''), v_now, v_uid);
  END LOOP;

  SELECT jsonb_agg(jsonb_build_object('level', trainer_level, 'min', min_unique_graduated_participants,
           'evidence', evidence_requirements) ORDER BY min_unique_graduated_participants)
    INTO v_after FROM public.trainer_level_rules WHERE version = v_next;
  PERFORM public.log_governance_event('master_trainer_levels_changed', v_uid, NULL, 'trainer_level_rules', v_next::text,
    jsonb_build_object('rules', v_before), jsonb_build_object('version', v_next, 'rules', v_after, 'note', v_note));
  RETURN jsonb_build_object('version', v_next, 'rules', v_after);
END $$;
REVOKE ALL ON FUNCTION public.master_trainer_levels_set(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_trainer_levels_set(jsonb, text) TO authenticated;

-- ------------------------------------------------------------- expert submissions
-- Latest definition (20261015060000) plus the bidang keahlian check. STABLE (it now
-- reads the expertise list). Unknown values are refused only when the application
-- is sent (_require_complete), so saving a draft never fails on them.
CREATE OR REPLACE FUNCTION public._expert_payload_problem(_payload jsonb, _uid uuid, _require_complete boolean)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_doc jsonb; v_path text; v_missing text[] := '{}'; v_item jsonb; v_unknown text;
BEGIN
  IF jsonb_typeof(_payload) IS DISTINCT FROM 'object' THEN RETURN 'payload_invalid'; END IF;
  IF octet_length(_payload::text) > 300000 THEN RETURN 'payload_too_large'; END IF;
  IF jsonb_typeof(_payload->'documents') = 'array' THEN
    IF jsonb_array_length(_payload->'documents') > 8 THEN RETURN 'too_many_documents'; END IF;
    FOR v_doc IN SELECT * FROM jsonb_array_elements(_payload->'documents') LOOP
      v_path := CASE WHEN jsonb_typeof(v_doc) = 'object' AND jsonb_typeof(v_doc->'path') = 'string' THEN v_doc->>'path' END;
      IF v_path IS NULL OR v_path NOT LIKE 'users/' || _uid::text || '/%' OR position('..' IN v_path) > 0 THEN
        RETURN 'document_not_owned';
      END IF;
    END LOOP;
  ELSIF _payload ? 'documents' AND jsonb_typeof(_payload->'documents') <> 'null' THEN
    RETURN 'payload_invalid';
  END IF;
  IF _require_complete THEN
    IF public._jtext(_payload, 'fullName') IS NULL THEN v_missing := array_append(v_missing, 'nama lengkap'::text); END IF;
    IF public._jtext(_payload, 'title') IS NULL THEN v_missing := array_append(v_missing, 'jabatan/gelar profesional'::text); END IF;
    IF public._jtext(_payload, 'institution') IS NULL THEN v_missing := array_append(v_missing, 'institusi'::text); END IF;
    IF public._jtext(_payload, 'country') IS NULL THEN v_missing := array_append(v_missing, 'negara'::text); END IF;
    IF public._jtext(_payload, 'email') IS NULL THEN v_missing := array_append(v_missing, 'email'::text); END IF;
    IF NOT (jsonb_typeof(_payload->'expertise') = 'array' AND jsonb_array_length(_payload->'expertise') > 0) THEN
      v_missing := array_append(v_missing, 'bidang keahlian'::text); END IF;
    IF NOT (jsonb_typeof(_payload->'roles') = 'array' AND jsonb_array_length(_payload->'roles') > 0) THEN
      v_missing := array_append(v_missing, 'peran yang tersedia'::text); END IF;
    IF public._jtext(_payload, 'biography') IS NULL THEN v_missing := array_append(v_missing, 'biografi profesional'::text); END IF;
    IF cardinality(v_missing) > 0 THEN RETURN 'payload_incomplete: ' || array_to_string(v_missing, ', '); END IF;

    -- Bidang keahlian must come from the master list (Data Master).
    IF jsonb_array_length(_payload->'expertise') > 20 THEN RETURN 'too_many_expertise'; END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(_payload->'expertise') LOOP
      IF jsonb_typeof(v_item) <> 'string' THEN RETURN 'payload_invalid'; END IF;
      v_unknown := v_item #>> '{}';
      IF NOT EXISTS (SELECT 1 FROM public.expertise_taxonomy t
                      WHERE public._master_norm(t.name) = public._master_norm(v_unknown)) THEN
        RETURN 'expertise_unknown: ' || left(v_unknown, 120);
      END IF;
    END LOOP;
  END IF;
  RETURN NULL;
END $$;

COMMIT;
