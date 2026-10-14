-- ============================================================================
-- Trainer qualification applications (Slide 39 "Become a BARUNA Trainer")
-- ============================================================================
-- A verified expert whose trainer status is not active (candidate, inactive,
-- suspended, retired) previously had no way to apply: the portal sent them to
-- /experts/become-trainer -> /experts/join -> "you are already an expert".
--
-- * expert_trainer_applications: one row per application, at most one pending
--   per expert (partial unique index).
-- * trainer_application_submit / trainer_application_my: applicant side.
-- * admin_trainer_applications_list / admin_trainer_application_decide: an
--   approval appends a NEW version to expert_trainer_status (the history table
--   is never updated in place). Self-approval is rejected.

BEGIN;

CREATE TABLE IF NOT EXISTS public.expert_trainer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected','withdrawn')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_trainer_status text,
  granted_level text,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text CHECK (decision_note IS NULL OR char_length(decision_note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS expert_trainer_applications_one_pending
  ON public.expert_trainer_applications(expert_id) WHERE status = 'submitted';
CREATE INDEX IF NOT EXISTS expert_trainer_applications_status_idx
  ON public.expert_trainer_applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS expert_trainer_applications_applicant_idx
  ON public.expert_trainer_applications(applicant_id, created_at DESC);

ALTER TABLE public.expert_trainer_applications ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.expert_trainer_applications TO authenticated;
GRANT ALL ON public.expert_trainer_applications TO service_role;
DROP POLICY IF EXISTS expert_trainer_applications_own_read ON public.expert_trainer_applications;
CREATE POLICY expert_trainer_applications_own_read
  ON public.expert_trainer_applications FOR SELECT TO authenticated
  USING (applicant_id = auth.uid());
-- Writes are RPC-only.

DROP TRIGGER IF EXISTS expert_trainer_applications_touch ON public.expert_trainer_applications;
CREATE TRIGGER expert_trainer_applications_touch
  BEFORE UPDATE ON public.expert_trainer_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

-- Latest trainer status version for an expert (NULL when never set).
CREATE OR REPLACE FUNCTION public._latest_trainer_status(_expert_id uuid)
RETURNS public.expert_trainer_status
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ts.* FROM public.expert_trainer_status ts
   WHERE ts.expert_id = _expert_id
   ORDER BY ts.version DESC, ts.granted_at DESC
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._latest_trainer_status(uuid) FROM PUBLIC;

-- The caller's canonical, published expert profile with an active expert role.
CREATE OR REPLACE FUNCTION public._my_verified_expert_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id FROM public.experts e
   WHERE (e.original_contributor_id = _user_id OR e.created_by = _user_id)
     AND e.current_status = 'published'
     AND public.has_rbac_role(_user_id, 'expert')
   ORDER BY e.updated_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._my_verified_expert_id(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.trainer_application_my()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_expert uuid; v_status public.expert_trainer_status; v_app jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  v_expert := public._my_verified_expert_id(v_uid);
  IF v_expert IS NULL THEN
    RETURN jsonb_build_object('eligibility', 'not_expert');
  END IF;
  v_status := public._latest_trainer_status(v_expert);
  SELECT jsonb_build_object(
    'id', a.id, 'status', a.status, 'payload', a.payload, 'createdAt', a.created_at,
    'decidedAt', a.decided_at, 'decisionNote', a.decision_note, 'grantedLevel', a.granted_level
  ) INTO v_app
  FROM public.expert_trainer_applications a
  WHERE a.expert_id = v_expert ORDER BY a.created_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'eligibility', CASE WHEN v_status.trainer_status = 'active' THEN 'active_trainer' ELSE 'eligible' END,
    'expertId', v_expert,
    'trainerStatus', COALESCE(v_status.trainer_status::text, 'not_applied'),
    'trainerLevel', v_status.trainer_level::text,
    'latestApplication', v_app
  );
END $$;

CREATE OR REPLACE FUNCTION public.trainer_application_submit(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_expert uuid; v_status public.expert_trainer_status; v_row public.expert_trainer_applications;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF _payload IS NULL OR jsonb_typeof(_payload) <> 'object' OR pg_column_size(_payload) > 60000 THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;
  v_expert := public._my_verified_expert_id(v_uid);
  IF v_expert IS NULL THEN RAISE EXCEPTION 'verified_expert_required'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('trainer_application:' || v_expert::text, 0));

  v_status := public._latest_trainer_status(v_expert);
  IF v_status.trainer_status = 'active' THEN RAISE EXCEPTION 'already_active_trainer'; END IF;

  -- Idempotent: a pending application is returned instead of duplicated.
  SELECT * INTO v_row FROM public.expert_trainer_applications
   WHERE expert_id = v_expert AND status = 'submitted';
  IF v_row.id IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status, 'duplicate', true);
  END IF;

  INSERT INTO public.expert_trainer_applications(expert_id, applicant_id, payload, previous_trainer_status)
  VALUES (v_expert, v_uid, _payload, COALESCE(v_status.trainer_status::text, 'not_applied'))
  RETURNING * INTO v_row;

  INSERT INTO public.admin_audit_log(event_type, actor_id, target_user_id, entity_type, entity_id, after_data)
  VALUES ('trainer_application.submitted', v_uid, v_uid, 'expert_trainer_application', v_row.id::text, to_jsonb(v_row));
  RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status, 'duplicate', false);
