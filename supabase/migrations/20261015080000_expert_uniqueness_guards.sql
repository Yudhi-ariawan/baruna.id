-- ============================================================================
-- Expert: pastikan pengaman duplikat benar-benar aktif
-- ============================================================================
-- Migrasi 20261014010000 MELEWATI dua indeks unik bila saat itu sudah ada data
-- ganda (hanya RAISE NOTICE, mudah terlewat di SQL Editor):
--   * experts_one_active_profile_per_contributor (satu profil aktif per akun)
--   * review_drafts_one_fresh_expert_draft_per_user (satu draf baru per akun)
-- Tanpa indeks itu, dua permintaan bersamaan bisa membuat profil/draf ganda.
-- Migrasi ini mencoba lagi. Bila data ganda masih ada, indeks tidak dibuat dan
-- daftar akun yang perlu dirapikan ditampilkan sebagai NOTICE; pengecek
-- check_migrations.sql akan tetap menampilkan BELUM sampai datanya dirapikan.
--
-- Selain itu kontak privat (email/telepon) expert yang sudah tayang sebelum
-- 20261015060000 diisi dari pengajuannya, agar cek duplikat email (A2) juga
-- mengenali mereka. Kontak yang sudah ada tidak diubah.

DO $$
DECLARE r record; v_dups integer;
BEGIN
  IF to_regclass('public.experts_one_active_profile_per_contributor') IS NULL THEN
    SELECT count(*) INTO v_dups FROM (
      SELECT original_contributor_id FROM public.experts
       WHERE original_contributor_id IS NOT NULL AND current_status <> 'archived'
       GROUP BY original_contributor_id HAVING count(*) > 1) d;
    IF v_dups = 0 THEN
      CREATE UNIQUE INDEX experts_one_active_profile_per_contributor
        ON public.experts (original_contributor_id)
        WHERE original_contributor_id IS NOT NULL AND current_status <> 'archived';
      RAISE NOTICE 'experts_one_active_profile_per_contributor dibuat';
    ELSE
      FOR r IN SELECT original_contributor_id AS uid, count(*) AS n FROM public.experts
                WHERE original_contributor_id IS NOT NULL AND current_status <> 'archived'
                GROUP BY original_contributor_id HAVING count(*) > 1 LOOP
        RAISE NOTICE 'Profil expert aktif ganda untuk akun % (% baris): arsipkan salah satu lalu jalankan ulang', r.uid, r.n;
      END LOOP;
    END IF;
  END IF;

  IF to_regclass('public.review_drafts_one_fresh_expert_draft_per_user') IS NULL THEN
    SELECT count(*) INTO v_dups FROM (
      SELECT submitter_id FROM public.review_drafts
       WHERE subject_kind = 'expert' AND status = 'draft' AND linked_subject_id IS NULL
       GROUP BY submitter_id HAVING count(*) > 1) d;
    IF v_dups = 0 THEN
      CREATE UNIQUE INDEX review_drafts_one_fresh_expert_draft_per_user
        ON public.review_drafts (submitter_id)
        WHERE subject_kind = 'expert' AND status = 'draft' AND linked_subject_id IS NULL;
      RAISE NOTICE 'review_drafts_one_fresh_expert_draft_per_user dibuat';
    ELSE
      FOR r IN SELECT submitter_id AS uid, count(*) AS n FROM public.review_drafts
                WHERE subject_kind = 'expert' AND status = 'draft' AND linked_subject_id IS NULL
                GROUP BY submitter_id HAVING count(*) > 1 LOOP
        RAISE NOTICE 'Draf expert baru ganda untuk akun % (% baris): tarik (withdraw) yang lama lalu jalankan ulang', r.uid, r.n;
      END LOOP;
    END IF;
  END IF;
END $$;

INSERT INTO public.expert_contact_private (expert_id, email, phone)
SELECT e.id,
       NULLIF(btrim(d.payload->>'email'), ''),
       NULLIF(btrim(d.payload->>'phone'), '')
  FROM public.experts e
  JOIN public.review_subjects s ON s.id = e.source_submission_id AND s.kind = 'expert'
  JOIN LATERAL (
    SELECT r.payload FROM public.review_drafts r
     WHERE r.linked_subject_id = s.id AND r.submitter_id = s.submitted_by AND r.status <> 'withdrawn'
     ORDER BY r.updated_at DESC LIMIT 1
  ) d ON true
 WHERE jsonb_typeof(d.payload->'email') = 'string' AND btrim(d.payload->>'email') <> ''
ON CONFLICT (expert_id) DO NOTHING;
