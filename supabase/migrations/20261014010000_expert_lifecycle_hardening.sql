-- ============================================================================
-- Expert lifecycle hardening (PB-EXP-01 Expert Profile / PB-EXP-02 Join & Claim)
-- ============================================================================
-- Additive and idempotent. Safe to run on a database that already holds data:
-- unique indexes are only created when existing rows already satisfy them, so
-- this migration never fails on legacy duplicates (a NOTICE is raised instead).
--
-- The application layer (src/lib/experts/*) enforces the same rules, so the app
-- behaves correctly both before and after this migration is applied; the
-- database layer closes the remaining race windows (double click, two tabs).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Idempotent expert_draft_create (duplicate check wajib, Slide 37)
-- ---------------------------------------------------------------------------
-- Same signature as before, so existing callers and grants keep working.
-- * Serializes concurrent creates per user with a transaction advisory lock.
-- * Returns the caller's existing editable expert draft instead of a duplicate.
-- * Refuses to open a second application while one is still in the queue.
CREATE OR REPLACE FUNCTION public.expert_draft_create(
  _display_name text,
  _source_type source_type_v1 DEFAULT 'external_submission'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_draft_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _display_name IS NULL OR length(trim(_display_name)) = 0 THEN
    RAISE EXCEPTION 'display_name_required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('expert_draft_create:' || v_uid::text, 0));

  SELECT id INTO v_draft_id
    FROM public.review_drafts
   WHERE submitter_id = v_uid AND subject_kind = 'expert' AND status = 'draft'
   ORDER BY updated_at DESC
   LIMIT 1;
  IF v_draft_id IS NOT NULL THEN
    RETURN v_draft_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.review_subjects
     WHERE submitted_by = v_uid AND kind = 'expert'
       AND current_status IN ('pending','under_review','decision_pending')
  ) THEN
    RAISE EXCEPTION 'expert_application_already_pending';
  END IF;

  INSERT INTO public.review_drafts (submitter_id, subject_kind, title, payload)
  VALUES (v_uid, 'expert', _display_name,
          jsonb_build_object('source_type', _source_type,
                             'display_name', _display_name))
  RETURNING id INTO v_draft_id;

  PERFORM public.emit_platform_event(
    'draft_created'::platform_event_type_v1,
    v_uid, v_draft_id, 'expert', v_draft_id::text, 'experts',
    _source_type, v_draft_id, NULL, NULL,
    jsonb_build_object('display_name', _display_name));
  RETURN v_draft_id;
END $$;

REVOKE ALL ON FUNCTION public.expert_draft_create(text, source_type_v1) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expert_draft_create(text, source_type_v1) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Guarded unique indexes (only created when current data already complies)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- At most one fresh (never submitted) expert draft per applicant.
  IF NOT EXISTS (
    SELECT 1 FROM public.review_drafts
     WHERE subject_kind = 'expert' AND status = 'draft' AND linked_subject_id IS NULL
     GROUP BY submitter_id HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS review_drafts_one_fresh_expert_draft_per_user
      ON public.review_drafts (submitter_id)
      WHERE subject_kind = 'expert' AND status = 'draft' AND linked_subject_id IS NULL;
  ELSE
    RAISE NOTICE 'review_drafts_one_fresh_expert_draft_per_user skipped: duplicate fresh expert drafts exist; clean them up and re-run.';
  END IF;

  -- One canonical, non-archived expert profile per contributor account.
  IF NOT EXISTS (
    SELECT 1 FROM public.experts
     WHERE original_contributor_id IS NOT NULL AND current_status <> 'archived'
     GROUP BY original_contributor_id HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS experts_one_active_profile_per_contributor
      ON public.experts (original_contributor_id)
      WHERE original_contributor_id IS NOT NULL AND current_status <> 'archived';
  ELSE
    RAISE NOTICE 'experts_one_active_profile_per_contributor skipped: a contributor owns more than one active expert profile; merge them and re-run.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Query-path indexes for the expert verification queue
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS review_subjects_kind_submitter_status_idx
  ON public.review_subjects (kind, submitted_by, current_status);
CREATE INDEX IF NOT EXISTS review_decisions_subject_created_idx
  ON public.review_decisions (subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS review_drafts_linked_subject_updated_idx
  ON public.review_drafts (linked_subject_id, updated_at DESC)
  WHERE linked_subject_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Upload quota aligned with ENGINEERING_STANDARDS §4
-- ---------------------------------------------------------------------------
-- The bucket only accepts PDF/DOC/DOCX and images, so the document ceiling
-- (10 MB) is the hard server-side limit. Images (2 MB) are additionally capped
-- by the client. Existing objects are unaffected.
UPDATE storage.buckets
   SET file_size_limit = 10485760
 WHERE id = 'expert-applications';

COMMIT;
