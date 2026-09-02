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
    RAISE EXCEPTION 'Course Offering not found: %', _offering_id;
  END IF;

  IF _learning_model IS NULL OR _delivery_format IS NULL OR _enrolment_access_rule IS NULL THEN
    RAISE EXCEPTION 'learning_model, delivery_format and enrolment_access_rule are all required';
  END IF;

  IF _learning_model = 'self_paced' AND _delivery_format <> 'fully_online' THEN
    RAISE EXCEPTION 'Invalid combination: self_paced requires delivery_format=fully_online';
  END IF;

  IF _expected_version IS NOT NULL AND _expected_version <> prev.classification_version THEN
    RAISE EXCEPTION 'Stale classification update: expected version % but current is %',
      _expected_version, prev.classification_version;
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