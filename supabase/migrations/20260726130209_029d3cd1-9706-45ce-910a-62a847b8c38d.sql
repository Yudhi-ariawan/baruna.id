
-- Learning Templates
CREATE TABLE public.learning_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  default_learning_flow jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_menu jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_human_intervention_level text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.learning_templates TO anon, authenticated;
GRANT ALL ON public.learning_templates TO service_role;
ALTER TABLE public.learning_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_read" ON public.learning_templates FOR SELECT USING (true);

-- Delivery Modes
CREATE TABLE public.delivery_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_modes TO anon, authenticated;
GRANT ALL ON public.delivery_modes TO service_role;
ALTER TABLE public.delivery_modes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modes_read" ON public.delivery_modes FOR SELECT USING (true);

-- Master Courses
CREATE TABLE public.master_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_course_id text,
  course_code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  learning_template_id uuid REFERENCES public.learning_templates(id),
  language text DEFAULT 'en',
  status text DEFAULT 'active',
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.master_courses TO anon, authenticated;
GRANT ALL ON public.master_courses TO service_role;
ALTER TABLE public.master_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses_read" ON public.master_courses FOR SELECT USING (true);

-- Master Modules
CREATE TABLE public.master_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_module_id text,
  master_course_id uuid NOT NULL REFERENCES public.master_courses(id) ON DELETE CASCADE,
  module_code text NOT NULL,
  title text NOT NULL,
  sequence integer NOT NULL DEFAULT 0,
  content_reference text,
  learning_hours numeric,
  status text DEFAULT 'active',
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (master_course_id, module_code)
);
GRANT SELECT ON public.master_modules TO anon, authenticated;
GRANT ALL ON public.master_modules TO service_role;
ALTER TABLE public.master_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules_read" ON public.master_modules FOR SELECT USING (true);

-- Course Offerings
CREATE TABLE public.course_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_course_id uuid NOT NULL REFERENCES public.master_courses(id),
  offering_code text UNIQUE NOT NULL,
  offering_title text NOT NULL,
  cohort_name text,
  batch_number integer,
  year integer,
  delivery_mode_id uuid REFERENCES public.delivery_modes(id),
  access_mode text,
  opening_date date,
  closing_date date,
  enrolment_start_date date,
  enrolment_end_date date,
  status text DEFAULT 'published',
  learning_engine_version text NOT NULL DEFAULT 'legacy',
  legacy_learn_path text,
  shared_learn_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.course_offerings TO anon, authenticated;
GRANT ALL ON public.course_offerings TO service_role;
ALTER TABLE public.course_offerings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offerings_read" ON public.course_offerings FOR SELECT USING (true);

-- Enrolments
CREATE TABLE public.enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_offering_id uuid NOT NULL REFERENCES public.course_offerings(id),
  legacy_enrolment_id text,
  enrolment_status text NOT NULL DEFAULT 'enrolled',
  enrolment_date timestamptz NOT NULL DEFAULT now(),
  access_start timestamptz,
  access_end timestamptz,
  completion_status text NOT NULL DEFAULT 'in-progress',
  completion_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_offering_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrolments TO authenticated;
GRANT ALL ON public.enrolments TO service_role;
ALTER TABLE public.enrolments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrolments_own_read" ON public.enrolments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "enrolments_own_insert" ON public.enrolments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "enrolments_own_update" ON public.enrolments FOR UPDATE USING (auth.uid() = user_id);

-- Progress Records
CREATE TABLE public.progress_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolment_id uuid NOT NULL REFERENCES public.enrolments(id) ON DELETE CASCADE,
  learning_activity_id text NOT NULL,
  status text NOT NULL DEFAULT 'in-progress',
  progress_value numeric DEFAULT 0,
  completed_at timestamptz,
  source_system text DEFAULT 'shared_v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrolment_id, learning_activity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_records TO authenticated;
GRANT ALL ON public.progress_records TO service_role;
ALTER TABLE public.progress_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_own_read" ON public.progress_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.enrolments e WHERE e.id = enrolment_id AND e.user_id = auth.uid())
);
CREATE POLICY "progress_own_insert" ON public.progress_records FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.enrolments e WHERE e.id = enrolment_id AND e.user_id = auth.uid())
);
CREATE POLICY "progress_own_update" ON public.progress_records FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.enrolments e WHERE e.id = enrolment_id AND e.user_id = auth.uid())
);

