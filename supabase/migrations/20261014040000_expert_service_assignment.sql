-- ============================================================================
-- PB-EXP-03 Expert Assignment (Slide 38): admin console, info loop, completion
-- ============================================================================
-- Before this migration a service request could only be created by a requester
-- and answered by the targeted trainer. Requests without a target were visible
-- to nobody, "Request info" had no reply path, and completion was never written
-- to the expert's facilitation history.
--
-- * expert_service_request_events: append-only timeline (also the message
--   thread for information requests and replies). Readable by the requester and
--   the targeted expert; written only by the RPCs below.
-- * admin RPCs: list, assignable experts, and a single guarded transition RPC
--   (optimistic lock on updated_at, state machine, conflict-of-interest checks).
-- * completion writes exactly one expert_training_facilitation_history row per
--   request (unique service_request_id).
-- * requester RPCs: reply to an information request, cancel a live request.
-- * trainer respond now takes an optional message (required for request_info).

BEGIN;

-- ---------------------------------------------------------------- columns
ALTER TABLE public.expert_service_requests
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.expert_training_facilitation_history
  ADD COLUMN IF NOT EXISTS service_request_id uuid
    REFERENCES public.expert_service_requests(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS expert_tfh_service_request_uniq
  ON public.expert_training_facilitation_history(service_request_id)
  WHERE service_request_id IS NOT NULL;

ALTER TABLE public.expert_service_requests
  ADD COLUMN IF NOT EXISTS facilitation_history_id uuid
    REFERENCES public.expert_training_facilitation_history(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expert_service_requests_status_idx
  ON public.expert_service_requests(status, updated_at DESC);

-- ---------------------------------------------------------------- events
CREATE TABLE IF NOT EXISTS public.expert_service_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.expert_service_requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('requester','expert','admin')),
  action text NOT NULL,
  from_status text,
  to_status text,
  message text CHECK (message IS NULL OR char_length(message) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expert_service_request_events_request_idx
  ON public.expert_service_request_events(request_id, created_at);

ALTER TABLE public.expert_service_request_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.expert_service_request_events TO authenticated;
GRANT ALL ON public.expert_service_request_events TO service_role;

DROP POLICY IF EXISTS expert_service_request_events_read ON public.expert_service_request_events;
CREATE POLICY expert_service_request_events_read
  ON public.expert_service_request_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.expert_service_requests r
    WHERE r.id = request_id
      AND (r.requester_id = auth.uid()
           OR (r.target_expert_id IS NOT NULL AND public._expert_is_owner(r.target_expert_id)))
  ));
-- Writes are RPC-only.

-- ---------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION public._is_service_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL
     AND (public.has_rbac_role(_user_id, 'super_admin') OR public.has_rbac_role(_user_id, 'admin'))
$$;
REVOKE ALL ON FUNCTION public._is_service_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._is_service_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._service_request_events_json(_request_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ev.id, 'actorRole', ev.actor_role, 'action', ev.action,
    'fromStatus', ev.from_status, 'toStatus', ev.to_status,
    'message', ev.message, 'createdAt', ev.created_at
  ) ORDER BY ev.created_at), '[]'::jsonb)
  FROM public.expert_service_request_events ev WHERE ev.request_id = _request_id
