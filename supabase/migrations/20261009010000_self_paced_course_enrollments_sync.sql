-- Migration: 20261009010000_self_paced_course_enrollments_sync.sql
-- Description: Persistent cross-device storage and sync for self-paced courses (Short Courses)
-- Aligns with Slide 22 (Self-Paced Learning) & Engineering Standards for persistent cloud state

CREATE TABLE IF NOT EXISTS public.self_paced_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text,
  hours text,
  instructor text,
  category text,
  score numeric,
  source text DEFAULT 'self-paced',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_steps jsonb NOT NULL DEFAULT '{}'::jsonb,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT self_paced_enrollments_user_code_unique UNIQUE (user_id, code)
);

-- Performance indexes for rapid user-based and code-based lookups
CREATE INDEX IF NOT EXISTS idx_self_paced_enrollments_user_id ON public.self_paced_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_self_paced_enrollments_code ON public.self_paced_enrollments(code);
CREATE INDEX IF NOT EXISTS idx_self_paced_enrollments_completed ON public.self_paced_enrollments(completed);

-- Enable Row Level Security (RLS)
ALTER TABLE public.self_paced_enrollments ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.self_paced_enrollments TO authenticated;
GRANT ALL ON public.self_paced_enrollments TO service_role;

-- RLS Policies
-- 1. Users can read their own self-paced enrollments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'self_paced_enrollments' AND policyname = 'self_paced_enrollments_own_read'
  ) THEN
    CREATE POLICY "self_paced_enrollments_own_read"
      ON public.self_paced_enrollments
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Users can insert their own self-paced enrollments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'self_paced_enrollments' AND policyname = 'self_paced_enrollments_own_insert'
  ) THEN
    CREATE POLICY "self_paced_enrollments_own_insert"
      ON public.self_paced_enrollments
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Users can update their own self-paced enrollments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'self_paced_enrollments' AND policyname = 'self_paced_enrollments_own_update'
  ) THEN
    CREATE POLICY "self_paced_enrollments_own_update"
      ON public.self_paced_enrollments
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Users can delete their own self-paced enrollments (reset)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'self_paced_enrollments' AND policyname = 'self_paced_enrollments_own_delete'
  ) THEN
    CREATE POLICY "self_paced_enrollments_own_delete"
      ON public.self_paced_enrollments
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
