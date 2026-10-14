-- ============================================================================
-- Expert Service Requests guards (PB-EXP-03 Expert Assignment, Slide 38)
-- ============================================================================
-- * trainer_service_request_respond: state machine guard. A trainer could
--   previously flip a declined/completed/cancelled request back to confirmed.
-- * expert_service_request_create: conflict check (cannot request your own
--   profile) and idempotency against double submit (same request within 2 min).
-- Signatures are unchanged, so existing callers and grants keep working.

BEGIN;

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

  -- Replayed click: same outcome already recorded.
  IF v_before.status = v_status THEN
    RETURN jsonb_build_object('id', v_before.id, 'status', v_before.status);
  END IF;
  IF v_before.status NOT IN ('submitted','under_review','expert_matching','expert_contacted','information_requested') THEN
    RAISE EXCEPTION 'request_not_respondable: status %', v_before.status;
  END IF;

  UPDATE public.expert_service_requests SET status=v_status, responded_at=now() WHERE id=_request_id RETURNING * INTO v_row;
  INSERT INTO public.admin_audit_log(event_type,actor_id,target_user_id,entity_type,entity_id,before_data,after_data)
  VALUES('expert_service_request.responded',auth.uid(),v_before.requester_id,'expert_service_request',v_row.id::text,to_jsonb(v_before),to_jsonb(v_row));
  RETURN jsonb_build_object('id',v_row.id,'status',v_row.status);
END $$;

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
    IF EXISTS (
      SELECT 1 FROM public.experts
      WHERE id = v_target AND (original_contributor_id = v_uid OR created_by = v_uid)
    ) THEN
      RAISE EXCEPTION 'cannot_request_own_profile';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('expert_service_request_create:' || v_uid::text, 0));
  SELECT * INTO v_row FROM public.expert_service_requests
   WHERE requester_id = v_uid
     AND request_type = _request_type
     AND status = _status
     AND target_expert_id IS NOT DISTINCT FROM v_target
     AND payload = COALESCE(_payload, '{}'::jsonb)
     AND created_at > now() - interval '2 minutes'
   ORDER BY created_at DESC LIMIT 1;
  IF v_row.id IS NOT NULL THEN
    RETURN jsonb_build_object('id',v_row.id,'requestNumber',v_row.request_number,'status',v_row.status);
  END IF;

  INSERT INTO public.expert_service_requests(requester_id,target_expert_id,request_type,status,payload,submitted_at)
  VALUES(v_uid,v_target,_request_type,_status,COALESCE(_payload,'{}'::jsonb),CASE WHEN _status='submitted' THEN now() END)
  RETURNING * INTO v_row;
  INSERT INTO public.admin_audit_log(event_type,actor_id,target_user_id,entity_type,entity_id,after_data,metadata)
  VALUES('expert_service_request.created',v_uid,v_uid,'expert_service_request',v_row.id::text,to_jsonb(v_row),jsonb_build_object('request_number',v_row.request_number));
  RETURN jsonb_build_object('id',v_row.id,'requestNumber',v_row.request_number,'status',v_row.status);
END $$;

REVOKE ALL ON FUNCTION public.expert_service_request_create(text,jsonb,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trainer_service_request_respond(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expert_service_request_create(text,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_service_request_respond(uuid,text) TO authenticated;

COMMIT;
