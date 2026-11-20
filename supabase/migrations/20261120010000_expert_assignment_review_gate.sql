-- ============================================================================
-- PB-EXP-03 (Slide 38): review and approval before an assignment is active
-- ============================================================================
-- Slide 38, "Aturan Utama": "review dan persetujuan sebelum penugasan aktif".
-- Before this migration a request sent from an expert's profile
-- (/experts/request?expert=<slug>) was stored with target_expert_id already set,
-- so that expert saw it in the trainer portal and could accept it straight away,
-- before the BARUNA team had checked it. An expert's decline also closed the
-- whole request, although the slide leaves that decision to the review lane
-- ("Layak ditindaklanjuti? Tidak -> Tutup Assignment dengan Alasan").
--
-- Now:
-- * The expert chosen by the requester is a PREFERENCE. The request becomes the
--   expert's only after an admin assigns it (assigned_at IS NOT NULL). Until
--   then the expert cannot read it (RLS, portal list) or answer it.
-- * The expert answers only from expert_contacted / information_requested.
-- * An expert's decline (reason required) returns the request to
--   expert_matching with no expert, so the admin can assign someone else or
--   close it with a reason. Only the admin closes ("declined").
-- * Lists say who is preferred and who is assigned; "unassigned" means no
--   assignment yet, even when the requester named an expert.
-- Signatures are unchanged, so callers and grants keep working.

BEGIN;

-- ---------------------------------------------------------------- RLS
DROP POLICY IF EXISTS expert_service_requests_target_read ON public.expert_service_requests;
CREATE POLICY expert_service_requests_target_read
  ON public.expert_service_requests FOR SELECT TO authenticated
  USING (target_expert_id IS NOT NULL AND assigned_at IS NOT NULL AND public._expert_is_owner(target_expert_id));

DROP POLICY IF EXISTS expert_service_request_events_read ON public.expert_service_request_events;
CREATE POLICY expert_service_request_events_read
  ON public.expert_service_request_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.expert_service_requests r
    WHERE r.id = request_id
      AND (r.requester_id = auth.uid()
           OR (r.target_expert_id IS NOT NULL AND r.assigned_at IS NOT NULL
               AND public._expert_is_owner(r.target_expert_id)))
  ));

-- ---------------------------------------------------------------- requester
CREATE OR REPLACE FUNCTION public.expert_service_requests_my()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'requestNumber', r.request_number, 'type', r.request_type,
    'status', r.status, 'payload', r.payload, 'createdAt', r.created_at,
    'updatedAt', r.updated_at, 'targetExpertId', r.target_expert_id,
    'assignedExpert', CASE WHEN r.assigned_at IS NOT NULL THEN e.display_name END,
    'preferredExpert', CASE WHEN r.assigned_at IS NULL THEN e.display_name END,
    'targetExpertSlug', e.slug,
    'completedAt', r.completed_at,
    'events', public._service_request_events_json(r.id)
  ) ORDER BY r.updated_at DESC), '[]'::jsonb)
  FROM public.expert_service_requests r LEFT JOIN public.experts e ON e.id = r.target_expert_id
  WHERE r.requester_id = auth.uid()
$$;

