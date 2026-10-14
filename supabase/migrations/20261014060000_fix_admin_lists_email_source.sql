-- Hotfix: public.profiles has no email column; email lives in auth.users.
-- Redefines the two admin list RPCs from 20261014040000 / 20261014050000.

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
           OR (_status = 'unassigned' AND r.target_expert_id IS NULL AND r.status NOT IN ('completed','declined','cancelled')))
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

CREATE OR REPLACE FUNCTION public.admin_trainer_applications_list(_status text DEFAULT 'submitted')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_items jsonb; v_counts jsonb;
BEGIN
  IF NOT public._is_service_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT COALESCE(jsonb_agg(x.obj ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_items FROM (
    SELECT a.created_at, jsonb_build_object(
      'id', a.id, 'status', a.status, 'payload', a.payload, 'createdAt', a.created_at,
      'updatedAt', a.updated_at, 'decidedAt', a.decided_at, 'decisionNote', a.decision_note,
      'grantedLevel', a.granted_level, 'previousTrainerStatus', a.previous_trainer_status,
      'applicantId', a.applicant_id, 'applicantName', p.display_name, 'applicantEmail', u.email,
      'expertId', e.id, 'expertName', e.display_name, 'expertSlug', e.slug, 'expertHeadline', e.headline,
      'currentTrainerStatus', (public._latest_trainer_status(e.id)).trainer_status::text
    ) AS obj
    FROM public.expert_trainer_applications a
    JOIN public.experts e ON e.id = a.expert_id
    LEFT JOIN public.profiles p ON p.id = a.applicant_id
    LEFT JOIN auth.users u ON u.id = a.applicant_id
    WHERE _status IS NULL OR _status = 'all' OR a.status = _status
    ORDER BY a.created_at DESC LIMIT 200
  ) x;
  SELECT jsonb_build_object(
    'submitted', count(*) FILTER (WHERE status = 'submitted'),
    'approved', count(*) FILTER (WHERE status = 'approved'),
    'rejected', count(*) FILTER (WHERE status = 'rejected'),
    'withdrawn', count(*) FILTER (WHERE status = 'withdrawn')
  ) INTO v_counts FROM public.expert_trainer_applications;
  RETURN jsonb_build_object('items', v_items, 'counts', v_counts);
END $$;
