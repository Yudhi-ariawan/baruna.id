-- ============================================================================
-- Attendance for cohort Course Offerings (Slide 23 PB-ACA-04: Admin Console /
-- Operator "Catat Kehadiran" -> "Buat Attendance Record"; output "Attendance
-- Record"). Part of turning Full Training into a Course Offering (keputusan pemilik
-- proyek 16 Nov; CATATAN_PERBAIKAN 2bb). Proven by `npm run test:offering-attendance`.
--
-- Before: no attendance anywhere on the server; the old Full Training "In-Person
-- Training" tab kept it in the browser.
-- Now:
-- * offering_sessions: the sessions of a cohort-based offering (title, start, place).
-- * attendance_records: one status per (session, enrolled participant): present,
--   late, excused, absent, with an optional note; who recorded it and when.
-- * Program managers (super_admin, admin, operator, approver: _program_can_manage)
--   manage sessions and record attendance through RPCs; a session that already has
--   records cannot be deleted. Participants read only their own attendance
--   (my_attendance). No direct writes from the browser.
-- * Attendance does not change completion yet: whether it is a requirement to pass
--   (Slide 24) waits for the mentor's rule.
-- Re-runnable.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.offering_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 200),
  starts_at timestamptz NOT NULL,
  location text CHECK (location IS NULL OR char_length(location) <= 200),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS offering_sessions_offering_idx ON public.offering_sessions (course_offering_id, starts_at);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.offering_sessions(id) ON DELETE RESTRICT,
  enrolment_id uuid NOT NULL REFERENCES public.enrolments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present', 'late', 'excused', 'absent')),
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, enrolment_id)
);
CREATE INDEX IF NOT EXISTS attendance_records_user_idx ON public.attendance_records (user_id);

ALTER TABLE public.offering_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.offering_sessions, public.attendance_records FROM anon, authenticated;
GRANT SELECT ON public.offering_sessions, public.attendance_records TO authenticated;
GRANT ALL ON public.offering_sessions, public.attendance_records TO service_role;
DROP POLICY IF EXISTS attendance_records_own_read ON public.attendance_records;
CREATE POLICY attendance_records_own_read ON public.attendance_records FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS offering_sessions_enrolled_read ON public.offering_sessions;
CREATE POLICY offering_sessions_enrolled_read ON public.offering_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.enrolments e WHERE e.course_offering_id = offering_sessions.course_offering_id
             AND e.user_id = auth.uid() AND e.enrolment_status <> 'withdrawn'));

