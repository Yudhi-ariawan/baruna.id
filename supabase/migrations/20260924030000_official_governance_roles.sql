-- Retire non-standard governance roles and enforce the official BARUNA chain.
-- reviewer -> verifier -> approver -> publisher; admin/super_admin bypass all.

BEGIN;

INSERT INTO public.rbac_roles(code,name,description,is_system) VALUES
 ('reviewer','Reviewer','Substantive review of learning content and syllabus.',true),
 ('verifier','Verifier','Document authenticity, licensing, and policy compliance verification.',true),
 ('approver','Approver','Final approval decision for curated material.',true),
 ('publisher','Publisher','Publication of approved material to the public catalog.',true)
ON CONFLICT(code) DO UPDATE SET name=excluded.name,description=excluded.description,is_system=true;

-- Preserve active access before removing obsolete catalog entries.
INSERT INTO public.rbac_user_roles(user_id,role_id,granted_by,created_at,is_primary,status,scope,valid_from,valid_until,approved_by,approved_at,reason)
SELECT ur.user_id,target.id,ur.granted_by,ur.created_at,false,ur.status,ur.scope,ur.valid_from,ur.valid_until,ur.approved_by,ur.approved_at,
       concat('migrated_from_',legacy.code)
FROM public.rbac_user_roles ur JOIN public.rbac_roles legacy ON legacy.id=ur.role_id
JOIN public.rbac_roles target ON target.code=CASE legacy.code WHEN 'qa_reviewer' THEN 'reviewer' ELSE 'approver' END
WHERE legacy.code IN ('qa_reviewer','management')
ON CONFLICT(user_id,role_id) DO NOTHING;

UPDATE public.rbac_role_change_requests req SET role_id=target.id
FROM public.rbac_roles legacy,public.rbac_roles target
WHERE req.role_id=legacy.id AND legacy.code IN ('qa_reviewer','management')
  AND target.code=CASE legacy.code WHEN 'qa_reviewer' THEN 'reviewer' ELSE 'approver' END;
DELETE FROM public.rbac_user_roles WHERE role_id IN (SELECT id FROM public.rbac_roles WHERE code IN ('qa_reviewer','management'));
UPDATE public.rbac_user_roles candidate SET is_primary=true
WHERE candidate.reason IN ('migrated_from_qa_reviewer','migrated_from_management')
  AND candidate.id=(
    SELECT choice.id
    FROM public.rbac_user_roles choice
    WHERE choice.user_id=candidate.user_id
      AND choice.reason IN ('migrated_from_qa_reviewer','migrated_from_management')
    ORDER BY choice.created_at,choice.id::text
    LIMIT 1
  )
  AND NOT EXISTS(SELECT 1 FROM public.rbac_user_roles active WHERE active.user_id=candidate.user_id AND active.is_primary AND active.status='active');
DELETE FROM public.rbac_role_permissions WHERE role_id IN (SELECT id FROM public.rbac_roles WHERE code IN ('qa_reviewer','management'));
DELETE FROM public.rbac_roles WHERE code IN ('qa_reviewer','management');
DELETE FROM public.user_roles WHERE role::text IN ('qa_reviewer','management');

-- Reset official curation mappings, then grant comprehensive control to admins.
DELETE FROM public.rbac_role_permissions rp USING public.rbac_roles r
WHERE rp.role_id=r.id AND r.code IN ('reviewer','verifier','approver','publisher','admin','super_admin');
INSERT INTO public.rbac_role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.rbac_roles r JOIN public.rbac_permissions p ON
 (r.code='reviewer' AND p.code IN ('governance.read','academy.read','academy.review')) OR
 (r.code='verifier' AND p.code IN ('governance.read','academy.read','academy.verify')) OR
 (r.code='approver' AND p.code IN ('governance.read','academy.read','academy.approve')) OR
 (r.code='publisher' AND p.code IN ('governance.read','academy.read','academy.publish')) OR
 (r.code IN ('admin','super_admin'))
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_any_governance_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.id=ur.role_id JOIN public.profiles p ON p.id=ur.user_id
 WHERE ur.user_id=_user_id AND p.is_active AND r.code IN ('reviewer','verifier','approver','publisher','admin','super_admin')
 AND ur.status='active' AND ur.valid_from<=now() AND (ur.valid_until IS NULL OR ur.valid_until>now()))
