-- ============================================================================
-- Peserta: biodata (P5) dan progres pelatihan mandiri (P6) lewat RPC tervalidasi
-- ============================================================================
-- P5. Biodata disimpan oleh dua server function (form biodata dan halaman Akun)
--     dalam 4-5 langkah terpisah dengan service role:
--       * profiles.is_active diset true -> akun yang DINONAKTIFKAN admin aktif lagi;
--       * role participant di-upsert status 'active' -> role yang DICABUT admin hidup lagi;
--       * tanpa batas panjang dan tanpa validasi tanggal/telepon/foto; bila unggah foto
--         gagal, foto base64 (~2,7 MB) disimpan ke user_metadata yang ikut di token login;
--       * kegagalan langkah tengah hanya console.warn;
--       * RLS mengizinkan browser INSERT/UPDATE participant_biodata langsung (tanpa validasi).
--     Sekarang: satu transaksi participant_biodata_save. Akun nonaktif ditolak, role yang
--     dicabut/ditangguhkan/kedaluwarsa tidak disentuh, data divalidasi di sini.
--
-- P6. Sinkron pelatihan mandiri membaca-mengubah-menulis user_metadata tanpa kunci
--     (dua perangkat saling menimpa), payload tanpa batas, dan error ditelan.
--     Sekarang: self_paced_sync menggabungkan per baris di database dan tidak pernah
--     menurunkan progres (selesai tetap selesai, nilai tertinggi, langkah digabung).
--     Catatan: status selesai tetap LAPORAN dari browser karena isi kursus mandiri ada
--     di kode aplikasi; tidak ada hak di server yang bergantung padanya (sertifikatnya
--     berlabel CONTOH, lihat 20261020010000).

BEGIN;

-- ------------------------------------------------------------- P5. biodata
CREATE OR REPLACE FUNCTION public._participant_biodata_problem(_b jsonb, _uid uuid)
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_len text; v_date date; v_foto text := NULLIF(btrim(COALESCE(_b->>'fotoUrl', '')), '');
  r record;
