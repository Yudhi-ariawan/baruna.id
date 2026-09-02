-- Phase 1.4 Increment 2 — Self-Paced Access Model (additive)

DO $$ BEGIN
  CREATE TYPE public.self_paced_access_model_v1 AS ENUM ('free','paid','free_to_learn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.course_offerings
  ADD COLUMN IF NOT EXISTS self_paced_access_model public.self_paced_access_model_v1,
  ADD COLUMN IF NOT EXISTS self_paced_access_model_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS self_paced_access_model_source text NOT NULL DEFAULT 'migration_backfill',
  ADD COLUMN IF NOT EXISTS self_paced_access_model_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS self_paced_access_model_updated_by uuid;

ALTER TABLE public.course_offerings
  DROP CONSTRAINT IF EXISTS course_offerings_spam_source_chk;
ALTER TABLE public.course_offerings
  ADD CONSTRAINT course_offerings_spam_source_chk
  CHECK (self_paced_access_model_source IN ('migration_backfill','operator'));

-- Evidence-based backfill: both existing self-paced fully online offerings are
-- currently delivered with no payment of any kind (no fee/tariff/billing field
-- exists anywhere in the platform; certificates are issued without payment).
UPDATE public.course_offerings
SET self_paced_access_model = 'free',
    self_paced_access_model_source = 'migration_backfill',
    self_paced_access_model_updated_at = now()
WHERE learning_model = 'self_paced'
  AND delivery_format = 'fully_online'
  AND self_paced_access_model IS NULL;

UPDATE public.course_offerings
SET self_paced_access_model = NULL
WHERE learning_model = 'cohort_based'
  AND self_paced_access_model IS NOT NULL;

ALTER TABLE public.course_offerings
  DROP CONSTRAINT IF EXISTS course_offerings_self_paced_access_model_chk;
ALTER TABLE public.course_offerings
  ADD CONSTRAINT course_offerings_self_paced_access_model_chk CHECK (
    CASE
      WHEN learning_model = 'self_paced' AND delivery_format = 'fully_online'
        THEN self_paced_access_model IS NOT NULL
      WHEN learning_model = 'cohort_based'
        THEN self_paced_access_model IS NULL
      ELSE self_paced_access_model IS NULL
    END
  );

-- Event taxonomy (platform_event_type_v1 is a text domain)
DO $$
DECLARE cn text;
BEGIN
  FOR cn IN
    SELECT c.conname FROM pg_constraint c
    JOIN pg_type t ON t.oid = c.contypid
    WHERE t.typname = 'platform_event_type_v1'
  LOOP
    EXECUTE format('ALTER DOMAIN public.platform_event_type_v1 DROP CONSTRAINT %I', cn);
  END LOOP;
END $$;

ALTER DOMAIN public.platform_event_type_v1 ADD CONSTRAINT platform_event_type_v1_check CHECK (
  VALUE = ANY (ARRAY[
    'draft_created','submission_started','submission_submitted','review_assigned',
    'recommendation_submitted','decision_recorded','returned_for_revision','approved',
    'rejected','directly_published','registry_record_created','registry_record_updated',
    'registry_record_published','registry_record_archived','self_paced_alternative_presented',
    'self_paced_alternative_selected','self_paced_course_started',
    'training_request_avoided_by_existing_content','facilitated_training_requested',
    'training_need_converted_to_self_paced','training_need_converted_to_course_offering',
    'funding_preference_selected','funding_model_confirmed','zero_tariff_approved',
    'billing_requested','billing_issued','payment_confirmed','offering_classification_updated',
    'self_paced_access_model_updated'
  ]::text[])
);

-- Public view: classification only (no fee/payer/billing/operator data)
DROP VIEW IF EXISTS public.course_offering_classification_public_v;
CREATE VIEW public.course_offering_classification_public_v
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
       o.self_paced_access_model_version
FROM public.course_offerings o;

-- Authorized write boundary (admin/management only, optimistic concurrency)
CREATE OR REPLACE FUNCTION public.set_self_paced_access_model(
  _offering_id uuid,
  _access_model public.self_paced_access_model_v1,
  _expected_version integer DEFAULT NULL,
  _reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prev record;
  newver integer;
BEGIN
  PERFORM public._require_admin_or_mgmt();

  SELECT id, learning_model, delivery_format, self_paced_access_model,
         self_paced_access_model_version
    INTO prev
  FROM public.course_offerings WHERE id = _offering_id FOR UPDATE;

  IF prev.id IS NULL THEN
    RAISE EXCEPTION 'Course Offering not found: %', _offering_id;
  END IF;

  IF _access_model IS NULL THEN
    RAISE EXCEPTION 'self_paced_access_model is required';
  END IF;

  IF prev.learning_model IS DISTINCT FROM 'self_paced'
     OR prev.delivery_format IS DISTINCT FROM 'fully_online' THEN
    RAISE EXCEPTION 'self_paced_access_model applies only to self_paced + fully_online offerings';
  END IF;

  IF _expected_version IS NOT NULL
     AND _expected_version <> prev.self_paced_access_model_version THEN
    RAISE EXCEPTION 'Stale self-paced access model update: expected version % but current is %',
      _expected_version, prev.self_paced_access_model_version
      USING ERRCODE = '23514';
  END IF;

  newver := prev.self_paced_access_model_version + 1;

  UPDATE public.course_offerings
  SET self_paced_access_model = _access_model,
      self_paced_access_model_version = newver,
      self_paced_access_model_source = 'operator',
      self_paced_access_model_updated_at = now(),
      self_paced_access_model_updated_by = auth.uid(),
      updated_at = now()
  WHERE id = _offering_id;

  PERFORM public.emit_platform_event(
    'self_paced_access_model_updated', auth.uid(), NULL,
    'course_offering', _offering_id::text, 'course_offering', NULL, NULL, NULL, _offering_id,
    jsonb_build_object(
      'origin','operator',
      'reason', _reason,
      'previous', prev.self_paced_access_model,
      'next', _access_model,
      'self_paced_access_model_version', newver
    )
  );

  RETURN jsonb_build_object(
    'course_offering_id', _offering_id,
    'self_paced_access_model', _access_model,
    'self_paced_access_model_version', newver
  );
END $function$;

REVOKE ALL ON FUNCTION public.set_self_paced_access_model(uuid, public.self_paced_access_model_v1, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_self_paced_access_model(uuid, public.self_paced_access_model_v1, integer, text) TO authenticated, service_role;
