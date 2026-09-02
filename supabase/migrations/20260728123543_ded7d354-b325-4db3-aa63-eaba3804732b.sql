
-- =====================================================================
-- Phase 1.3 — Increment 2: Experts Canonical Registry & Intake
-- =====================================================================

-- ---------- Shared enums ---------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.registry_status_v1 AS ENUM (
    'draft','submitted','under_review','changes_requested',
    'approved','published','rejected','withdrawn','archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.registry_visibility_v1 AS ENUM ('public','restricted','private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_status_v1 AS ENUM (
    'unverified','self_declared','institutionally_verified','governance_verified'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- experts (canonical) --------------------------------------
CREATE TABLE public.experts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Shared provenance header (§B)
  source_type public.source_type_v1 NOT NULL,
  source_submission_id uuid,
  source_institution_id uuid,
  original_contributor_id uuid,
  created_by uuid NOT NULL,
  approved_by uuid,
  published_by uuid,
  approval_date timestamptz,
  publication_date timestamptz,
  verification_status public.verification_status_v1 NOT NULL DEFAULT 'self_declared',
  visibility public.registry_visibility_v1 NOT NULL DEFAULT 'private',
  version integer NOT NULL DEFAULT 1,
  previous_version_id uuid REFERENCES public.experts(id),
  current_status public.registry_status_v1 NOT NULL DEFAULT 'draft',
  audit_ref uuid,

  -- Profile
  display_name text NOT NULL,
  headline text,
  bio text,
  country text,
  city text,
  languages text[] NOT NULL DEFAULT '{}',
  expertise_areas text[] NOT NULL DEFAULT '{}',
  orcid text,
  personal_url text,
  avatar_url text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX experts_status_idx ON public.experts(current_status);
CREATE INDEX experts_owner_idx ON public.experts(created_by);
CREATE INDEX experts_visibility_idx ON public.experts(visibility);

GRANT SELECT, INSERT, UPDATE ON public.experts TO authenticated;
GRANT ALL ON public.experts TO service_role;

ALTER TABLE public.experts ENABLE ROW LEVEL SECURITY;

CREATE POLICY experts_owner_read ON public.experts
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY experts_governance_read ON public.experts
  FOR SELECT TO authenticated
  USING (public.has_any_governance_role(auth.uid()));

CREATE POLICY experts_owner_insert ON public.experts
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND current_status = 'draft');

-- Owner may only edit own draft/changes_requested rows via RPC; direct UPDATE limited
CREATE POLICY experts_owner_update_draft ON public.experts
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND current_status IN ('draft','changes_requested'))
  WITH CHECK (created_by = auth.uid() AND current_status IN ('draft','changes_requested','submitted','withdrawn'));

CREATE TRIGGER experts_touch BEFORE UPDATE ON public.experts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

-- ---------- Child tables ---------------------------------------------
CREATE TABLE public.expert_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  degree text NOT NULL,
  field text,
  institution text NOT NULL,
  year integer,
  visibility public.registry_visibility_v1 NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expert_education_expert_idx ON public.expert_education(expert_id);

CREATE TABLE public.expert_employment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  role text NOT NULL,
  organization text NOT NULL,
  start_year integer,
  end_year integer,
  is_current boolean NOT NULL DEFAULT false,
  visibility public.registry_visibility_v1 NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expert_employment_expert_idx ON public.expert_employment(expert_id);

CREATE TABLE public.expert_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  name text NOT NULL,
  issuer text,
  year integer,
  reference text,
  visibility public.registry_visibility_v1 NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expert_certifications_expert_idx ON public.expert_certifications(expert_id);

CREATE TABLE public.expert_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  title text NOT NULL,
  venue text,
  year integer,
  url text,
  visibility public.registry_visibility_v1 NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expert_publications_expert_idx ON public.expert_publications(expert_id);

CREATE TABLE public.expert_contact_private (
  expert_id uuid PRIMARY KEY REFERENCES public.experts(id) ON DELETE CASCADE,
  email text,
  phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grants for children
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_education TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_employment TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_certifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_publications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_contact_private TO authenticated;
GRANT ALL ON public.expert_education TO service_role;
GRANT ALL ON public.expert_employment TO service_role;
GRANT ALL ON public.expert_certifications TO service_role;
GRANT ALL ON public.expert_publications TO service_role;
GRANT ALL ON public.expert_contact_private TO service_role;

ALTER TABLE public.expert_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_employment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_contact_private ENABLE ROW LEVEL SECURITY;

-- Child policies: owner (via parent) full manage, governance read
CREATE OR REPLACE FUNCTION public._expert_is_owner(_expert_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.experts e WHERE e.id = _expert_id AND e.created_by = auth.uid())
$$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['expert_education','expert_employment','expert_certifications','expert_publications']
  LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
        USING (public._expert_is_owner(expert_id) OR public.has_any_governance_role(auth.uid()));
    $f$, t||'_read', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR ALL TO authenticated
        USING (public._expert_is_owner(expert_id))
        WITH CHECK (public._expert_is_owner(expert_id));
    $f$, t||'_owner_manage', t);
  END LOOP;