BEGIN
  IF _b IS NULL OR jsonb_typeof(_b) <> 'object' THEN RETURN 'biodata_invalid'; END IF;
  FOR r IN SELECT * FROM (VALUES
      ('nama', 2, 160), ('nip', 3, 40), ('tempatLahir', 2, 100), ('jenisKelamin', 2, 20),
      ('agama', 2, 60), ('jabatan', 2, 160), ('pangkatGolongan', 2, 60),
      ('pendidikanTerakhir', 2, 80), ('noHp', 8, 20), ('unitEselon1', 2, 120),
      ('instansiUnitKerja', 2, 200), ('alamatKantor', 3, 500), ('provinsi', 2, 80),
      ('kabupatenKota', 2, 120)) AS f(k, lo, hi)
  LOOP
    IF jsonb_typeof(_b->r.k) IS DISTINCT FROM 'string'
       OR char_length(btrim(_b->>r.k)) NOT BETWEEN r.lo AND r.hi THEN
      RETURN 'biodata_field_invalid:' || r.k;
    END IF;
  END LOOP;
  IF btrim(_b->>'nip') !~ '^[0-9A-Za-z./ -]+$' THEN RETURN 'biodata_field_invalid:nip'; END IF;
  IF btrim(_b->>'noHp') !~ '^\+?[0-9 ()-]{8,20}$' THEN RETURN 'biodata_field_invalid:noHp'; END IF;
  IF btrim(_b->>'jenisKelamin') NOT IN ('Laki-laki', 'Perempuan') THEN RETURN 'biodata_field_invalid:jenisKelamin'; END IF;

  IF jsonb_typeof(_b->'tanggalLahir') IS DISTINCT FROM 'string'
     OR btrim(_b->>'tanggalLahir') !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN 'biodata_field_invalid:tanggalLahir';
  END IF;
  BEGIN
    v_date := (btrim(_b->>'tanggalLahir'))::date;
  EXCEPTION WHEN others THEN
    RETURN 'biodata_field_invalid:tanggalLahir';
  END;
  IF v_date < DATE '1900-01-01' OR v_date > (now() AT TIME ZONE 'Asia/Jakarta')::date THEN
    RETURN 'biodata_field_invalid:tanggalLahir';
  END IF;

  -- Foto: hanya berkas di folder avatar milik pengguna sendiri (bukan base64/URL luar).
  IF v_foto IS NOT NULL AND (
       char_length(v_foto) > 600
       OR v_foto !~ '^https://[^\s]+$'
       OR strpos(v_foto, '/storage/v1/object/public/avatars/users/' || _uid::text || '/') = 0) THEN
    RETURN 'biodata_field_invalid:fotoUrl';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._participant_biodata_problem(jsonb, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.participant_biodata_save(_biodata jsonb, _source text DEFAULT 'academy_biodata_peserta')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_problem text; v_before jsonb; v_active boolean; v_role_id uuid;
  v_role public.rbac_user_roles%ROWTYPE; v_has_primary boolean; v_role_state text;
  v_foto text := NULLIF(btrim(COALESCE(_biodata->>'fotoUrl', '')), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF _source NOT IN ('academy_biodata_peserta', 'account_profile') THEN RAISE EXCEPTION 'invalid_source'; END IF;

  -- Klik ganda / dua perangkat: satu penyimpanan per akun pada satu waktu.
  PERFORM pg_advisory_xact_lock(hashtextextended('participant_biodata:' || v_uid::text, 0));

  SELECT is_active INTO v_active FROM public.profiles WHERE id = v_uid;
  IF v_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'account_inactive' USING ERRCODE = '42501'; END IF;

  v_problem := public._participant_biodata_problem(_biodata, v_uid);
  IF v_problem IS NOT NULL THEN RAISE EXCEPTION '%', v_problem; END IF;

  SELECT to_jsonb(b) INTO v_before FROM public.participant_biodata b WHERE b.user_id = v_uid;

  INSERT INTO public.participant_biodata AS b (
    user_id, nama, nip, tempat_lahir, tanggal_lahir, jenis_kelamin, agama, jabatan,
    pangkat_golongan, pendidikan_terakhir, no_hp, unit_eselon_1, instansi_unit_kerja,
    alamat_kantor, provinsi, kabupaten_kota, foto_url, updated_at)
  VALUES (
    v_uid, btrim(_biodata->>'nama'), btrim(_biodata->>'nip'), btrim(_biodata->>'tempatLahir'),
    (btrim(_biodata->>'tanggalLahir'))::date, btrim(_biodata->>'jenisKelamin'), btrim(_biodata->>'agama'),
    btrim(_biodata->>'jabatan'), btrim(_biodata->>'pangkatGolongan'), btrim(_biodata->>'pendidikanTerakhir'),
    btrim(_biodata->>'noHp'), btrim(_biodata->>'unitEselon1'), btrim(_biodata->>'instansiUnitKerja'),
    btrim(_biodata->>'alamatKantor'), btrim(_biodata->>'provinsi'), btrim(_biodata->>'kabupatenKota'),
    v_foto, now())
  ON CONFLICT (user_id) DO UPDATE SET
    nama = EXCLUDED.nama, nip = EXCLUDED.nip, tempat_lahir = EXCLUDED.tempat_lahir,
    tanggal_lahir = EXCLUDED.tanggal_lahir, jenis_kelamin = EXCLUDED.jenis_kelamin,
    agama = EXCLUDED.agama, jabatan = EXCLUDED.jabatan, pangkat_golongan = EXCLUDED.pangkat_golongan,
    pendidikan_terakhir = EXCLUDED.pendidikan_terakhir, no_hp = EXCLUDED.no_hp,
    unit_eselon_1 = EXCLUDED.unit_eselon_1, instansi_unit_kerja = EXCLUDED.instansi_unit_kerja,
    alamat_kantor = EXCLUDED.alamat_kantor, provinsi = EXCLUDED.provinsi,
    kabupaten_kota = EXCLUDED.kabupaten_kota, foto_url = EXCLUDED.foto_url, updated_at = now();

  -- Profil tampilan; is_active TIDAK pernah diubah di sini.
  UPDATE public.profiles
     SET display_name = btrim(_biodata->>'nama'), phone = btrim(_biodata->>'noHp'),
         organization = btrim(_biodata->>'instansiUnitKerja'), job_title = btrim(_biodata->>'jabatan'),
         avatar_url = COALESCE(v_foto, avatar_url), updated_at = now()
   WHERE id = v_uid;

  -- Role participant (otomatis, keputusan mentor menunggu). Baris yang sudah ada dan
  -- tidak aktif (dicabut/ditangguhkan/kedaluwarsa) adalah keputusan admin: tidak disentuh.
  SELECT id INTO v_role_id FROM public.rbac_roles WHERE code = 'participant';
  IF v_role_id IS NULL THEN RAISE EXCEPTION 'participant_role_missing'; END IF;
  SELECT * INTO v_role FROM public.rbac_user_roles WHERE user_id = v_uid AND role_id = v_role_id FOR UPDATE;
  IF v_role.id IS NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.rbac_user_roles
                    WHERE user_id = v_uid AND status = 'active' AND is_primary) INTO v_has_primary;
    INSERT INTO public.rbac_user_roles (user_id, role_id, status, is_primary, scope, valid_from, approved_at, reason)
    VALUES (v_uid, v_role_id, 'active', NOT v_has_primary, '{}'::jsonb, now(), now(),
            'registered_as_participant_self_service');
    v_role_state := 'granted';
  ELSIF v_role.status = 'active' AND v_role.valid_from <= now()
        AND (v_role.valid_until IS NULL OR v_role.valid_until > now()) THEN
    v_role_state := 'already_active';
  ELSE
    v_role_state := 'blocked_by_admin';
  END IF;

  INSERT INTO public.admin_audit_log (event_type, actor_id, target_user_id, entity_type, entity_id,
                                      before_data, after_data, metadata)
  SELECT 'participant_biodata_saved', v_uid, v_uid, 'participant_biodata', v_uid::text,
         v_before, to_jsonb(b), jsonb_build_object('source', _source, 'role_state', v_role_state)
    FROM public.participant_biodata b WHERE b.user_id = v_uid;

  RETURN jsonb_build_object('saved', true, 'roleState', v_role_state);
END $$;
REVOKE ALL ON FUNCTION public.participant_biodata_save(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.participant_biodata_save(jsonb, text) TO authenticated;

-- Tulis langsung dari browser ditutup; baca milik sendiri tetap boleh.
DROP POLICY IF EXISTS participant_biodata_own_insert ON public.participant_biodata;
DROP POLICY IF EXISTS participant_biodata_own_update ON public.participant_biodata;
REVOKE INSERT, UPDATE, DELETE ON public.participant_biodata FROM authenticated, anon;

-- ------------------------------------------------------------- P6. pelatihan mandiri
CREATE OR REPLACE FUNCTION public._epoch_ms_to_ts(_v jsonb)
RETURNS timestamptz LANGUAGE sql STABLE AS $$
  -- Waktu dari browser: angka milidetik; masa depan dipotong ke sekarang.
  SELECT CASE WHEN jsonb_typeof(_v) = 'number' AND (_v::text)::numeric BETWEEN 946684800000 AND 32503680000000
              THEN LEAST(to_timestamp((_v::text)::numeric / 1000), now()) END
$$;
REVOKE ALL ON FUNCTION public._epoch_ms_to_ts(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.self_paced_sync(_courses jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_key text; v_c jsonb; v_code text; v_score numeric; v_steps jsonb; v_source text;
  v_skipped integer := 0; v_saved integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF _courses IS NULL OR jsonb_typeof(_courses) <> 'object' THEN RAISE EXCEPTION 'invalid_payload'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(_courses)) > 200 THEN RAISE EXCEPTION 'too_many_courses'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('self_paced:' || v_uid::text, 0));

  FOR v_key, v_c IN SELECT key, value FROM jsonb_each(_courses) LOOP
    v_code := btrim(COALESCE(v_c->>'code', v_key));
    -- Entri rusak dilewati (tidak menggagalkan seluruh sinkron).
    IF jsonb_typeof(v_c) <> 'object'
       OR v_code !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$'
       OR (v_c ? 'explicitlyEnrolled' AND (v_c->'explicitlyEnrolled') IS DISTINCT FROM 'true'::jsonb)
       OR char_length(COALESCE(v_c->>'title', '')) > 300
       OR char_length(COALESCE(v_c->>'hours', '')) > 40
       OR char_length(COALESCE(v_c->>'instructor', '')) > 200
       OR char_length(COALESCE(v_c->>'category', '')) > 120 THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    v_score := CASE WHEN jsonb_typeof(v_c->'score') = 'number' AND (v_c->>'score')::numeric BETWEEN 0 AND 100
                    THEN (v_c->>'score')::numeric END;
    v_source := CASE WHEN v_c->>'source' IN ('self-paced', 'full-training-program') THEN v_c->>'source' ELSE 'self-paced' END;
    SELECT COALESCE(jsonb_object_agg(k, true), '{}'::jsonb) INTO v_steps
      FROM unnest(ARRAY['video', 'pdf', 'ppt', 'quiz']) k
     WHERE (v_c->'completedSteps'->k) = 'true'::jsonb;

    INSERT INTO public.self_paced_enrollments AS t (
      user_id, code, title, hours, instructor, category, score, source, completed, completed_at,
      completed_steps, enrolled_at, updated_at)
    VALUES (
      v_uid, v_code, NULLIF(v_c->>'title', ''), NULLIF(v_c->>'hours', ''), NULLIF(v_c->>'instructor', ''),
      NULLIF(v_c->>'category', ''), v_score, v_source, COALESCE((v_c->'completed') = 'true'::jsonb, false),
      CASE WHEN (v_c->'completed') = 'true'::jsonb THEN COALESCE(public._epoch_ms_to_ts(v_c->'completedAt'), now()) END,
      v_steps, COALESCE(public._epoch_ms_to_ts(v_c->'enrolledAt'), now()), now())
    ON CONFLICT (user_id, code) DO UPDATE SET
      -- Tidak pernah turun: selesai tetap selesai, nilai tertinggi, langkah digabung.
      completed = t.completed OR EXCLUDED.completed,
      completed_at = CASE WHEN t.completed OR EXCLUDED.completed
                          THEN LEAST(t.completed_at, EXCLUDED.completed_at) END,
      score = GREATEST(t.score, EXCLUDED.score),
      completed_steps = t.completed_steps || EXCLUDED.completed_steps,
      enrolled_at = LEAST(t.enrolled_at, EXCLUDED.enrolled_at),
      title = COALESCE(EXCLUDED.title, t.title),
      hours = COALESCE(EXCLUDED.hours, t.hours),
      instructor = COALESCE(EXCLUDED.instructor, t.instructor),
      category = COALESCE(EXCLUDED.category, t.category),
      source = COALESCE(t.source, EXCLUDED.source),
      updated_at = now();
    v_saved := v_saved + 1;
  END LOOP;

  RETURN jsonb_build_object('saved', v_saved, 'skipped', v_skipped);
END $$;
REVOKE ALL ON FUNCTION public.self_paced_sync(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.self_paced_sync(jsonb) TO authenticated;

-- Langkah tersimpan hanya berisi nilai true (penggabungan || tidak boleh menurunkan).
UPDATE public.self_paced_enrollments t
   SET completed_steps = COALESCE((SELECT jsonb_object_agg(k, true) FROM unnest(ARRAY['video','pdf','ppt','quiz']) k
                                    WHERE (t.completed_steps->k) = 'true'::jsonb), '{}'::jsonb)
 WHERE completed_steps <> COALESCE((SELECT jsonb_object_agg(k, true) FROM unnest(ARRAY['video','pdf','ppt','quiz']) k
                                     WHERE (t.completed_steps->k) = 'true'::jsonb), '{}'::jsonb);

-- Tulis hanya lewat RPC; baca dan hapus (reset kursus) milik sendiri tetap boleh.
DROP POLICY IF EXISTS self_paced_enrollments_own_insert ON public.self_paced_enrollments;
DROP POLICY IF EXISTS self_paced_enrollments_own_update ON public.self_paced_enrollments;
REVOKE INSERT, UPDATE ON public.self_paced_enrollments FROM authenticated, anon;

COMMIT;
