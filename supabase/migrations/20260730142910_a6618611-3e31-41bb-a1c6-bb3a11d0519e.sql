CREATE OR REPLACE FUNCTION public.set_self_paced_access_model(_offering_id uuid, _access_model self_paced_access_model_v1, _expected_version integer DEFAULT NULL::integer, _reason text DEFAULT NULL::text)
 RETURNS jsonb
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

  -- Idempotency: re-applying the identical value is a no-op (no version bump, no event)
  IF prev.self_paced_access_model IS NOT DISTINCT FROM _access_model THEN
    RETURN jsonb_build_object(
      'course_offering_id', _offering_id,
      'self_paced_access_model', prev.self_paced_access_model,
      'self_paced_access_model_version', prev.self_paced_access_model_version,
      'no_op', true
    );
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