END $$;

-- Contact private: owner + admin/management only (NOT qa_reviewer)
CREATE POLICY expert_contact_private_owner ON public.expert_contact_private
  FOR ALL TO authenticated
  USING (public._expert_is_owner(expert_id))
  WITH CHECK (public._expert_is_owner(expert_id));

CREATE POLICY expert_contact_private_admin_read ON public.expert_contact_private
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

CREATE TRIGGER expert_education_touch BEFORE UPDATE ON public.expert_education
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();
CREATE TRIGGER expert_employment_touch BEFORE UPDATE ON public.expert_employment
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();
CREATE TRIGGER expert_certifications_touch BEFORE UPDATE ON public.expert_certifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();
CREATE TRIGGER expert_publications_touch BEFORE UPDATE ON public.expert_publications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();
CREATE TRIGGER expert_contact_private_touch BEFORE UPDATE ON public.expert_contact_private
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

-- ---------- Public read view -----------------------------------------
CREATE OR REPLACE VIEW public.experts_public_v AS
SELECT
  e.id, e.display_name, e.headline, e.bio, e.country, e.city,
  e.languages, e.expertise_areas, e.orcid, e.personal_url, e.avatar_url,
  e.verification_status, e.version, e.publication_date,
  e.created_at, e.updated_at
FROM public.experts e
WHERE e.current_status = 'published'
  AND e.visibility = 'public'
  AND e.verification_status IN ('institutionally_verified','governance_verified','self_declared');

GRANT SELECT ON public.experts_public_v TO anon, authenticated;

-- ---------- RPCs -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.expert_draft_create(
  _display_name text,
  _source_type public.source_type_v1 DEFAULT 'external_submission'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _display_name IS NULL OR length(trim(_display_name)) = 0 THEN
    RAISE EXCEPTION 'display_name_required';
  END IF;

  INSERT INTO public.experts (source_type, created_by, original_contributor_id, display_name)
  VALUES (_source_type, v_uid, v_uid, _display_name)
  RETURNING id INTO v_id;

  PERFORM public.emit_platform_event(
    'draft_created'::public.platform_event_type_v1,
    v_uid, v_id, 'expert', v_id::text, 'experts', _source_type, NULL, v_id, NULL,
    jsonb_build_object('display_name', _display_name)
  );
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.expert_draft_update(
  _expert_id uuid,
  _patch jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.experts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.experts WHERE id = _expert_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'expert_not_found'; END IF;
  IF v_row.created_by <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.current_status NOT IN ('draft','changes_requested') THEN
    RAISE EXCEPTION 'expert_not_editable';
  END IF;
  IF _patch ? 'approved_zero_tariff' THEN
    RAISE EXCEPTION 'zero_tariff_not_permitted';
  END IF;

  UPDATE public.experts SET
    display_name    = COALESCE(_patch->>'display_name', display_name),
    headline        = COALESCE(_patch->>'headline', headline),
    bio             = COALESCE(_patch->>'bio', bio),
    country         = COALESCE(_patch->>'country', country),
    city            = COALESCE(_patch->>'city', city),
    orcid           = COALESCE(_patch->>'orcid', orcid),
    personal_url    = COALESCE(_patch->>'personal_url', personal_url),
    avatar_url      = COALESCE(_patch->>'avatar_url', avatar_url),
    languages       = COALESCE(
      CASE WHEN _patch ? 'languages' THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'languages')) END,
      languages),
    expertise_areas = COALESCE(
      CASE WHEN _patch ? 'expertise_areas' THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'expertise_areas')) END,
      expertise_areas)
  WHERE id = _expert_id;

  PERFORM public.emit_platform_event(
    'registry_record_updated'::public.platform_event_type_v1,
    v_uid, _expert_id, 'expert', _expert_id::text, 'experts', v_row.source_type,
    NULL, _expert_id, NULL,
    jsonb_build_object('patch_keys', (SELECT jsonb_agg(k) FROM jsonb_object_keys(_patch) k))
  );
END $$;

