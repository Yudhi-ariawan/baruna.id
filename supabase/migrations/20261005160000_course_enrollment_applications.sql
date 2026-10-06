-- Migration: 20261005160000_course_enrollment_applications.sql
-- Description: Official Participant Enrollment Review & Approval Workflow (Slide 22 / PB-ACA-03)
-- Aligns with Slide 22 (Participant Application & Enrollment) and Slide 42 (LS-01)

CREATE TABLE IF NOT EXISTS public.course_enrollment_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text NOT NULL,
  course_title text NOT NULL,
  applicant_name text,
  applicant_email text,
  applicant_organization text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  notes text,
  decision_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_at timestamptz,
  decision_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_enrollment_applications_user_course_unique UNIQUE (user_id, course_id)
);

-- Indexes for performant filtering and high-traffic lookups
CREATE INDEX IF NOT EXISTS idx_course_enrollment_apps_status ON public.course_enrollment_applications(status);
CREATE INDEX IF NOT EXISTS idx_course_enrollment_apps_user ON public.course_enrollment_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollment_apps_course ON public.course_enrollment_applications(course_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.course_enrollment_applications ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.course_enrollment_applications TO authenticated;
GRANT ALL ON public.course_enrollment_applications TO service_role;

-- RLS Policies
-- 1. Applicants can view their own enrollment applications
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'course_enrollment_applications' AND policyname = 'enrollment_apps_own_read'
  ) THEN
    CREATE POLICY "enrollment_apps_own_read"
      ON public.course_enrollment_applications
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Applicants can submit their own enrollment applications
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'course_enrollment_applications' AND policyname = 'enrollment_apps_own_insert'
  ) THEN
    CREATE POLICY "enrollment_apps_own_insert"
      ON public.course_enrollment_applications
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Applicants may edit/re-apply, but can never approve/reject themselves.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'course_enrollment_applications' AND policyname = 'enrollment_apps_own_update'
  ) THEN
    CREATE POLICY "enrollment_apps_own_update"
      ON public.course_enrollment_applications
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id AND status IN ('pending', 'rejected'))
      WITH CHECK (
        auth.uid() = user_id
        AND status = 'pending'
        AND decision_by IS NULL
        AND decision_at IS NULL
        AND decision_notes IS NULL
      );
  END IF;
END $$;

-- 4. Governance & Admins can read all enrollment applications
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'course_enrollment_applications' AND policyname = 'enrollment_apps_admin_read'
  ) THEN
    CREATE POLICY "enrollment_apps_admin_read"
      ON public.course_enrollment_applications
      FOR SELECT
      TO authenticated
      USING (
        public.has_rbac_role(auth.uid(), 'super_admin')
        OR public.has_rbac_role(auth.uid(), 'admin')
        OR public.has_rbac_role(auth.uid(), 'operator')
        OR public.has_rbac_role(auth.uid(), 'approver')
      );
  END IF;
END $$;

-- 5. Governance & Admins can update any enrollment application (decide approve / reject)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'course_enrollment_applications' AND policyname = 'enrollment_apps_admin_update'
  ) THEN
    CREATE POLICY "enrollment_apps_admin_update"
      ON public.course_enrollment_applications
      FOR UPDATE
      TO authenticated
      USING (
        public.has_rbac_role(auth.uid(), 'super_admin')
        OR public.has_rbac_role(auth.uid(), 'admin')
        OR public.has_rbac_role(auth.uid(), 'operator')
        OR public.has_rbac_role(auth.uid(), 'approver')
      )
      WITH CHECK (
        public.has_rbac_role(auth.uid(), 'super_admin')
        OR public.has_rbac_role(auth.uid(), 'admin')
        OR public.has_rbac_role(auth.uid(), 'operator')
        OR public.has_rbac_role(auth.uid(), 'approver')
      );
  END IF;
END $$;
