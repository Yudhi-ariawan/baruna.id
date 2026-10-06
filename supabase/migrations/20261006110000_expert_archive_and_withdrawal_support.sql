-- Migration: Add 'archived' to review_subjects.current_status constraint
-- Aligns with BARUNA Official Business Process Slide 45 (LS-04: Publication, Withdrawal, Archive)

ALTER TABLE public.review_subjects
  DROP CONSTRAINT IF EXISTS review_subjects_current_status_check;

ALTER TABLE public.review_subjects
  ADD CONSTRAINT review_subjects_current_status_check
  CHECK (current_status IN ('pending', 'under_review', 'decision_pending', 'approved', 'rejected', 'withdrawn', 'archived'));

COMMENT ON CONSTRAINT review_subjects_current_status_check ON public.review_subjects IS
  'Allowed lifecycle statuses for review subjects, including archived state for decommissioned or hidden entities.';

