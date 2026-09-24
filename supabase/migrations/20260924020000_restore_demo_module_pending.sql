-- Compensating transition: the Demo Upload Modul test must return to manual
-- curation. Preserve immutable history while removing it from public output.
DO $$
DECLARE v_subject uuid; v_module uuid; v_before jsonb;
BEGIN
  SELECT linked_subject_id INTO v_subject FROM public.review_drafts
    WHERE lower(title)='demo upload modul' ORDER BY created_at DESC LIMIT 1;
  IF v_subject IS NULL THEN RETURN; END IF;
  SELECT id,to_jsonb(m) INTO v_module,v_before FROM public.module_registry m
    WHERE source_submission_id=v_subject ORDER BY created_at DESC LIMIT 1;
  IF v_module IS NOT NULL THEN
    UPDATE public.module_registry SET current_status='archived',visibility='private',updated_at=now() WHERE id=v_module;
  END IF;
  UPDATE public.review_records SET status='superseded' WHERE subject_id=v_subject AND status='submitted';
  UPDATE public.review_assignments SET status='cancelled' WHERE subject_id=v_subject AND status='active';
  UPDATE public.review_subjects SET current_status='pending' WHERE id=v_subject;
  UPDATE public.review_drafts SET status='submitted' WHERE linked_subject_id=v_subject;
  IF NOT EXISTS (SELECT 1 FROM public.governance_audit_log WHERE subject_id=v_subject AND event_type='test_approval_reverted') THEN
    PERFORM public.log_governance_event('test_approval_reverted',NULL,v_subject,'module_registry',v_module::text,v_before,
      jsonb_build_object('subject_status','pending','module_status','archived','visibility','private','reason','manual_review_required'));
  END IF;
END $$;
