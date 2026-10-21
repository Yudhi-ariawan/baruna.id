-- Audit keamanan BARUNA (BUKAN migrasi; hanya membaca, tidak mengubah apa pun).
-- Tempel di SQL Editor database yang ingin diperiksa (main / intern-update), lalu Run.
-- Setiap baris = satu temuan. Hasil kosong = tidak ada temuan untuk kategori itu.
--
-- Kategori:
--   1 rls_mati              tabel public tanpa RLS (siapa pun yang punya GRANT bisa baca/tulis semua baris)
--   2 view_tulis_lewati_rls view yang bisa ditulis anon/authenticated dan berjalan sebagai pemilik (melewati RLS)
--   3 anon_boleh_tulis      GRANT INSERT/UPDATE/DELETE ke anon (pengunjung tanpa login)
--   4 policy_tulis_terbuka  policy tulis untuk anon/public, atau dengan syarat `true`
--   5 policy_admin_lama     policy tulis yang masih memakai has_role() (role admin/management lama)
--   6 definer_anon          fungsi SECURITY DEFINER yang bisa dipanggil anon
--   7 internal_terbuka      fungsi berawalan "_" yang bisa dipanggil authenticated
--   8 fk_blok_hapus_akun    foreign key ke auth.users tanpa ON DELETE (akun tidak bisa dihapus)
--   9 expert_tanpa_profil   akun berperan expert tanpa profil expert yang tayang (buntu: portal menolak,
--                           formulir Become an Expert menganggapnya sudah expert). Detail = asal perannya.
--                           Akun admin uji yang diberi semua peran juga muncul di sini.

WITH pub AS (
  SELECT c.oid, c.relname, c.relkind, c.relrowsecurity, c.reloptions
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
)
SELECT 1 AS no, 'rls_mati' AS kategori, relname::text AS objek, '' AS detail
  FROM pub WHERE relkind IN ('r', 'p') AND NOT relrowsecurity
UNION ALL
SELECT 2, 'view_tulis_lewati_rls', g.table_name::text, string_agg(DISTINCT g.grantee || ':' || g.privilege_type, ', ')
  FROM information_schema.role_table_grants g
  JOIN pub ON pub.relname = g.table_name AND pub.relkind = 'v'
 WHERE g.table_schema = 'public' AND g.grantee IN ('anon', 'authenticated')
   AND g.privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
   AND NOT COALESCE((SELECT o.option_value::boolean FROM pg_options_to_table(pub.reloptions) o
                      WHERE o.option_name = 'security_invoker'), false)
 GROUP BY g.table_name
UNION ALL
SELECT 3, 'anon_boleh_tulis', g.table_name::text, string_agg(g.privilege_type, ', ')
  FROM information_schema.role_table_grants g
 WHERE g.table_schema = 'public' AND g.grantee = 'anon' AND g.privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
 GROUP BY g.table_name
UNION ALL
SELECT 4, 'policy_tulis_terbuka', tablename::text, policyname || ' (' || cmd || ', roles=' || array_to_string(roles, ',') || ')'
  FROM pg_policies
 WHERE schemaname = 'public' AND cmd <> 'SELECT'
   AND ('anon' = ANY (roles) OR 'public' = ANY (roles)
        OR btrim(COALESCE(qual, '')) = 'true' OR btrim(COALESCE(with_check, '')) = 'true')
UNION ALL
SELECT 5, 'policy_admin_lama', tablename::text, policyname || ' (' || cmd || ')'
  FROM pg_policies
 WHERE schemaname = 'public' AND cmd <> 'SELECT'
   AND (COALESCE(qual, '') ILIKE '%has_role(%' OR COALESCE(with_check, '') ILIKE '%has_role(%')
UNION ALL
SELECT 6, 'definer_anon', p.proname::text, pg_get_function_identity_arguments(p.oid)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.prosecdef AND p.prorettype <> 'trigger'::regtype
   AND has_function_privilege('anon', p.oid, 'EXECUTE')
UNION ALL
SELECT 7, 'internal_terbuka', p.proname::text, pg_get_function_identity_arguments(p.oid)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname LIKE '\_%' AND p.prorettype <> 'trigger'::regtype
   AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
UNION ALL
SELECT 8, 'fk_blok_hapus_akun', conrelid::regclass::text, conname::text
  FROM pg_constraint
 WHERE contype = 'f' AND confrelid = 'auth.users'::regclass AND confdeltype IN ('a', 'r')
UNION ALL
SELECT 9, 'expert_tanpa_profil', u.email::text, COALESCE(ur.reason, '')
  FROM public.rbac_user_roles ur
  JOIN public.rbac_roles r ON r.id = ur.role_id AND r.code = 'expert'
  JOIN auth.users u ON u.id = ur.user_id
 WHERE ur.status = 'active'
   AND NOT EXISTS (SELECT 1 FROM public.experts e
                    WHERE e.original_contributor_id = ur.user_id AND e.current_status::text = 'published')
ORDER BY 1, 3;
