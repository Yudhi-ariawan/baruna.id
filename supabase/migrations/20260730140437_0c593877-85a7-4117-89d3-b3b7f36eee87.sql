-- Phase 1.4 Increment 2 corrective run: AZA product-owner confirmation

ALTER TABLE public.course_offerings
  DROP CONSTRAINT IF EXISTS course_offerings_spam_source_chk;
ALTER TABLE public.course_offerings
  ADD CONSTRAINT course_offerings_spam_source_chk
  CHECK (self_paced_access_model_source IN ('migration_backfill','operator','product_owner_confirmation'));

DO $$
DECLARE
  v_offering uuid;
  v_prev public.self_paced_access_model_v1;
  v_prev_ver integer;
  v_new_ver integer;
  v_actor uuid;
BEGIN
  -- The historical operator may not exist when provisioning a fresh project.
  SELECT id INTO v_actor FROM auth.users
  WHERE id = 'efc6743c-92e5-4932-a9a0-2acec2428c53';

  SELECT id, self_paced_access_model, self_paced_access_model_version
    INTO v_offering, v_prev, v_prev_ver
  FROM public.course_offerings
  WHERE offering_code = 'of-aza-open-2026'
  FOR UPDATE;

  IF v_offering IS NULL THEN
    RAISE EXCEPTION 'AZA offering not found';
  END IF;

  -- Idempotent: only act when the value is still the backfilled 'free'.
  IF v_prev IS DISTINCT FROM 'free' THEN
    RAISE NOTICE 'AZA already corrected (current=%); no change, no event.', v_prev;
    RETURN;
  END IF;

  v_new_ver := v_prev_ver + 1;

  UPDATE public.course_offerings
  SET self_paced_access_model = 'free_to_learn',
      self_paced_access_model_version = v_new_ver,
      self_paced_access_model_source = 'product_owner_confirmation',
      self_paced_access_model_updated_at = now(),
      self_paced_access_model_updated_by = v_actor,
      updated_at = now()
  WHERE id = v_offering;

  PERFORM public.emit_platform_event(
    'self_paced_access_model_updated', v_actor, NULL,
    'course_offering', v_offering::text, 'course_offering', NULL, NULL, NULL, v_offering,
    jsonb_build_object(
      'origin', 'product_owner_confirmation',
      'offering_code', 'of-aza-open-2026',
      'reason', 'AZA learning access is free; certificate is available for a fee',
      'previous', 'free',
      'next', 'free_to_learn',
      'previous_self_paced_access_model_version', v_prev_ver,
      'self_paced_access_model_version', v_new_ver
    )
  );
END $$;
