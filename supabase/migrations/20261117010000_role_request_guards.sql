-- ============================================================================
-- Permintaan Peran: guards in the database (Slide 42 LS-01; CATATAN_PERBAIKAN 2bh).
-- Proven by `npm run test:role-requests` (bagian 7).
--
-- Before (found in 2be): the app offered only the five curation roles, but
-- request_rbac_role_change accepted ANY role for oneself (e.g. admin) when called
-- directly; "already held / still pending" was checked only in the app and not
-- atomically (two requests in the same instant both passed); a user could not
-- withdraw a pending request although the table has a 'cancelled' status.
-- Now:
-- * Self-service requests: only operator, reviewer, verifier, approver, publisher,
--   action 'grant' (role_not_requestable). Requests made by admins for others are
--   unchanged.
-- * A grant for a role already held is refused (role_already_held); a second pending
--   request for the same person, role and action is refused (role_request_pending),
--   serialised by an advisory lock and a partial unique index.
-- * cancel_rbac_role_change: the requester withdraws their own pending request.
-- request_rbac_role_change is otherwise identical to 20261021080000. Re-runnable.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.request_rbac_role_change(
  _target_user_id uuid,
  _role_code text,
  _action text,
  _reason text,
  _scope jsonb DEFAULT '{}'::jsonb,
  _valid_from timestamptz DEFAULT now(),
  _valid_until timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role_id uuid;
  v_request_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_actor AND is_active
  ) THEN RAISE EXCEPTION 'unauthorized_or_inactive'; END IF;
  IF _target_user_id <> v_actor
     AND NOT public.has_permission(v_actor, 'users.assign_role') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _role_code = 'expert' THEN RAISE EXCEPTION 'expert_role_managed_by_flow'; END IF;
  IF COALESCE(_action, '') NOT IN ('grant', 'revoke') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;
  IF length(trim(COALESCE(_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;
  IF COALESCE(jsonb_typeof(_scope), '') <> 'object' THEN
    RAISE EXCEPTION 'scope_must_be_object';
  END IF;
  IF _valid_from IS NULL OR (_valid_until IS NOT NULL AND _valid_until <= _valid_from) THEN
    RAISE EXCEPTION 'invalid_validity_window';
  END IF;
  SELECT id INTO v_role_id FROM public.rbac_roles WHERE code = _role_code;
  IF v_role_id IS NULL THEN RAISE EXCEPTION 'role_not_found'; END IF;
  IF _role_code = 'super_admin'
     AND NOT public.has_permission(v_actor, 'roles.manage') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _target_user_id) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Self-service (Profil Saya, 2bh): only the curation roles, only "grant". Admins
  -- (users.assign_role) keep requesting any role for anyone as before.
  IF _target_user_id = v_actor AND NOT public.has_permission(v_actor, 'users.assign_role') THEN
    IF _action <> 'grant' OR _role_code NOT IN ('operator', 'reviewer', 'verifier', 'approver', 'publisher') THEN
      RAISE EXCEPTION 'role_not_requestable';
    END IF;
  END IF;
  -- One request at a time per (person, role, action); the unique index backs this up.
  PERFORM pg_advisory_xact_lock(hashtextextended('rbac_role_request:' || _target_user_id::text || ':' || v_role_id::text, 0));
  IF _action = 'grant' AND EXISTS (
       SELECT 1 FROM public.rbac_user_roles ur
        WHERE ur.user_id = _target_user_id AND ur.role_id = v_role_id AND ur.status = 'active'
          AND ur.valid_from <= now() AND (ur.valid_until IS NULL OR ur.valid_until > now())) THEN
    RAISE EXCEPTION 'role_already_held';
  END IF;
  IF EXISTS (SELECT 1 FROM public.rbac_role_change_requests r
              WHERE r.target_user_id = _target_user_id AND r.role_id = v_role_id AND r.action = _action AND r.status = 'pending') THEN
    RAISE EXCEPTION 'role_request_pending';
  END IF;

  INSERT INTO public.rbac_role_change_requests(
    target_user_id, role_id, action, requested_by, reason, scope,
    requested_valid_from, requested_valid_until
  ) VALUES (
    _target_user_id, v_role_id, _action, v_actor, trim(_reason),
    COALESCE(_scope, '{}'::jsonb), _valid_from, _valid_until
  ) RETURNING id INTO v_request_id;

  PERFORM public.log_admin_event(
    'role_change_requested', v_actor, _target_user_id, 'rbac_role_change_request',
    v_request_id::text, NULL,
    jsonb_build_object('role', _role_code, 'action', _action, 'status', 'pending'),
    jsonb_build_object('scope', _scope, 'valid_from', _valid_from,
                       'valid_until', _valid_until, 'reason', trim(_reason))
  );
  RETURN v_request_id;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS rbac_role_change_requests_one_pending
  ON public.rbac_role_change_requests (target_user_id, role_id, action) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.cancel_rbac_role_change(_request_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_req public.rbac_role_change_requests;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthorized_or_inactive'; END IF;
  SELECT * INTO v_req FROM public.rbac_role_change_requests WHERE id = _request_id FOR UPDATE;
  IF v_req.id IS NULL OR v_req.requested_by <> v_actor THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'request_not_pending'; END IF;
  UPDATE public.rbac_role_change_requests SET status = 'cancelled', updated_at = now() WHERE id = _request_id;
  PERFORM public.log_admin_event(
    'role_change_cancelled', v_actor, v_req.target_user_id, 'rbac_role_change_request', _request_id::text,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'cancelled'),
    jsonb_build_object('role_id', v_req.role_id, 'action', v_req.action));
  RETURN 'cancelled';
END $$;
REVOKE ALL ON FUNCTION public.cancel_rbac_role_change(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_rbac_role_change(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.request_rbac_role_change(uuid,text,text,text,jsonb,timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_rbac_role_change(uuid,text,text,text,jsonb,timestamptz,timestamptz) TO authenticated;

COMMIT;
