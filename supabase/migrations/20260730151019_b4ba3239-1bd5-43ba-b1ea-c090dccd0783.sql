-- 1. Domain
CREATE DOMAIN public.cohort_payment_responsibility_v1 AS text
  CHECK (VALUE = ANY (ARRAY['participant','institution','sponsor_or_partner','government_or_public_funding','cost_sharing','to_be_determined']));

-- 2. Extend platform event type domain
DO $$
DECLARE cname text;
BEGIN
  SELECT c.conname INTO cname FROM pg_constraint c JOIN pg_type t ON t.oid=c.contypid WHERE t.typname='platform_event_type_v1' LIMIT 1;
  EXECUTE format('ALTER DOMAIN public.platform_event_type_v1 DROP CONSTRAINT %I', cname);
  EXECUTE $q$ALTER DOMAIN public.platform_event_type_v1 ADD CONSTRAINT platform_event_type_v1_check CHECK (VALUE = ANY (ARRAY['draft_created','submission_started','submission_submitted','review_assigned','recommendation_submitted','decision_recorded','returned_for_revision','approved','rejected','directly_published','registry_record_created','registry_record_updated','registry_record_published','registry_record_archived','self_paced_alternative_presented','self_paced_alternative_selected','self_paced_course_started','training_request_avoided_by_existing_content','facilitated_training_requested','training_need_converted_to_self_paced','training_need_converted_to_course_offering','funding_preference_selected','funding_model_confirmed','zero_tariff_approved','billing_requested','billing_issued','payment_confirmed','offering_classification_updated','self_paced_access_model_updated','cohort_financial_model_updated','cohort_payment_responsibility_updated']))$q$;
END $$;

-- 3. Columns
ALTER TABLE public.course_offerings
  ADD COLUMN cohort_payment_responsibility public.cohort_payment_responsibility_v1,
  ADD COLUMN cohort_payment_responsibility_version integer NOT NULL DEFAULT 1,
  ADD COLUMN cohort_payment_responsibility_source text NOT NULL DEFAULT 'migration_backfill',
  ADD COLUMN cohort_payment_responsibility_updated_at timestamptz,
  ADD COLUMN cohort_payment_responsibility_updated_by uuid;

ALTER TABLE public.course_offerings
  ADD CONSTRAINT course_offerings_cpr_source_chk
  CHECK (cohort_payment_responsibility_source = ANY (ARRAY['migration_backfill','operator','product_owner_confirmation']));

-- 4. Evidence-based backfill (before enabling applicability constraint)
UPDATE public.course_offerings
   SET cohort_payment_responsibility = 'government_or_public_funding',
       cohort_payment_responsibility_source = 'migration_backfill',
       cohort_payment_responsibility_updated_at = now()
 WHERE id = 'f4644ee3-eb8f-4dca-88ca-2446c49cd739';

UPDATE public.course_offerings
   SET cohort_payment_responsibility = 'to_be_determined',
       cohort_payment_responsibility_source = 'migration_backfill',
       cohort_payment_responsibility_updated_at = now()
 WHERE id = '6a1c94b7-6396-4ea7-9959-e5eb18db1574';

UPDATE public.course_offerings
   SET cohort_payment_responsibility = 'to_be_determined',
       cohort_payment_responsibility_source = 'migration_backfill',
       cohort_payment_responsibility_updated_at = now()
 WHERE learning_model = 'cohort_based'
   AND cohort_financial_model = 'fee_based'
   AND cohort_payment_responsibility IS NULL;

UPDATE public.course_offerings
   SET cohort_payment_responsibility = NULL
 WHERE learning_model IS DISTINCT FROM 'cohort_based';

-- 5. Applicability constraint (two-valued, no NULL hole)
ALTER TABLE public.course_offerings
  ADD CONSTRAINT course_offerings_cohort_payment_responsibility_chk
  CHECK (
    CASE
      WHEN learning_model::text = 'cohort_based' AND cohort_financial_model::text = 'fee_based'
        THEN cohort_payment_responsibility IS NOT NULL
      ELSE cohort_payment_responsibility IS NULL
    END
  );

-- 6. Idempotent backfill events
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, cohort_payment_responsibility FROM public.course_offerings
            WHERE cohort_payment_responsibility IS NOT NULL LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.platform_events
       WHERE event_type = 'cohort_payment_responsibility_updated'
         AND offering_id = r.id
         AND payload->>'source' = 'migration_backfill'
    ) THEN
      PERFORM public.emit_platform_event(
        'cohort_payment_responsibility_updated', NULL, NULL,
        'course_offering', r.id::text, 'course_offering', NULL, NULL, NULL, r.id,
        jsonb_build_object(
          'origin','migration',
          'source','migration_backfill',
          'reason','Phase 1.4 Increment 4 evidence-based backfill',
          'previous', NULL,
          'next', r.cohort_payment_responsibility,
          'previous_version', 0,
          'cohort_payment_responsibility_version', 1
        )
      );
    END IF;
  END LOOP;
END $$;

