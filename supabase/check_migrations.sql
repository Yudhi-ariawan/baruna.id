-- Pengecek migrasi BARUNA (BUKAN migrasi; tidak mengubah apa pun, hanya membaca).
-- Cara pakai: tempel seluruh isi berkas ini di Supabase SQL Editor lalu Run.
-- Hasil: satu baris per migrasi, kolom "status" berisi OK atau BELUM DIJALANKAN.
-- Jalankan migrasi yang berstatus BELUM DIJALANKAN, berurutan dari atas ke bawah
-- (urutan "no" sama dengan urutan menjalankan), lalu jalankan pengecek ini lagi.
--
-- Catatan: 20261014030000 tidak diperiksa terpisah karena fungsinya digantikan oleh
-- 20261014040000. Berkas ini perlu ditambah satu baris setiap ada migrasi baru.

WITH checks(no, migration, ok) AS (
  VALUES
  (1, '20261005160000_course_enrollment_applications',
      to_regclass('public.course_enrollment_applications') IS NOT NULL),
  (2, '20261007100000_participant_biodata',
      to_regclass('public.participant_biodata') IS NOT NULL),
  (3, '20261013020000_atomic_knowledge_resource_metrics',
      to_regclass('public.knowledge_resource_metrics') IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_resource_metric')),
  (4, '20261014010000_expert_lifecycle_hardening',
      EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
                AND indexname = 'review_subjects_kind_submitter_status_idx')),
  (5, '20261014020000_trainer_status_latest_semantics',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_active_trainer_expert_id'
                AND prosrc LIKE '%ts.version DESC%')),
  (6, '20261014040000_expert_service_assignment',
      to_regclass('public.expert_service_request_events') IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_service_request_transition')),
  (7, '20261014050000_trainer_qualification_applications',
      to_regclass('public.expert_trainer_applications') IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trainer_application_submit')),
  (8, '20261014060000_fix_admin_lists_email_source',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_service_requests_list'
                AND prosrc LIKE '%auth.users%')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_trainer_applications_list'
                AND prosrc LIKE '%auth.users%')),
  (9, '20261015010000_participant_enrollment_integrity',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'course_enrollment_apply')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_course_enrollment_decide')),
  (10, '20261015020000_trainer_module_integrity',
      to_regclass('public.module_quiz_answer_keys') IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_module_decide')),
  (11, '20261015030000_trainer_pipeline_hardening',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trainer_module_save')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_trainer_module_quota')),
  (12, '20261015040000_published_module_revision_roles',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'request_published_module_revision'
                AND prosrc LIKE '%_can_decide_review%'))
)
SELECT no, migration,
       CASE WHEN ok THEN 'OK' ELSE 'BELUM DIJALANKAN' END AS status
  FROM checks
 ORDER BY no;
