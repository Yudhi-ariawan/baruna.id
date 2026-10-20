-- ============================================================================
-- Hentikan sistem peran lama (user_roles) dan jalur keputusan generik untuk
-- jenis pengajuan yang punya RPC khusus
-- ============================================================================
-- 1. Ada dua sistem peran: lama `user_roles` (dibaca lewat has_role) dan baru
--    `rbac_user_roles` (dikelola di halaman admin). Sistem lama tidak terlihat di
--    halaman admin, tetapi masih dibaca oleh 12 policy tulis, policy baca, dan
--    pemeriksa pemutus (_can_decide_review). Di intern-update (20 Okt) dua akun
--    tercatat admin HANYA di sistem lama: satu akun expert biasa dan satu akun
--    tanpa peran aktif -> admin tersembunyi (bisa memutuskan pengajuan, menulis
--    status pengajuan langsung, membaca kontak privat expert).
--    Keputusan pemilik proyek: kedua akun itu bukan admin.
--
--    Perbaikan: has_role() sekarang membaca sistem baru (nama peran sama:
--    admin, management, qa_reviewer; super_admin dianggap admin). Satu perubahan
--    ini berlaku untuk semua policy dan fungsi yang memakai has_role, tanpa
--    menulis ulang policy satu per satu. Baris lama yang tidak didukung sistem
--    baru dihapus (dicatat di admin_audit_log).
--
--    Pengaman anti-terkunci: bila database ini tidak punya satu pun admin aktif
--    di sistem baru, migrasi DIBATALKAN (semua orang akan kehilangan akses admin).
--
-- 2. finalize_decision dan return_for_revision adalah jalur keputusan generik
--    (alur reviewer lama). Untuk expert, modul, dan Knowledge Hub keduanya hanya
--    mengubah status tanpa menayangkan/menurunkan profil, modul, atau katalog,
--    dan return_for_revision membuat draf kedua. Jenis itu sekarang ditolak dan
--    harus lewat RPC khususnya (admin_expert_decide, admin_module_decide,
--    admin_kr_decide). Fungsi ini tidak dipanggil kode aplikasi.

BEGIN;

-- ---------------------------------------------------------------- 1a. pengaman
DO $$
DECLARE r record; v_admins integer;
BEGIN
  SELECT count(*) INTO v_admins
    FROM public.rbac_user_roles ur
    JOIN public.rbac_roles ro ON ro.id = ur.role_id
    JOIN public.profiles p ON p.id = ur.user_id
   WHERE ro.code IN ('admin', 'super_admin') AND ur.status = 'active' AND p.is_active
     AND ur.valid_from <= now() AND (ur.valid_until IS NULL OR ur.valid_until > now());
  IF v_admins = 0 THEN
    RAISE EXCEPTION 'no_rbac_admin: tidak ada admin aktif di sistem peran baru (rbac_user_roles). '
      'Beri peran admin ke akun yang benar lewat halaman admin atau SQL, lalu jalankan migrasi ini lagi.';
  END IF;

  FOR r IN
    SELECT u.email, ur.role::text AS role
      FROM public.user_roles ur LEFT JOIN auth.users u ON u.id = ur.user_id
     WHERE NOT public.has_rbac_role(ur.user_id, ur.role::text)
       AND NOT (ur.role::text = 'admin' AND public.has_rbac_role(ur.user_id, 'super_admin'))
  LOOP
    RAISE NOTICE 'Peran lama dicabut (tidak ada di sistem baru): % sebagai %', COALESCE(r.email, '(akun terhapus)'), r.role;
  END LOOP;
END $$;

-- ---------------------------------------------------------------- 1b. has_role -> RBAC
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_rbac_role(_user_id, _role::text)
    OR (_role = 'admin' AND public.has_rbac_role(_user_id, 'super_admin')))
$$;

-- ---------------------------------------------------------------- 1c. rapikan baris lama
INSERT INTO public.admin_audit_log (event_type, actor_id, target_user_id, entity_type, entity_id, before_data, after_data, metadata)
SELECT 'legacy_role_revoked', NULL, ur.user_id, 'user_roles', ur.id::text, to_jsonb(ur), NULL,
       jsonb_build_object('source', 'migration_20261020070000', 'reason', 'not_present_in_rbac')
  FROM public.user_roles ur
 WHERE NOT public.has_rbac_role(ur.user_id, ur.role::text)
   AND NOT (ur.role::text = 'admin' AND public.has_rbac_role(ur.user_id, 'super_admin'));

DELETE FROM public.user_roles ur
 WHERE NOT public.has_rbac_role(ur.user_id, ur.role::text)
   AND NOT (ur.role::text = 'admin' AND public.has_rbac_role(ur.user_id, 'super_admin'));

