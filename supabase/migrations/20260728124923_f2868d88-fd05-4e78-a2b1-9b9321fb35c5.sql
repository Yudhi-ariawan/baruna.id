
-- =========================================================
-- Phase 1.3 Increment 2b — Expert Digital Identity
-- Additive only. Preserves all Increment 2 objects.
-- =========================================================

-- 0. Enums
DO $$ BEGIN
  CREATE TYPE public.language_proficiency_v1 AS ENUM ('A1','A2','B1','B2','C1','C2','native');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.availability_status_v1 AS ENUM ('available','limited','unavailable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.trainer_status_v1 AS ENUM ('candidate','active','inactive','suspended','retired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.trainer_level_v1 AS ENUM ('not_assigned','certified','advanced','senior','master');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.expertise_proficiency_v1 AS ENUM ('novice','intermediate','proficient','expert','authority');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- 1. Expertise taxonomy
-- =========================================================
CREATE TABLE public.expertise_taxonomy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.expertise_taxonomy(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  domain text,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.expertise_taxonomy TO anon, authenticated;
GRANT ALL ON public.expertise_taxonomy TO service_role;
ALTER TABLE public.expertise_taxonomy ENABLE ROW LEVEL SECURITY;
CREATE POLICY expertise_taxonomy_read ON public.expertise_taxonomy FOR SELECT USING (true);
CREATE POLICY expertise_taxonomy_admin_write ON public.expertise_taxonomy FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE TRIGGER trg_expertise_taxonomy_touch BEFORE UPDATE ON public.expertise_taxonomy
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

INSERT INTO public.expertise_taxonomy (code, name, domain, display_order) VALUES
  ('fisheries_management','Fisheries Management','marine_fisheries',10),
  ('aquaculture','Aquaculture','marine_fisheries',20),
  ('marine_conservation','Marine Conservation','marine_fisheries',30),
  ('blue_economy','Blue Economy','marine_fisheries',40),
  ('climate_change','Climate Change','marine_fisheries',50),
  ('ocean_governance','Ocean Governance','marine_fisheries',60),
  ('marine_spatial_planning','Marine Spatial Planning','marine_fisheries',70),
  ('fisheries_surveillance','Fisheries Surveillance','marine_fisheries',80),
  ('fish_processing_value_addition','Fish Processing and Value Addition','marine_fisheries',90);

-- Helper for child-table RLS
CREATE OR REPLACE FUNCTION public._expert_child_read(_expert_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public._expert_is_owner(_expert_id)
      OR public.has_any_governance_role(auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public._expert_child_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._expert_child_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._expert_child_write(_expert_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public._expert_is_owner(_expert_id)
      OR public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'management')
$$;
REVOKE EXECUTE ON FUNCTION public._expert_child_write(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._expert_child_write(uuid) TO authenticated;

-- =========================================================
-- 2. expert_expertise
-- =========================================================
CREATE TABLE public.expert_expertise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  expertise_taxonomy_id uuid NOT NULL REFERENCES public.expertise_taxonomy(id) ON DELETE RESTRICT,
  proficiency public.expertise_proficiency_v1 NOT NULL DEFAULT 'proficient',
  years_experience integer,
  primary_expertise boolean NOT NULL DEFAULT false,
  evidence_ref text,
  visibility public.registry_visibility_v1 NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expert_id, expertise_taxonomy_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_expertise TO authenticated;
GRANT ALL ON public.expert_expertise TO service_role;
ALTER TABLE public.expert_expertise ENABLE ROW LEVEL SECURITY;
CREATE POLICY expert_expertise_read ON public.expert_expertise FOR SELECT TO authenticated USING (public._expert_child_read(expert_id));
CREATE POLICY expert_expertise_write ON public.expert_expertise FOR ALL TO authenticated
  USING (public._expert_child_write(expert_id)) WITH CHECK (public._expert_child_write(expert_id));
CREATE TRIGGER trg_expert_expertise_touch BEFORE UPDATE ON public.expert_expertise
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

-- =========================================================
-- 3. expert_languages
-- =========================================================
CREATE TABLE public.expert_languages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  language_code text NOT NULL,
  language_name text NOT NULL,
  proficiency_level public.language_proficiency_v1 NOT NULL,
  visibility public.registry_visibility_v1 NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expert_id, language_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_languages TO authenticated;
GRANT ALL ON public.expert_languages TO service_role;
ALTER TABLE public.expert_languages ENABLE ROW LEVEL SECURITY;
CREATE POLICY expert_languages_read ON public.expert_languages FOR SELECT TO authenticated USING (public._expert_child_read(expert_id));
CREATE POLICY expert_languages_write ON public.expert_languages FOR ALL TO authenticated
  USING (public._expert_child_write(expert_id)) WITH CHECK (public._expert_child_write(expert_id));
CREATE TRIGGER trg_expert_languages_touch BEFORE UPDATE ON public.expert_languages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

-- =========================================================
-- 4. expert_geographic_experience
-- =========================================================
CREATE TABLE public.expert_geographic_experience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  country_name text NOT NULL,
  region text,
  start_year integer,
  end_year integer,
  years_experience integer,
  expertise_context text,
  visibility public.registry_visibility_v1 NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_geographic_experience TO authenticated;
GRANT ALL ON public.expert_geographic_experience TO service_role;
ALTER TABLE public.expert_geographic_experience ENABLE ROW LEVEL SECURITY;
CREATE POLICY expert_geo_read ON public.expert_geographic_experience FOR SELECT TO authenticated USING (public._expert_child_read(expert_id));
CREATE POLICY expert_geo_write ON public.expert_geographic_experience FOR ALL TO authenticated
  USING (public._expert_child_write(expert_id)) WITH CHECK (public._expert_child_write(expert_id));
CREATE TRIGGER trg_expert_geo_touch BEFORE UPDATE ON public.expert_geographic_experience
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

-- =========================================================
-- 5. expert_availability
-- =========================================================
CREATE TABLE public.expert_availability (
  expert_id uuid PRIMARY KEY REFERENCES public.experts(id) ON DELETE CASCADE,
  availability_status public.availability_status_v1 NOT NULL DEFAULT 'unavailable',
  available_modes text[] NOT NULL DEFAULT '{}',
  hours_per_month integer,
  next_available_from date,
  available_until date,
  notes text,
  visibility public.registry_visibility_v1 NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_availability TO authenticated;
GRANT ALL ON public.expert_availability TO service_role;
ALTER TABLE public.expert_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY expert_availability_read ON public.expert_availability FOR SELECT TO authenticated USING (public._expert_child_read(expert_id));
CREATE POLICY expert_availability_write ON public.expert_availability FOR ALL TO authenticated
  USING (public._expert_child_write(expert_id)) WITH CHECK (public._expert_child_write(expert_id));
CREATE TRIGGER trg_expert_availability_touch BEFORE UPDATE ON public.expert_availability
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

-- =========================================================
-- 6. Trainer level rules (versioned config) + expert_trainer_status
-- =========================================================
CREATE TABLE public.trainer_level_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL,
  trainer_level public.trainer_level_v1 NOT NULL,
  min_unique_graduated_participants integer NOT NULL,
  evidence_requirements text,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version, trainer_level)
);
GRANT SELECT ON public.trainer_level_rules TO anon, authenticated;
GRANT ALL ON public.trainer_level_rules TO service_role;
ALTER TABLE public.trainer_level_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY trainer_level_rules_read ON public.trainer_level_rules FOR SELECT USING (true);
CREATE POLICY trainer_level_rules_admin_write ON public.trainer_level_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

INSERT INTO public.trainer_level_rules (version, trainer_level, min_unique_graduated_participants, evidence_requirements) VALUES
  (1,'certified',30,'Verified graduate roster'),
  (1,'advanced',100,'Verified graduate roster'),
  (1,'senior',1000,'Verified graduate roster + institutional endorsement'),
  (1,'master',10001,'Verified graduate roster + governance approval');

CREATE TABLE public.expert_trainer_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  trainer_status public.trainer_status_v1 NOT NULL DEFAULT 'candidate',
  trainer_level public.trainer_level_v1 NOT NULL DEFAULT 'not_assigned',
  unique_graduated_participants integer NOT NULL DEFAULT 0,
  evidence_ref text,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  effective_from timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  rationale text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expert_trainer_status_expert_idx ON public.expert_trainer_status (expert_id, granted_at DESC);
GRANT SELECT ON public.expert_trainer_status TO authenticated;
GRANT ALL ON public.expert_trainer_status TO service_role;
ALTER TABLE public.expert_trainer_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY expert_trainer_status_read ON public.expert_trainer_status FOR SELECT TO authenticated
  USING (public._expert_child_read(expert_id));
-- No direct INSERT/UPDATE/DELETE via client; use RPC.

-- =========================================================
-- 7. Verification history
-- =========================================================
CREATE TABLE public.expert_verification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  previous_status public.verification_status_v1,
  new_status public.verification_status_v1 NOT NULL,
  verification_method text,
  evidence_ref text,
  changed_by uuid,
  rationale text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expert_verification_history_expert_idx ON public.expert_verification_history (expert_id, changed_at DESC);
GRANT SELECT ON public.expert_verification_history TO authenticated;
GRANT ALL ON public.expert_verification_history TO service_role;
ALTER TABLE public.expert_verification_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY expert_verification_history_read ON public.expert_verification_history FOR SELECT TO authenticated
  USING (public._expert_child_read(expert_id));
-- Insert only via trigger/RPC — no policy for INSERT/UPDATE/DELETE.

-- =========================================================
-- 8. Immutable version snapshots
-- =========================================================
CREATE TABLE public.expert_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  previous_version_id uuid REFERENCES public.expert_versions(id) ON DELETE SET NULL,
  created_by uuid,
  publication_or_approval_ref uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expert_id, version)
);
CREATE INDEX expert_versions_expert_idx ON public.expert_versions (expert_id, version DESC);
GRANT SELECT ON public.expert_versions TO authenticated;
GRANT ALL ON public.expert_versions TO service_role;
ALTER TABLE public.expert_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY expert_versions_read ON public.expert_versions FOR SELECT TO authenticated
  USING (public._expert_child_read(expert_id));
-- Immutable: no INSERT/UPDATE/DELETE policies. Writes via SECURITY DEFINER trigger.

-- =========================================================
-- 9. Professional history
-- =========================================================
CREATE TABLE public.expert_training_facilitation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  activity_title text NOT NULL,
  organizer text,
  role text,
  start_date date,
  end_date date,
  participant_count integer,
  country text,
  course_offering_id uuid,
  evidence_ref text,
  visibility public.registry_visibility_v1 NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_training_facilitation_history TO authenticated;
GRANT ALL ON public.expert_training_facilitation_history TO service_role;
ALTER TABLE public.expert_training_facilitation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY expert_tfh_read ON public.expert_training_facilitation_history FOR SELECT TO authenticated USING (public._expert_child_read(expert_id));
CREATE POLICY expert_tfh_write ON public.expert_training_facilitation_history FOR ALL TO authenticated
  USING (public._expert_child_write(expert_id)) WITH CHECK (public._expert_child_write(expert_id));
CREATE TRIGGER trg_expert_tfh_touch BEFORE UPDATE ON public.expert_training_facilitation_history
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

CREATE TABLE public.expert_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  project_name text NOT NULL,
  institution_or_funder text,
  role text,
  start_date date,
  end_date date,
  description text,
  evidence_ref text,
  visibility public.registry_visibility_v1 NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_projects TO authenticated;
GRANT ALL ON public.expert_projects TO service_role;
ALTER TABLE public.expert_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY expert_projects_read ON public.expert_projects FOR SELECT TO authenticated USING (public._expert_child_read(expert_id));
CREATE POLICY expert_projects_write ON public.expert_projects FOR ALL TO authenticated
  USING (public._expert_child_write(expert_id)) WITH CHECK (public._expert_child_write(expert_id));
CREATE TRIGGER trg_expert_projects_touch BEFORE UPDATE ON public.expert_projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

CREATE TABLE public.expert_portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  title text NOT NULL,
  description text,
  asset_ref_or_url text,
  related_entity_type text,
  related_entity_id text,
  visibility public.registry_visibility_v1 NOT NULL DEFAULT 'public',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_portfolio_items TO authenticated;
GRANT ALL ON public.expert_portfolio_items TO service_role;
ALTER TABLE public.expert_portfolio_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY expert_portfolio_read ON public.expert_portfolio_items FOR SELECT TO authenticated USING (public._expert_child_read(expert_id));
CREATE POLICY expert_portfolio_write ON public.expert_portfolio_items FOR ALL TO authenticated
  USING (public._expert_child_write(expert_id)) WITH CHECK (public._expert_child_write(expert_id));
CREATE TRIGGER trg_expert_portfolio_touch BEFORE UPDATE ON public.expert_portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

-- =========================================================
-- 10. Verification-history trigger on experts
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_expert_verification_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    INSERT INTO public.expert_verification_history
      (expert_id, previous_status, new_status, verification_method, changed_by, rationale)
    VALUES
      (NEW.id, OLD.verification_status, NEW.verification_status, 'system_update', auth.uid(), NULL);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_experts_verification_history
  AFTER UPDATE OF verification_status ON public.experts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_expert_verification_history();

-- Version snapshot trigger: fires when publication_date changes (initial publish or re-publish)
-- or the version integer increments.
CREATE OR REPLACE FUNCTION public.emit_expert_version_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_snap jsonb; v_prev uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF (NEW.publication_date IS DISTINCT FROM OLD.publication_date AND NEW.publication_date IS NOT NULL)
     OR (NEW.version IS DISTINCT FROM OLD.version) THEN
    v_snap := jsonb_build_object(
      'expert', to_jsonb(NEW),
      'expertise', COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM public.expert_expertise e WHERE e.expert_id = NEW.id), '[]'::jsonb),
      'languages', COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM public.expert_languages l WHERE l.expert_id = NEW.id), '[]'::jsonb),
      'geographic', COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM public.expert_geographic_experience g WHERE g.expert_id = NEW.id), '[]'::jsonb),
      'education', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.expert_education x WHERE x.expert_id = NEW.id), '[]'::jsonb),
      'employment', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.expert_employment x WHERE x.expert_id = NEW.id), '[]'::jsonb),
      'certifications', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.expert_certifications x WHERE x.expert_id = NEW.id), '[]'::jsonb),
      'publications', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.expert_publications x WHERE x.expert_id = NEW.id), '[]'::jsonb)
    );
    SELECT id INTO v_prev FROM public.expert_versions
      WHERE expert_id = NEW.id ORDER BY version DESC LIMIT 1;
    INSERT INTO public.expert_versions (expert_id, version, snapshot, previous_version_id, created_by, publication_or_approval_ref)
    VALUES (NEW.id, NEW.version, v_snap, v_prev, auth.uid(), NEW.audit_ref);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_experts_version_snapshot
  AFTER UPDATE ON public.experts
  FOR EACH ROW EXECUTE FUNCTION public.emit_expert_version_snapshot();

