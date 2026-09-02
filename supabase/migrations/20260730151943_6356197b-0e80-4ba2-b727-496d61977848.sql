CREATE OR REPLACE FUNCTION public.set_cohort_payment_responsibility(_offering_id uuid, _responsibility cohort_payment_responsibility_v1, _expected_version integer DEFAULT NULL::integer, _reason text DEFAULT NULL::text, _source text DEFAULT 'operator'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prev record;
  newver integer;
  is_restamp boolean := false;
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
         cohort_payment_responsibility, cohort_payment_responsibility_version,
         cohort_payment_responsibility_source
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

  is_restamp := (prev.cohort_payment_responsibility IS NOT DISTINCT FROM _responsibility)
                AND _source = 'product_owner_confirmation'
                AND prev.cohort_payment_responsibility_source IS DISTINCT FROM 'product_owner_confirmation';

  IF prev.cohort_payment_responsibility IS NOT DISTINCT FROM _responsibility AND NOT is_restamp THEN
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
      'change_kind', CASE WHEN is_restamp THEN 'source_confirmation' ELSE 'value_change' END,
      'previous', prev.cohort_payment_responsibility,
      'next', _responsibility,
      'previous_source', prev.cohort_payment_responsibility_source,
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
END $function$;