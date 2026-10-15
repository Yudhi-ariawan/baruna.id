-- ============================================================================
-- Expert/Trainer: kuota level di konfigurasi, penanda baca notifikasi, cek duplikat
-- ============================================================================
-- A9  Batas modul per level trainer tidak lagi ditulis mati di fungsi SQL
--     (Slide 15/36-38: data tidak hard-coded). Nilainya ada di tabel
--     trainer_level_module_limits dan bisa diubah admin tanpa migrasi.
-- A5  Notifikasi permintaan layanan dan pengajuan trainer dihitung dari tabel
--     yang sudah ada. Penanda "sudah dibaca" dipindah ke tabel notification_reads
--     (satu baris per notifikasi, INSERT ... ON CONFLICT DO NOTHING) sehingga dua
--     perangkat yang menandai bersamaan tidak saling menimpa, dan pengguna tanpa
--     pengajuan tetap bisa menandai notifikasinya.
-- A2  Pencarian kandidat duplikat profil expert (Slide 37 Duplicate/Match):
--     nama (dinormalkan) atau email yang sama dengan profil lain di direktori.
--     Hanya service_role; dipakai tampilan admin sebagai peringatan.

BEGIN;

-- ------------------------------------------------------------ A9 kuota level
CREATE TABLE IF NOT EXISTS public.trainer_level_module_limits (
  level text PRIMARY KEY,
  module_limit integer NOT NULL CHECK (module_limit >= 0),
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trainer_level_module_limits ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.trainer_level_module_limits TO authenticated;
GRANT ALL ON public.trainer_level_module_limits TO service_role;
DROP POLICY IF EXISTS trainer_level_module_limits_read ON public.trainer_level_module_limits;
CREATE POLICY trainer_level_module_limits_read ON public.trainer_level_module_limits
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.trainer_level_module_limits (level, module_limit, note) VALUES
  ('none', 0, 'Belum ada level: belum boleh mengajukan modul tambahan'),
  ('certified', 2, 'BARUNA Certified Trainer'),
  ('advanced', 5, 'BARUNA Advanced Trainer'),
  ('senior', 10, 'BARUNA Senior Trainer'),
  ('master', 999, 'BARUNA Master Trainer (tunduk pada persetujuan kurikulum strategis)')
ON CONFLICT (level) DO NOTHING;

-- Dulu IMMUTABLE dengan angka tetap; sekarang membaca tabel. Level yang tidak
-- dikenal tetap 0 (tertutup, bukan terbuka).
CREATE OR REPLACE FUNCTION public._module_level_limit(_level text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT module_limit FROM public.trainer_level_module_limits WHERE level = _level), 0)
$$;
REVOKE ALL ON FUNCTION public._module_level_limit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._module_level_limit(text) TO authenticated, service_role;

-- --------------------------------------------------- A5 penanda baca notifikasi
CREATE TABLE IF NOT EXISTS public.notification_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id text NOT NULL CHECK (char_length(notification_id) BETWEEN 1 AND 200),
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notification_id)
);
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
DROP POLICY IF EXISTS notification_reads_own_read ON public.notification_reads;
CREATE POLICY notification_reads_own_read ON public.notification_reads
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Indeks untuk membaca notifikasi per pengguna (terbatas dan terurut).
CREATE INDEX IF NOT EXISTS expert_service_request_events_request_idx
  ON public.expert_service_request_events(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS expert_trainer_applications_decided_idx
  ON public.expert_trainer_applications(applicant_id, decided_at DESC)
  WHERE status IN ('approved', 'rejected');

-- ----------------------------------------------------- A2 kandidat duplikat
CREATE INDEX IF NOT EXISTS experts_display_name_norm_idx
  ON public.experts (lower(regexp_replace(btrim(display_name), '\s+', ' ', 'g')));
CREATE INDEX IF NOT EXISTS expert_contact_private_email_norm_idx
  ON public.expert_contact_private (lower(btrim(email)));

CREATE OR REPLACE FUNCTION public.expert_duplicate_candidates(
  _name text, _email text, _exclude_user uuid DEFAULT NULL
) RETURNS TABLE (
  expert_id uuid, display_name text, slug text, current_status text,
  owner_id uuid, match_reason text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH q AS (
    SELECT NULLIF(lower(regexp_replace(btrim(COALESCE(_name, '')), '\s+', ' ', 'g')), '') AS n,
           NULLIF(lower(btrim(COALESCE(_email, ''))), '') AS e
  )
  SELECT x.id, x.display_name, x.slug, x.current_status::text, x.created_by,
         CASE WHEN x.by_name AND x.by_email THEN 'nama dan email sama'
              WHEN x.by_email THEN 'email sama' ELSE 'nama sama' END
    FROM (
      SELECT ex.id, ex.display_name, ex.slug, ex.current_status, ex.created_by,
             (q.n IS NOT NULL AND lower(regexp_replace(btrim(ex.display_name), '\s+', ' ', 'g')) = q.n) AS by_name,
             (q.e IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.expert_contact_private c
                 WHERE c.expert_id = ex.id AND lower(btrim(c.email)) = q.e)) AS by_email
        FROM public.experts ex, q
       WHERE (_exclude_user IS NULL OR ex.created_by <> _exclude_user)
         AND ex.current_status::text NOT IN ('draft')
         AND (
           (q.n IS NOT NULL AND lower(regexp_replace(btrim(ex.display_name), '\s+', ' ', 'g')) = q.n)
           OR (q.e IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.expert_contact_private c
                 WHERE c.expert_id = ex.id AND lower(btrim(c.email)) = q.e))
         )
       LIMIT 10
    ) x
$$;
REVOKE ALL ON FUNCTION public.expert_duplicate_candidates(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expert_duplicate_candidates(text, text, uuid) TO service_role;

COMMIT;
