-- PHASE 1.4 INCREMENT 3 — COHORT FINANCIAL MODEL (classification only)

-- 1. DOMAIN -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cohort_financial_model_v1') THEN
    CREATE DOMAIN public.cohort_financial_model_v1 AS text
      CONSTRAINT cohort_financial_model_v1_check CHECK (VALUE = 'fee_based');
  END IF;
END $$;

-- 2. COLUMNS ----------------------------------------------------
ALTER TABLE public.course_offerings
  ADD COLUMN IF NOT EXISTS cohort_financial_model public.cohort_financial_model_v1,
  ADD COLUMN IF NOT EXISTS cohort_financial_model_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cohort_financial_model_source text NOT NULL DEFAULT 'migration_backfill',
  ADD COLUMN IF NOT EXISTS cohort_financial_model_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS cohort_financial_model_updated_by uuid;

ALTER TABLE public.course_offerings
  DROP CONSTRAINT IF EXISTS course_offerings_cfm_source_chk;
ALTER TABLE public.course_offerings
  ADD CONSTRAINT course_offerings_cfm_source_chk
  CHECK (cohort_financial_model_source = ANY (ARRAY['migration_backfill','operator','product_owner_confirmation']));

-- 3. BACKFILL (before applicability constraint) -----------------
UPDATE public.course_offerings
SET cohort_financial_model = 'fee_based',
    cohort_financial_model_source = 'migration_backfill',
    cohort_financial_model_updated_at = now()
WHERE learning_model = 'cohort_based'
  AND cohort_financial_model IS NULL;

UPDATE public.course_offerings
SET cohort_financial_model = NULL
WHERE learning_model IS DISTINCT FROM 'cohort_based'
  AND cohort_financial_model IS NOT NULL;

-- 4. APPLICABILITY CONSTRAINT -----------------------------------
ALTER TABLE public.course_offerings
  DROP CONSTRAINT IF EXISTS course_offerings_cohort_financial_model_chk;
ALTER TABLE public.course_offerings
  ADD CONSTRAINT course_offerings_cohort_financial_model_chk
  CHECK (
    CASE
      WHEN learning_model = 'cohort_based' THEN cohort_financial_model = 'fee_based'
      ELSE cohort_financial_model IS NULL
    END
  );

-- 5. EVENT TAXONOMY ---------------------------------------------
ALTER DOMAIN public.platform_event_type_v1 DROP CONSTRAINT IF EXISTS platform_event_type_v1_check;
ALTER DOMAIN public.platform_event_type_v1 ADD CONSTRAINT platform_event_type_v1_check
  CHECK (VALUE = ANY (ARRAY[
    'draft_created','submission_started','submission_submitted','review_assigned',
    'recommendation_submitted','decision_recorded','returned_for_revision','approved',
    'rejected','directly_published','registry_record_created','registry_record_updated',
    'registry_record_published','registry_record_archived','self_paced_alternative_presented',
    'self_paced_alternative_selected','self_paced_course_started',
    'training_request_avoided_by_existing_content','facilitated_training_requested',
    'training_need_converted_to_self_paced','training_need_converted_to_course_offering',
    'funding_preference_selected','funding_model_confirmed','zero_tariff_approved',
    'billing_requested','billing_issued','payment_confirmed',
    'offering_classification_updated','self_paced_access_model_updated',
    'cohort_financial_model_updated'
  ]));

-- 6. BACKFILL AUDIT EVENTS (idempotent) -------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id, offering_code, cohort_financial_model, cohort_financial_model_version
    FROM public.course_offerings
    WHERE cohort_financial_model IS NOT NULL
      AND cohort_financial_model_source = 'migration_backfill'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE event_type = 'cohort_financial_model_updated'
        AND offering_id = r.id
        AND payload->>'origin' = 'migration'
    ) THEN
      PERFORM public.emit_platform_event(
        'cohort_financial_model_updated', NULL, NULL,
        'course_offering', r.id::text, 'course_offering', NULL, NULL, NULL, r.id,
        jsonb_build_object(
          'origin','migration',
          'source','migration_backfill',
          'reason','phase_1_4_increment_3_backfill',
          'offering_code', r.offering_code,
          'previous', NULL,
          'next', r.cohort_financial_model,
          'previous_version', NULL,
          'cohort_financial_model_version', r.cohort_financial_model_version
        )
      );
    END IF;
  END LOOP;
END $$;