END $$;

CREATE OR REPLACE FUNCTION public.trainer_application_withdraw(_application_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  UPDATE public.expert_trainer_applications SET status = 'withdrawn'
   WHERE id = _application_id AND applicant_id = v_uid AND status = 'submitted';
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_pending'; END IF;
  RETURN jsonb_build_object('id', _application_id, 'status', 'withdrawn');
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

CREATE OR REPLACE FUNCTION public.admin_trainer_application_decide(
  _application_id uuid, _decision text, _level text DEFAULT 'certified', _note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_app public.expert_trainer_applications;
  v_latest public.expert_trainer_status;
  v_next int;
BEGIN
  IF NOT public._is_service_admin(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF char_length(COALESCE(_note, '')) > 2000 THEN RAISE EXCEPTION 'note_too_long'; END IF;
  IF _decision = 'reject' AND char_length(btrim(COALESCE(_note, ''))) < 5 THEN RAISE EXCEPTION 'rejection_reason_required'; END IF;
  IF _decision = 'approve' AND _level NOT IN ('certified','advanced','senior','master') THEN RAISE EXCEPTION 'invalid_level'; END IF;

  SELECT * INTO v_app FROM public.expert_trainer_applications WHERE id = _application_id FOR UPDATE;
  IF v_app.id IS NULL THEN RAISE EXCEPTION 'application_not_found'; END IF;
  IF v_app.applicant_id = v_uid THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
  IF v_app.status <> 'submitted' THEN
    IF v_app.status = (CASE _decision WHEN 'approve' THEN 'approved' ELSE 'rejected' END) THEN
      RETURN jsonb_build_object('id', v_app.id, 'status', v_app.status);
    END IF;
    RAISE EXCEPTION 'application_already_decided: status %', v_app.status;
  END IF;

  IF _decision = 'approve' THEN
    -- The expert may have been archived while the application was pending.
    IF NOT EXISTS (SELECT 1 FROM public.experts e WHERE e.id = v_app.expert_id AND e.current_status = 'published') THEN
      RAISE EXCEPTION 'expert_not_published: profil expert tidak aktif, pulihkan dahulu';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('trainer_status:' || v_app.expert_id::text, 0));
    v_latest := public._latest_trainer_status(v_app.expert_id);
    IF v_latest.trainer_status IS DISTINCT FROM 'active' THEN
      SELECT COALESCE(MAX(version), 0) + 1 INTO v_next FROM public.expert_trainer_status WHERE expert_id = v_app.expert_id;
      INSERT INTO public.expert_trainer_status(
        expert_id, trainer_status, trainer_level, unique_graduated_participants,
        evidence_ref, granted_by, granted_at, effective_from, rationale, version
      ) VALUES (
        v_app.expert_id, 'active', _level::public.trainer_level_v1,
        COALESCE(v_latest.unique_graduated_participants, 0),
        'trainer_application:' || v_app.id::text, v_uid, now(), now(),
        COALESCE(NULLIF(btrim(COALESCE(_note, '')), ''), 'Trainer qualification approved'), v_next
      );
    END IF;
  END IF;

  UPDATE public.expert_trainer_applications
     SET status = CASE _decision WHEN 'approve' THEN 'approved' ELSE 'rejected' END,
         granted_level = CASE _decision WHEN 'approve' THEN _level END,
         decided_by = v_uid, decided_at = now(),
         decision_note = NULLIF(btrim(COALESCE(_note, '')), '')
   WHERE id = _application_id
   RETURNING * INTO v_app;

  INSERT INTO public.admin_audit_log(event_type, actor_id, target_user_id, entity_type, entity_id, after_data)
  VALUES ('trainer_application.' || v_app.status, v_uid, v_app.applicant_id, 'expert_trainer_application', v_app.id::text, to_jsonb(v_app));
  RETURN jsonb_build_object('id', v_app.id, 'status', v_app.status);
END $$;

-- Sample teaching material is commonly a presentation; the bucket only
-- accepted PDF/DOC/DOCX/images, so a PPTX upload would always be rejected.
UPDATE storage.buckets
   SET allowed_mime_types = (
     SELECT array_agg(DISTINCT m)
     FROM unnest(COALESCE(allowed_mime_types, ARRAY[]::text[]) || ARRAY[
       'application/vnd.ms-powerpoint',
       'application/vnd.openxmlformats-officedocument.presentationml.presentation'
     ]) AS m
   )
 WHERE id = 'expert-applications';

REVOKE ALL ON FUNCTION public.trainer_application_my() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trainer_application_submit(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trainer_application_withdraw(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_trainer_applications_list(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_trainer_application_decide(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trainer_application_my() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_application_submit(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_application_withdraw(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_trainer_applications_list(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_trainer_application_decide(uuid, text, text, text) TO authenticated;

COMMIT;
