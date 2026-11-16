-- ============================================================================
-- Authentication Log (Slide 42, LS-01: output "Authentication Log";
-- CATATAN_PERBAIKAN 2bg).
--
-- Why our own table: Supabase only keeps auth.audit_log_entries when "store auth
-- audit logs in the database" is on, and the auth schema is not readable through
-- the API. Triggers on the auth tables record the events here instead:
--   auth.sessions INSERT -> sign_in   (with IP and browser when Supabase records them)
--   auth.sessions DELETE -> sign_out  (sign-out or ended session; not when the
--                                      account itself is deleted)
--   auth.users   INSERT -> account_created
--   auth.users   UPDATE -> email_confirmed, password_changed, recovery_requested,
--                          and sign_in from last_sign_in_at ONLY when the
--                          auth.sessions trigger could not be installed.
--
-- Safety: every trigger swallows its own errors, so logging can never block a
-- sign-in, sign-up, or password change. The table has RLS on, no policies, and no
-- grants for anon/authenticated: it is read only by the Admin Portal server
-- function (permission audit.read, service role).
-- Re-runnable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_event_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- No foreign key: the history stays readable after an account is deleted.
  user_id uuid,
  email text,
  event text NOT NULL CHECK (event IN (
    'sign_in', 'sign_out', 'account_created', 'email_confirmed', 'password_changed', 'recovery_requested'
  )),
  ip text,
  user_agent text,
  session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_event_log_id_desc_idx ON public.auth_event_log (id DESC);
CREATE INDEX IF NOT EXISTS auth_event_log_user_idx ON public.auth_event_log (user_id, id DESC);
CREATE INDEX IF NOT EXISTS auth_event_log_event_idx ON public.auth_event_log (event, id DESC);

ALTER TABLE public.auth_event_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_event_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.auth_event_log TO service_role;

COMMENT ON TABLE public.auth_event_log IS
  'Authentication Log (Slide 42). Written only by triggers on auth.sessions/auth.users; read by the Admin Portal (audit.read).';

-- One writer for every event. Never raises: a logging failure must not block auth.
CREATE OR REPLACE FUNCTION public._auth_event_write(
  _user uuid, _event text, _ip text, _user_agent text, _session uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  INSERT INTO public.auth_event_log (user_id, email, event, ip, user_agent, session_id)
  VALUES (
    _user,
    (SELECT u.email FROM auth.users u WHERE u.id = _user),
    _event,
    NULLIF(left(_ip, 64), ''),
    NULLIF(left(_user_agent, 500), ''),
    _session
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auth_event_log not written (%): %', _event, SQLERRM;
END $$;

-- auth.sessions: a new row is a sign-in, a removed row is a sign-out / ended session.
-- Columns are read through to_jsonb so an older auth schema without ip/user_agent
-- still works (the values are then empty).
CREATE OR REPLACE FUNCTION public._auth_log_session()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  r jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    r := to_jsonb(NEW);
    PERFORM public._auth_event_write(NEW.user_id, 'sign_in', r->>'ip', r->>'user_agent', NEW.id);
  ELSIF TG_OP = 'DELETE' THEN
    -- Sessions removed because the account itself is deleted are not sign-outs.
    IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.user_id) THEN
      r := to_jsonb(OLD);
      PERFORM public._auth_event_write(OLD.user_id, 'sign_out', r->>'ip', r->>'user_agent', OLD.id);
    END IF;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

-- auth.users: account-level events.
CREATE OR REPLACE FUNCTION public._auth_log_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._auth_event_write(NEW.id, 'account_created', NULL, NULL, NULL);
    RETURN NULL;
  END IF;

  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public._auth_event_write(NEW.id, 'email_confirmed', NULL, NULL, NULL);
  END IF;
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password
     AND COALESCE(OLD.encrypted_password, '') <> '' THEN
    PERFORM public._auth_event_write(NEW.id, 'password_changed', NULL, NULL, NULL);
  END IF;
  IF NEW.recovery_sent_at IS NOT NULL AND NEW.recovery_sent_at IS DISTINCT FROM OLD.recovery_sent_at THEN
    PERFORM public._auth_event_write(NEW.id, 'recovery_requested', NULL, NULL, NULL);
  END IF;
  -- Fallback only: when the auth.sessions trigger is missing, take sign-ins from
  -- last_sign_in_at (no IP/browser). Otherwise the sessions trigger records them.
  IF NEW.last_sign_in_at IS NOT NULL AND NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'baruna_auth_log_session') THEN
    PERFORM public._auth_event_write(NEW.id, 'sign_in', NULL, NULL, NULL);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public._auth_event_write(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._auth_log_session() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._auth_log_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS baruna_auth_log_user ON auth.users;
CREATE TRIGGER baruna_auth_log_user
  AFTER INSERT OR UPDATE OF email_confirmed_at, encrypted_password, recovery_sent_at, last_sign_in_at
  ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public._auth_log_user();

-- Supabase may refuse triggers on auth.sessions; then sign-ins fall back to
-- last_sign_in_at (above) and this migration still succeeds.
DO $$
BEGIN
  DROP TRIGGER IF EXISTS baruna_auth_log_session ON auth.sessions;
  CREATE TRIGGER baruna_auth_log_session
    AFTER INSERT OR DELETE ON auth.sessions
    FOR EACH ROW EXECUTE FUNCTION public._auth_log_session();
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'auth.sessions trigger not installed (%): sign-ins are logged from auth.users.last_sign_in_at, without IP/browser.', SQLERRM;
END $$;