$$;

CREATE OR REPLACE FUNCTION public._can_approve_academy(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.has_permission(_user_id,'academy.approve')
$$;
CREATE OR REPLACE FUNCTION public._can_publish_academy(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.has_permission(_user_id,'academy.publish')
$$;
REVOKE ALL ON FUNCTION public._can_publish_academy(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public._can_publish_academy(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.module_publish_from_decision(
 _subject_id uuid,_decision_id uuid,_visibility registry_visibility_v1 DEFAULT 'public',_verification verification_status_v1 DEFAULT 'governance_verified'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid();v_sub public.review_subjects%ROWTYPE;v_dec public.review_decisions%ROWTYPE;
 v_snap jsonb;v_payload jsonb;v_src source_type_v1;v_existing uuid;v_id uuid;v_author uuid;
BEGIN
 IF v_uid IS NULL OR NOT public._can_publish_academy(v_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO v_sub FROM public.review_subjects WHERE id=_subject_id;
 IF v_sub.id IS NULL OR v_sub.kind<>'module' THEN RAISE EXCEPTION 'invalid_module_subject'; END IF;
 SELECT * INTO v_dec FROM public.review_decisions WHERE id=_decision_id AND subject_id=_subject_id AND decision='approve';
 IF v_dec.id IS NULL THEN RAISE EXCEPTION 'approved_decision_required'; END IF;
 SELECT id INTO v_existing FROM public.module_registry WHERE source_submission_id=_subject_id;
 IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
 SELECT snapshot INTO v_snap FROM public.review_subject_revisions WHERE subject_id=_subject_id ORDER BY revision DESC LIMIT 1;
 IF v_snap IS NULL THEN RAISE EXCEPTION 'no_revision_snapshot'; END IF;
 v_payload:=COALESCE(v_snap->'payload','{}'::jsonb);v_src:=COALESCE(v_payload->>'source_type','external_submission')::source_type_v1;
 v_author:=COALESCE(NULLIF(v_payload->>'author_expert_id','')::uuid,public._active_trainer_expert_id(v_sub.submitted_by));
 INSERT INTO public.module_registry(source_type,source_submission_id,created_by,original_contributor_id,approved_by,published_by,approval_date,publication_date,verification_status,visibility,current_status,audit_ref,title,summary,language,module_type,target_participants,estimated_learning_hours,learning_objectives,competency_refs,prerequisites,delivery_suitability,content_outline,learning_activities,assessment_approach,author_expert_id,institution_id,related_resource_ids,legacy_master_module_ref,metadata)
 VALUES(v_src,_subject_id,v_sub.submitted_by,v_sub.submitted_by,v_dec.decided_by,v_uid,v_dec.decided_at,now(),_verification,_visibility,'published',_decision_id,COALESCE(v_payload->>'title',v_snap->>'title'),v_payload->>'summary',v_payload->>'language',COALESCE(v_payload->>'module_type','other')::module_type_v1,v_payload->>'target_participants',NULLIF(v_payload->>'estimated_learning_hours','')::numeric,
 COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(v_payload->'learning_objectives','[]')) x),ARRAY[]::text[]),COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(v_payload->'competency_refs','[]')) x),ARRAY[]::text[]),COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(v_payload->'prerequisites','[]')) x),ARRAY[]::text[]),COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(v_payload->'delivery_suitability','[]')) x),ARRAY[]::text[]),COALESCE(v_payload->'content_outline','{}'),COALESCE(v_payload->'learning_activities','{}'),COALESCE(v_payload->'assessment_approach','{}'),v_author,NULLIF(v_payload->>'institution_id','')::uuid,COALESCE((SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(COALESCE(v_payload->'related_resource_ids','[]')) x),ARRAY[]::uuid[]),v_payload->>'legacy_master_module_ref',COALESCE(v_payload->'metadata','{}')||jsonb_build_object('attachments',COALESCE(v_payload->'attachments','[]')))
 RETURNING id INTO v_id;
 INSERT INTO public.module_registry_versions(module_id,version,snapshot,created_by,publication_or_approval_ref) SELECT id,version,to_jsonb(m),v_uid,_decision_id FROM public.module_registry m WHERE id=v_id;
 PERFORM public.emit_platform_event('registry_record_published',v_uid,v_id,'module',v_id::text,'module_registry',v_src,_subject_id,v_id,NULL,jsonb_build_object('visibility',_visibility));
 PERFORM public.log_governance_event('module_published',v_uid,_subject_id,'module_registry',v_id::text,NULL,jsonb_build_object('module_id',v_id,'decision_id',_decision_id));
 RETURN v_id;
