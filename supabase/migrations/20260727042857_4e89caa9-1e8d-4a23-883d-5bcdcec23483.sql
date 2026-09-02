
-- Roles enum + user_roles
CREATE TYPE public.app_role AS ENUM ('admin', 'management', 'qa_reviewer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_governance_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','management','qa_reviewer'))
$$;

CREATE POLICY user_roles_self_read ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY user_roles_admin_read ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

-- governance_audit_log (append-only)
CREATE TABLE public.governance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor_id uuid REFERENCES auth.users(id),
  subject_id uuid,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.governance_audit_log TO authenticated;
GRANT ALL ON public.governance_audit_log TO service_role;
REVOKE UPDATE, DELETE ON public.governance_audit_log FROM PUBLIC, anon, authenticated;
ALTER TABLE public.governance_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY gov_audit_admin_read ON public.governance_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

CREATE OR REPLACE FUNCTION public.log_governance_event(
  _event_type text, _actor_id uuid, _subject_id uuid,
  _entity_type text, _entity_id text, _before jsonb, _after jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF _event_type IS NULL OR length(_event_type) = 0 THEN
    RAISE EXCEPTION 'event_type required';
  END IF;
  INSERT INTO public.governance_audit_log(event_type, actor_id, subject_id, entity_type, entity_id, before, after)
  VALUES (_event_type, _actor_id, _subject_id, _entity_type, _entity_id, _before, _after)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.log_governance_event(text,uuid,uuid,text,text,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_governance_event(text,uuid,uuid,text,text,jsonb,jsonb) TO service_role;

-- review_subjects (no policies yet — need assignments table first)
CREATE TABLE public.review_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('expert','module','knowledge_resource','training_need')),
  external_ref text,
  title text NOT NULL,
  description text,
  submitted_by uuid NOT NULL REFERENCES auth.users(id),
  current_status text NOT NULL DEFAULT 'pending'
    CHECK (current_status IN ('pending','under_review','decision_pending','approved','rejected','withdrawn')),
  required_recommendations integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.review_subjects TO authenticated;
GRANT ALL ON public.review_subjects TO service_role;
ALTER TABLE public.review_subjects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_review_subjects_touch
  BEFORE UPDATE ON public.review_subjects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- review_assignments
CREATE TABLE public.review_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.review_subjects(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','recused','completed','cancelled')),
  conflict_of_interest_declared boolean NOT NULL DEFAULT false,
  conflict_of_interest_reason text,
  conflict_declared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX review_assignments_one_active
  ON public.review_assignments(subject_id, reviewer_id) WHERE status = 'active';
GRANT SELECT, INSERT, UPDATE ON public.review_assignments TO authenticated;
GRANT ALL ON public.review_assignments TO service_role;
ALTER TABLE public.review_assignments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_review_assignments_touch
  BEFORE UPDATE ON public.review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Now policies for review_subjects (can reference review_assignments)
CREATE POLICY review_subjects_submitter_read ON public.review_subjects
  FOR SELECT TO authenticated USING (auth.uid() = submitted_by);
CREATE POLICY review_subjects_reviewer_read ON public.review_subjects
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.review_assignments a
    WHERE a.subject_id = review_subjects.id AND a.reviewer_id = auth.uid() AND a.status = 'active'));
CREATE POLICY review_subjects_admin_read ON public.review_subjects
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY review_subjects_admin_write ON public.review_subjects
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY review_subjects_admin_update ON public.review_subjects
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

-- Policies for review_assignments
CREATE POLICY review_assignments_reviewer_read ON public.review_assignments
  FOR SELECT TO authenticated USING (auth.uid() = reviewer_id);
CREATE POLICY review_assignments_admin_read ON public.review_assignments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY review_assignments_admin_write ON public.review_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY review_assignments_admin_update ON public.review_assignments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY review_assignments_reviewer_coi_update ON public.review_assignments
  FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);

