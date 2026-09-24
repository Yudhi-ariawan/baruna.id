-- Align module review/approval with PB-ACA-01, LS-02 and LS-08.

CREATE OR REPLACE FUNCTION public.has_any_governance_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('admin','management','qa_reviewer'))
    OR EXISTS (
      SELECT 1 FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.id=ur.role_id
      WHERE ur.user_id=_user_id AND r.code IN ('super_admin','admin','reviewer','verifier','approver')
        AND COALESCE(ur.status,'active')='active'
        AND COALESCE(ur.valid_from,ur.created_at)<=now()
        AND (ur.valid_until IS NULL OR ur.valid_until>now())
    )
$$;

CREATE OR REPLACE FUNCTION public._can_approve_academy(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(_user_id,'admin') OR public.has_role(_user_id,'management')
    OR EXISTS (
      SELECT 1 FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.id=ur.role_id
      JOIN public.profiles p ON p.id=ur.user_id
      WHERE ur.user_id=_user_id AND p.is_active=true
        AND r.code IN ('super_admin','admin','approver')
        AND COALESCE(ur.status,'active')='active'
        AND COALESCE(ur.valid_from,ur.created_at)<=now()
        AND (ur.valid_until IS NULL OR ur.valid_until>now())
    )
$$;
REVOKE ALL ON FUNCTION public._can_approve_academy(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._can_approve_academy(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._require_admin_or_mgmt() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public._can_approve_academy(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
END $$;

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

CREATE OR REPLACE FUNCTION public.submit_review_recommendation(_record_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid:=auth.uid(); v_rec public.review_records%ROWTYPE; v_asg public.review_assignments%ROWTYPE;
  v_schema jsonb; v_required integer; v_submitted integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_rec FROM public.review_records WHERE id=_record_id FOR UPDATE;
  IF v_rec.id IS NULL THEN RAISE EXCEPTION 'record_not_found'; END IF;
  IF v_rec.reviewer_id<>v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_rec.status<>'draft' THEN RAISE EXCEPTION 'record_not_draft'; END IF;
  SELECT * INTO v_asg FROM public.review_assignments WHERE id=v_rec.assignment_id;
  IF v_asg.id IS NULL OR v_asg.status<>'active' THEN RAISE EXCEPTION 'assignment_not_active'; END IF;
  IF v_asg.conflict_of_interest_declared THEN RAISE EXCEPTION 'unresolved_conflict_of_interest'; END IF;
  IF v_asg.template_version_id IS NOT NULL THEN
    SELECT criteria_schema INTO v_schema FROM public.review_template_versions WHERE id=v_asg.template_version_id;
    PERFORM public.validate_review_criteria(COALESCE(v_rec.criteria,'{}'),v_schema);
  END IF;
  UPDATE public.review_records SET status='submitted',submitted_at=now() WHERE id=_record_id;
  SELECT required_recommendations INTO v_required FROM public.review_subjects WHERE id=v_rec.subject_id FOR UPDATE;
  SELECT count(*) INTO v_submitted FROM public.review_records WHERE subject_id=v_rec.subject_id AND status='submitted';
  IF v_submitted>=v_required THEN
    UPDATE public.review_subjects SET current_status='decision_pending' WHERE id=v_rec.subject_id AND current_status='under_review';
  END IF;
  PERFORM public.log_governance_event('review_submitted',v_uid,v_rec.subject_id,'review_record',_record_id::text,NULL,
    jsonb_build_object('recommendation',v_rec.recommendation,'submitted_count',v_submitted,'required_count',v_required));
END $$;

CREATE OR REPLACE FUNCTION public.module_publish_from_decision(
  _subject_id uuid, _decision_id uuid,
  _visibility registry_visibility_v1 DEFAULT 'public',
  _verification verification_status_v1 DEFAULT 'governance_verified'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid:=auth.uid(); v_sub public.review_subjects%ROWTYPE; v_dec public.review_decisions%ROWTYPE;
  v_snap jsonb; v_payload jsonb; v_src source_type_v1; v_existing uuid; v_id uuid; v_author uuid;
BEGIN
  IF v_uid IS NULL OR NOT public._can_approve_academy(v_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_sub FROM public.review_subjects WHERE id=_subject_id;
  IF v_sub.id IS NULL THEN RAISE EXCEPTION 'subject_not_found'; END IF;
  IF v_sub.kind<>'module' THEN RAISE EXCEPTION 'wrong_subject_kind'; END IF;
  SELECT * INTO v_dec FROM public.review_decisions WHERE id=_decision_id AND subject_id=_subject_id;
  IF v_dec.id IS NULL THEN RAISE EXCEPTION 'decision_not_found'; END IF;
  IF v_dec.decision<>'approve' THEN RAISE EXCEPTION 'decision_not_approved'; END IF;
  SELECT id INTO v_existing FROM public.module_registry WHERE source_submission_id=_subject_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  SELECT snapshot INTO v_snap FROM public.review_subject_revisions WHERE subject_id=_subject_id ORDER BY revision DESC LIMIT 1;
  IF v_snap IS NULL THEN RAISE EXCEPTION 'no_revision_snapshot'; END IF;
  v_payload:=COALESCE(v_snap->'payload','{}'::jsonb);
  v_src:=COALESCE(v_payload->>'source_type','external_submission')::source_type_v1;
  v_author:=COALESCE(NULLIF(v_payload->>'author_expert_id','')::uuid,public._active_trainer_expert_id(v_sub.submitted_by));
  INSERT INTO public.module_registry(source_type,source_submission_id,created_by,original_contributor_id,approved_by,published_by,
    approval_date,publication_date,verification_status,visibility,current_status,audit_ref,title,summary,language,module_type,
    target_participants,estimated_learning_hours,learning_objectives,competency_refs,prerequisites,delivery_suitability,
    content_outline,learning_activities,assessment_approach,author_expert_id,institution_id,related_resource_ids,legacy_master_module_ref,metadata)
  VALUES(v_src,_subject_id,v_sub.submitted_by,v_sub.submitted_by,v_dec.decided_by,v_uid,v_dec.decided_at,now(),_verification,_visibility,
    'published',_decision_id,COALESCE(v_payload->>'title',v_snap->>'title'),v_payload->>'summary',v_payload->>'language',
    COALESCE(v_payload->>'module_type','other')::module_type_v1,v_payload->>'target_participants',NULLIF(v_payload->>'estimated_learning_hours','')::numeric,
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(v_payload->'learning_objectives','[]')) x),ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(v_payload->'competency_refs','[]')) x),ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(v_payload->'prerequisites','[]')) x),ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(v_payload->'delivery_suitability','[]')) x),ARRAY[]::text[]),
    COALESCE(v_payload->'content_outline','{}'),COALESCE(v_payload->'learning_activities','{}'),COALESCE(v_payload->'assessment_approach','{}'),
    v_author,NULLIF(v_payload->>'institution_id','')::uuid,
    COALESCE((SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(COALESCE(v_payload->'related_resource_ids','[]')) x),ARRAY[]::uuid[]),
    v_payload->>'legacy_master_module_ref',COALESCE(v_payload->'metadata','{}')||jsonb_build_object('attachments',COALESCE(v_payload->'attachments','[]')))
  RETURNING id INTO v_id;
  INSERT INTO public.module_registry_versions(module_id,version,snapshot,created_by,publication_or_approval_ref)
    SELECT id,version,to_jsonb(m),v_uid,_decision_id FROM public.module_registry m WHERE id=v_id;
  PERFORM public.emit_platform_event('approved',v_uid,v_id,'module',v_id::text,'module_registry',v_src,_subject_id,v_id,NULL,jsonb_build_object('decision_id',_decision_id));
  PERFORM public.emit_platform_event('registry_record_published',v_uid,v_id,'module',v_id::text,'module_registry',v_src,_subject_id,v_id,NULL,jsonb_build_object('visibility',_visibility));
  PERFORM public.log_governance_event('module_master_activated',v_uid,_subject_id,'module_registry',v_id::text,NULL,
    jsonb_build_object('module_id',v_id,'version',1,'author_expert_id',v_author));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.module_finalize_review(_subject_id uuid,_decision text,_rationale text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_decision uuid; v_module uuid;
BEGIN
  v_decision:=public.finalize_decision(_subject_id,_decision,_rationale);
  IF _decision='approve' THEN v_module:=public.module_publish_from_decision(_subject_id,v_decision); END IF;
  RETURN jsonb_build_object('decision_id',v_decision,'module_id',v_module,'status',CASE WHEN _decision='approve' THEN 'approved' ELSE 'rejected' END);
END $$;
REVOKE ALL ON FUNCTION public.module_finalize_review(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.module_finalize_review(uuid,text,text) TO authenticated;

DROP POLICY IF EXISTS module_attachments_governance_select ON storage.objects;
CREATE POLICY module_attachments_governance_select ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='module-attachments' AND public.has_any_governance_role(auth.uid()));
