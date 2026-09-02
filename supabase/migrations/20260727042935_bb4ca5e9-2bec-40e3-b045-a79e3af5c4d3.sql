
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_any_governance_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_governance_role(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.log_governance_event(text,uuid,uuid,text,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_governance_event(text,uuid,uuid,text,text,jsonb,jsonb) TO service_role;
