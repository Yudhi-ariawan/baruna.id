-- ============================================================================
-- Riwayat status, SLA per langkah, dan penarikan Request a Training
-- ============================================================================
-- Dicek 21 Okt 2026 (database intern-update, kode branch ini):
--
-- 1. Slide 13 (Pola Umum Workflow): "setiap langkah dapat memiliki SLA", "sistem
--    mengirim notifikasi otomatis di setiap perubahan status", "riwayat dapat
--    dilihat pada halaman status proses". Saat ini perubahan status
--    review_subjects tidak tercatat di mana pun (governance_audit_log hanya
--    mencatat sebagian event dan hanya bisa dibaca admin/approver), dan tidak ada
--    batas waktu per langkah.
-- 2. PB-ACA-06 (Slide 25): "My Training Requests" membaca salinan localStorage,
--    sehingga pemohon tidak melihat keputusan dan tidak bisa menarik pengajuan
--    di server. Belum ada RPC penarikan untuk training_need.
--
-- Perubahan:
-- * review_subject_status_history: satu baris setiap kali current_status berubah
--   (trigger, berlaku untuk SEMUA jenis pengajuan dan semua RPC lama maupun baru).
--   Dibaca pemohon/reviewer aktif/admin/approver lewat can_read_review_subject;
--   kolom changed_by tidak diberikan ke authenticated.
-- * workflow_sla_policies: target jam per (jenis, status). Diisi nilai SEMENTARA
--   untuk training_need (menunggu arahan mentor, lihat MENUNGGU_ARAHAN_MENTOR.md);
--   diubah administrator lewat set_workflow_sla_policy (tercatat di audit trail).
-- * training_need_withdraw: pemohon menarik pengajuannya sendiri sebelum diputuskan.
-- * return_for_revision: menutup penugasan reviewer ronde itu (tanpa ini revisi
--   yang dikirim ulang macet di 'pending'), dan hanya untuk pengajuan yang masih
--   berjalan dan belum menunggu revisi.

BEGIN;

-- ------------------------------------------------------- 1. riwayat status
CREATE TABLE IF NOT EXISTS public.review_subject_status_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject_id uuid NOT NULL REFERENCES public.review_subjects(id) ON DELETE CASCADE,
  subject_kind text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  is_backfill boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS review_subject_status_history_subject_idx
  ON public.review_subject_status_history (subject_id, changed_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS review_subject_status_history_kind_idx
  ON public.review_subject_status_history (subject_kind, to_status, changed_at DESC);

ALTER TABLE public.review_subject_status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_subject_status_history FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, subject_id, subject_kind, from_status, to_status, changed_at, is_backfill)
  ON public.review_subject_status_history TO authenticated;
GRANT ALL ON public.review_subject_status_history TO service_role;
DROP POLICY IF EXISTS review_subject_status_history_read ON public.review_subject_status_history;
CREATE POLICY review_subject_status_history_read ON public.review_subject_status_history
  FOR SELECT TO authenticated USING (public.can_read_review_subject(subject_id));

CREATE OR REPLACE FUNCTION public._record_review_subject_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.current_status IS DISTINCT FROM OLD.current_status THEN
    INSERT INTO public.review_subject_status_history (subject_id, subject_kind, from_status, to_status, changed_by)
    VALUES (NEW.id, NEW.kind, CASE WHEN TG_OP = 'UPDATE' THEN OLD.current_status END, NEW.current_status, auth.uid());
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._record_review_subject_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS review_subject_status_history_trg ON public.review_subjects;
CREATE TRIGGER review_subject_status_history_trg
  AFTER INSERT OR UPDATE OF current_status ON public.review_subjects
  FOR EACH ROW EXECUTE FUNCTION public._record_review_subject_status();

-- Pengajuan lama: dua baris perkiraan (diajukan, status sekarang), ditandai is_backfill
-- agar tidak memicu notifikasi dan tidak dianggap waktu pasti.
INSERT INTO public.review_subject_status_history
  (subject_id, subject_kind, from_status, to_status, changed_by, changed_at, is_backfill)