-- =========================================================
-- 11. RPCs
-- =========================================================
CREATE OR REPLACE FUNCTION public.record_expert_verification(
  _expert_id uuid,
  _new_status public.verification_status_v1,
  _verification_method text,
  _evidence_ref text DEFAULT NULL,
  _rationale text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.experts%ROWTYPE;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT * INTO v_row FROM public.experts WHERE id = _expert_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'expert_not_found'; END IF;
  UPDATE public.experts SET verification_status = _new_status WHERE id = _expert_id;
  -- Trigger inserts baseline history row; overwrite last row with richer metadata.
  UPDATE public.expert_verification_history
    SET verification_method = _verification_method,
        evidence_ref = _evidence_ref,
        rationale = _rationale
    WHERE id = (SELECT id FROM public.expert_verification_history
                WHERE expert_id = _expert_id ORDER BY changed_at DESC LIMIT 1);
END $$;
REVOKE EXECUTE ON FUNCTION public.record_expert_verification(uuid, verification_status_v1, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_expert_verification(uuid, verification_status_v1, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_expert_trainer_status(
  _expert_id uuid,
  _trainer_status public.trainer_status_v1,
  _trainer_level public.trainer_level_v1,
  _unique_graduated_participants integer DEFAULT 0,
  _evidence_ref text DEFAULT NULL,
  _effective_from timestamptz DEFAULT now(),
  _expires_at timestamptz DEFAULT NULL,
  _rationale text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); v_next_version int; v_id uuid;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  IF NOT EXISTS (SELECT 1 FROM public.experts WHERE id = _expert_id) THEN
    RAISE EXCEPTION 'expert_not_found';
  END IF;
  SELECT COALESCE(MAX(version),0)+1 INTO v_next_version
    FROM public.expert_trainer_status WHERE expert_id = _expert_id;
  INSERT INTO public.expert_trainer_status (
    expert_id, trainer_status, trainer_level, unique_graduated_participants,
    evidence_ref, granted_by, granted_at, effective_from, expires_at, rationale, version
  ) VALUES (
    _expert_id, _trainer_status, _trainer_level, _unique_graduated_participants,
    _evidence_ref, v_uid, now(), _effective_from, _expires_at, _rationale, v_next_version
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.upsert_expert_trainer_status(uuid, trainer_status_v1, trainer_level_v1, integer, text, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_expert_trainer_status(uuid, trainer_status_v1, trainer_level_v1, integer, text, timestamptz, timestamptz, text) TO authenticated;

-- Duplicate detection. Never exposes private email text.
CREATE OR REPLACE FUNCTION public.find_expert_duplicate_candidates(
  _display_name text DEFAULT NULL,
  _orcid text DEFAULT NULL,
  _email text DEFAULT NULL,
  _country text DEFAULT NULL
) RETURNS TABLE (
  expert_id uuid,
  display_name text,
  country text,
  match_kind text,
  match_score numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public._require_admin_or_mgmt();
  RETURN QUERY
    SELECT e.id, e.display_name, e.country, 'orcid_exact'::text, 1.0::numeric
    FROM public.experts e
    WHERE _orcid IS NOT NULL AND lower(e.orcid) = lower(_orcid)
    UNION ALL
    SELECT e.id, e.display_name, e.country, 'email_exact'::text, 0.95::numeric
    FROM public.experts e
    JOIN public.expert_contact_private c ON c.expert_id = e.id
    WHERE _email IS NOT NULL AND lower(c.email) = lower(_email)
    UNION ALL
    SELECT e.id, e.display_name, e.country, 'name_country_similar'::text, 0.6::numeric
    FROM public.experts e
    WHERE _display_name IS NOT NULL
      AND lower(e.display_name) LIKE '%' || lower(_display_name) || '%'
      AND (_country IS NULL OR e.country = _country);
END $$;
REVOKE EXECUTE ON FUNCTION public.find_expert_duplicate_candidates(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_expert_duplicate_candidates(text, text, text, text) TO authenticated;

-- Unique partial index on normalized ORCID
CREATE UNIQUE INDEX IF NOT EXISTS experts_orcid_normalized_uniq
  ON public.experts (lower(orcid)) WHERE orcid IS NOT NULL;
