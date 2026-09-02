-- ============================================================
-- PHASE 1.4 INCREMENT 1 — COURSE OFFERING CLASSIFICATION DOMAINS
-- Additive only. No drops, no renames, no financial/certificate fields.
-- ============================================================

-- 1. DOMAINS ---------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'learning_model_v1') THEN
    CREATE DOMAIN public.learning_model_v1 AS text
      CHECK (VALUE IN ('self_paced','cohort_based'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_format_v1') THEN
    CREATE DOMAIN public.delivery_format_v1 AS text
      CHECK (VALUE IN ('fully_online','blended','in_person'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrolment_access_rule_v1') THEN
    CREATE DOMAIN public.enrolment_access_rule_v1 AS text
      CHECK (VALUE IN ('open','registered','approval_required','entitlement_required'));
  END IF;
END $$;

-- 2. ADDITIVE COLUMNS -----------------------------------------
ALTER TABLE public.course_offerings
  ADD COLUMN IF NOT EXISTS learning_model public.learning_model_v1,
  ADD COLUMN IF NOT EXISTS delivery_format public.delivery_format_v1,
  ADD COLUMN IF NOT EXISTS enrolment_access_rule public.enrolment_access_rule_v1,
  ADD COLUMN IF NOT EXISTS classification_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS classification_source text NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS classification_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS classification_updated_by uuid;

ALTER TABLE public.course_offerings
  DROP CONSTRAINT IF EXISTS course_offerings_classification_source_chk;
ALTER TABLE public.course_offerings
  ADD CONSTRAINT course_offerings_classification_source_chk
  CHECK (classification_source IN ('unclassified','migration_backfill','operator'));

-- 3. EVIDENCE-BASED BACKFILL (idempotent) ----------------------
-- Self-Paced + Fully Online: open_self_paced delivery mode, no cohort/
-- attendance/travel feature flags, no in-person journey.
UPDATE public.course_offerings o
SET learning_model = 'self_paced',
    delivery_format = 'fully_online',
    enrolment_access_rule = 'open',
    classification_source = 'migration_backfill',
    classification_updated_at = now()
FROM public.delivery_modes dm
WHERE dm.id = o.delivery_mode_id
  AND dm.code = 'open_self_paced'
  AND o.access_mode = 'open'
  AND o.learning_model IS NULL;

-- Cohort-Based + Blended: blended_cohort delivery mode (in_person + schedule
-- + attendance + travel + application flags), application-required access.
UPDATE public.course_offerings o
SET learning_model = 'cohort_based',
    delivery_format = 'blended',
    enrolment_access_rule = 'approval_required',
    classification_source = 'migration_backfill',
    classification_updated_at = now()
FROM public.delivery_modes dm
WHERE dm.id = o.delivery_mode_id
  AND dm.code = 'blended_cohort'
  AND o.access_mode = 'application-required'
  AND o.learning_model IS NULL;

-- 4. UNRESOLVED-ROW REPORT VIEW --------------------------------
CREATE OR REPLACE VIEW public.course_offering_classification_review_v AS
SELECT o.id AS course_offering_id,
       o.offering_code,
       o.offering_title,
       o.status,
       o.access_mode,
       dm.code AS delivery_mode_code,
       o.learning_engine_version
FROM public.course_offerings o
LEFT JOIN public.delivery_modes dm ON dm.id = o.delivery_mode_id
WHERE o.learning_model IS NULL
   OR o.delivery_format IS NULL
   OR o.enrolment_access_rule IS NULL;

REVOKE ALL ON public.course_offering_classification_review_v FROM anon, authenticated;
GRANT SELECT ON public.course_offering_classification_review_v TO service_role;

-- 5. COMBINATION + COMPLETENESS CONSTRAINTS --------------------
-- Partial (nullable-tolerant) so an unclassified legacy row stays operational
-- through the controlled compatibility path instead of breaking reads.
ALTER TABLE public.course_offerings
  DROP CONSTRAINT IF EXISTS course_offerings_classification_combo_chk;
ALTER TABLE public.course_offerings
  ADD CONSTRAINT course_offerings_classification_combo_chk
  CHECK (
    learning_model IS NULL
    OR delivery_format IS NULL
    OR (learning_model = 'self_paced'  AND delivery_format = 'fully_online')
    OR (learning_model = 'cohort_based' AND delivery_format IN ('fully_online','blended','in_person'))
  );

ALTER TABLE public.course_offerings
  DROP CONSTRAINT IF EXISTS course_offerings_classification_complete_chk;
ALTER TABLE public.course_offerings
  ADD CONSTRAINT course_offerings_classification_complete_chk
  CHECK (
    (learning_model IS NULL AND delivery_format IS NULL AND enrolment_access_rule IS NULL)
    OR (learning_model IS NOT NULL AND delivery_format IS NOT NULL AND enrolment_access_rule IS NOT NULL)
  );

-- 6. VENUE RULE RESOLVER (derived, never requester-editable) ---
CREATE OR REPLACE FUNCTION public.offering_venue_rule(
  _learning_model public.learning_model_v1,
  _delivery_format public.delivery_format_v1
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _learning_model IS NULL OR _delivery_format IS NULL
      THEN jsonb_build_object('physical_venue_required', false, 'components', '[]'::jsonb)
    WHEN _learning_model = 'self_paced'
      THEN jsonb_build_object('physical_venue_required', false, 'components', '[]'::jsonb)
    WHEN _delivery_format = 'fully_online'
      THEN jsonb_build_object('physical_venue_required', false,
             'components', jsonb_build_array(
               jsonb_build_object('label','Delivery Location','value','Online')))
    WHEN _delivery_format = 'in_person'
      THEN jsonb_build_object('physical_venue_required', true,
             'components', jsonb_build_array(
               jsonb_build_object('label','Training Location','value','Denpasar, Bali, Indonesia')))
    WHEN _delivery_format = 'blended'
      THEN jsonb_build_object('physical_venue_required', true,
             'components', jsonb_build_array(
               jsonb_build_object('label','Online Component','value','Online'),
               jsonb_build_object('label','In-Person Component','value','Denpasar, Bali, Indonesia')))
    ELSE jsonb_build_object('physical_venue_required', false, 'components', '[]'::jsonb)
  END;
$$;

-- 7. PUBLIC-SAFE CLASSIFICATION READ ---------------------------
-- Only offerings already authorized for public visibility (published/completed
-- offerings are already world-readable via the existing offerings_read policy).
CREATE OR REPLACE VIEW public.course_offering_classification_public_v AS
SELECT o.id AS course_offering_id,
       o.offering_code,
       o.offering_title,
       o.learning_model,
       o.delivery_format,
       o.enrolment_access_rule,
       public.offering_venue_rule(o.learning_model, o.delivery_format) AS venue_rule,
       o.classification_version
FROM public.course_offerings o;

GRANT SELECT ON public.course_offering_classification_public_v TO anon, authenticated, service_role;

-- 8. EVENT TAXONOMY EXTENSION ----------------------------------
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
    'offering_classification_updated'
  ]));

-- 9. BACKFILL AUDIT EVENTS (idempotent, origin=migration) ------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id, offering_code, learning_model, delivery_format, enrolment_access_rule
    FROM public.course_offerings
    WHERE classification_source = 'migration_backfill'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.platform_events
      WHERE event_type = 'offering_classification_updated'
        AND offering_id = r.id
        AND payload->>'origin' = 'migration'
    ) THEN
      PERFORM public.emit_platform_event(
        'offering_classification_updated', NULL, NULL,
        'course_offering', r.id::text, 'course_offering', NULL, NULL, NULL, r.id,
        jsonb_build_object(
          'origin','migration',
          'reason','phase_1_4_increment_1_backfill',
          'offering_code', r.offering_code,
          'previous', jsonb_build_object('learning_model', NULL, 'delivery_format', NULL, 'enrolment_access_rule', NULL),
          'next', jsonb_build_object('learning_model', r.learning_model,
                                     'delivery_format', r.delivery_format,
                                     'enrolment_access_rule', r.enrolment_access_rule)
        )
      );
    END IF;
  END LOOP;
END $$;

-- 10. AUTHORIZED WRITE BOUNDARY --------------------------------
CREATE OR REPLACE FUNCTION public.set_offering_classification(
  _offering_id uuid,
  _learning_model public.learning_model_v1,
  _delivery_format public.delivery_format_v1,
  _enrolment_access_rule public.enrolment_access_rule_v1,
  _expected_version integer DEFAULT NULL,
  _reason text DEFAULT NULL
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

  SELECT id, learning_model, delivery_format, enrolment_access_rule, classification_version
    INTO prev
  FROM public.course_offerings WHERE id = _offering_id FOR UPDATE;

  IF prev.id IS NULL THEN
    RAISE EXCEPTION 'Course Offering not found: %', _offering_id USING ERRCODE = 'no_data_found';
  END IF;

  IF _learning_model IS NULL OR _delivery_format IS NULL OR _enrolment_access_rule IS NULL THEN
    RAISE EXCEPTION 'learning_model, delivery_format and enrolment_access_rule are all required';
  END IF;

  IF _learning_model = 'self_paced' AND _delivery_format <> 'fully_online' THEN
    RAISE EXCEPTION 'Invalid combination: self_paced requires delivery_format=fully_online';
  END IF;

  IF _expected_version IS NOT NULL AND _expected_version <> prev.classification_version THEN
    RAISE EXCEPTION 'Stale classification update: expected version % but current is %',
      _expected_version, prev.classification_version USING ERRCODE = 'serialization_failure';
  END IF;

  newver := prev.classification_version + 1;

  UPDATE public.course_offerings
  SET learning_model = _learning_model,
      delivery_format = _delivery_format,
      enrolment_access_rule = _enrolment_access_rule,
      classification_version = newver,
      classification_source = 'operator',
      classification_updated_at = now(),
      classification_updated_by = auth.uid(),
      updated_at = now()
  WHERE id = _offering_id;

  PERFORM public.emit_platform_event(
    'offering_classification_updated', auth.uid(), NULL,
    'course_offering', _offering_id::text, 'course_offering', NULL, NULL, NULL, _offering_id,
    jsonb_build_object(
      'origin','operator',
      'reason', _reason,
      'previous', jsonb_build_object('learning_model', prev.learning_model,
                                     'delivery_format', prev.delivery_format,
                                     'enrolment_access_rule', prev.enrolment_access_rule),
      'next', jsonb_build_object('learning_model', _learning_model,
                                 'delivery_format', _delivery_format,
                                 'enrolment_access_rule', _enrolment_access_rule),
      'classification_version', newver
    )
  );

  RETURN jsonb_build_object(
    'course_offering_id', _offering_id,
    'learning_model', _learning_model,
    'delivery_format', _delivery_format,
    'enrolment_access_rule', _enrolment_access_rule,
    'classification_version', newver,
    'venue_rule', public.offering_venue_rule(_learning_model, _delivery_format)
  );
END $$;

REVOKE ALL ON FUNCTION public.set_offering_classification(uuid, public.learning_model_v1, public.delivery_format_v1, public.enrolment_access_rule_v1, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_offering_classification(uuid, public.learning_model_v1, public.delivery_format_v1, public.enrolment_access_rule_v1, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.offering_venue_rule(public.learning_model_v1, public.delivery_format_v1) TO anon, authenticated, service_role;