SELECT subject_id, subject_kind, from_status, to_status, changed_by, changed_at, true
  FROM (
    SELECT s.id AS subject_id, s.kind AS subject_kind, NULL::text AS from_status, 'pending'::text AS to_status,
           s.submitted_by AS changed_by, s.created_at AS changed_at, 1 AS step
      FROM public.review_subjects s
    UNION ALL
    SELECT s.id, s.kind, 'pending', s.current_status, NULL, GREATEST(s.updated_at, s.created_at), 2
      FROM public.review_subjects s
     WHERE s.current_status <> 'pending'
  ) b
 WHERE NOT EXISTS (SELECT 1 FROM public.review_subject_status_history h WHERE h.subject_id = b.subject_id)
 ORDER BY subject_id, step;

-- ------------------------------------------------------- 2. SLA per langkah
CREATE TABLE IF NOT EXISTS public.workflow_sla_policies (
  subject_kind text NOT NULL CHECK (subject_kind IN ('expert', 'module', 'knowledge_resource', 'training_need')),
  status text NOT NULL CHECK (status IN ('pending', 'under_review', 'decision_pending')),
  target_hours integer NOT NULL CHECK (target_hours BETWEEN 1 AND 8760),
  responsible_label text NOT NULL CHECK (length(btrim(responsible_label)) BETWEEN 1 AND 120),
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_kind, status)
);
ALTER TABLE public.workflow_sla_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workflow_sla_policies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.workflow_sla_policies TO authenticated;
GRANT ALL ON public.workflow_sla_policies TO service_role;
DROP POLICY IF EXISTS workflow_sla_policies_read ON public.workflow_sla_policies;
CREATE POLICY workflow_sla_policies_read ON public.workflow_sla_policies
  FOR SELECT TO authenticated USING (true);

-- Nilai sementara (jam kalender), boleh diubah administrator kapan saja.
INSERT INTO public.workflow_sla_policies (subject_kind, status, target_hours, responsible_label) VALUES
  ('training_need', 'pending', 72, 'Operator / Administrator: cek kelengkapan dan tugaskan reviewer'),
  ('training_need', 'under_review', 120, 'Reviewer: review substansi dan rekomendasi'),
  ('training_need', 'decision_pending', 72, 'Approver: keputusan akhir')