CREATE OR REPLACE FUNCTION public.attendance_session_save(
  _offering_id uuid, _id uuid, _title text, _starts_at timestamptz, _location text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_title text := btrim(COALESCE(_title, ''));
  v_loc text := NULLIF(btrim(COALESCE(_location, '')), '');
  v_model text;
  v_row public.offering_sessions;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._program_can_manage(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_title) NOT BETWEEN 2 AND 200 THEN RAISE EXCEPTION 'attendance_session_title_invalid'; END IF;
  IF _starts_at IS NULL THEN RAISE EXCEPTION 'attendance_session_time_required'; END IF;
  IF char_length(COALESCE(v_loc, '')) > 200 THEN RAISE EXCEPTION 'attendance_session_location_invalid'; END IF;
  SELECT learning_model::text INTO v_model FROM public.course_offerings WHERE id = _offering_id;
  IF v_model IS NULL THEN RAISE EXCEPTION 'attendance_offering_not_found'; END IF;
  -- Self-paced courses have no sessions.
  IF v_model <> 'cohort_based' THEN RAISE EXCEPTION 'attendance_not_applicable'; END IF;

  IF _id IS NULL THEN
    INSERT INTO public.offering_sessions (course_offering_id, title, starts_at, location, created_by)
    VALUES (_offering_id, v_title, _starts_at, v_loc, v_uid) RETURNING * INTO v_row;
  ELSE
    UPDATE public.offering_sessions SET title = v_title, starts_at = _starts_at, location = v_loc, updated_at = now()
     WHERE id = _id AND course_offering_id = _offering_id RETURNING * INTO v_row;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'attendance_session_not_found'; END IF;
  END IF;
  INSERT INTO public.admin_audit_log (event_type, actor_id, entity_type, entity_id, after_data)
  VALUES ('attendance_session_saved', v_uid, 'offering_session', v_row.id::text, to_jsonb(v_row));
  RETURN jsonb_build_object('id', v_row.id);
END $$;
REVOKE ALL ON FUNCTION public.attendance_session_save(uuid, uuid, text, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_session_save(uuid, uuid, text, timestamptz, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.attendance_session_delete(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.offering_sessions;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._program_can_manage(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.offering_sessions WHERE id = _id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'attendance_session_not_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.attendance_records WHERE session_id = _id) THEN RAISE EXCEPTION 'attendance_session_has_records'; END IF;
  DELETE FROM public.offering_sessions WHERE id = _id;
  INSERT INTO public.admin_audit_log (event_type, actor_id, entity_type, entity_id, before_data)
  VALUES ('attendance_session_deleted', v_uid, 'offering_session', _id::text, to_jsonb(v_row));
  RETURN jsonb_build_object('id', _id, 'deleted', true);
END $$;
REVOKE ALL ON FUNCTION public.attendance_session_delete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_session_delete(uuid) TO authenticated;

-- Records for one session: [{enrolmentId, status, note}], status null clears it.
CREATE OR REPLACE FUNCTION public.attendance_record_set(_session_id uuid, _records jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session public.offering_sessions;
  v_r jsonb; v_enr public.enrolments; v_status text; v_note text; v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._program_can_manage(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(_records) IS DISTINCT FROM 'array' OR jsonb_array_length(_records) > 500 THEN RAISE EXCEPTION 'attendance_records_invalid'; END IF;
  -- One recorder at a time per session (two staff on two devices).
  SELECT * INTO v_session FROM public.offering_sessions WHERE id = _session_id FOR UPDATE;
  IF v_session.id IS NULL THEN RAISE EXCEPTION 'attendance_session_not_found'; END IF;

  FOR v_r IN SELECT * FROM jsonb_array_elements(_records) LOOP
    BEGIN
      SELECT * INTO v_enr FROM public.enrolments WHERE id = (v_r->>'enrolmentId')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'attendance_records_invalid';
    END;
    IF v_enr.id IS NULL OR v_enr.course_offering_id <> v_session.course_offering_id OR v_enr.enrolment_status = 'withdrawn' THEN
      RAISE EXCEPTION 'attendance_participant_not_enrolled';
    END IF;
    v_status := NULLIF(v_r->>'status', '');
    v_note := NULLIF(btrim(COALESCE(v_r->>'note', '')), '');
    IF char_length(COALESCE(v_note, '')) > 300 THEN RAISE EXCEPTION 'attendance_note_too_long'; END IF;
    IF v_status IS NULL THEN
      DELETE FROM public.attendance_records WHERE session_id = _session_id AND enrolment_id = v_enr.id;
    ELSIF v_status IN ('present', 'late', 'excused', 'absent') THEN
      INSERT INTO public.attendance_records (session_id, enrolment_id, user_id, status, note, recorded_by)
      VALUES (_session_id, v_enr.id, v_enr.user_id, v_status, v_note, v_uid)
      ON CONFLICT (session_id, enrolment_id) DO UPDATE
        SET status = EXCLUDED.status, note = EXCLUDED.note, recorded_by = EXCLUDED.recorded_by, recorded_at = now();
    ELSE
      RAISE EXCEPTION 'attendance_status_invalid';
    END IF;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.admin_audit_log (event_type, actor_id, entity_type, entity_id, after_data)
  VALUES ('attendance_recorded', v_uid, 'offering_session', _session_id::text, jsonb_build_object('records', _records));
  RETURN jsonb_build_object('sessionId', _session_id, 'count', v_count);
END $$;
REVOKE ALL ON FUNCTION public.attendance_record_set(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_record_set(uuid, jsonb) TO authenticated;

-- Staff view: sessions, enrolled participants and their records.
CREATE OR REPLACE FUNCTION public.attendance_overview(_offering_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._program_can_manage(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.course_offerings WHERE id = _offering_id) THEN RAISE EXCEPTION 'attendance_offering_not_found'; END IF;
  RETURN jsonb_build_object(
    'sessions', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'startsAt', s.starts_at, 'location', s.location,
                    'recorded', (SELECT count(*) FROM public.attendance_records r WHERE r.session_id = s.id)) ORDER BY s.starts_at)
                  FROM public.offering_sessions s WHERE s.course_offering_id = _offering_id), '[]'::jsonb),
    'participants', COALESCE((SELECT jsonb_agg(jsonb_build_object('enrolmentId', e.id, 'userId', e.user_id,
                    'name', COALESCE(NULLIF(btrim(p.display_name), ''), split_part(u.email, '@', 1), 'Peserta'), 'email', u.email)
                    ORDER BY COALESCE(NULLIF(btrim(p.display_name), ''), u.email))
                  FROM public.enrolments e LEFT JOIN public.profiles p ON p.id = e.user_id LEFT JOIN auth.users u ON u.id = e.user_id
                 WHERE e.course_offering_id = _offering_id AND e.enrolment_status <> 'withdrawn'), '[]'::jsonb),
    'records', COALESCE((SELECT jsonb_agg(jsonb_build_object('sessionId', r.session_id, 'enrolmentId', r.enrolment_id, 'status', r.status, 'note', r.note))
                  FROM public.attendance_records r JOIN public.offering_sessions s ON s.id = r.session_id
                 WHERE s.course_offering_id = _offering_id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.attendance_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_overview(uuid) TO authenticated;

-- Participant view: the sessions of my offering and my own status per session.
CREATE OR REPLACE FUNCTION public.my_attendance(_offering_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_enr uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT id INTO v_enr FROM public.enrolments
   WHERE user_id = v_uid AND course_offering_id = _offering_id AND enrolment_status <> 'withdrawn';
  IF v_enr IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('sessionId', s.id, 'title', s.title, 'startsAt', s.starts_at, 'location', s.location,
            'status', r.status, 'note', r.note) ORDER BY s.starts_at)
     FROM public.offering_sessions s LEFT JOIN public.attendance_records r ON r.session_id = s.id AND r.enrolment_id = v_enr
    WHERE s.course_offering_id = _offering_id), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.my_attendance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_attendance(uuid) TO authenticated;

COMMIT;