-- ---------------------------------------------------------------- 2a. finalize_decision
CREATE OR REPLACE FUNCTION public.finalize_decision(_subject_id uuid, _decision text, _rationale text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid:=auth.uid(); v_subject public.review_subjects%ROWTYPE; v_id uuid;
  v_submitted integer; v_approve integer;
BEGIN
  IF v_uid IS NULL OR NOT public._can_approve_academy(v_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF length(trim(COALESCE(_rationale,'')))=0 THEN RAISE EXCEPTION 'rationale_required'; END IF;
  SELECT * INTO v_subject FROM public.review_subjects WHERE id=_subject_id FOR UPDATE;
  IF v_subject.id IS NULL THEN RAISE EXCEPTION 'subject_not_found'; END IF;
  IF v_subject.kind IN ('expert','module','knowledge_resource') THEN
    RAISE EXCEPTION 'use_kind_specific_decision: % diputuskan lewat RPC khususnya', v_subject.kind;
  END IF;
  IF v_subject.submitted_by=v_uid THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
  IF v_subject.current_status<>'decision_pending' THEN RAISE EXCEPTION 'subject_not_ready_for_decision'; END IF;
  IF EXISTS (SELECT 1 FROM public.review_records WHERE subject_id=_subject_id AND reviewer_id=v_uid AND status='submitted') THEN
    RAISE EXCEPTION 'reviewer_cannot_approve_same_subject';
  END IF;
  SELECT count(*),count(*) FILTER (WHERE recommendation='approve') INTO v_submitted,v_approve
    FROM public.review_records WHERE subject_id=_subject_id AND status='submitted';
  IF v_submitted<v_subject.required_recommendations THEN RAISE EXCEPTION 'recommendations_incomplete'; END IF;
  IF _decision='approve' AND v_approve<>v_submitted THEN RAISE EXCEPTION 'non_approval_recommendation_present'; END IF;
  INSERT INTO public.review_decisions(subject_id,decided_by,decision,rationale)
    VALUES(_subject_id,v_uid,_decision,_rationale) RETURNING id INTO v_id;
  UPDATE public.review_subjects SET current_status=CASE WHEN _decision='approve' THEN 'approved' ELSE 'rejected' END WHERE id=_subject_id;
  PERFORM public.log_governance_event('decision_'||_decision,v_uid,_subject_id,'review_decision',v_id::text,
    jsonb_build_object('previous_status',v_subject.current_status),
    jsonb_build_object('decision',_decision,'rationale',_rationale,'recommendations',v_submitted));
  RETURN v_id;
END $$;

-- ---------------------------------------------------------------- 2b. return_for_revision
CREATE OR REPLACE FUNCTION public.return_for_revision(_subject_id uuid,_rationale text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid();v_subject public.review_subjects%ROWTYPE;v_decision_id uuid;v_new_draft_id uuid;v_latest jsonb;
BEGIN
 IF v_uid IS NULL OR NOT public._can_approve_academy(v_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF length(trim(COALESCE(_rationale,'')))=0 THEN RAISE EXCEPTION 'rationale_required'; END IF;
 SELECT * INTO v_subject FROM public.review_subjects WHERE id=_subject_id FOR UPDATE;
 IF v_subject.id IS NULL THEN RAISE EXCEPTION 'subject_not_found'; END IF;
 IF v_subject.kind IN ('expert','module','knowledge_resource') THEN
   RAISE EXCEPTION 'use_kind_specific_decision: % diputuskan lewat RPC khususnya', v_subject.kind;
 END IF;
 IF v_subject.submitted_by=v_uid THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
 INSERT INTO public.review_decisions(subject_id,decided_by,decision,rationale) VALUES(_subject_id,v_uid,'return_for_revision',_rationale) RETURNING id INTO v_decision_id;
 UPDATE public.review_records SET status='superseded' WHERE subject_id=_subject_id AND status='submitted';
 UPDATE public.review_subjects SET current_status='pending' WHERE id=_subject_id;
 SELECT snapshot INTO v_latest FROM public.review_subject_revisions WHERE subject_id=_subject_id ORDER BY revision DESC LIMIT 1;
 INSERT INTO public.review_drafts(subject_kind,submitter_id,title,description,external_ref,payload,status,linked_subject_id)
 VALUES(v_subject.kind,v_subject.submitted_by,COALESCE(v_latest->>'title',v_subject.title),COALESCE(v_latest->>'description',v_subject.description),COALESCE(v_latest->>'external_ref',v_subject.external_ref),COALESCE(v_latest->'payload','{}'::jsonb),'draft',_subject_id) RETURNING id INTO v_new_draft_id;
 PERFORM public.log_governance_event('decision_return_for_revision',v_uid,_subject_id,'review_decision',v_decision_id::text,jsonb_build_object('previous_status',v_subject.current_status),jsonb_build_object('new_status','pending','new_draft_id',v_new_draft_id,'rationale',_rationale));
 RETURN v_decision_id;
END $$;

COMMIT;
