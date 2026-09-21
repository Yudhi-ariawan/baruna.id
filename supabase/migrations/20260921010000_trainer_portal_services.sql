-- Fase 3: Trainer Portal and Expert Services.
-- Additive only: no policy on legacy feature domains is changed.

CREATE TABLE public.expert_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE DEFAULT ('SR-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_expert_id uuid REFERENCES public.experts(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK (request_type IN ('speaker','trainer','reviewer','mentor','technical')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','submitted','under_review','expert_matching','expert_contacted',
    'confirmed','scheduled','completed','declined','cancelled','information_requested'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expert_service_requests_requester_idx
  ON public.expert_service_requests(requester_id, updated_at DESC);
CREATE INDEX expert_service_requests_target_idx
  ON public.expert_service_requests(target_expert_id, updated_at DESC)
  WHERE target_expert_id IS NOT NULL;

ALTER TABLE public.expert_service_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.expert_service_requests TO authenticated;
GRANT ALL ON public.expert_service_requests TO service_role;

CREATE POLICY expert_service_requests_requester_read
  ON public.expert_service_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid());
CREATE POLICY expert_service_requests_target_read
  ON public.expert_service_requests FOR SELECT TO authenticated
  USING (target_expert_id IS NOT NULL AND public._expert_is_owner(target_expert_id));
-- Mutations are RPC-only so validation, transitions, and audit are inseparable.

CREATE TRIGGER expert_service_requests_touch
  BEFORE UPDATE ON public.expert_service_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

CREATE OR REPLACE FUNCTION public._active_trainer_expert_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id
  FROM public.experts e
  WHERE (e.original_contributor_id = _user_id OR e.created_by = _user_id)
    AND e.current_status = 'published'
    AND e.visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM public.rbac_user_roles ur
      JOIN public.rbac_roles r ON r.id = ur.role_id
      WHERE ur.user_id = _user_id AND r.code = 'expert'
        AND COALESCE(ur.status, 'active') = 'active'
        AND COALESCE(ur.valid_from, ur.created_at) <= now()
        AND (ur.valid_until IS NULL OR ur.valid_until > now())
    )
    AND EXISTS (
      SELECT 1 FROM public.expert_trainer_status ts
      WHERE ts.expert_id = e.id AND ts.trainer_status = 'active'
        AND ts.effective_from <= now()
        AND (ts.expires_at IS NULL OR ts.expires_at > now())
    )
  ORDER BY e.updated_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._active_trainer_expert_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._active_trainer_expert_id(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trainer_portal_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_expert public.experts%ROWTYPE;
  v_status public.expert_trainer_status%ROWTYPE;
  v_has_expert_role boolean := false;
  v_modules jsonb := '[]'::jsonb;
  v_history jsonb := '[]'::jsonb;
  v_organization text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_uid AND r.code = 'expert'
      AND COALESCE(ur.status, 'active') = 'active'
      AND COALESCE(ur.valid_from, ur.created_at) <= now()
      AND (ur.valid_until IS NULL OR ur.valid_until > now())
  ) INTO v_has_expert_role;

  SELECT * INTO v_expert FROM public.experts e
  WHERE e.original_contributor_id = v_uid OR e.created_by = v_uid
  ORDER BY (e.current_status = 'published') DESC, e.updated_at DESC LIMIT 1;

  IF NOT v_has_expert_role OR v_expert.id IS NULL THEN
    RETURN jsonb_build_object('access', 'registered_user');
  END IF;

  SELECT * INTO v_status FROM public.expert_trainer_status s
  WHERE s.expert_id = v_expert.id AND s.effective_from <= now()
    AND (s.expires_at IS NULL OR s.expires_at > now())
  ORDER BY s.version DESC, s.granted_at DESC LIMIT 1;

  IF v_status.id IS NULL OR v_status.trainer_status <> 'active' THEN
    RETURN jsonb_build_object(
      'access', 'expert_non_trainer', 'expertName', v_expert.display_name,
      'trainerStatus', COALESCE(v_status.trainer_status::text, 'not_applied')
    );
  END IF;

  SELECT ee.organization INTO v_organization FROM public.expert_employment ee
  WHERE ee.expert_id = v_expert.id ORDER BY ee.is_current DESC, ee.updated_at DESC LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'title', m.title, 'status', m.current_status,
    'hours', m.estimated_learning_hours, 'version', m.version,
    'language', m.language, 'updatedAt', m.updated_at
  ) ORDER BY m.updated_at DESC), '[]'::jsonb) INTO v_modules
  FROM public.module_registry m WHERE m.author_expert_id = v_expert.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', h.id, 'title', h.activity_title, 'organizer', h.organizer,
    'role', h.role, 'startDate', h.start_date, 'endDate', h.end_date,
    'participants', h.participant_count, 'country', h.country
  ) ORDER BY h.start_date DESC NULLS LAST), '[]'::jsonb) INTO v_history
  FROM public.expert_training_facilitation_history h WHERE h.expert_id = v_expert.id;

  RETURN jsonb_build_object(
    'access', 'active_trainer',
    'trainer', jsonb_build_object(
      'expertId', v_expert.id, 'fullName', v_expert.display_name,
      'title', v_expert.headline, 'organization', v_organization,
      'level', v_status.trainer_level, 'status', v_status.trainer_status,
      'approvedAt', v_status.granted_at,
      'uniqueSuccessfulParticipants', v_status.unique_graduated_participants
    ),
    'modules', v_modules, 'history', v_history
  );
