-- ============================================================================
-- Selaraskan nama peran governance dan pengaman penugasan reviewer (Nomor 8)
-- ============================================================================
-- Dicek 21 Okt 2026 (database intern-update):
--
-- 1. Ada dua nama peran untuk tugas yang sama. 20260924030000 memetakan peran
--    lama ke peran resmi (qa_reviewer -> reviewer, management -> approver), tetapi
--    kode lama `qa_reviewer`/`management` masih ada di rbac_roles dan hanya
--    dipegang super admin. Sejak 20261020070000, has_role() mencari nama yang
--    sama persis di sistem baru, sehingga akun berperan resmi `reviewer` tidak
--    dikenali sebagai reviewer dan `approver` tidak dikenali sebagai management di
--    lapisan review governance (policy review_*, can_review_registry_subject,
--    _can_decide_review, dll.).
--    Keputusan pemilik proyek (21 Okt): petakan keduanya.
--      has_role(_, 'qa_reviewer') juga menerima peran resmi `reviewer`.
--      has_role(_, 'management')  juga menerima peran resmi `approver`.
--    Akibat yang disengaja: approver mendapat hak management lama, yaitu membaca
--    dan mengelola data review governance (subjek, penugasan, rekomendasi,
--    keputusan, log audit), membaca semua baris modul (tanpa kolom metadata,
--    lihat 20261021010000) dan salinan versinya, membaca lampiran modul untuk
--    tinjauan, dan membaca data evaluasi penyelesaian. Di intern-update yang
--    benar-benar mendapat hak baru hanya 1 akun (approver lain sudah admin).
--    Reviewer tetap hanya bisa membaca pengajuan yang DITUGASKAN kepadanya
--    (can_review_registry_subject mensyaratkan penugasan aktif).
--
-- 2. assign_reviewer / reassign_reviewer hanya memeriksa penugas. Siapa pun bisa
--    ditugaskan (bukan reviewer, bahkan pengaju sendiri), dan penugasan pada
--    pengajuan expert/modul/Knowledge Hub mengubah statusnya menjadi
--    'under_review', padahal jenis itu diputuskan lewat RPC khususnya
--    (finalize_decision sudah menolaknya sejak 20261020070000). reassign juga bisa
--    mengalihkan penugasan yang sudah dibatalkan (dua penugasan aktif).
--    Saat dicek: 0 penugasan dan 0 rekomendasi, jadi tidak ada data yang berubah.

BEGIN;

-- ------------------------------------------------- 1. has_role -> peran resmi
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_rbac_role(_user_id, _role::text)
    OR (_role = 'admin'       AND public.has_rbac_role(_user_id, 'super_admin'))
    OR (_role = 'qa_reviewer' AND public.has_rbac_role(_user_id, 'reviewer'))
    OR (_role = 'management'  AND public.has_rbac_role(_user_id, 'approver')))
$$;

-- ------------------------------------------- 2. pengaman penugasan reviewer
CREATE OR REPLACE FUNCTION public._assert_reviewer_assignable(_subject_id uuid, _reviewer_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_subject public.review_subjects%ROWTYPE;
BEGIN
  SELECT * INTO v_subject FROM public.review_subjects WHERE id = _subject_id;
  IF v_subject.id IS NULL THEN RAISE EXCEPTION 'subject_not_found'; END IF;
  IF v_subject.kind IN ('expert', 'module', 'knowledge_resource') THEN
    RAISE EXCEPTION 'use_kind_specific_review: % ditinjau dan diputuskan lewat alur khususnya', v_subject.kind;
  END IF;
  IF _reviewer_id IS NULL OR NOT public.has_role(_reviewer_id, 'qa_reviewer') THEN
    RAISE EXCEPTION 'reviewer_role_required: akun yang ditugaskan bukan reviewer aktif';
  END IF;
  IF _reviewer_id = v_subject.submitted_by THEN
    RAISE EXCEPTION 'reviewer_is_submitter: pengaju tidak boleh meninjau pengajuannya sendiri';
  END IF;
END $$;

-- Hanya dipanggil dari dalam fungsi SECURITY DEFINER di bawah.
REVOKE EXECUTE ON FUNCTION public._assert_reviewer_assignable(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assign_reviewer(_subject_id uuid, _reviewer_id uuid, _due_at timestamptz, _template_version_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  PERFORM public._assert_reviewer_assignable(_subject_id, _reviewer_id);
  INSERT INTO public.review_assignments (subject_id, reviewer_id, assigned_by, due_at, status, conflict_of_interest_declared, template_version_id)
  VALUES (_subject_id, _reviewer_id, auth.uid(), _due_at, 'active', false, _template_version_id)
  RETURNING id INTO v_id;
  UPDATE public.review_subjects SET current_status = 'under_review'
    WHERE id = _subject_id AND current_status = 'pending';
  PERFORM public.log_governance_event('assignment_created', auth.uid(), _subject_id, 'review_assignment', v_id::text, NULL,
    jsonb_build_object('reviewer_id', _reviewer_id, 'template_version_id', _template_version_id));
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reassign_reviewer(_assignment_id uuid, _new_reviewer_id uuid, _due_at timestamptz, _template_version_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old public.review_assignments%ROWTYPE; v_new uuid;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT * INTO v_old FROM public.review_assignments WHERE id = _assignment_id FOR UPDATE;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'assignment_not_found'; END IF;
  IF v_old.status <> 'active' THEN RAISE EXCEPTION 'assignment_not_active'; END IF;
  PERFORM public._assert_reviewer_assignable(v_old.subject_id, _new_reviewer_id);
  UPDATE public.review_assignments SET status = 'cancelled' WHERE id = _assignment_id;
  INSERT INTO public.review_assignments (subject_id, reviewer_id, assigned_by, due_at, status, conflict_of_interest_declared, template_version_id)
  VALUES (v_old.subject_id, _new_reviewer_id, auth.uid(), _due_at, 'active', false, COALESCE(_template_version_id, v_old.template_version_id))
  RETURNING id INTO v_new;
  PERFORM public.log_governance_event('assignment_reassigned', auth.uid(), v_old.subject_id, 'review_assignment', v_new::text,
    to_jsonb(v_old), jsonb_build_object('new_reviewer_id', _new_reviewer_id));
  RETURN v_new;
END; $$;

REVOKE EXECUTE ON FUNCTION public.assign_reviewer(uuid, uuid, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_reviewer(uuid, uuid, timestamptz, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reassign_reviewer(uuid, uuid, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reassign_reviewer(uuid, uuid, timestamptz, uuid) TO authenticated;

COMMIT;