CREATE OR REPLACE FUNCTION public.expert_draft_submit(_expert_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.experts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.experts WHERE id = _expert_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'expert_not_found'; END IF;
  IF v_row.created_by <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.current_status NOT IN ('draft','changes_requested') THEN
    RAISE EXCEPTION 'expert_not_submittable';
  END IF;

  UPDATE public.experts SET current_status = 'submitted' WHERE id = _expert_id;

  PERFORM public.emit_platform_event(
    'submission_submitted'::public.platform_event_type_v1,
    v_uid, _expert_id, 'expert', _expert_id::text, 'experts', v_row.source_type,
    NULL, _expert_id, NULL, '{}'::jsonb
  );
END $$;

CREATE OR REPLACE FUNCTION public.expert_publish_direct(
  _expert_id uuid,
  _visibility public.registry_visibility_v1 DEFAULT 'public',
  _verification public.verification_status_v1 DEFAULT 'governance_verified',
  _rationale text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.experts%ROWTYPE;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT * INTO v_row FROM public.experts WHERE id = _expert_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'expert_not_found'; END IF;
  IF v_row.current_status = 'published' THEN
    -- idempotent
    RETURN;
  END IF;

  UPDATE public.experts SET
    current_status = 'published',
    visibility = _visibility,
    verification_status = _verification,
    approved_by = COALESCE(approved_by, v_uid),
    published_by = v_uid,
    approval_date = COALESCE(approval_date, now()),
    publication_date = now()
  WHERE id = _expert_id;

  PERFORM public.emit_platform_event(
    'directly_published'::public.platform_event_type_v1,
    v_uid, _expert_id, 'expert', _expert_id::text, 'experts', v_row.source_type,
    NULL, _expert_id, NULL,
    jsonb_build_object('rationale', _rationale, 'visibility', _visibility, 'verification', _verification)
  );
  PERFORM public.emit_platform_event(
    'registry_record_published'::public.platform_event_type_v1,
    v_uid, _expert_id, 'expert', _expert_id::text, 'experts', v_row.source_type,
    NULL, _expert_id, NULL, '{}'::jsonb
  );
END $$;

CREATE OR REPLACE FUNCTION public.expert_publish_from_decision(
  _expert_id uuid,
  _decision_id uuid,
  _visibility public.registry_visibility_v1 DEFAULT 'public',
  _verification public.verification_status_v1 DEFAULT 'governance_verified'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.experts%ROWTYPE; v_dec public.review_decisions%ROWTYPE;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT * INTO v_dec FROM public.review_decisions WHERE id = _decision_id;
  IF v_dec.id IS NULL OR v_dec.decision <> 'approve' THEN
    RAISE EXCEPTION 'decision_not_approve';
  END IF;
  SELECT * INTO v_row FROM public.experts WHERE id = _expert_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'expert_not_found'; END IF;
  IF v_row.current_status = 'published' THEN RETURN; END IF;

  UPDATE public.experts SET
    current_status = 'published',
    visibility = _visibility,
    verification_status = _verification,
    approved_by = v_dec.decided_by,
    published_by = v_uid,
    approval_date = v_dec.decided_at,
    publication_date = now(),
    audit_ref = _decision_id
  WHERE id = _expert_id;

  PERFORM public.emit_platform_event(
    'approved'::public.platform_event_type_v1,
    v_uid, _expert_id, 'expert', _expert_id::text, 'experts', v_row.source_type,
    NULL, _expert_id, NULL, jsonb_build_object('decision_id', _decision_id)
  );
  PERFORM public.emit_platform_event(
    'registry_record_published'::public.platform_event_type_v1,
    v_uid, _expert_id, 'expert', _expert_id::text, 'experts', v_row.source_type,
    NULL, _expert_id, NULL, '{}'::jsonb
  );
END $$;

CREATE OR REPLACE FUNCTION public.expert_archive(_expert_id uuid, _rationale text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.experts%ROWTYPE;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT * INTO v_row FROM public.experts WHERE id = _expert_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'expert_not_found'; END IF;
  UPDATE public.experts SET current_status = 'archived' WHERE id = _expert_id;
  PERFORM public.emit_platform_event(
    'registry_record_archived'::public.platform_event_type_v1,
    v_uid, _expert_id, 'expert', _expert_id::text, 'experts', v_row.source_type,
    NULL, _expert_id, NULL, jsonb_build_object('rationale', _rationale)
  );
END $$;

-- Lock down direct execution: allow only authenticated (owner ops) and admin/mgmt via checks
REVOKE ALL ON FUNCTION public.expert_draft_create(text, public.source_type_v1) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expert_draft_update(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expert_draft_submit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expert_publish_direct(uuid, public.registry_visibility_v1, public.verification_status_v1, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expert_publish_from_decision(uuid, uuid, public.registry_visibility_v1, public.verification_status_v1) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expert_archive(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.expert_draft_create(text, public.source_type_v1) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expert_draft_update(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expert_draft_submit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expert_publish_direct(uuid, public.registry_visibility_v1, public.verification_status_v1, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expert_publish_from_decision(uuid, uuid, public.registry_visibility_v1, public.verification_status_v1) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expert_archive(uuid, text) TO authenticated;
