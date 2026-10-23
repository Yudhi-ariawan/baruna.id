-- ============================================================================
-- Data Master: kuota modul per level trainer
-- ============================================================================
-- Dicek 23 Okt 2026 (database intern-update, kode branch ini):
--
-- * Batas modul aktif per level trainer ada di tabel trainer_level_module_limits
--   (20261015050000: certified 2, advanced 5, senior 10, master 999) dan sudah
--   dipakai module_draft_create lewat _module_level_limit / _trainer_module_quota.
--   Komentar migrasi itu menyebut nilainya "bisa diubah admin tanpa migrasi", tetapi
--   tidak ada RPC maupun halaman untuk mengubahnya: hanya lewat SQL Editor, tanpa
--   validasi dan tanpa audit trail (Slide 26/39: tidak hard-coded, dikelola lewat
--   Admin Console, setiap perubahan masuk audit trail).
--
-- Slide 16: Approver (dan Admin) punya akses penuh pada domain Experts dan Academy,
-- sama dengan aturan level trainer di Data Master (20261023010000).
--
-- Perubahan:
-- * Tulis langsung dicabut dari anon/authenticated (RLS sudah tidak punya policy
--   tulis; ini lapis kedua). Baris empat level dipastikan ada (nilai bawaan bila
--   belum ada; nilai yang sudah ada tidak diubah).
-- * master_module_limits_overview(): kuota yang berlaku, jumlah trainer aktif per
--   level, dan riwayat perubahan (dari audit trail).
-- * master_module_limits_set(_limits, _expected, _note): empat level wajib, bilangan
--   bulat 1-9999, level lebih tinggi tidak boleh lebih kecil, alasan wajib, perubahan
--   kosong ditolak. _expected = nilai yang dilihat layar; bila sudah diubah orang lain
--   (perangkat/kurator lain), simpan ditolak agar tidak saling menimpa diam-diam.
-- * Kuota "belum punya level" tetap 0 (tidak lewat Data Master): trainer tanpa level
--   tidak bisa membuat modul tambahan, sesuai aturan 20261015050000.
-- * Menurunkan kuota tidak menghapus atau menarik modul yang sudah ada; trainer yang
--   sudah melewati kuota baru hanya tidak bisa membuat modul baru.

BEGIN;

INSERT INTO public.trainer_level_module_limits (level, module_limit, note) VALUES
  ('certified', 2, 'BARUNA Certified Trainer'),
  ('advanced', 5, 'BARUNA Advanced Trainer'),
  ('senior', 10, 'BARUNA Senior Trainer'),
  ('master', 999, 'BARUNA Master Trainer (tunduk pada persetujuan kurikulum strategis)')
ON CONFLICT (level) DO NOTHING;

DROP POLICY IF EXISTS trainer_level_module_limits_admin_write ON public.trainer_level_module_limits;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.trainer_level_module_limits FROM anon, authenticated;

-- ------------------------------------------------------------- read (console)
CREATE OR REPLACE FUNCTION public.master_module_limits_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'limits', COALESCE((SELECT jsonb_agg(jsonb_build_object('level', l.level, 'limit', l.module_limit, 'updatedAt', l.updated_at)
        ORDER BY array_position(ARRAY['certified', 'advanced', 'senior', 'master'], l.level))
        FROM public.trainer_level_module_limits l WHERE l.level IN ('certified', 'advanced', 'senior', 'master')), '[]'::jsonb),
    -- Active trainers per level, read the same way as _trainer_module_quota (latest valid row).
    'trainers', COALESCE((SELECT jsonb_object_agg(x.lvl, x.n) FROM (
        SELECT s.trainer_level::text AS lvl, count(*) AS n FROM (
          SELECT DISTINCT ON (ts.expert_id) ts.trainer_level, ts.trainer_status
            FROM public.expert_trainer_status ts
           WHERE ts.effective_from <= now() AND (ts.expires_at IS NULL OR ts.expires_at > now())
           ORDER BY ts.expert_id, ts.version DESC, ts.granted_at DESC) s
         WHERE s.trainer_status = 'active'
         GROUP BY s.trainer_level) x), '{}'::jsonb),
    'history', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'at', a.created_at, 'by', (SELECT display_name FROM public.profiles WHERE id = a.actor_id),
        'note', a.after->>'note', 'before', a.before->'limits', 'after', a.after->'limits') ORDER BY a.created_at DESC)
        FROM (SELECT * FROM public.governance_audit_log WHERE event_type = 'master_module_limits_changed'
               ORDER BY created_at DESC LIMIT 20) a), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.master_module_limits_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_module_limits_overview() TO authenticated;

