-- The deferred primary-role validator also runs for assignments provisioned by
-- Supabase Auth. Execute it with its owner's privileges so the internal Auth
-- role does not need direct access to RBAC tables.

CREATE OR REPLACE FUNCTION public.validate_rbac_user_primary_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(NEW.user_id, OLD.user_id);
  v_active_count integer;
  v_primary_count integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE is_primary)
  INTO v_active_count, v_primary_count
  FROM public.rbac_user_roles
  WHERE user_id = v_user_id AND status = 'active';

  IF v_active_count > 0 AND v_primary_count <> 1 THEN
    RAISE EXCEPTION 'exactly_one_primary_role_required';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_rbac_user_primary_role() FROM PUBLIC, anon, authenticated;