-- 7. Public label resolver
CREATE OR REPLACE FUNCTION public.cohort_payment_responsibility_public_label(
  _learning_model text,
  _responsibility text
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _learning_model IS DISTINCT FROM 'cohort_based' THEN NULL
    WHEN _responsibility = 'participant' THEN 'Payment Required'
    WHEN _responsibility = 'institution' THEN 'Participation Fee Covered by Institution'
    WHEN _responsibility = 'sponsor_or_partner' THEN 'Sponsored Participation'
    WHEN _responsibility = 'government_or_public_funding' THEN 'Funded Participation'
    WHEN _responsibility = 'cost_sharing' THEN 'Cost Sharing'
    WHEN _responsibility = 'to_be_determined' THEN 'Funding Arrangement to Be Confirmed'
    ELSE NULL
  END
$$;

-- 8. Controlled write boundary
CREATE OR REPLACE FUNCTION public.set_cohort_payment_responsibility(
  _offering_id uuid,
  _responsibility public.cohort_payment_responsibility_v1,
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

  IF _responsibility IS NULL THEN
    RAISE EXCEPTION 'cohort_payment_responsibility is required';
  END IF;

  SELECT id, learning_model, cohort_financial_model,
         cohort_payment_responsibility, cohort_payment_responsibility_version
    INTO prev
  FROM public.course_offerings WHERE id = _offering_id FOR UPDATE;

  IF prev.id IS NULL THEN
    RAISE EXCEPTION 'Course Offering not found: %', _offering_id;
  END IF;

  IF prev.learning_model IS DISTINCT FROM 'cohort_based' THEN
    RAISE EXCEPTION 'cohort_payment_responsibility applies only to cohort_based offerings';
  END IF;

  IF prev.cohort_financial_model IS DISTINCT FROM 'fee_based' THEN
    RAISE EXCEPTION 'cohort_payment_responsibility requires cohort_financial_model = fee_based';
  END IF;

  IF _expected_version IS NOT NULL
     AND _expected_version <> prev.cohort_payment_responsibility_version THEN
    RAISE EXCEPTION 'Stale cohort payment responsibility update: expected version % but current is %',
      _expected_version, prev.cohort_payment_responsibility_version
      USING ERRCODE = '23514';
  END IF;

  IF prev.cohort_payment_responsibility IS NOT DISTINCT FROM _responsibility THEN
    RETURN jsonb_build_object(
      'course_offering_id', _offering_id,
      'cohort_payment_responsibility', prev.cohort_payment_responsibility,
      'cohort_payment_responsibility_version', prev.cohort_payment_responsibility_version,
      'no_op', true
    );
  END IF;

  newver := prev.cohort_payment_responsibility_version + 1;

  UPDATE public.course_offerings
     SET cohort_payment_responsibility = _responsibility,
         cohort_payment_responsibility_version = newver,
         cohort_payment_responsibility_source = _source,
         cohort_payment_responsibility_updated_at = now(),
         cohort_payment_responsibility_updated_by = auth.uid(),
         updated_at = now()
   WHERE id = _offering_id;

  PERFORM public.emit_platform_event(
    'cohort_payment_responsibility_updated', auth.uid(), NULL,
    'course_offering', _offering_id::text, 'course_offering', NULL, NULL, NULL, _offering_id,
    jsonb_build_object(
      'origin','operator',
      'source', _source,
      'reason', _reason,
      'previous', prev.cohort_payment_responsibility,
      'next', _responsibility,
      'previous_version', prev.cohort_payment_responsibility_version,
      'cohort_payment_responsibility_version', newver
    )
  );

  RETURN jsonb_build_object(
    'course_offering_id', _offering_id,
    'cohort_payment_responsibility', _responsibility,
    'cohort_payment_responsibility_version', newver,
    'no_op', false
  );
END $$;

REVOKE ALL ON FUNCTION public.set_cohort_payment_responsibility(uuid, public.cohort_payment_responsibility_v1, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_cohort_payment_responsibility(uuid, public.cohort_payment_responsibility_v1, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cohort_payment_responsibility_public_label(text, text) TO anon, authenticated, service_role;

-- 9. Views (append-only columns; security_invoker preserved)
CREATE OR REPLACE VIEW public.course_offering_classification_public_v
WITH (security_invoker = true) AS
SELECT o.id AS course_offering_id,
       o.offering_code,
       o.offering_title,
       o.learning_model,
       o.delivery_format,
       o.enrolment_access_rule,
       o.self_paced_access_model,
       public.offering_venue_rule(o.learning_model, o.delivery_format) AS venue_rule,
       o.classification_version,
       o.self_paced_access_model_version,
       public.cohort_payment_responsibility_public_label(o.learning_model::text, o.cohort_payment_responsibility::text) AS payment_responsibility_label
  FROM public.course_offerings o;

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
       o.cohort_financial_model_updated_at,
       o.cohort_payment_responsibility,
       o.cohort_payment_responsibility_version,
       o.cohort_payment_responsibility_source,
       o.cohort_payment_responsibility_updated_at
  FROM public.course_offerings o
 WHERE public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'management'::app_role);