-- ---------------------------------------------------------------- expert
CREATE OR REPLACE FUNCTION public.trainer_service_requests()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_expert uuid; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  v_expert := public._active_trainer_expert_id(auth.uid());
  IF v_expert IS NULL THEN RAISE EXCEPTION 'active_trainer_required' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',r.id,'requestNumber',r.request_number,'type',r.request_type,'status',r.status,
    'payload',r.payload,'createdAt',r.created_at,'updatedAt',r.updated_at,
    'events', public._service_request_events_json(r.id)
  ) ORDER BY r.updated_at DESC),'[]'::jsonb) INTO v_result
  FROM public.expert_service_requests r
  WHERE r.target_expert_id = v_expert AND r.assigned_at IS NOT NULL AND r.status <> 'draft';
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.trainer_service_request_respond(_request_id uuid, _action text, _message text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_expert uuid; v_before public.expert_service_requests%ROWTYPE; v_status text; v_row public.expert_service_requests%ROWTYPE;
BEGIN
  v_expert := public._active_trainer_expert_id(v_uid);
  IF v_expert IS NULL THEN RAISE EXCEPTION 'active_trainer_required' USING ERRCODE='42501'; END IF;
  IF _action IS NULL OR _action NOT IN ('accept','request_info','decline') THEN RAISE EXCEPTION 'invalid_action'; END IF;
  IF _action IN ('request_info','decline') AND char_length(btrim(COALESCE(_message, ''))) < 5 THEN
    RAISE EXCEPTION '%', CASE _action WHEN 'decline' THEN 'decline_reason_required' ELSE 'info_request_message_required' END;
  END IF;
  IF char_length(COALESCE(_message, '')) > 2000 THEN RAISE EXCEPTION 'message_too_long'; END IF;

  SELECT * INTO v_before FROM public.expert_service_requests
   WHERE id = _request_id AND target_expert_id = v_expert AND assigned_at IS NOT NULL FOR UPDATE;
  IF v_before.id IS NULL THEN
    -- Replayed decline (double click, second device): the request already went back to the team.
    IF _action = 'decline' AND EXISTS (
         SELECT 1 FROM public.expert_service_request_events ev
          WHERE ev.request_id = _request_id AND ev.actor_id = v_uid AND ev.action = 'decline'
            AND ev.created_at > now() - interval '10 minutes') THEN
      RETURN jsonb_build_object('id', _request_id, 'status', 'expert_matching');
    END IF;
    RAISE EXCEPTION 'request_not_found';
  END IF;

  v_status := CASE _action WHEN 'accept' THEN 'confirmed' WHEN 'request_info' THEN 'information_requested' ELSE 'expert_matching' END;
  -- Replayed accept / question: same outcome already recorded.
  IF _action <> 'decline' AND v_before.status = v_status THEN
    RETURN jsonb_build_object('id', v_before.id, 'status', v_before.status);
  END IF;
  IF v_before.status NOT IN ('expert_contacted','information_requested')
     OR (_action = 'request_info' AND v_before.status <> 'expert_contacted') THEN
    RAISE EXCEPTION 'request_not_respondable: status %', v_before.status;
  END IF;

  IF _action = 'decline' THEN
    UPDATE public.expert_service_requests
       SET status = v_status, target_expert_id = NULL, assigned_at = NULL, assigned_by = NULL, responded_at = now()
     WHERE id = _request_id RETURNING * INTO v_row;
  ELSE
    UPDATE public.expert_service_requests SET status = v_status, responded_at = now()
     WHERE id = _request_id RETURNING * INTO v_row;
  END IF;
  PERFORM public._service_request_log(_request_id, v_uid, 'expert', _action, v_before.status, v_status, _message);
  INSERT INTO public.admin_audit_log(event_type,actor_id,target_user_id,entity_type,entity_id,before_data,after_data)
  VALUES('expert_service_request.responded',v_uid,v_before.requester_id,'expert_service_request',v_row.id::text,to_jsonb(v_before),to_jsonb(v_row));
  RETURN jsonb_build_object('id',v_row.id,'status',v_row.status);
END $$;

-- ---------------------------------------------------------------- admin
CREATE OR REPLACE FUNCTION public.admin_service_requests_list(
  _status text DEFAULT NULL, _search text DEFAULT NULL, _limit int DEFAULT 50, _offset int DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_items jsonb; v_total int; v_counts jsonb; v_q text := lower(NULLIF(btrim(COALESCE(_search, '')), ''));
BEGIN
  IF NOT public._is_service_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  _limit := LEAST(GREATEST(COALESCE(_limit, 50), 1), 200);
  _offset := GREATEST(COALESCE(_offset, 0), 0);

  WITH base AS (
    SELECT r.*, p.display_name AS requester_name, u.email AS requester_email,
           e.display_name AS expert_name, e.slug AS expert_slug
    FROM public.expert_service_requests r
    LEFT JOIN public.profiles p ON p.id = r.requester_id
    LEFT JOIN auth.users u ON u.id = r.requester_id
    LEFT JOIN public.experts e ON e.id = r.target_expert_id
    WHERE r.status <> 'draft'
      AND (_status IS NULL OR _status = 'all' OR r.status = _status
           OR (_status = 'open' AND r.status IN ('submitted','under_review','expert_matching','expert_contacted','information_requested'))
           OR (_status = 'unassigned' AND r.assigned_at IS NULL AND r.status NOT IN ('completed','declined','cancelled')))
      AND (v_q IS NULL
           OR strpos(lower(r.request_number), v_q) > 0
           OR strpos(lower(COALESCE(p.display_name, '')), v_q) > 0
           OR strpos(lower(COALESCE(u.email, '')), v_q) > 0
           OR strpos(lower(COALESCE(e.display_name, '')), v_q) > 0
           OR strpos(lower(r.payload::text), v_q) > 0)
  )
  SELECT (SELECT count(*) FROM base),
         COALESCE((SELECT jsonb_agg(x.obj ORDER BY x.updated_at DESC) FROM (
           SELECT b.updated_at, jsonb_build_object(
             'id', b.id, 'requestNumber', b.request_number, 'type', b.request_type,
             'status', b.status, 'payload', b.payload, 'createdAt', b.created_at,
             'updatedAt', b.updated_at, 'submittedAt', b.submitted_at,
             'requesterId', b.requester_id, 'requesterName', b.requester_name,
             'requesterEmail', b.requester_email,
             'targetExpertId', b.target_expert_id,
             'assignedExpert', CASE WHEN b.assigned_at IS NOT NULL THEN b.expert_name END,
             'preferredExpert', CASE WHEN b.assigned_at IS NULL THEN b.expert_name END,
             'targetExpertSlug', b.expert_slug, 'assignedAt', b.assigned_at,
             'completedAt', b.completed_at, 'facilitationHistoryId', b.facilitation_history_id,
             'events', public._service_request_events_json(b.id)
           ) AS obj
           FROM base b ORDER BY b.updated_at DESC LIMIT _limit OFFSET _offset
         ) x), '[]'::jsonb)
    INTO v_total, v_items;

  SELECT jsonb_build_object(
    'open', count(*) FILTER (WHERE status IN ('submitted','under_review','expert_matching','expert_contacted','information_requested')),
    'unassigned', count(*) FILTER (WHERE assigned_at IS NULL AND status NOT IN ('completed','declined','cancelled')),
    'confirmed', count(*) FILTER (WHERE status IN ('confirmed','scheduled')),
    'completed', count(*) FILTER (WHERE status = 'completed'),
    'closed', count(*) FILTER (WHERE status IN ('declined','cancelled'))
  ) INTO v_counts
  FROM public.expert_service_requests WHERE status <> 'draft';

  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'counts', v_counts);
END $$;

REVOKE ALL ON FUNCTION public.expert_service_requests_my() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trainer_service_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trainer_service_request_respond(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_service_requests_list(text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expert_service_requests_my() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_service_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_service_request_respond(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_service_requests_list(text, text, int, int) TO authenticated;

COMMIT;
