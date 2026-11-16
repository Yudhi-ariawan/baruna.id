-- ============================================================================
-- Data Master: Operator proposes, Approver/Admin approves (Slide 16; keputusan
-- pemilik proyek 16 Nov, MENUNGGU_ARAHAN_MENTOR butir 10; CATATAN_PERBAIKAN 2az).
-- Proven by `npm run test:master-data-requests`.
--
-- Slide 16: the Operator "mengelola data harian, input, editing, dan persiapan
-- dokumen untuk review", with full access to Academy and Experts; the same slide
-- requires "akses sensitif memerlukan verifikasi & persetujuan berjenjang".
--
-- Before: only Approver, Admin and Super Admin could read or change Data Master
-- (_can_decide_review); an Operator could not even open it.
-- Now:
-- * Operators can read every Data Master list (_can_view_master_data).
-- * master_change_submit(kind, payload, note) is the one write entry point:
--   - Approver/Admin: applied at once by the existing RPC (unchanged rules/audit).
--   - Operator: stored as a pending request in master_data_change_requests.
-- * master_change_decide: another Approver/Admin approves (the existing RPC runs in
--   the same transaction, with all its checks; if it fails nothing is approved) or
--   rejects with a reason. Nobody decides their own request.
-- * master_change_cancel: the requester withdraws a pending request.
-- * Every step is in admin_audit_log; the applied change keeps its own audit row.
-- Re-runnable.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._can_view_master_data(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (public._can_decide_review(_uid) OR public.has_rbac_role(_uid, 'operator'))
$$;
REVOKE ALL ON FUNCTION public._can_view_master_data(uuid) FROM PUBLIC, anon;
-- Used by the RLS policy below, so signed-in users must be able to call it (it only
-- answers yes/no for a user id).
GRANT EXECUTE ON FUNCTION public._can_view_master_data(uuid) TO authenticated;

-- Read access for Operators: same functions, only the guard changes. The guard text is
-- identical in all six readers; a reader that has neither form is an error.
DO $$
DECLARE
  f text;
  v_def text;
  v_old text := 'IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION ''forbidden''';
  v_new text := 'IF NOT public._can_view_master_data(v_uid) THEN RAISE EXCEPTION ''forbidden''';
BEGIN
  FOREACH f IN ARRAY ARRAY['master_data_overview', 'master_module_limits_overview', 'master_trainer_quota_list',
                           'master_kh_topics_overview', 'master_languages_overview', 'master_training_categories_overview'] LOOP
    v_def := pg_get_functiondef(format('public.%I()', f)::regprocedure);
    IF position(v_new IN v_def) > 0 THEN CONTINUE; END IF;
    IF position(v_old IN v_def) = 0 THEN RAISE EXCEPTION 'master_reader_guard_not_found: %', f; END IF;
    EXECUTE replace(v_def, v_old, v_new);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.master_data_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN (
    'expertise_save', 'expertise_set_active', 'kh_topic_save', 'kh_topic_set_active',
    'language_save', 'language_set_active', 'training_category_save', 'training_category_set_active',
    'trainer_levels_set', 'module_limits_set')),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 300),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text CHECK (decision_note IS NULL OR char_length(decision_note) <= 500),
  result jsonb
);
CREATE INDEX IF NOT EXISTS master_data_change_requests_status_idx ON public.master_data_change_requests (status, requested_at DESC);
ALTER TABLE public.master_data_change_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.master_data_change_requests FROM anon, authenticated;
GRANT SELECT ON public.master_data_change_requests TO authenticated;
GRANT ALL ON public.master_data_change_requests TO service_role;
DROP POLICY IF EXISTS master_data_change_requests_read ON public.master_data_change_requests;
CREATE POLICY master_data_change_requests_read ON public.master_data_change_requests
  FOR SELECT USING (public._can_view_master_data(auth.uid()));