ON CONFLICT (subject_kind, status) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_workflow_sla_policy(
  _subject_kind text, _status text, _target_hours integer, _responsible_label text, _is_active boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_before jsonb; v_after jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _subject_kind IS NULL OR _subject_kind NOT IN ('expert', 'module', 'knowledge_resource', 'training_need') THEN
    RAISE EXCEPTION 'invalid_subject_kind';
  END IF;
  IF _status IS NULL OR _status NOT IN ('pending', 'under_review', 'decision_pending') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  IF _target_hours IS NULL OR _target_hours NOT BETWEEN 1 AND 8760 THEN RAISE EXCEPTION 'invalid_target_hours'; END IF;
  IF length(btrim(COALESCE(_responsible_label, ''))) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'invalid_responsible_label';
  END IF;

  SELECT to_jsonb(p) - 'updated_by' INTO v_before FROM public.workflow_sla_policies p
   WHERE subject_kind = _subject_kind AND status = _status FOR UPDATE;

  INSERT INTO public.workflow_sla_policies AS p
    (subject_kind, status, target_hours, responsible_label, is_active, updated_by, updated_at)
  VALUES (_subject_kind, _status, _target_hours, btrim(_responsible_label), COALESCE(_is_active, true), v_uid, now())
  ON CONFLICT (subject_kind, status) DO UPDATE
    SET target_hours = EXCLUDED.target_hours, responsible_label = EXCLUDED.responsible_label,
        is_active = EXCLUDED.is_active, updated_by = v_uid, updated_at = now()
  RETURNING to_jsonb(p) - 'updated_by' INTO v_after;

  PERFORM public.log_governance_event('sla_policy_updated', v_uid, NULL, 'workflow_sla_policy',
    _subject_kind || ':' || _status, v_before, v_after);
END $$;
REVOKE ALL ON FUNCTION public.set_workflow_sla_policy(text, text, integer, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_workflow_sla_policy(text, text, integer, text, boolean) TO authenticated;

-- ------------------------------------------------------- 3. penarikan oleh pemohon
CREATE OR REPLACE FUNCTION public.training_need_withdraw(_subject_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_subject public.review_subjects%ROWTYPE; v_reason text := NULLIF(btrim(COALESCE(_reason, '')), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF length(COALESCE(v_reason, '')) > 1000 THEN RAISE EXCEPTION 'reason_too_long'; END IF;
  SELECT * INTO v_subject FROM public.review_subjects WHERE id = _subject_id FOR UPDATE;
  IF v_subject.id IS NULL OR v_subject.submitted_by <> v_uid THEN RAISE EXCEPTION 'subject_not_found'; END IF;
  IF v_subject.kind <> 'training_need' THEN RAISE EXCEPTION 'wrong_subject_kind'; END IF;
  IF v_subject.current_status NOT IN ('pending', 'under_review', 'decision_pending') THEN
    RAISE EXCEPTION 'not_withdrawable';
  END IF;

  UPDATE public.review_assignments SET status = 'cancelled'
   WHERE subject_id = _subject_id AND status = 'active';
  -- Draf revisi yang belum dikirim ikut dihapus: pengajuan yang ditarik tidak bisa dikirim ulang.
  DELETE FROM public.review_drafts WHERE linked_subject_id = _subject_id AND status = 'draft';
  UPDATE public.review_subjects
     SET current_status = 'withdrawn',
         metadata = COALESCE(metadata, '{}'::jsonb)
                    || jsonb_build_object('withdrawn_at', now(), 'withdrawn_reason', v_reason)
   WHERE id = _subject_id;

  PERFORM public.log_governance_event('subject_withdrawn', v_uid, _subject_id, 'review_subject', _subject_id::text,
    jsonb_build_object('previous_status', v_subject.current_status),
    jsonb_build_object('new_status', 'withdrawn', 'reason', v_reason));
END $$;
REVOKE ALL ON FUNCTION public.training_need_withdraw(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_need_withdraw(uuid, text) TO authenticated;

-- ------------------------------------------------------- 4. return_for_revision
-- Sama dengan versi 20261020070000, ditambah:
-- * penugasan reviewer ronde ini ditutup ('completed'). Sebelumnya penugasan tetap
--   aktif; setelah pemohon mengirim ulang, status 'pending' tidak pernah naik ke
--   'decision_pending' (submit_review_recommendation hanya dari 'under_review'),
--   sehingga pengajuan macet. Kini revisi yang masuk kembali ke "cek kelengkapan
--   lalu tugaskan reviewer" (Slide 25), dan reviewer yang sama boleh ditugaskan lagi.
-- * hanya untuk pengajuan yang masih berjalan, dan tidak dua kali selama pemohon
--   belum mengirim revisinya.
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
 IF v_subject.current_status NOT IN ('pending','under_review','decision_pending') THEN RAISE EXCEPTION 'subject_not_open'; END IF;
 IF EXISTS (SELECT 1 FROM public.review_drafts WHERE linked_subject_id=_subject_id AND status='draft') THEN
   RAISE EXCEPTION 'already_awaiting_revision';
 END IF;
 INSERT INTO public.review_decisions(subject_id,decided_by,decision,rationale) VALUES(_subject_id,v_uid,'return_for_revision',_rationale) RETURNING id INTO v_decision_id;
 UPDATE public.review_records SET status='superseded' WHERE subject_id=_subject_id AND status='submitted';
 UPDATE public.review_assignments SET status='completed' WHERE subject_id=_subject_id AND status='active';
 UPDATE public.review_subjects SET current_status='pending' WHERE id=_subject_id;
 SELECT snapshot INTO v_latest FROM public.review_subject_revisions WHERE subject_id=_subject_id ORDER BY revision DESC LIMIT 1;
 INSERT INTO public.review_drafts(subject_kind,submitter_id,title,description,external_ref,payload,status,linked_subject_id)
 VALUES(v_subject.kind,v_subject.submitted_by,COALESCE(v_latest->>'title',v_subject.title),COALESCE(v_latest->>'description',v_subject.description),COALESCE(v_latest->>'external_ref',v_subject.external_ref),COALESCE(v_latest->'payload','{}'::jsonb),'draft',_subject_id) RETURNING id INTO v_new_draft_id;
 PERFORM public.log_governance_event('decision_return_for_revision',v_uid,_subject_id,'review_decision',v_decision_id::text,jsonb_build_object('previous_status',v_subject.current_status),jsonb_build_object('new_status','pending','new_draft_id',v_new_draft_id,'rationale',_rationale));
 RETURN v_decision_id;
END $$;

COMMIT;
