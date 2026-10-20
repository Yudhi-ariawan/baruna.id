-- ============================================================================
-- Hapus kode peran lama `qa_reviewer` dan `management` dari sistem peran
-- ============================================================================
-- 20260924030000 menetapkan rantai kurasi resmi reviewer -> verifier -> approver
-- -> publisher dan seharusnya sudah menghapus kode lama (qa_reviewer -> reviewer,
-- management -> approver). Di intern-update (21 Okt 2026) kedua kode lama masih
-- ada dan muncul sebagai pilihan centang di halaman Users:
--   * `management` diperlakukan kode aplikasi sebagai ADMIN PENUH
--     (src/lib/auth/permissions.server.ts). Mencentangnya untuk seseorang membuat
--     orang itu admin tanpa terlihat sebagai admin.
--   * `qa_reviewer` dan `reviewer` adalah tugas yang sama dengan dua nama.
-- Saat dicek: masing-masing 1 penugasan aktif (bukan primer), hanya milik super
-- admin yang juga memegang reviewer dan approver; 37 izin melekat; 0 permintaan
-- perubahan peran.
--
-- Syarat: 20261021020000 sudah dijalankan (has_role menerima peran resmi), supaya
-- pemeriksaan has_role(_, 'qa_reviewer'/'management') di policy tetap berlaku.
-- Nama `qa_reviewer`/`management` di enum app_role TETAP ada: itu nama
-- pemeriksaan di dalam has_role(), bukan kode peran yang bisa diberikan.
--
-- Langkah:
--   1. Pengaman: BATAL bila 20261021020000 belum dijalankan, atau bila ada
--      pemegang aktif `management` yang bukan admin/super_admin (bagi mereka
--      management = admin penuh; beri admin bila memang admin, atau approver lalu
--      cabut management bila tugasnya hanya memutuskan).
--   2. Pemegang `qa_reviewer` mendapat `reviewer` (tugas sama); status primer ikut.
--      Peran primer `management` dipindah ke peran admin/super_admin orangnya.
--   3. Permintaan perubahan peran dipetakan ke peran resmi.
--   4. Penugasan, izin, dan kode lama dihapus; setiap penugasan dicatat di
--      admin_audit_log.
-- Aman dijalankan ulang: bila kode lama sudah tidak ada, tidak ada yang berubah.

BEGIN;

DO $$
DECLARE v_problem text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role' AND prosrc LIKE '%''reviewer''%'
                   AND prosrc LIKE '%''approver''%') THEN
    RAISE EXCEPTION 'jalankan 20261021020000_governance_role_alignment.sql lebih dulu';
  END IF;

  SELECT string_agg(DISTINCT COALESCE(u.email, ur.user_id::text), ', ') INTO v_problem
    FROM public.rbac_user_roles ur
    JOIN public.rbac_roles r ON r.id = ur.role_id AND r.code = 'management'
    LEFT JOIN auth.users u ON u.id = ur.user_id
   WHERE ur.status = 'active'
     AND ur.valid_from <= now() AND (ur.valid_until IS NULL OR ur.valid_until > now())
     AND NOT public.has_rbac_role(ur.user_id, 'admin')
     AND NOT public.has_rbac_role(ur.user_id, 'super_admin');
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION 'management_holder_not_admin: % memegang management (setara admin penuh di aplikasi) tanpa peran admin. Bila akun itu memang admin, beri peran admin; bila tugasnya hanya memutuskan, beri approver lalu cabut management. Setelah itu jalankan lagi.', v_problem
      USING HINT = 'Tidak ada yang diubah.';
  END IF;
END $$;

-- ------------------------------------------- 2a. qa_reviewer -> reviewer
INSERT INTO public.rbac_user_roles (user_id, role_id, granted_by, created_at, is_primary, status, scope,
                                    valid_from, valid_until, approved_by, approved_at, reason)
SELECT ur.user_id, target.id, ur.granted_by, ur.created_at, false, ur.status, ur.scope,
       ur.valid_from, ur.valid_until, ur.approved_by, ur.approved_at, 'migrated_from_qa_reviewer'
  FROM public.rbac_user_roles ur
  JOIN public.rbac_roles legacy ON legacy.id = ur.role_id AND legacy.code = 'qa_reviewer'
  JOIN public.rbac_roles target ON target.code = 'reviewer'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ------------------------------------------- 2b. pindahkan status primer
UPDATE public.rbac_user_roles official SET is_primary = true
  FROM public.rbac_user_roles legacy_row
  JOIN public.rbac_roles legacy ON legacy.id = legacy_row.role_id AND legacy.code = 'qa_reviewer'
  JOIN public.rbac_roles target ON target.code = 'reviewer'
 WHERE legacy_row.is_primary AND legacy_row.status = 'active'
   AND official.user_id = legacy_row.user_id AND official.role_id = target.id;

UPDATE public.rbac_user_roles official SET is_primary = true
 WHERE official.id IN (
   SELECT DISTINCT ON (legacy_row.user_id) adm.id
     FROM public.rbac_user_roles legacy_row
     JOIN public.rbac_roles legacy ON legacy.id = legacy_row.role_id AND legacy.code = 'management'
     JOIN public.rbac_user_roles adm ON adm.user_id = legacy_row.user_id AND adm.status = 'active'
     JOIN public.rbac_roles ar ON ar.id = adm.role_id AND ar.code IN ('super_admin', 'admin')
    WHERE legacy_row.is_primary AND legacy_row.status = 'active'
    ORDER BY legacy_row.user_id, (ar.code = 'super_admin') DESC, adm.created_at);

-- ------------------------------------------- 3. permintaan perubahan peran
UPDATE public.rbac_role_change_requests req SET role_id = target.id
  FROM public.rbac_roles legacy, public.rbac_roles target
 WHERE req.role_id = legacy.id AND legacy.code IN ('qa_reviewer', 'management')
   AND target.code = CASE legacy.code WHEN 'qa_reviewer' THEN 'reviewer' ELSE 'approver' END;

-- ------------------------------------------- 4. hapus dan catat
INSERT INTO public.admin_audit_log (event_type, actor_id, target_user_id, entity_type, entity_id, before_data, after_data, metadata)
SELECT 'legacy_role_code_retired', NULL, ur.user_id, 'rbac_user_roles', ur.id::text,
       to_jsonb(ur) || jsonb_build_object('role_code', r.code), NULL,
       jsonb_build_object('source', 'migration_20261021030000',
                          'official_role', CASE r.code WHEN 'qa_reviewer' THEN 'reviewer' ELSE 'approver' END)
  FROM public.rbac_user_roles ur
  JOIN public.rbac_roles r ON r.id = ur.role_id
 WHERE r.code IN ('qa_reviewer', 'management');

DELETE FROM public.rbac_user_roles
 WHERE role_id IN (SELECT id FROM public.rbac_roles WHERE code IN ('qa_reviewer', 'management'));
DELETE FROM public.rbac_role_permissions
 WHERE role_id IN (SELECT id FROM public.rbac_roles WHERE code IN ('qa_reviewer', 'management'));
DELETE FROM public.rbac_roles WHERE code IN ('qa_reviewer', 'management');
DELETE FROM public.user_roles WHERE role::text IN ('qa_reviewer', 'management');

COMMIT;