END $$;

-- Approval is a decision only; publishing is an explicit later action.
CREATE OR REPLACE FUNCTION public.module_finalize_review(_subject_id uuid,_decision text,_rationale text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_decision uuid;
BEGIN
 v_decision:=public.finalize_decision(_subject_id,_decision,_rationale);
 RETURN jsonb_build_object('decision_id',v_decision,'module_id',NULL,'status',CASE WHEN _decision='approve' THEN 'approved' ELSE 'rejected' END);
END $$;

CREATE OR REPLACE FUNCTION public.return_for_revision(_subject_id uuid,_rationale text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid();v_subject public.review_subjects%ROWTYPE;v_decision_id uuid;v_new_draft_id uuid;v_latest jsonb;
BEGIN
 IF v_uid IS NULL OR NOT public._can_approve_academy(v_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF length(trim(COALESCE(_rationale,'')))=0 THEN RAISE EXCEPTION 'rationale_required'; END IF;
 SELECT * INTO v_subject FROM public.review_subjects WHERE id=_subject_id FOR UPDATE;
 IF v_subject.id IS NULL THEN RAISE EXCEPTION 'subject_not_found'; END IF;
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

-- Official curators can inspect governance records; mutation remains RPC-gated.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['review_subjects','review_subject_revisions','review_assignments','review_records','review_decisions','review_templates','review_template_versions','governance_audit_log'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS official_governance_read ON public.%I',t);
  EXECUTE format('CREATE POLICY official_governance_read ON public.%I FOR SELECT TO authenticated USING (public.has_any_governance_role(auth.uid()))',t);
 END LOOP;
END $$;

DROP POLICY IF EXISTS official_review_record_write ON public.review_records;
CREATE POLICY official_review_record_write ON public.review_records FOR ALL TO authenticated
USING (reviewer_id=auth.uid() AND EXISTS(SELECT 1 FROM public.review_assignments a WHERE a.id=assignment_id AND a.reviewer_id=auth.uid() AND a.status='active')
       AND (public.has_permission(auth.uid(),'academy.review') OR public.has_permission(auth.uid(),'academy.verify') OR public.has_rbac_role(auth.uid(),'admin') OR public.has_rbac_role(auth.uid(),'super_admin')))
WITH CHECK (reviewer_id=auth.uid() AND EXISTS(SELECT 1 FROM public.review_assignments a WHERE a.id=assignment_id AND a.reviewer_id=auth.uid() AND a.status='active')
       AND (public.has_permission(auth.uid(),'academy.review') OR public.has_permission(auth.uid(),'academy.verify') OR public.has_rbac_role(auth.uid(),'admin') OR public.has_rbac_role(auth.uid(),'super_admin')));

COMMIT;
