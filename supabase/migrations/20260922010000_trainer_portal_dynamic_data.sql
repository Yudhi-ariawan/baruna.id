-- Trainer Portal dynamic workspace projection and trainer certificates.

CREATE TABLE public.expert_trainer_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  certificate_type text NOT NULL CHECK (certificate_type IN ('training_delivery','recognition','trainer_qualification','other')),
  title text NOT NULL,
  subtitle text,
  certificate_number text NOT NULL UNIQUE,
  issue_date date NOT NULL DEFAULT current_date,
  document_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expert_trainer_certificates_expert_idx ON public.expert_trainer_certificates(expert_id, issue_date DESC);
ALTER TABLE public.expert_trainer_certificates ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.expert_trainer_certificates TO authenticated;
GRANT ALL ON public.expert_trainer_certificates TO service_role;
CREATE POLICY expert_trainer_certificates_owner_read ON public.expert_trainer_certificates
  FOR SELECT TO authenticated USING (public._expert_is_owner(expert_id));

CREATE OR REPLACE FUNCTION public.trainer_portal_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid(); v_expert public.experts%ROWTYPE; v_status public.expert_trainer_status%ROWTYPE;
  v_has_expert_role boolean := false; v_modules jsonb := '[]'; v_history jsonb := '[]';
  v_drafts jsonb := '[]'; v_certificates jsonb := '[]'; v_rules jsonb := '[]';
  v_countries jsonb := '[]'; v_organization text; v_training_roles jsonb := '[]';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.id=ur.role_id
    WHERE ur.user_id=v_uid AND r.code='expert' AND COALESCE(ur.status,'active')='active'
      AND COALESCE(ur.valid_from,ur.created_at)<=now() AND (ur.valid_until IS NULL OR ur.valid_until>now())) INTO v_has_expert_role;
  SELECT * INTO v_expert FROM public.experts e WHERE e.original_contributor_id=v_uid OR e.created_by=v_uid
    ORDER BY (e.current_status='published') DESC,e.updated_at DESC LIMIT 1;
  IF NOT v_has_expert_role OR v_expert.id IS NULL THEN RETURN jsonb_build_object('access','registered_user'); END IF;
  SELECT * INTO v_status FROM public.expert_trainer_status s WHERE s.expert_id=v_expert.id
    AND s.effective_from<=now() AND (s.expires_at IS NULL OR s.expires_at>now())
    ORDER BY s.version DESC,s.granted_at DESC LIMIT 1;
  IF v_status.id IS NULL OR v_status.trainer_status<>'active' THEN
    RETURN jsonb_build_object('access','expert_non_trainer','expertName',v_expert.display_name,
      'trainerStatus',COALESCE(v_status.trainer_status::text,'not_applied'));
  END IF;
  SELECT ee.organization INTO v_organization FROM public.expert_employment ee WHERE ee.expert_id=v_expert.id
    ORDER BY ee.is_current DESC,ee.updated_at DESC LIMIT 1;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'summary',m.summary,
    'status',m.current_status,'hours',m.estimated_learning_hours,'version',m.version,'language',m.language,
    'moduleType',m.module_type,'targetParticipants',m.target_participants,'updatedAt',m.updated_at)
    ORDER BY m.updated_at DESC),'[]') INTO v_modules FROM public.module_registry m WHERE m.author_expert_id=v_expert.id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',h.id,'title',h.activity_title,'organizer',h.organizer,
    'role',h.role,'startDate',h.start_date,'endDate',h.end_date,'participants',h.participant_count,
    'country',h.country) ORDER BY h.start_date DESC NULLS LAST),'[]') INTO v_history
    FROM public.expert_training_facilitation_history h WHERE h.expert_id=v_expert.id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'status',d.status,
    'subjectId',d.linked_subject_id,'reviewStatus',s.current_status,'payload',d.payload,
    'createdAt',d.created_at,'updatedAt',d.updated_at,
    'reviewHistory',COALESCE((SELECT jsonb_agg(item ORDER BY item->>'at' DESC) FROM (
      SELECT jsonb_build_object('kind','review','at',rr.submitted_at,'actor',COALESCE(p.display_name,'BARUNA Reviewer'),
        'decision',rr.recommendation,'comment',rr.rationale) item FROM public.review_records rr
        LEFT JOIN public.profiles p ON p.id=rr.reviewer_id WHERE rr.subject_id=s.id AND rr.status='submitted'
      UNION ALL
      SELECT jsonb_build_object('kind','decision','at',rd.decided_at,'actor',COALESCE(p.display_name,'BARUNA Approver'),
        'decision',rd.decision,'comment',rd.rationale) item FROM public.review_decisions rd
        LEFT JOIN public.profiles p ON p.id=rd.decided_by WHERE rd.subject_id=s.id
    ) events),'[]'::jsonb)) ORDER BY d.updated_at DESC),'[]') INTO v_drafts
    FROM public.review_drafts d LEFT JOIN public.review_subjects s ON s.id=d.linked_subject_id
    WHERE d.submitter_id=v_uid AND d.subject_kind='module';
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'type',c.certificate_type,'title',c.title,
    'subtitle',c.subtitle,'number',c.certificate_number,'issueDate',c.issue_date,
    'documentUrl',c.document_url,'metadata',c.metadata) ORDER BY c.issue_date DESC),'[]') INTO v_certificates
    FROM public.expert_trainer_certificates c WHERE c.expert_id=v_expert.id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('level',r.trainer_level,'minimumParticipants',r.min_unique_graduated_participants,
    'evidenceRequirements',r.evidence_requirements) ORDER BY r.min_unique_graduated_participants),'[]') INTO v_rules
    FROM public.trainer_level_rules r WHERE r.effective_from<=now() AND (r.effective_until IS NULL OR r.effective_until>now());
  SELECT COALESCE(jsonb_agg(jsonb_build_object('country',country,'participants',participants) ORDER BY participants DESC),'[]') INTO v_countries
    FROM (SELECT COALESCE(h.country,'Unspecified') country,SUM(COALESCE(h.participant_count,0))::int participants
      FROM public.expert_training_facilitation_history h WHERE h.expert_id=v_expert.id GROUP BY COALESCE(h.country,'Unspecified')) x;
  SELECT COALESCE(jsonb_agg(role ORDER BY role),'[]') INTO v_training_roles FROM (
    SELECT DISTINCT h.role FROM public.expert_training_facilitation_history h
    WHERE h.expert_id=v_expert.id AND h.role IS NOT NULL AND trim(h.role)<>''
  ) roles;
  RETURN jsonb_build_object('access','active_trainer','trainer',jsonb_build_object(
    'expertId',v_expert.id,'fullName',v_expert.display_name,'title',v_expert.headline,'organization',v_organization,
    'country',v_expert.country,'expertiseAreas',v_expert.expertise_areas,'languages',v_expert.languages,
    'trainingRoles',v_training_roles,'level',v_status.trainer_level,'status',v_status.trainer_status,
    'approvedAt',v_status.granted_at,'uniqueSuccessfulParticipants',v_status.unique_graduated_participants),
    'modules',v_modules,'history',v_history,'moduleDrafts',v_drafts,'certificates',v_certificates,
    'recognitionRules',v_rules,'analytics',jsonb_build_object('countries',v_countries,
      'completionRate',NULL,'averageRating',NULL,'hasUnresolvedComplaint',NULL));
END $$;
REVOKE ALL ON FUNCTION public.trainer_portal_bootstrap() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trainer_portal_bootstrap() TO authenticated;
