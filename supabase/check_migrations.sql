-- Pengecek migrasi BARUNA (BUKAN migrasi; tidak mengubah apa pun, hanya membaca).
-- Cara pakai: tempel seluruh isi berkas ini di Supabase SQL Editor DATABASE YANG
-- INGIN DIPERIKSA (main dan intern-update adalah dua database berbeda) lalu Run.
-- Hasil: satu baris per migrasi, kolom "status" berisi OK atau BELUM DIJALANKAN.
-- Jalankan migrasi yang berstatus BELUM DIJALANKAN, berurutan dari atas ke bawah
-- (urutan "no" sama dengan urutan menjalankan), lalu jalankan pengecek ini lagi.
--
-- Catatan: sebagian migrasi tidak diperiksa terpisah karena hanya mengisi data atau
-- digantikan migrasi berikutnya (misalnya 20261014030000 digantikan 20261014040000;
-- 20261003131500, 20260924020000, 20261008020000/040000,
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
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'expert_revision_resubmit')),
  (27, '20261015070000_expert_direct_write_lockdown',
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'review_drafts_guard_client_update')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'submit_draft_for_review'
                    AND prosrc LIKE '%_expert_payload_problem%')),
  -- Tetap BELUM setelah dijalankan = masih ada data ganda; lihat NOTICE migrasi itu.
  (28, '20261015080000_expert_uniqueness_guards',
      to_regclass('public.experts_one_active_profile_per_contributor') IS NOT NULL
      AND to_regclass('public.review_drafts_one_fresh_expert_draft_per_user') IS NOT NULL),
  (29, '20261015090000_expert_language_taxonomy',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_expert_language_code')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_expert_sync_languages')),
  (30, '20261015100000_review_subjects_archived_status (juga memeriksa 20261006110000)',
      EXISTS (SELECT 1 FROM pg_constraint
               WHERE conname = 'review_subjects_current_status_check'
                 AND pg_get_constraintdef(oid) LIKE '%archived%')),
  (31, '20261020010000_participant_learning_integrity',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'learning_enrol')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'issue_my_certificate')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'verify_certificate')),
  (32, '20261020030000_expert_profile_ownership',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_expert_is_owner'
                AND prosrc LIKE '%original_contributor_id%')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trainer_portal_bootstrap'
                    AND prosrc NOT LIKE '%created_by=v_uid%')),
  -- Nomor urut 33 walau berkasnya 20261020020000: dibuat bersamaan dengan 030000 dan
  -- tidak saling bergantung, jadi boleh dijalankan sebelum atau sesudahnya.
  (33, '20261020020000_module_content_access',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'can_access_module_content'
                AND prosrc LIKE '%original_contributor_id%')),
  (34, '20261020040000_participant_biodata_selfpaced_integrity',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'participant_biodata_save')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'self_paced_sync')
      AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'participant_biodata'
                        AND policyname = 'participant_biodata_own_update')),
  (35, '20261020050000_security_hardening_views_internal_functions',
      (to_regprocedure('public._service_request_log(uuid, uuid, text, text, text, text, text)') IS NULL
       OR NOT has_function_privilege('anon', 'public._service_request_log(uuid, uuid, text, text, text, text, text)', 'EXECUTE'))
      AND (to_regclass('public.languages') IS NULL
           OR NOT has_table_privilege('anon', 'public.languages', 'UPDATE'))),
  (36, '20261020060000_knowledge_resource_decision_atomic',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_kr_decide')),
  (37, '20261020070000_retire_legacy_role_system',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role' AND prosrc LIKE '%has_rbac_role%')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'finalize_decision'
                    AND prosrc LIKE '%use_kind_specific_decision%')),
  -- BELUM juga bila migrasi batal karena pengamannya; lihat pesan error di SQL Editor.
  (38, '20261021010000_module_material_metadata_privacy',
      NOT has_column_privilege('anon', 'public.module_registry', 'metadata', 'SELECT')
      AND has_column_privilege('anon', 'public.module_registry', 'title', 'SELECT')
      AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kr_module_metadata_guard')),
  (39, '20261021020000_governance_role_alignment',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role' AND prosrc LIKE '%''reviewer''%'
                AND prosrc LIKE '%''approver''%')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_assert_reviewer_assignable')),
  -- Jalankan SETELAH no. 39. BELUM juga bila migrasi batal karena pengamannya.
  (40, '20261021030000_retire_legacy_governance_role_codes',
      NOT EXISTS (SELECT 1 FROM public.rbac_roles WHERE code IN ('qa_reviewer', 'management'))),
  (41, '20261021040000_rbac_role_catalog_readable',
      EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rbac_roles'
                AND policyname = 'rbac_roles_catalog_read'))
)
SELECT no, migration,
       CASE WHEN ok THEN 'OK' ELSE 'BELUM DIJALANKAN' END AS status
  FROM checks
 ORDER BY no;