END $$;
REVOKE ALL ON FUNCTION public.trainer_portal_bootstrap() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trainer_portal_bootstrap() TO authenticated;

CREATE OR REPLACE FUNCTION public.expert_service_request_create(
  _request_type text, _payload jsonb, _status text DEFAULT 'submitted', _target_expert_slug text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_target uuid; v_row public.expert_service_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF _request_type NOT IN ('speaker','trainer','reviewer','mentor','technical') THEN RAISE EXCEPTION 'invalid_request_type'; END IF;
  IF _status NOT IN ('draft','submitted') THEN RAISE EXCEPTION 'invalid_initial_status'; END IF;
  IF _target_expert_slug IS NOT NULL THEN
    SELECT id INTO v_target FROM public.experts
    WHERE slug = _target_expert_slug AND current_status = 'published' AND visibility = 'public';
    IF v_target IS NULL THEN RAISE EXCEPTION 'target_expert_not_found'; END IF;
  END IF;
  INSERT INTO public.expert_service_requests(requester_id,target_expert_id,request_type,status,payload,submitted_at)
  VALUES(v_uid,v_target,_request_type,_status,COALESCE(_payload,'{}'::jsonb),CASE WHEN _status='submitted' THEN now() END)
  RETURNING * INTO v_row;
  INSERT INTO public.admin_audit_log(event_type,actor_id,target_user_id,entity_type,entity_id,after_data,metadata)
  VALUES('expert_service_request.created',v_uid,v_uid,'expert_service_request',v_row.id::text,to_jsonb(v_row),jsonb_build_object('request_number',v_row.request_number));
  RETURN jsonb_build_object('id',v_row.id,'requestNumber',v_row.request_number,'status',v_row.status);
END $$;

CREATE OR REPLACE FUNCTION public.expert_service_requests_my()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'requestNumber', r.request_number, 'type', r.request_type,
    'status', r.status, 'payload', r.payload, 'createdAt', r.created_at,
    'updatedAt', r.updated_at, 'targetExpertId', r.target_expert_id,
    'assignedExpert', e.display_name, 'targetExpertSlug', e.slug
  ) ORDER BY r.updated_at DESC), '[]'::jsonb)
  FROM public.expert_service_requests r LEFT JOIN public.experts e ON e.id=r.target_expert_id
  WHERE r.requester_id=auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.trainer_service_requests()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_expert uuid; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  v_expert := public._active_trainer_expert_id(auth.uid());
  IF v_expert IS NULL THEN RAISE EXCEPTION 'active_trainer_required' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',r.id,'requestNumber',r.request_number,'type',r.request_type,'status',r.status,
    'payload',r.payload,'createdAt',r.created_at,'updatedAt',r.updated_at
  ) ORDER BY r.updated_at DESC),'[]'::jsonb) INTO v_result
  FROM public.expert_service_requests r WHERE r.target_expert_id=v_expert AND r.status <> 'draft';
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.trainer_service_request_respond(_request_id uuid, _action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_expert uuid; v_before public.expert_service_requests%ROWTYPE; v_status text; v_row public.expert_service_requests%ROWTYPE;
BEGIN
  v_expert := public._active_trainer_expert_id(auth.uid());
  IF v_expert IS NULL THEN RAISE EXCEPTION 'active_trainer_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_before FROM public.expert_service_requests WHERE id=_request_id AND target_expert_id=v_expert FOR UPDATE;
  IF v_before.id IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
  v_status := CASE _action WHEN 'accept' THEN 'confirmed' WHEN 'request_info' THEN 'information_requested' WHEN 'decline' THEN 'declined' ELSE NULL END;
  IF v_status IS NULL THEN RAISE EXCEPTION 'invalid_action'; END IF;
  UPDATE public.expert_service_requests SET status=v_status, responded_at=now() WHERE id=_request_id RETURNING * INTO v_row;
  INSERT INTO public.admin_audit_log(event_type,actor_id,target_user_id,entity_type,entity_id,before_data,after_data)
  VALUES('expert_service_request.responded',auth.uid(),v_before.requester_id,'expert_service_request',v_row.id::text,to_jsonb(v_before),to_jsonb(v_row));
  RETURN jsonb_build_object('id',v_row.id,'status',v_row.status);
END $$;

CREATE OR REPLACE FUNCTION public.expert_service_request_delete_draft(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.expert_service_requests WHERE id=_request_id AND requester_id=auth.uid() AND status='draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'draft_not_found'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.expert_service_request_create(text,jsonb,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expert_service_requests_my() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trainer_service_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trainer_service_request_respond(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expert_service_request_delete_draft(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expert_service_request_create(text,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expert_service_requests_my() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_service_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_service_request_respond(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expert_service_request_delete_draft(uuid) TO authenticated;