-- 7. AUTHORIZED WRITE BOUNDARY ----------------------------------
CREATE OR REPLACE FUNCTION public.set_cohort_financial_model(
  _offering_id uuid,
  _financial_model public.cohort_financial_model_v1,
  _expected_version integer DEFAULT NULL,
  _reason text DEFAULT NULL,
  _source text DEFAULT 'operator'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev record;
  newver integer;
BEGIN
  PERFORM public._require_admin_or_mgmt();

  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'A change reason is required';
  END IF;

  IF _source NOT IN ('operator','product_owner_confirmation') THEN
    RAISE EXCEPTION 'Invalid source: %', _source;
  END IF;

  IF _financial_model IS DISTINCT FROM 'fee_based' THEN
    RAISE EXCEPTION 'cohort_financial_model must be fee_based';
  END IF;

  SELECT id, learning_model, cohort_financial_model, cohort_financial_model_version
    INTO prev
  FROM public.course_offerings WHERE id = _offering_id FOR UPDATE;

  IF prev.id IS NULL THEN
    RAISE EXCEPTION 'Course Offering not found: %', _offering_id;
  END IF;

  IF prev.learning_model IS DISTINCT FROM 'cohort_based' THEN
    RAISE EXCEPTION 'cohort_financial_model applies only to cohort_based offerings';
  END IF;

  IF _expected_version IS NOT NULL
     AND _expected_version <> prev.cohort_financial_model_version THEN
    RAISE EXCEPTION 'Stale cohort financial model update: expected version % but current is %',
      _expected_version, prev.cohort_financial_model_version
      USING ERRCODE = '23514';
  END IF;

  IF prev.cohort_financial_model IS NOT DISTINCT FROM _financial_model THEN
    RETURN jsonb_build_object(
      'course_offering_id', _offering_id,
      'cohort_financial_model', prev.cohort_financial_model,
      'cohort_financial_model_version', prev.cohort_financial_model_version,
      'no_op', true
    );
  END IF;

  newver := prev.cohort_financial_model_version + 1;

  UPDATE public.course_offerings
  SET cohort_financial_model = _financial_model,
      cohort_financial_model_version = newver,
      cohort_financial_model_source = _source,
      cohort_financial_model_updated_at = now(),
      cohort_financial_model_updated_by = auth.uid(),
      updated_at = now()
  WHERE id = _offering_id;

  PERFORM public.emit_platform_event(
    'cohort_financial_model_updated', auth.uid(), NULL,
    'course_offering', _offering_id::text, 'course_offering', NULL, NULL, NULL, _offering_id,
    jsonb_build_object(
      'origin','operator',
      'source', _source,
      'reason', _reason,
      'previous', prev.cohort_financial_model,
      'next', _financial_model,
      'previous_version', prev.cohort_financial_model_version,
      'cohort_financial_model_version', newver
    )
  );

  RETURN jsonb_build_object(
    'course_offering_id', _offering_id,
    'cohort_financial_model', _financial_model,
    'cohort_financial_model_version', newver,
    'no_op', false
  );
END $$;

REVOKE ALL ON FUNCTION public.set_cohort_financial_model(uuid, public.cohort_financial_model_v1, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_cohort_financial_model(uuid, public.cohort_financial_model_v1, integer, text, text) TO authenticated, service_role;

-- 8. VIEWS ------------------------------------------------------
-- Public view: append-only column additions, no actor/reason/source metadata.
CREATE OR REPLACE VIEW public.course_offering_classification_public_v AS
SELECT o.id AS course_offering_id,
       o.offering_code,
       o.offering_title,
       o.learning_model,
       o.delivery_format,
       o.enrolment_access_rule,
       o.self_paced_access_model,
       public.offering_venue_rule(o.learning_model, o.delivery_format) AS venue_rule,
       o.classification_version,
       o.self_paced_access_model_version
FROM public.course_offerings o;

GRANT SELECT ON public.course_offering_classification_public_v TO anon, authenticated, service_role;

-- Internal authorized view: admin/management only, no participant PII.
CREATE OR REPLACE VIEW public.course_offering_financial_internal_v
WITH (security_invoker = true) AS
SELECT o.id AS course_offering_id,
       o.offering_code,
       o.offering_title,
       o.learning_model,
       o.delivery_format,
       o.cohort_financial_model,
       o.cohort_financial_model_version,
       o.cohort_financial_model_source,
       o.cohort_financial_model_updated_at
FROM public.course_offerings o
WHERE public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management');

REVOKE ALL ON public.course_offering_financial_internal_v FROM PUBLIC, anon;
GRANT SELECT ON public.course_offering_financial_internal_v TO authenticated, service_role;