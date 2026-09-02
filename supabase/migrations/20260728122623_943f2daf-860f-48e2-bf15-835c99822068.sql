-- =====================================================================
-- PHASE 1.3 INCREMENT 1 — Shared Foundation
-- Baseline: PHASE-1.2-GOVERNANCE-OPERATIONS-PASSED
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Shared source_type vocabulary (as domain, reusable by all registries)
-- ---------------------------------------------------------------------
CREATE DOMAIN public.source_type_v1 AS text
  CHECK (VALUE IN (
    'admin_direct',
    'admin_entry',
    'admin_import',
    'bulk_import',
    'institutional_intake',
    'external_submission',
    'invited_contributor',
    'system_sync',
    'migration_legacy'
  ));

COMMENT ON DOMAIN public.source_type_v1 IS
  'Phase 1.3 shared provenance vocabulary — differentiates canonical registry rows by intake channel.';

-- ---------------------------------------------------------------------
-- 2. Shared platform_event_type vocabulary
--    Declared names include future-only events that MUST NOT be emitted
--    by Phase 1.3 code (funding_model_confirmed, zero_tariff_approved,
--    billing_requested, billing_issued, payment_confirmed).
-- ---------------------------------------------------------------------
CREATE DOMAIN public.platform_event_type_v1 AS text
  CHECK (VALUE IN (
    -- lifecycle
    'draft_created',
    'submission_started',
    'submission_submitted',
    'review_assigned',
    'recommendation_submitted',
    'decision_recorded',
    'returned_for_revision',
    'approved',
    'rejected',
    'directly_published',
    -- registry
    'registry_record_created',
    'registry_record_updated',
    'registry_record_published',
    'registry_record_archived',
    -- self-paced / facilitated / funding
    'self_paced_alternative_presented',
    'self_paced_alternative_selected',
    'self_paced_course_started',
    'training_request_avoided_by_existing_content',
    'facilitated_training_requested',
    'training_need_converted_to_self_paced',
    'training_need_converted_to_course_offering',
    'funding_preference_selected',
    -- future-only (declared, NOT emitted in Phase 1.3)
    'funding_model_confirmed',
    'zero_tariff_approved',
    'billing_requested',
    'billing_issued',
    'payment_confirmed'
  ));

COMMENT ON DOMAIN public.platform_event_type_v1 IS
  'Phase 1.3 shared event vocabulary. Future-only values (funding_model_confirmed, zero_tariff_approved, billing_requested, billing_issued, payment_confirmed) are declared but MUST NOT be emitted by Phase 1.3 code.';

-- ---------------------------------------------------------------------
-- 3. Append-only platform_events table
-- ---------------------------------------------------------------------
CREATE TABLE public.platform_events (
  id             uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  event_type     public.platform_event_type_v1 NOT NULL,
  actor_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_id     uuid,
  entity_type    text,
  entity_id      text,
  domain         text,
  source_type    public.source_type_v1,
  submission_id  uuid,
  registry_id    uuid,
  offering_id    uuid,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_events_event_type ON public.platform_events(event_type);
CREATE INDEX idx_platform_events_subject    ON public.platform_events(subject_id);
CREATE INDEX idx_platform_events_actor      ON public.platform_events(actor_id);
CREATE INDEX idx_platform_events_domain     ON public.platform_events(domain);
CREATE INDEX idx_platform_events_created_at ON public.platform_events(created_at DESC);
CREATE INDEX idx_platform_events_entity     ON public.platform_events(entity_type, entity_id);

COMMENT ON TABLE public.platform_events IS
  'Phase 1.3 append-only analytics substrate. Emitted by Phase 1.3 pipelines only; no retrofit of Phase 1.1/1.2 RPCs.';

-- GRANTs (append-only; writes via SECURITY DEFINER emitter only)
GRANT SELECT ON public.platform_events TO authenticated;
GRANT ALL    ON public.platform_events TO service_role;

-- RLS
ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;

-- Governance roles can read all
CREATE POLICY "platform_events_read_governance"
  ON public.platform_events
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'management')
    OR public.has_role(auth.uid(), 'qa_reviewer')
  );

-- Regular users can read events where they are actor or subject
CREATE POLICY "platform_events_read_own"
  ON public.platform_events
  FOR SELECT
  TO authenticated
  USING (
    actor_id = auth.uid()
    OR subject_id = auth.uid()
  );

-- No INSERT/UPDATE/DELETE policies → append-only via SECURITY DEFINER only.

-- ---------------------------------------------------------------------
-- 4. Shared lifecycle helper for updated_at on future 1.3 tables
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at_shared()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.touch_updated_at_shared() IS
  'Phase 1.3 shared updated_at maintenance trigger for future canonical registry tables.';

-- ---------------------------------------------------------------------
-- 5. Emit helper — SECURITY DEFINER, search_path=public, EXECUTE locked down
--    Callable only from other Phase 1.3 SECURITY DEFINER RPCs (later increments).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_platform_event(
  _event_type    public.platform_event_type_v1,
  _actor_id      uuid    DEFAULT NULL,
  _subject_id    uuid    DEFAULT NULL,
  _entity_type   text    DEFAULT NULL,
  _entity_id     text    DEFAULT NULL,
  _domain        text    DEFAULT NULL,
  _source_type   public.source_type_v1 DEFAULT NULL,
  _submission_id uuid    DEFAULT NULL,
  _registry_id   uuid    DEFAULT NULL,
  _offering_id   uuid    DEFAULT NULL,
  _payload       jsonb   DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
BEGIN
  -- Hard guard: refuse future-only event names in Phase 1.3.
  IF _event_type IN (
    'funding_model_confirmed',
    'zero_tariff_approved',
    'billing_requested',
    'billing_issued',
    'payment_confirmed'
  ) THEN
    RAISE EXCEPTION
      'platform event % is declared for future phases and must not be emitted in Phase 1.3',
      _event_type
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.platform_events (
    event_type, actor_id, subject_id, entity_type, entity_id,
    domain, source_type, submission_id, registry_id, offering_id, payload
  )
  VALUES (
    _event_type, _actor_id, _subject_id, _entity_type, _entity_id,
    _domain, _source_type, _submission_id, _registry_id, _offering_id,
    COALESCE(_payload, '{}'::jsonb)
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

COMMENT ON FUNCTION public.emit_platform_event IS
  'Phase 1.3 append-only event emitter. Intended for use by Phase 1.3 SECURITY DEFINER RPCs only. Refuses future-only event names.';

-- Lock down direct execution — later 1.3 RPCs invoke this via SECURITY DEFINER chain.
REVOKE ALL ON FUNCTION public.emit_platform_event(
  public.platform_event_type_v1, uuid, uuid, text, text, text,
  public.source_type_v1, uuid, uuid, uuid, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emit_platform_event(
  public.platform_event_type_v1, uuid, uuid, text, text, text,
  public.source_type_v1, uuid, uuid, uuid, jsonb
) FROM anon;
REVOKE ALL ON FUNCTION public.emit_platform_event(
  public.platform_event_type_v1, uuid, uuid, text, text, text,
  public.source_type_v1, uuid, uuid, uuid, jsonb
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.emit_platform_event(
  public.platform_event_type_v1, uuid, uuid, text, text, text,
  public.source_type_v1, uuid, uuid, uuid, jsonb
) TO service_role;
