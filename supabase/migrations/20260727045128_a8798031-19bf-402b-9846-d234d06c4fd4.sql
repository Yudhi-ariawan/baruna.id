
-- Fixed IDs so PostgREST tests can reference them deterministically.
-- These disposable acceptance-test users only exist in the original project.
DO $$
BEGIN
IF (SELECT count(*) FROM auth.users WHERE id IN (
  '757d0081-1e4d-456c-b034-277c5dcf03a8',
  '11d283bb-a2a6-4ed6-a0c1-da8e4dce53ff',
  'f3b67fba-1b46-4698-b475-688a16798824',
  'efc6743c-92e5-4932-a9a0-2acec2428c53'
)) = 4 THEN
INSERT INTO public.review_subjects (id, kind, external_ref, title, description, submitted_by, current_status, required_recommendations, metadata)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'module', 'test-mod-1', 'Test Module Subject #1',
   'Phase 1.1 subject with two active reviewers.', '757d0081-1e4d-456c-b034-277c5dcf03a8',
   'under_review', 2, '{}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'expert', 'test-expert-1', 'Test Expert Subject (self-review)',
   'Owned by qa_a to verify self-review is blocked.', '11d283bb-a2a6-4ed6-a0c1-da8e4dce53ff',
   'under_review', 1, '{}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', 'training_need', 'test-tn-1', 'Test Training Need (COI subject)',
   'For conflict-of-interest recusal test.', '757d0081-1e4d-456c-b034-277c5dcf03a8',
   'under_review', 1, '{}'::jsonb);

INSERT INTO public.review_assignments (id, subject_id, reviewer_id, assigned_by, status, conflict_of_interest_declared)
VALUES
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '11d283bb-a2a6-4ed6-a0c1-da8e4dce53ff', 'efc6743c-92e5-4932-a9a0-2acec2428c53', 'active', false),
  ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
   'f3b67fba-1b46-4698-b475-688a16798824', 'efc6743c-92e5-4932-a9a0-2acec2428c53', 'active', false),
  ('a3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222',
   '11d283bb-a2a6-4ed6-a0c1-da8e4dce53ff', 'efc6743c-92e5-4932-a9a0-2acec2428c53', 'active', false),
  ('a4444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
   'f3b67fba-1b46-4698-b475-688a16798824', 'efc6743c-92e5-4932-a9a0-2acec2428c53', 'active', false);
END IF;
END $$;