-- ------------------------------------------------------------- write
CREATE OR REPLACE FUNCTION public.master_module_limits_set(_limits jsonb, _expected jsonb, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_note text := btrim(COALESCE(_note, ''));
  v_levels text[] := ARRAY['certified', 'advanced', 'senior', 'master'];
  v_level text; v_val integer; v_prev integer := 0; v_before jsonb; v_after jsonb := '{}'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_note) < 5 OR char_length(v_note) > 500 THEN RAISE EXCEPTION 'module_limits_note_required'; END IF;
  -- Exactly the four level keys, nothing else.
  IF jsonb_typeof(_limits) IS DISTINCT FROM 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(_limits)) <> 4
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(_limits) k WHERE k <> ALL (v_levels)) THEN
    RAISE EXCEPTION 'module_limits_invalid';
  END IF;
  IF jsonb_typeof(_expected) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'module_limits_stale'; END IF;

  -- One writer at a time; the stale check below then compares against settled values.
  PERFORM pg_advisory_xact_lock(hashtext('master_module_limits'));
  PERFORM 1 FROM public.trainer_level_module_limits WHERE level = ANY (v_levels) FOR UPDATE;

  SELECT COALESCE(jsonb_object_agg(level, module_limit), '{}'::jsonb) INTO v_before
    FROM public.trainer_level_module_limits WHERE level = ANY (v_levels);

  FOREACH v_level IN ARRAY v_levels LOOP
    IF jsonb_typeof(_limits->v_level) IS DISTINCT FROM 'number' OR (_limits->>v_level) !~ '^\d{1,4}$' THEN
      RAISE EXCEPTION 'module_limits_value_invalid';
    END IF;
    v_val := (_limits->>v_level)::integer;
    IF v_val < 1 OR v_val > 9999 THEN RAISE EXCEPTION 'module_limits_value_invalid'; END IF;
    -- A higher level never gets a smaller quota than a lower one.
    IF v_val < v_prev THEN RAISE EXCEPTION 'module_limits_decreasing'; END IF;
    v_prev := v_val;
    v_after := v_after || jsonb_build_object(v_level, v_val);
  END LOOP;

  -- The screen saw other values: someone else saved in between.
  FOREACH v_level IN ARRAY v_levels LOOP
    IF (_expected->>v_level) IS DISTINCT FROM (v_before->>v_level) THEN RAISE EXCEPTION 'module_limits_stale'; END IF;
  END LOOP;
  IF v_after = v_before THEN RAISE EXCEPTION 'module_limits_unchanged'; END IF;

  FOREACH v_level IN ARRAY v_levels LOOP
    INSERT INTO public.trainer_level_module_limits (level, module_limit, updated_at)
    VALUES (v_level, (v_after->>v_level)::integer, now())
    ON CONFLICT (level) DO UPDATE SET module_limit = EXCLUDED.module_limit, updated_at = now()
      WHERE public.trainer_level_module_limits.module_limit IS DISTINCT FROM EXCLUDED.module_limit;
  END LOOP;

  PERFORM public.log_governance_event('master_module_limits_changed', v_uid, NULL, 'trainer_level_module_limits', NULL,
    jsonb_build_object('limits', v_before), jsonb_build_object('limits', v_after, 'note', v_note));
  RETURN jsonb_build_object('limits', v_after);
END $$;
REVOKE ALL ON FUNCTION public.master_module_limits_set(jsonb, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_module_limits_set(jsonb, jsonb, text) TO authenticated;

COMMIT;