$$;
REVOKE ALL ON FUNCTION public._service_request_events_json(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._service_request_log(
  _request_id uuid, _actor uuid, _actor_role text, _action text,
  _from text, _to text, _message text
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.expert_service_request_events(request_id, actor_id, actor_role, action, from_status, to_status, message)
  VALUES (_request_id, _actor, _actor_role, _action, _from, _to, NULLIF(btrim(COALESCE(_message, '')), ''))
$$;
REVOKE ALL ON FUNCTION public._service_request_log(uuid, uuid, text, text, text, text, text) FROM PUBLIC;

-- Expert ids that have a working inbox (= active trainer portal). Assigning a
-- request to anyone else would leave it unanswerable.
CREATE OR REPLACE FUNCTION public._expert_has_active_portal(_expert_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.experts e
    WHERE e.id = _expert_id
      AND public._active_trainer_expert_id(COALESCE(e.original_contributor_id, e.created_by)) = e.id
  )
$$;
REVOKE ALL ON FUNCTION public._expert_has_active_portal(uuid) FROM PUBLIC;

-- ---------------------------------------------------------------- requester
CREATE OR REPLACE FUNCTION public.expert_service_requests_my()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'requestNumber', r.request_number, 'type', r.request_type,
    'status', r.status, 'payload', r.payload, 'createdAt', r.created_at,
    'updatedAt', r.updated_at, 'targetExpertId', r.target_expert_id,
    'assignedExpert', e.display_name, 'targetExpertSlug', e.slug,
    'completedAt', r.completed_at,
    'events', public._service_request_events_json(r.id)
  ) ORDER BY r.updated_at DESC), '[]'::jsonb)
  FROM public.expert_service_requests r LEFT JOIN public.experts e ON e.id = r.target_expert_id
  WHERE r.requester_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.expert_service_request_reply(_request_id uuid, _message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.expert_service_requests%ROWTYPE; v_back text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF char_length(btrim(COALESCE(_message, ''))) < 5 THEN RAISE EXCEPTION 'reply_message_required'; END IF;
  IF char_length(_message) > 2000 THEN RAISE EXCEPTION 'reply_message_too_long'; END IF;

  SELECT * INTO v_row FROM public.expert_service_requests
   WHERE id = _request_id AND requester_id = v_uid FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_row.status <> 'information_requested' THEN
    RAISE EXCEPTION 'request_not_awaiting_information: status %', v_row.status;
  END IF;

  -- Return to the state the request was in when information was asked for.
  SELECT ev.from_status INTO v_back FROM public.expert_service_request_events ev
   WHERE ev.request_id = _request_id AND ev.to_status = 'information_requested'
   ORDER BY ev.created_at DESC LIMIT 1;
  IF v_back IS NULL OR v_back = 'information_requested' THEN
    v_back := CASE WHEN v_row.target_expert_id IS NOT NULL THEN 'expert_contacted' ELSE 'under_review' END;
  END IF;

  UPDATE public.expert_service_requests SET status = v_back WHERE id = _request_id;
  PERFORM public._service_request_log(_request_id, v_uid, 'requester', 'reply', v_row.status, v_back, _message);
  RETURN jsonb_build_object('id', _request_id, 'status', v_back);
END $$;

CREATE OR REPLACE FUNCTION public.expert_service_request_cancel(_request_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.expert_service_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.expert_service_requests
   WHERE id = _request_id AND requester_id = v_uid FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_row.status = 'cancelled' THEN RETURN jsonb_build_object('id', _request_id, 'status', 'cancelled'); END IF;
  IF v_row.status IN ('draft','completed','declined') THEN
    RAISE EXCEPTION 'request_not_cancellable: status %', v_row.status;
  END IF;
  UPDATE public.expert_service_requests SET status = 'cancelled' WHERE id = _request_id;
  PERFORM public._service_request_log(_request_id, v_uid, 'requester', 'cancel', v_row.status, 'cancelled', _reason);
  RETURN jsonb_build_object('id', _request_id, 'status', 'cancelled');
END $$;

-- ---------------------------------------------------------------- trainer
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
  FROM public.expert_service_requests r WHERE r.target_expert_id=v_expert AND r.status <> 'draft';
  RETURN v_result;
END $$;

DROP FUNCTION IF EXISTS public.trainer_service_request_respond(uuid, text);
CREATE OR REPLACE FUNCTION public.trainer_service_request_respond(_request_id uuid, _action text, _message text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_expert uuid; v_before public.expert_service_requests%ROWTYPE; v_status text; v_row public.expert_service_requests%ROWTYPE;
BEGIN
  v_expert := public._active_trainer_expert_id(auth.uid());
  IF v_expert IS NULL THEN RAISE EXCEPTION 'active_trainer_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_before FROM public.expert_service_requests WHERE id=_request_id AND target_expert_id=v_expert FOR UPDATE;
  IF v_before.id IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
  v_status := CASE _action WHEN 'accept' THEN 'confirmed' WHEN 'request_info' THEN 'information_requested' WHEN 'decline' THEN 'declined' ELSE NULL END;
  IF v_status IS NULL THEN RAISE EXCEPTION 'invalid_action'; END IF;
  IF _action = 'request_info' AND char_length(btrim(COALESCE(_message, ''))) < 5 THEN
    RAISE EXCEPTION 'info_request_message_required';
  END IF;
  IF char_length(COALESCE(_message, '')) > 2000 THEN RAISE EXCEPTION 'message_too_long'; END IF;

  IF v_before.status = v_status THEN
    RETURN jsonb_build_object('id', v_before.id, 'status', v_before.status);
  END IF;
  IF v_before.status NOT IN ('submitted','under_review','expert_matching','expert_contacted','information_requested') THEN
    RAISE EXCEPTION 'request_not_respondable: status %', v_before.status;
  END IF;

  UPDATE public.expert_service_requests SET status=v_status, responded_at=now() WHERE id=_request_id RETURNING * INTO v_row;
  PERFORM public._service_request_log(_request_id, auth.uid(), 'expert', _action, v_before.status, v_status, _message);
  INSERT INTO public.admin_audit_log(event_type,actor_id,target_user_id,entity_type,entity_id,before_data,after_data)
  VALUES('expert_service_request.responded',auth.uid(),v_before.requester_id,'expert_service_request',v_row.id::text,to_jsonb(v_before),to_jsonb(v_row));
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
    SELECT r.*, p.display_name AS requester_name, p.email AS requester_email,
           e.display_name AS expert_name, e.slug AS expert_slug
    FROM public.expert_service_requests r
    LEFT JOIN public.profiles p ON p.id = r.requester_id
    LEFT JOIN public.experts e ON e.id = r.target_expert_id
    WHERE r.status <> 'draft'
      AND (_status IS NULL OR _status = 'all' OR r.status = _status
           OR (_status = 'open' AND r.status IN ('submitted','under_review','expert_matching','expert_contacted','information_requested'))
           OR (_status = 'unassigned' AND r.target_expert_id IS NULL AND r.status NOT IN ('completed','declined','cancelled')))
      AND (v_q IS NULL
           OR strpos(lower(r.request_number), v_q) > 0
           OR strpos(lower(COALESCE(p.display_name, '')), v_q) > 0
           OR strpos(lower(COALESCE(p.email, '')), v_q) > 0
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
             'targetExpertId', b.target_expert_id, 'assignedExpert', b.expert_name,
             'targetExpertSlug', b.expert_slug, 'assignedAt', b.assigned_at,
             'completedAt', b.completed_at, 'facilitationHistoryId', b.facilitation_history_id,
             'events', public._service_request_events_json(b.id)
           ) AS obj
           FROM base b ORDER BY b.updated_at DESC LIMIT _limit OFFSET _offset
         ) x), '[]'::jsonb)
    INTO v_total, v_items;

  SELECT jsonb_build_object(
    'open', count(*) FILTER (WHERE status IN ('submitted','under_review','expert_matching','expert_contacted','information_requested')),
    'unassigned', count(*) FILTER (WHERE target_expert_id IS NULL AND status NOT IN ('completed','declined','cancelled')),
    'confirmed', count(*) FILTER (WHERE status IN ('confirmed','scheduled')),
    'completed', count(*) FILTER (WHERE status = 'completed'),
    'closed', count(*) FILTER (WHERE status IN ('declined','cancelled'))
  ) INTO v_counts
  FROM public.expert_service_requests WHERE status <> 'draft';

  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'counts', v_counts);