-- review_records
CREATE TABLE public.review_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.review_subjects(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.review_assignments(id) ON DELETE CASCADE,
  recommendation text NOT NULL CHECK (recommendation IN ('approve','reject','request_changes')),
  rationale text,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','withdrawn','superseded')),
  supersedes_review_record_id uuid REFERENCES public.review_records(id),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX review_records_one_active
  ON public.review_records(subject_id, reviewer_id) WHERE status IN ('draft','submitted');
GRANT SELECT, INSERT, UPDATE ON public.review_records TO authenticated;
GRANT ALL ON public.review_records TO service_role;
ALTER TABLE public.review_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY review_records_reviewer_read ON public.review_records
  FOR SELECT TO authenticated USING (auth.uid() = reviewer_id);
CREATE POLICY review_records_admin_read_submitted ON public.review_records
  FOR SELECT TO authenticated
  USING (status = 'submitted' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')));
CREATE POLICY review_records_reviewer_insert ON public.review_records
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reviewer_id
    AND (public.has_role(auth.uid(),'qa_reviewer') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY review_records_reviewer_update ON public.review_records
  FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);

CREATE TRIGGER trg_review_records_touch
  BEFORE UPDATE ON public.review_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_review_record_rules()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_assignment public.review_assignments%ROWTYPE;
  v_submitter uuid;
BEGIN
  SELECT * INTO v_assignment FROM public.review_assignments WHERE id = NEW.assignment_id;
  IF v_assignment.id IS NULL THEN RAISE EXCEPTION 'assignment_not_found'; END IF;
  IF v_assignment.reviewer_id <> NEW.reviewer_id THEN RAISE EXCEPTION 'reviewer_mismatch_assignment'; END IF;
  IF v_assignment.subject_id <> NEW.subject_id THEN RAISE EXCEPTION 'subject_mismatch_assignment'; END IF;
  IF v_assignment.status <> 'active' THEN RAISE EXCEPTION 'assignment_not_active'; END IF;
  IF v_assignment.conflict_of_interest_declared = true THEN RAISE EXCEPTION 'unresolved_conflict_of_interest'; END IF;
  SELECT submitted_by INTO v_submitter FROM public.review_subjects WHERE id = NEW.subject_id;
  IF v_submitter = NEW.reviewer_id THEN RAISE EXCEPTION 'self_review_forbidden'; END IF;
  IF NEW.status = 'submitted' AND NEW.submitted_at IS NULL THEN NEW.submitted_at := now(); END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_review_records_rules
  BEFORE INSERT OR UPDATE ON public.review_records
  FOR EACH ROW EXECUTE FUNCTION public.enforce_review_record_rules();

-- review_decisions
CREATE TABLE public.review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.review_subjects(id) ON DELETE CASCADE,
  decided_by uuid NOT NULL REFERENCES auth.users(id),
  decision text NOT NULL CHECK (decision IN ('approve','reject','return_for_revision')),
  rationale text,
  supersedes_decision_id uuid REFERENCES public.review_decisions(id),
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX review_decisions_one_current_final
  ON public.review_decisions(subject_id)
  WHERE supersedes_decision_id IS NULL AND decision IN ('approve','reject');
GRANT SELECT, INSERT ON public.review_decisions TO authenticated;
GRANT ALL ON public.review_decisions TO service_role;
ALTER TABLE public.review_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY review_decisions_admin_write ON public.review_decisions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = decided_by
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')));
CREATE POLICY review_decisions_admin_read ON public.review_decisions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY review_decisions_subject_visible_read ON public.review_decisions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.review_subjects s
    WHERE s.id = review_decisions.subject_id
      AND (s.submitted_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.review_assignments a
          WHERE a.subject_id = s.id AND a.reviewer_id = auth.uid() AND a.status = 'active'))));

CREATE OR REPLACE FUNCTION public.enforce_review_decision_rules()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(NEW.decided_by,'admin') OR public.has_role(NEW.decided_by,'management')) THEN
    RAISE EXCEPTION 'decider_role_required';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_review_decisions_rules
  BEFORE INSERT ON public.review_decisions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_review_decision_rules();
