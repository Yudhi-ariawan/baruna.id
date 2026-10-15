-- Pengecek migrasi BARUNA (BUKAN migrasi; tidak mengubah apa pun, hanya membaca).
-- Cara pakai: tempel seluruh isi berkas ini di Supabase SQL Editor DATABASE YANG
-- INGIN DIPERIKSA (main dan intern-update adalah dua database berbeda) lalu Run.
-- Hasil: satu baris per migrasi, kolom "status" berisi OK atau BELUM DIJALANKAN.
-- Jalankan migrasi yang berstatus BELUM DIJALANKAN, berurutan dari atas ke bawah
-- (urutan "no" sama dengan urutan menjalankan), lalu jalankan pengecek ini lagi.
--
-- Catatan: sebagian migrasi tidak diperiksa terpisah karena hanya mengisi data atau
-- digantikan migrasi berikutnya (misalnya 20261014030000 digantikan 20261014040000;
-- 20261003131500, 20261006110000, 20260924020000, 20261008020000/040000,
-- 20261009020000 hanya mengubah data). Berkas ini perlu ditambah satu baris setiap
-- ada migrasi baru.

WITH checks(no, migration, ok) AS (
  VALUES
  (1, '20260916010000_experts_public_directory',
      to_regclass('public.experts_directory_v') IS NOT NULL),
  (2, '20260917010000_expert_application_storage',
      EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'expert-applications')),
  (3, '20260921010000_trainer_portal_services',
      to_regclass('public.expert_service_requests') IS NOT NULL),
  (4, '20260922010000_trainer_portal_dynamic_data',
      to_regclass('public.expert_trainer_certificates') IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trainer_portal_bootstrap')),
  (5, '20260923010000_module_attachments_storage',
      EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'module-attachments')),
  (6, '20260924010000_module_review_approval_workflow',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_can_approve_academy')),
  (7, '20260924030000_official_governance_roles',
      EXISTS (SELECT 1 FROM public.rbac_roles WHERE code = 'approver')),
  (8, '20261003010000_knowledge_resource_submission_storage',
      EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'knowledge-submissions')
      OR EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'knowledge_submission_owner_all')),
  (9, '20261005160000_course_enrollment_applications',
      to_regclass('public.course_enrollment_applications') IS NOT NULL),
  (10, '20261007100000_participant_biodata',
      to_regclass('public.participant_biodata') IS NOT NULL),
  (11, '20261008010000_published_module_revision_branch',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'request_published_module_revision')),
  (12, '20261009010000_self_paced_course_enrollments_sync',
      to_regclass('public.self_paced_enrollments') IS NOT NULL),
  (13, '20261013010000_knowledge_resource_metrics_tracking',
      to_regclass('public.knowledge_resource_metrics') IS NOT NULL),
  (14, '20261013010000_platform_partners_catalog',
      to_regclass('public.partners') IS NOT NULL),
  (15, '20261013020000_atomic_knowledge_resource_metrics',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_resource_metric')),
  (16, '20261014010000_expert_lifecycle_hardening',
      EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
                AND indexname = 'review_subjects_kind_submitter_status_idx')),
  (17, '20261014020000_trainer_status_latest_semantics',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_active_trainer_expert_id'
                AND prosrc LIKE '%ts.version DESC%')),
  (18, '20261014040000_expert_service_assignment',
      to_regclass('public.expert_service_request_events') IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_service_request_transition')),
  (19, '20261014050000_trainer_qualification_applications',
      to_regclass('public.expert_trainer_applications') IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trainer_application_submit')),
  (20, '20261014060000_fix_admin_lists_email_source',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_service_requests_list'
                AND prosrc LIKE '%auth.users%')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_trainer_applications_list'
                AND prosrc LIKE '%auth.users%')),
  (21, '20261015010000_participant_enrollment_integrity',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'course_enrollment_apply')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_course_enrollment_decide')),
  (22, '20261015020000_trainer_module_integrity',
      to_regclass('public.module_quiz_answer_keys') IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_module_decide')),
  (23, '20261015030000_trainer_pipeline_hardening',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trainer_module_save')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_trainer_module_quota')),
  (24, '20261015040000_published_module_revision_roles',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'request_published_module_revision'
                AND prosrc LIKE '%_can_decide_review%')),
  (25, '20261015050000_expert_config_notifications_duplicates',
      to_regclass('public.trainer_level_module_limits') IS NOT NULL
      AND to_regclass('public.notification_reads') IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'expert_duplicate_candidates')),
  (26, '20261015060000_expert_decision_atomic',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_expert_decide')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_expert_archive')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'expert_revision_resubmit'))
)
SELECT no, migration,
       CASE WHEN ok THEN 'OK' ELSE 'BELUM DIJALANKAN' END AS status
  FROM checks
 ORDER BY no;