END $$;

CREATE OR REPLACE FUNCTION public.admin_service_request_assignable_experts(_search text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_q text := lower(NULLIF(btrim(COALESCE(_search, '')), '')); v_result jsonb;
BEGIN
  IF NOT public._is_service_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT COALESCE(jsonb_agg(x.obj ORDER BY x.name), '[]'::jsonb) INTO v_result FROM (
    SELECT e.display_name AS name, jsonb_build_object(
      'id', e.id, 'name', e.display_name, 'slug', e.slug, 'headline', e.headline,
      'country', e.country, 'expertiseAreas', COALESCE(to_jsonb(e.expertise_areas), '[]'::jsonb),
      'ownerId', COALESCE(e.original_contributor_id, e.created_by),
      'openAssignments', (SELECT count(*) FROM public.expert_service_requests r
                           WHERE r.target_expert_id = e.id
                             AND r.status IN ('expert_contacted','information_requested','confirmed','scheduled'))
    ) AS obj
    FROM public.experts e
    WHERE e.current_status = 'published' AND e.visibility = 'public'
      AND public._expert_has_active_portal(e.id)
      AND (v_q IS NULL
           OR strpos(lower(e.display_name), v_q) > 0
           OR strpos(lower(COALESCE(e.headline, '')), v_q) > 0
           OR strpos(lower(COALESCE(array_to_string(e.expertise_areas, ' '), '')), v_q) > 0)
    ORDER BY e.display_name LIMIT 50
  ) x;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_service_request_transition(
  _request_id uuid, _action text, _expected_updated_at timestamptz,
  _message text DEFAULT NULL, _expert_id uuid DEFAULT NULL, _completion jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_before public.expert_service_requests%ROWTYPE;
  v_to text;
  v_allowed text[];
  v_history uuid;
  v_title text;
BEGIN
  IF NOT public._is_service_admin(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(COALESCE(_message, '')) > 2000 THEN RAISE EXCEPTION 'message_too_long'; END IF;

  SELECT * INTO v_before FROM public.expert_service_requests WHERE id = _request_id FOR UPDATE;
  IF v_before.id IS NULL OR v_before.status = 'draft' THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_before.requester_id = v_uid THEN RAISE EXCEPTION 'cannot_process_own_request'; END IF;
  IF _expected_updated_at IS NOT NULL AND v_before.updated_at <> _expected_updated_at THEN
    RAISE EXCEPTION 'stale_request: data telah diubah oleh pengguna lain, muat ulang.';
  END IF;

  CASE _action
    WHEN 'review' THEN v_to := 'under_review'; v_allowed := ARRAY['submitted'];
    WHEN 'matching' THEN v_to := 'expert_matching'; v_allowed := ARRAY['submitted','under_review'];
    WHEN 'assign' THEN v_to := 'expert_contacted';
      v_allowed := ARRAY['submitted','under_review','expert_matching','expert_contacted','declined'];
    WHEN 'request_info' THEN v_to := 'information_requested';
      v_allowed := ARRAY['submitted','under_review','expert_matching'];
    WHEN 'schedule' THEN v_to := 'scheduled'; v_allowed := ARRAY['confirmed'];
    WHEN 'complete' THEN v_to := 'completed'; v_allowed := ARRAY['confirmed','scheduled'];
    WHEN 'decline' THEN v_to := 'declined';
      v_allowed := ARRAY['submitted','under_review','expert_matching','expert_contacted','information_requested'];
    WHEN 'cancel' THEN v_to := 'cancelled';
      v_allowed := ARRAY['submitted','under_review','expert_matching','expert_contacted','information_requested','confirmed','scheduled'];
    ELSE RAISE EXCEPTION 'invalid_action';
  END CASE;

  IF NOT (v_before.status = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'invalid_transition: % tidak dapat dilakukan dari status %', _action, v_before.status;
  END IF;
  IF _action IN ('request_info','decline','cancel') AND char_length(btrim(COALESCE(_message, ''))) < 5 THEN
    RAISE EXCEPTION 'message_required';
  END IF;

  IF _action = 'assign' THEN
    IF _expert_id IS NULL THEN RAISE EXCEPTION 'expert_required'; END IF;
    IF _expert_id = v_before.target_expert_id AND v_before.status = 'expert_contacted' THEN
      RETURN jsonb_build_object('id', v_before.id, 'status', v_before.status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.experts e WHERE e.id = _expert_id
                    AND e.current_status = 'published' AND e.visibility = 'public') THEN
      RAISE EXCEPTION 'expert_not_available';
    END IF;
    IF EXISTS (SELECT 1 FROM public.experts e WHERE e.id = _expert_id
                AND (e.original_contributor_id = v_before.requester_id OR e.created_by = v_before.requester_id)) THEN
      RAISE EXCEPTION 'conflict_of_interest: expert adalah pemohon sendiri';
    END IF;
    IF NOT public._expert_has_active_portal(_expert_id) THEN
      RAISE EXCEPTION 'expert_has_no_active_portal: expert belum berstatus trainer aktif sehingga tidak dapat menerima permintaan';
    END IF;
    UPDATE public.expert_service_requests
       SET target_expert_id = _expert_id, status = v_to, assigned_by = v_uid, assigned_at = now(), responded_at = NULL
     WHERE id = _request_id;

  ELSIF _action = 'complete' THEN
    IF v_before.target_expert_id IS NULL THEN RAISE EXCEPTION 'expert_required'; END IF;
    v_title := NULLIF(btrim(COALESCE(_completion->>'activityTitle', '')), '');
    IF v_title IS NULL THEN RAISE EXCEPTION 'activity_title_required'; END IF;
    INSERT INTO public.expert_training_facilitation_history(
      expert_id, activity_title, organizer, role, start_date, end_date,
      participant_count, country, service_request_id, evidence_ref
    ) VALUES (
      v_before.target_expert_id, left(v_title, 240),
      NULLIF(btrim(COALESCE(_completion->>'organizer', '')), ''),
      v_before.request_type,
      NULLIF(_completion->>'startDate', '')::date,
      NULLIF(_completion->>'endDate', '')::date,
      NULLIF(_completion->>'participantCount', '')::int,
      NULLIF(btrim(COALESCE(_completion->>'country', '')), ''),
      v_before.id, v_before.request_number
    )
    ON CONFLICT (service_request_id) WHERE service_request_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_history;
    IF v_history IS NULL THEN
      SELECT id INTO v_history FROM public.expert_training_facilitation_history WHERE service_request_id = v_before.id;
    END IF;
    UPDATE public.expert_service_requests
       SET status = v_to, completed_at = now(), facilitation_history_id = v_history
     WHERE id = _request_id;

  ELSE
    UPDATE public.expert_service_requests SET status = v_to WHERE id = _request_id;
  END IF;

  PERFORM public._service_request_log(_request_id, v_uid, 'admin', _action, v_before.status, v_to, _message);
  INSERT INTO public.admin_audit_log(event_type,actor_id,target_user_id,entity_type,entity_id,before_data,after_data,metadata)
  SELECT 'expert_service_request.admin_' || _action, v_uid, v_before.requester_id, 'expert_service_request',
         r.id::text, to_jsonb(v_before), to_jsonb(r), jsonb_build_object('message', _message)
    FROM public.expert_service_requests r WHERE r.id = _request_id;

  RETURN jsonb_build_object('id', _request_id, 'status', v_to);
END $$;

-- Legacy rows: give every existing non-draft request a "submitted" event so
-- the timeline is never empty.
INSERT INTO public.expert_service_request_events(request_id, actor_id, actor_role, action, from_status, to_status, created_at)
SELECT r.id, r.requester_id, 'requester', 'submit', NULL, 'submitted', COALESCE(r.submitted_at, r.created_at)
  FROM public.expert_service_requests r
 WHERE r.status <> 'draft'
   AND NOT EXISTS (SELECT 1 FROM public.expert_service_request_events ev WHERE ev.request_id = r.id);

-- New requests log their own "submitted" event.
CREATE OR REPLACE FUNCTION public._service_request_submitted_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR OLD.status = 'draft') THEN
    INSERT INTO public.expert_service_request_events(request_id, actor_id, actor_role, action, from_status, to_status)
    VALUES (NEW.id, NEW.requester_id, 'requester', 'submit', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, 'submitted');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS expert_service_requests_submitted_event ON public.expert_service_requests;
CREATE TRIGGER expert_service_requests_submitted_event
  AFTER INSERT OR UPDATE OF status ON public.expert_service_requests
  FOR EACH ROW EXECUTE FUNCTION public._service_request_submitted_event();

REVOKE ALL ON FUNCTION public.expert_service_requests_my() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expert_service_request_reply(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expert_service_request_cancel(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trainer_service_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trainer_service_request_respond(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_service_requests_list(text, text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_service_request_assignable_experts(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_service_request_transition(uuid, text, timestamptz, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expert_service_requests_my() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expert_service_request_reply(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expert_service_request_cancel(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_service_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_service_request_respond(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_service_requests_list(text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_service_request_assignable_experts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_service_request_transition(uuid, text, timestamptz, text, uuid, jsonb) TO authenticated;

COMMIT;