-- Quiz Attempts (append-only)
CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolment_id uuid NOT NULL REFERENCES public.enrolments(id) ON DELETE CASCADE,
  assessment_id text NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  score numeric,
  passed boolean DEFAULT false,
  started_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  source_system text DEFAULT 'shared_v1',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quiz_own_read" ON public.quiz_attempts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.enrolments e WHERE e.id = enrolment_id AND e.user_id = auth.uid())
);
CREATE POLICY "quiz_own_insert" ON public.quiz_attempts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.enrolments e WHERE e.id = enrolment_id AND e.user_id = auth.uid())
);

-- Evaluations
CREATE TABLE public.evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolment_id uuid NOT NULL REFERENCES public.enrolments(id) ON DELETE CASCADE,
  evaluation_type text NOT NULL,
  response_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  completion_status text NOT NULL DEFAULT 'submitted',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrolment_id, evaluation_type)
);
GRANT SELECT, INSERT, UPDATE ON public.evaluations TO authenticated;
GRANT ALL ON public.evaluations TO service_role;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eval_own_read" ON public.evaluations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.enrolments e WHERE e.id = enrolment_id AND e.user_id = auth.uid())
);
CREATE POLICY "eval_own_insert" ON public.evaluations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.enrolments e WHERE e.id = enrolment_id AND e.user_id = auth.uid())
);
CREATE POLICY "eval_own_update" ON public.evaluations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.enrolments e WHERE e.id = enrolment_id AND e.user_id = auth.uid())
);

-- Certificates (server-issued only)
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolment_id uuid NOT NULL REFERENCES public.enrolments(id) ON DELETE CASCADE,
  course_offering_id uuid NOT NULL REFERENCES public.course_offerings(id),
  certificate_type text NOT NULL,
  certificate_number text UNIQUE NOT NULL,
  legacy_certificate_id text,
  issue_date timestamptz NOT NULL DEFAULT now(),
  verification_reference text NOT NULL,
  certificate_status text NOT NULL DEFAULT 'issued',
  source_system text DEFAULT 'shared_v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, course_offering_id, certificate_type)
);
GRANT SELECT ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cert_own_read" ON public.certificates FOR SELECT USING (auth.uid() = learner_id);
-- No INSERT policy for authenticated — server-issued only via service_role

-- Migration Mappings
CREATE TABLE public.migration_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  legacy_entity_id text NOT NULL,
  shared_entity_id text NOT NULL,
  migration_status text NOT NULL DEFAULT 'not_started',
  validation_status text NOT NULL DEFAULT 'pending',
  mismatch_reason text,
  migrated_at timestamptz,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, legacy_entity_id)
);
GRANT SELECT ON public.migration_mappings TO authenticated;
GRANT ALL ON public.migration_mappings TO service_role;
ALTER TABLE public.migration_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mappings_read" ON public.migration_mappings FOR SELECT USING (true);

-- Feature Flags
CREATE TABLE public.learning_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid UNIQUE NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  engine_version text NOT NULL DEFAULT 'legacy',
  enabled boolean NOT NULL DEFAULT true,
  shadow_mode boolean NOT NULL DEFAULT false,
  rollback_available boolean NOT NULL DEFAULT true,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.learning_feature_flags TO anon, authenticated;
GRANT ALL ON public.learning_feature_flags TO service_role;
ALTER TABLE public.learning_feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flags_read" ON public.learning_feature_flags FOR SELECT USING (true);

-- Audit Log
CREATE TABLE public.learning_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor_id uuid,
  entity_type text,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.learning_audit_log TO authenticated;
GRANT ALL ON public.learning_audit_log TO service_role;
ALTER TABLE public.learning_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_own_read" ON public.learning_audit_log FOR SELECT USING (auth.uid() = actor_id);
CREATE POLICY "audit_own_insert" ON public.learning_audit_log FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- ===== SEED =====

