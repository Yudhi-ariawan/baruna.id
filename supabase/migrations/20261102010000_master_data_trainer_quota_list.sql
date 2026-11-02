-- ============================================================================
-- Data Master: daftar trainer aktif per level beserta pemakaian kuota modul
-- ============================================================================
-- Diminta pemilik proyek 2 Nov 2026 setelah uji manual Data Master: panel Kuota
-- Modul per Level Trainer (20261023020000) hanya menampilkan jumlah trainer per
-- level ("4 trainer aktif"), sehingga kurator tidak tahu siapa yang terdampak saat
-- mengubah kuota.
--
-- master_trainer_quota_list(): baca saja, hanya super_admin/admin/approver
-- (_can_decide_review), sama dengan Data Master lain.
-- * Satu baris per expert yang status trainer terbarunya 'active' (dibaca sama
--   seperti master_module_limits_overview: baris terbaru yang berlaku).
-- * Pemakaian kuota diambil dari _trainer_module_quota(pemilik profil), fungsi yang
--   sama yang dipakai module_draft_create dan Portal Trainer, jadi angkanya persis
--   sama dengan yang dilihat trainer. Pemilik profil = original_contributor_id
--   (aturan 20261020030000).
-- * portalActive = false bila kuota pemilik tidak menemukan profil trainer aktif
--   (profil tidak tayang/publik atau role expert tidak aktif): trainer itu tidak bisa
--   membuat modul walau statusnya aktif. Ini ditampilkan, bukan diperbaiki diam-diam.
-- * Hanya nama tampil, slug, dan angka; tanpa email/kontak.
-- * Tidak mengubah data apa pun.

BEGIN;

CREATE OR REPLACE FUNCTION public.master_trainer_quota_list()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'expertId', t.expert_id, 'name', t.display_name, 'slug', t.slug, 'level', t.lvl,
             'limit', (t.q->>'limit')::integer, 'used', (t.q->>'used')::integer,
             'live', (t.q->>'live')::integer, 'queued', (t.q->>'queued')::integer,
             'portalActive', t.q->>'level' IS DISTINCT FROM 'not_assigned')
           ORDER BY array_position(ARRAY['certified', 'advanced', 'senior', 'master'], t.lvl), lower(t.display_name))
      FROM (
        SELECT s.expert_id, e.display_name, e.slug, s.trainer_level::text AS lvl,
               public._trainer_module_quota(e.original_contributor_id) AS q
          FROM (SELECT DISTINCT ON (ts.expert_id) ts.expert_id, ts.trainer_level, ts.trainer_status
                  FROM public.expert_trainer_status ts
                 WHERE ts.effective_from <= now() AND (ts.expires_at IS NULL OR ts.expires_at > now())
                 ORDER BY ts.expert_id, ts.version DESC, ts.granted_at DESC) s
          JOIN public.experts e ON e.id = s.expert_id
         WHERE s.trainer_status = 'active'
           AND s.trainer_level::text IN ('certified', 'advanced', 'senior', 'master')
      ) t), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.master_trainer_quota_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_trainer_quota_list() TO authenticated;

COMMIT;