-- Runs one change through the existing RPC (which checks the caller can decide).
CREATE OR REPLACE FUNCTION public._master_apply(_kind text, _p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_order integer;
BEGIN
  v_id := NULLIF(_p->>'id', '')::uuid;
  v_order := NULLIF(_p->>'displayOrder', '')::integer;
  RETURN CASE _kind
    WHEN 'expertise_save' THEN public.master_expertise_save(v_id, _p->>'name', _p->>'description', v_order)
    WHEN 'expertise_set_active' THEN public.master_expertise_set_active(v_id, (_p->>'active')::boolean)
    WHEN 'kh_topic_save' THEN public.master_kh_topic_save(v_id, _p->>'name', _p->>'description', v_order)
    WHEN 'kh_topic_set_active' THEN public.master_kh_topic_set_active(v_id, (_p->>'active')::boolean)
    WHEN 'language_save' THEN public.master_language_save(v_id, _p->>'code', _p->>'name', _p->>'nativeName', v_order)
    WHEN 'language_set_active' THEN public.master_language_set_active(v_id, (_p->>'active')::boolean)
    WHEN 'training_category_save' THEN public.master_training_category_save(v_id, _p->>'name', _p->>'description', v_order)
    WHEN 'training_category_set_active' THEN public.master_training_category_set_active(v_id, (_p->>'active')::boolean)
    WHEN 'trainer_levels_set' THEN public.master_trainer_levels_set(_p->'rules', _p->>'note')
    WHEN 'module_limits_set' THEN public.master_module_limits_set(_p->'limits', _p->'expected', _p->>'note')
  END;
EXCEPTION WHEN invalid_text_representation THEN
  RAISE EXCEPTION 'master_request_payload_invalid';
END $$;
REVOKE ALL ON FUNCTION public._master_apply(text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.master_change_submit(_kind text, _payload jsonb, _summary text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_summary text := left(btrim(COALESCE(_summary, '')), 300);
  v_row public.master_data_change_requests;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF _kind IS NULL OR _kind NOT IN (
       'expertise_save', 'expertise_set_active', 'kh_topic_save', 'kh_topic_set_active',
       'language_save', 'language_set_active', 'training_category_save', 'training_category_set_active',
       'trainer_levels_set', 'module_limits_set') THEN
    RAISE EXCEPTION 'master_request_kind_invalid';
  END IF;
  IF jsonb_typeof(_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'master_request_payload_invalid'; END IF;

  -- Approver / Admin: applied at once, exactly as before.
  IF public._can_decide_review(v_uid) THEN
    RETURN jsonb_build_object('queued', false, 'result', public._master_apply(_kind, _payload));
  END IF;
  IF NOT public.has_rbac_role(v_uid, 'operator') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF v_summary = '' THEN RAISE EXCEPTION 'master_request_payload_invalid'; END IF;

  -- One requester at a time; a double click returns the same pending request.
  PERFORM pg_advisory_xact_lock(hashtextextended('master_change:' || v_uid::text, 0));
  SELECT * INTO v_row FROM public.master_data_change_requests
   WHERE requested_by = v_uid AND status = 'pending' AND kind = _kind AND payload = _payload;
  IF v_row.id IS NOT NULL THEN
    RETURN jsonb_build_object('queued', true, 'requestId', v_row.id, 'changed', false);
  END IF;
  IF (SELECT count(*) FROM public.master_data_change_requests WHERE requested_by = v_uid AND status = 'pending') >= 20 THEN
    RAISE EXCEPTION 'master_request_too_many';
  END IF;

  INSERT INTO public.master_data_change_requests (kind, payload, summary, requested_by)
  VALUES (_kind, _payload, v_summary, v_uid) RETURNING * INTO v_row;
  INSERT INTO public.admin_audit_log (event_type, actor_id, entity_type, entity_id, after_data)
  VALUES ('master_change_requested', v_uid, 'master_data_change_request', v_row.id::text,
          jsonb_build_object('kind', _kind, 'payload', _payload, 'summary', v_summary));
  RETURN jsonb_build_object('queued', true, 'requestId', v_row.id, 'changed', true);
END $$;
REVOKE ALL ON FUNCTION public.master_change_submit(text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_change_submit(text, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.master_change_decide(_id uuid, _decision text, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_note text := NULLIF(btrim(COALESCE(_note, '')), '');
  v_row public.master_data_change_requests;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _decision IS NULL OR _decision NOT IN ('approve', 'reject') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF _decision = 'reject' AND (v_note IS NULL OR char_length(v_note) < 5) THEN RAISE EXCEPTION 'master_request_reason_required'; END IF;
  IF char_length(COALESCE(v_note, '')) > 500 THEN RAISE EXCEPTION 'notes_too_long'; END IF;

  SELECT * INTO v_row FROM public.master_data_change_requests WHERE id = _id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'master_request_not_found'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'master_request_already_decided: status %', v_row.status; END IF;
  IF v_row.requested_by = v_uid THEN RAISE EXCEPTION 'self_decision_forbidden'; END IF;

  IF _decision = 'approve' THEN
    -- The existing RPC checks everything again; any error rolls the approval back.
    v_result := public._master_apply(v_row.kind, v_row.payload);
  END IF;

  UPDATE public.master_data_change_requests
     SET status = CASE _decision WHEN 'approve' THEN 'approved' ELSE 'rejected' END,
         decided_by = v_uid, decided_at = now(), decision_note = v_note, result = v_result
   WHERE id = v_row.id RETURNING * INTO v_row;
  INSERT INTO public.admin_audit_log (event_type, actor_id, target_user_id, entity_type, entity_id, after_data)
  VALUES (CASE _decision WHEN 'approve' THEN 'master_change_approved' ELSE 'master_change_rejected' END,
          v_uid, v_row.requested_by, 'master_data_change_request', v_row.id::text,
          jsonb_build_object('kind', v_row.kind, 'payload', v_row.payload, 'summary', v_row.summary,
                             'decision_note', v_note, 'result', v_result));
  RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status, 'result', v_result);
END $$;
REVOKE ALL ON FUNCTION public.master_change_decide(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_change_decide(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.master_change_cancel(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.master_data_change_requests;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.master_data_change_requests WHERE id = _id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.requested_by IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'master_request_not_found'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'master_request_already_decided: status %', v_row.status; END IF;
  UPDATE public.master_data_change_requests SET status = 'cancelled', decided_by = v_uid, decided_at = now()
   WHERE id = v_row.id RETURNING * INTO v_row;
  INSERT INTO public.admin_audit_log (event_type, actor_id, entity_type, entity_id, after_data)
  VALUES ('master_change_cancelled', v_uid, 'master_data_change_request', v_row.id::text,
          jsonb_build_object('kind', v_row.kind, 'summary', v_row.summary));
  RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status);
END $$;
REVOKE ALL ON FUNCTION public.master_change_cancel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_change_cancel(uuid) TO authenticated;

-- Latest requests with names, for the Data Master page (Operator and deciders).
CREATE OR REPLACE FUNCTION public.master_change_requests_list()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_view_master_data(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'canDecide', public._can_decide_review(v_uid),
    'me', v_uid,
    'items', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'requestedAt' DESC) FROM (
      SELECT jsonb_build_object(
        'id', r.id, 'kind', r.kind, 'summary', r.summary, 'status', r.status, 'payload', r.payload,
        'requestedBy', r.requested_by, 'requestedByName', (SELECT display_name FROM public.profiles WHERE id = r.requested_by),
        'requestedAt', r.requested_at, 'decidedByName', (SELECT display_name FROM public.profiles WHERE id = r.decided_by),
        'decidedAt', r.decided_at, 'decisionNote', r.decision_note) AS x
        FROM public.master_data_change_requests r
       WHERE r.status = 'pending' OR r.requested_at > now() - interval '30 days'
       ORDER BY r.requested_at DESC LIMIT 100) s), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.master_change_requests_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_change_requests_list() TO authenticated;

COMMIT;