INSERT INTO public.learning_templates (code, name, description, default_human_intervention_level) VALUES
  ('knowledge_course', 'Knowledge Course', 'Self-paced knowledge acquisition', 'none'),
  ('technical_practice_course', 'Technical Practice Course', 'Guided practice with trainer feedback', 'trainer'),
  ('project_based_course', 'Project-Based Course', 'Applied project with expert review', 'expert-review'),
  ('certification_course', 'Certification Course', 'Formal assessment leading to certification', 'assessor'),
  ('webinar_workshop_course', 'Webinar / Workshop', 'Live event with facilitator', 'facilitator')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.delivery_modes (code, name, description, feature_flags) VALUES
  ('open_self_paced', 'Open Self-Paced', 'Anyone can enrol immediately', '{"schedule":false,"trainer":false,"attendance":false,"travel":false,"application":false}'::jsonb),
  ('approved_self_paced', 'Approved Self-Paced', 'Admin approval required before self-paced access', '{"schedule":false,"trainer":false,"attendance":false,"travel":false,"application":true}'::jsonb),
  ('cohort_guided', 'Cohort Guided', 'Trainer-facilitated cohort with schedule', '{"schedule":true,"trainer":true,"attendance":true,"travel":false,"application":true}'::jsonb),
  ('blended_cohort', 'Blended Cohort', 'Online plus in-person with travel', '{"schedule":true,"trainer":true,"attendance":true,"travel":true,"application":true,"in_person":true}'::jsonb),
  ('live_webinar_workshop', 'Live Webinar / Workshop', 'Single live event', '{"schedule":true,"trainer":true,"attendance":true,"travel":false,"application":false}'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.master_courses (course_code, title, description, learning_template_id, legacy_course_id)
SELECT 'ocean-literacy-foundations', 'Ocean Literacy Foundations',
       'Introduction to ocean systems, marine biodiversity, and human interactions with the ocean.',
       t.id, 'mc-ocean-literacy'
FROM public.learning_templates t WHERE t.code = 'knowledge_course'
ON CONFLICT (course_code) DO NOTHING;

INSERT INTO public.master_courses (course_code, title, description, learning_template_id, legacy_course_id)
SELECT 'allocated-zones-for-aquaculture', 'Allocated Zones for Aquaculture (AZA)',
       'Project-based training on spatial planning for aquaculture zones.',
       t.id, 'tr-09'
FROM public.learning_templates t WHERE t.code = 'project_based_course'
ON CONFLICT (course_code) DO NOTHING;

INSERT INTO public.master_courses (course_code, title, description, learning_template_id, legacy_course_id)
SELECT 'international-fisheries-african-countries', 'International Training on Fisheries for African Countries',
       'Blended technical-practice training programme for African fisheries professionals.',
       t.id, 'tr-01'
FROM public.learning_templates t WHERE t.code = 'technical_practice_course'
ON CONFLICT (course_code) DO NOTHING;

INSERT INTO public.master_modules (master_course_id, module_code, title, sequence, learning_hours)
SELECT c.id, m.code, m.title, m.seq, m.hours FROM public.master_courses c
CROSS JOIN (VALUES
  ('OCN-01','Ocean systems and cycles', 1, 1.5),
  ('OCN-02','Marine biodiversity', 2, 1.5),
  ('OCN-03','Human impact on the ocean', 3, 1.5),
  ('OCN-04','Sustainable ocean action', 4, 1.5)
) AS m(code, title, seq, hours)
WHERE c.course_code = 'ocean-literacy-foundations'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_offerings (master_course_id, offering_code, offering_title, cohort_name, year, delivery_mode_id, access_mode, status, learning_engine_version, shared_learn_path, legacy_learn_path)
SELECT c.id, 'of-ocean-literacy-open-2026', 'Ocean Literacy Foundations 2026', 'Open 2026', 2026, d.id, 'open', 'published', 'shared_v1', '/academy/course/of-ocean-literacy-open-2026', NULL
FROM public.master_courses c, public.delivery_modes d
WHERE c.course_code = 'ocean-literacy-foundations' AND d.code = 'open_self_paced'
ON CONFLICT (offering_code) DO NOTHING;

INSERT INTO public.course_offerings (master_course_id, offering_code, offering_title, cohort_name, year, delivery_mode_id, access_mode, status, learning_engine_version, legacy_learn_path)
SELECT c.id, 'of-aza-open-2026', 'AZA Open 2026', 'Open 2026', 2026, d.id, 'open', 'published', 'legacy', '/academy/learn/allocated-zones-for-aquaculture'
FROM public.master_courses c, public.delivery_modes d
WHERE c.course_code = 'allocated-zones-for-aquaculture' AND d.code = 'open_self_paced'
ON CONFLICT (offering_code) DO NOTHING;

INSERT INTO public.course_offerings (master_course_id, offering_code, offering_title, cohort_name, year, delivery_mode_id, access_mode, status, learning_engine_version, legacy_learn_path)
SELECT c.id, 'of-africa-fisheries-2024', 'Africa Fisheries Training 2024', 'Cohort 2024', 2024, d.id, 'application-required', 'completed', 'legacy', '/academy/edition-2024'
FROM public.master_courses c, public.delivery_modes d
WHERE c.course_code = 'international-fisheries-african-countries' AND d.code = 'blended_cohort'
ON CONFLICT (offering_code) DO NOTHING;

INSERT INTO public.course_offerings (master_course_id, offering_code, offering_title, cohort_name, year, delivery_mode_id, access_mode, status, learning_engine_version, legacy_learn_path)
SELECT c.id, 'of-africa-fisheries-2026', 'Africa Fisheries Training 2026', 'Cohort 2026', 2026, d.id, 'application-required', 'published', 'legacy', '/academy/preview/international-training-fisheries-african-countries'
FROM public.master_courses c, public.delivery_modes d
WHERE c.course_code = 'international-fisheries-african-countries' AND d.code = 'blended_cohort'
ON CONFLICT (offering_code) DO NOTHING;

INSERT INTO public.learning_feature_flags (course_offering_id, engine_version, enabled)
SELECT id, learning_engine_version, true FROM public.course_offerings
ON CONFLICT (course_offering_id) DO NOTHING;

INSERT INTO public.migration_mappings (entity_type, legacy_entity_id, shared_entity_id, migration_status, validation_status, migrated_at, validated_at) VALUES
  ('master_course', 'mc-ocean-literacy', 'ocean-literacy-foundations', 'completed', 'validated', now(), now()),
  ('master_course', 'tr-09', 'allocated-zones-for-aquaculture', 'mapped_only', 'pending', NULL, NULL),
  ('master_course', 'tr-01', 'international-fisheries-african-countries', 'mapped_only', 'pending', NULL, NULL),
  ('course_offering', 'aza-legacy-2026', 'of-aza-open-2026', 'not_started', 'pending', NULL, NULL),
  ('course_offering', 'africa-legacy-2024', 'of-africa-fisheries-2024', 'not_started', 'pending', NULL, NULL),
  ('course_offering', 'africa-legacy-2026', 'of-africa-fisheries-2026', 'not_started', 'pending', NULL, NULL)
ON CONFLICT (entity_type, legacy_entity_id) DO NOTHING;

-- Server-side certificate eligibility function
CREATE OR REPLACE FUNCTION public.check_certificate_eligibility(_enrolment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrolment RECORD;
  v_module_count integer;
  v_completed_count integer;
  v_evaluation_exists boolean;
BEGIN
  SELECT e.id, e.user_id, e.course_offering_id, o.master_course_id
  INTO v_enrolment
  FROM public.enrolments e
  JOIN public.course_offerings o ON o.id = e.course_offering_id
  WHERE e.id = _enrolment_id;

  IF v_enrolment.id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'enrolment_not_found');
  END IF;

  SELECT COUNT(*) INTO v_module_count
  FROM public.master_modules WHERE master_course_id = v_enrolment.master_course_id;

  SELECT COUNT(DISTINCT learning_activity_id) INTO v_completed_count
  FROM public.progress_records
  WHERE enrolment_id = _enrolment_id AND status = 'completed';

  SELECT EXISTS(SELECT 1 FROM public.evaluations WHERE enrolment_id = _enrolment_id) INTO v_evaluation_exists;

  IF v_module_count = 0 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_modules_configured');
  END IF;

  IF v_completed_count < v_module_count THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'modules_incomplete',
      'completed', v_completed_count, 'required', v_module_count);
  END IF;

  IF NOT v_evaluation_exists THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'evaluation_missing');
  END IF;

  RETURN jsonb_build_object('eligible', true, 'completed', v_completed_count, 'required', v_module_count);
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_certificate_eligibility(uuid) TO authenticated, service_role;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_enrolments_touch BEFORE UPDATE ON public.enrolments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_progress_touch BEFORE UPDATE ON public.progress_records FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_flags_touch BEFORE UPDATE ON public.learning_feature_flags FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_mappings_touch BEFORE UPDATE ON public.migration_mappings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
