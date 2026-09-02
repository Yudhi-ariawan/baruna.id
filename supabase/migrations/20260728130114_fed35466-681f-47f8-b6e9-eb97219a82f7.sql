-- ============================================================================
-- Phase 1.3 · Increment 3 — Knowledge Resources Registry & Intake
-- Additive only. Preserves Phase 1/1.1/1.2 and Increment 2/2b objects.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.resource_type_v1 AS ENUM (
    'publication','journal_article','book','book_chapter',
    'working_paper','technical_report','policy_brief','guideline','standard',
    'dataset','database','model','tool','methodology',
    'best_practice','case_study',
    'infographic','poster',
    'video','podcast','webinar_recording',
    'training_material','module','toolkit'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.resource_license_v1 AS ENUM (
    'cc_by','cc_by_sa','cc_by_nc','cc_by_nc_sa','cc_by_nd','cc_by_nc_nd',
    'cc0','all_rights_reserved','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- knowledge_resources
-- ---------------------------------------------------------------------------
CREATE TABLE public.knowledge_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Shared provenance header
  source_type public.source_type_v1 NOT NULL,
  source_submission_id uuid,
  source_institution_id uuid,
  original_contributor_id uuid,
  created_by uuid NOT NULL,
  approved_by uuid,
  published_by uuid,
  approval_date timestamptz,
  publication_date timestamptz,
  verification_status public.verification_status_v1 NOT NULL DEFAULT 'unverified',
  visibility public.registry_visibility_v1 NOT NULL DEFAULT 'private',
  version integer NOT NULL DEFAULT 1,
  previous_version_id uuid REFERENCES public.knowledge_resources(id),
  current_status public.registry_status_v1 NOT NULL DEFAULT 'draft',
  audit_ref uuid,

  -- Domain
  resource_type public.resource_type_v1 NOT NULL,
  title text NOT NULL,
  subtitle text,
  summary text,
  abstract text,
  language text,
  publication_year integer,
  publisher text,
  venue text,
  license public.resource_license_v1,
  doi text,
  isbn text,
  external_url text,
  thumbnail_url text,
  topics text[] NOT NULL DEFAULT '{}',
  keywords text[] NOT NULL DEFAULT '{}',
  geographic_focus text[] NOT NULL DEFAULT '{}',
  related_expert_ids uuid[] NOT NULL DEFAULT '{}',
  related_module_refs text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.knowledge_resources TO authenticated;
GRANT ALL ON public.knowledge_resources TO service_role;

ALTER TABLE public.knowledge_resources ENABLE ROW LEVEL SECURITY;

-- Owner reads own rows (including hidden statuses)
CREATE POLICY kr_select_owner ON public.knowledge_resources
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- Governance roles read all
CREATE POLICY kr_select_governance ON public.knowledge_resources
  FOR SELECT TO authenticated
  USING (public.has_any_governance_role(auth.uid()));

-- Public reads only published+public rows (also served via public view)
CREATE POLICY kr_select_public ON public.knowledge_resources
  FOR SELECT
  USING (current_status = 'published' AND visibility = 'public');

-- No direct INSERT/UPDATE — force RPC-only writes
CREATE POLICY kr_no_direct_insert ON public.knowledge_resources
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY kr_no_direct_update ON public.knowledge_resources
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE TRIGGER trg_knowledge_resources_updated_at
  BEFORE UPDATE ON public.knowledge_resources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

CREATE INDEX idx_kr_status ON public.knowledge_resources(current_status);
CREATE INDEX idx_kr_type ON public.knowledge_resources(resource_type);
CREATE INDEX idx_kr_created_by ON public.knowledge_resources(created_by);
CREATE INDEX idx_kr_visibility ON public.knowledge_resources(visibility);

-- ---------------------------------------------------------------------------
-- Child tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.knowledge_resource_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.knowledge_resources(id) ON DELETE CASCADE,
  label text,
  file_url text NOT NULL,
  mime_type text,
  size_bytes bigint,
  checksum text,
  is_primary boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  visibility public.registry_visibility_v1 NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_resource_files TO authenticated;
GRANT ALL ON public.knowledge_resource_files TO service_role;
ALTER TABLE public.knowledge_resource_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY krf_read ON public.knowledge_resource_files FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_resources r
            WHERE r.id = resource_id
              AND (r.created_by = auth.uid()
                OR public.has_any_governance_role(auth.uid())
                OR (r.current_status='published' AND r.visibility='public')))
  );
CREATE POLICY krf_read_public ON public.knowledge_resource_files FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_resources r
            WHERE r.id = resource_id
              AND r.current_status='published' AND r.visibility='public'
              AND knowledge_resource_files.visibility = 'public')
  );
CREATE POLICY krf_write ON public.knowledge_resource_files FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_resources r
            WHERE r.id = resource_id
              AND (r.created_by = auth.uid()
                OR public.has_role(auth.uid(),'admin')
                OR public.has_role(auth.uid(),'management')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.knowledge_resources r
            WHERE r.id = resource_id
              AND (r.created_by = auth.uid()
                OR public.has_role(auth.uid(),'admin')
                OR public.has_role(auth.uid(),'management')))
  );
CREATE TRIGGER trg_krf_updated_at BEFORE UPDATE ON public.knowledge_resource_files
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

CREATE TABLE public.knowledge_resource_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.knowledge_resources(id) ON DELETE CASCADE,
  expert_id uuid REFERENCES public.experts(id),
  display_name text NOT NULL,
  affiliation text,
  role text,
  display_order integer NOT NULL DEFAULT 0,
  is_corresponding boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_resource_authors TO authenticated;
GRANT ALL ON public.knowledge_resource_authors TO service_role;
ALTER TABLE public.knowledge_resource_authors ENABLE ROW LEVEL SECURITY;
CREATE POLICY kra_read ON public.knowledge_resource_authors FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_resources r
            WHERE r.id = resource_id
              AND (r.created_by = auth.uid()
                OR public.has_any_governance_role(auth.uid())
                OR (r.current_status='published' AND r.visibility='public')))
  );
CREATE POLICY kra_read_public ON public.knowledge_resource_authors FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_resources r
            WHERE r.id = resource_id
              AND r.current_status='published' AND r.visibility='public')
  );
CREATE POLICY kra_write ON public.knowledge_resource_authors FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_resources r
            WHERE r.id = resource_id
              AND (r.created_by = auth.uid()
                OR public.has_role(auth.uid(),'admin')
                OR public.has_role(auth.uid(),'management')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.knowledge_resources r
            WHERE r.id = resource_id
              AND (r.created_by = auth.uid()
                OR public.has_role(auth.uid(),'admin')
                OR public.has_role(auth.uid(),'management')))
  );
CREATE TRIGGER trg_kra_updated_at BEFORE UPDATE ON public.knowledge_resource_authors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_shared();

CREATE TABLE public.knowledge_resource_related (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.knowledge_resources(id) ON DELETE CASCADE,
  related_resource_id uuid NOT NULL REFERENCES public.knowledge_resources(id) ON DELETE CASCADE,
  relation_kind text NOT NULL DEFAULT 'related',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, related_resource_id, relation_kind),
  CHECK (resource_id <> related_resource_id)
);
GRANT SELECT, INSERT, DELETE ON public.knowledge_resource_related TO authenticated;
GRANT ALL ON public.knowledge_resource_related TO service_role;
ALTER TABLE public.knowledge_resource_related ENABLE ROW LEVEL SECURITY;
CREATE POLICY krr_read ON public.knowledge_resource_related FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_resources r
            WHERE r.id = resource_id
              AND (r.created_by = auth.uid()
                OR public.has_any_governance_role(auth.uid())
                OR (r.current_status='published' AND r.visibility='public')))
  );
CREATE POLICY krr_read_public ON public.knowledge_resource_related FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_resources r
            WHERE r.id = resource_id
              AND r.current_status='published' AND r.visibility='public')
  );
CREATE POLICY krr_write ON public.knowledge_resource_related FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_resources r
            WHERE r.id = resource_id
              AND (r.created_by = auth.uid()
                OR public.has_role(auth.uid(),'admin')
                OR public.has_role(auth.uid(),'management')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.knowledge_resources r
            WHERE r.id = resource_id
              AND (r.created_by = auth.uid()
                OR public.has_role(auth.uid(),'admin')
                OR public.has_role(auth.uid(),'management')))
  );

-- Immutable version snapshots
CREATE TABLE public.knowledge_resource_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.knowledge_resources(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  previous_version_id uuid REFERENCES public.knowledge_resource_versions(id),
  created_by uuid,
  publication_or_approval_ref uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, version)
);
GRANT SELECT ON public.knowledge_resource_versions TO authenticated;
GRANT ALL ON public.knowledge_resource_versions TO service_role;
ALTER TABLE public.knowledge_resource_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY krv_read ON public.knowledge_resource_versions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_resources r
            WHERE r.id = resource_id
              AND (r.created_by = auth.uid()
                OR public.has_any_governance_role(auth.uid())
                OR (r.current_status='published' AND r.visibility='public')))
  );

-- Snapshot trigger — writes on publication or explicit version change
CREATE OR REPLACE FUNCTION public.emit_knowledge_resource_version_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_snap jsonb; v_prev uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF (NEW.publication_date IS DISTINCT FROM OLD.publication_date AND NEW.publication_date IS NOT NULL)
     OR (NEW.version IS DISTINCT FROM OLD.version) THEN
    v_snap := jsonb_build_object(
      'resource', to_jsonb(NEW),
      'files', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.knowledge_resource_files x WHERE x.resource_id = NEW.id), '[]'::jsonb),
      'authors', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.knowledge_resource_authors x WHERE x.resource_id = NEW.id), '[]'::jsonb),
      'related', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.knowledge_resource_related x WHERE x.resource_id = NEW.id), '[]'::jsonb)
    );
    SELECT id INTO v_prev FROM public.knowledge_resource_versions
      WHERE resource_id = NEW.id ORDER BY version DESC LIMIT 1;
    INSERT INTO public.knowledge_resource_versions (resource_id, version, snapshot, previous_version_id, created_by, publication_or_approval_ref)
    VALUES (NEW.id, NEW.version, v_snap, v_prev, auth.uid(), NEW.audit_ref);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_kr_version_snapshot
  AFTER UPDATE ON public.knowledge_resources
  FOR EACH ROW EXECUTE FUNCTION public.emit_knowledge_resource_version_snapshot();

-- ---------------------------------------------------------------------------
-- Public read view
-- ---------------------------------------------------------------------------
CREATE VIEW public.knowledge_resources_public_v
WITH (security_invoker = true) AS
SELECT
  id, resource_type, title, subtitle, summary, abstract,
  language, publication_year, publisher, venue, license,
  doi, isbn, external_url, thumbnail_url,
  topics, keywords, geographic_focus, related_expert_ids,
  version, publication_date, verification_status,
  created_at, updated_at
FROM public.knowledge_resources
WHERE current_status = 'published' AND visibility = 'public';

GRANT SELECT ON public.knowledge_resources_public_v TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Intake / lifecycle RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kr_draft_create(
  _title text,
  _resource_type public.resource_type_v1,
  _source_type public.source_type_v1 DEFAULT 'external_submission'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _title IS NULL OR length(trim(_title)) = 0 THEN RAISE EXCEPTION 'title_required'; END IF;

  INSERT INTO public.knowledge_resources (source_type, created_by, original_contributor_id, title, resource_type)
  VALUES (_source_type, v_uid, v_uid, _title, _resource_type)
  RETURNING id INTO v_id;

  PERFORM public.emit_platform_event(
    'draft_created'::public.platform_event_type_v1,
    v_uid, v_id, 'knowledge_resource', v_id::text, 'knowledge_resources', _source_type,
    NULL, v_id, NULL,
    jsonb_build_object('title', _title, 'resource_type', _resource_type)
  );
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.kr_draft_update(_resource_id uuid, _patch jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.knowledge_resources%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.knowledge_resources WHERE id = _resource_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'resource_not_found'; END IF;
  IF v_row.created_by <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.current_status NOT IN ('draft','changes_requested') THEN
    RAISE EXCEPTION 'resource_not_editable';
  END IF;
  IF _patch ? 'approved_zero_tariff' THEN
    RAISE EXCEPTION 'zero_tariff_not_permitted';
  END IF;

  UPDATE public.knowledge_resources SET
    title             = COALESCE(_patch->>'title', title),
    subtitle          = COALESCE(_patch->>'subtitle', subtitle),
    summary           = COALESCE(_patch->>'summary', summary),
    abstract          = COALESCE(_patch->>'abstract', abstract),
    language          = COALESCE(_patch->>'language', language),
    publication_year  = COALESCE(NULLIF(_patch->>'publication_year','')::int, publication_year),
    publisher         = COALESCE(_patch->>'publisher', publisher),
    venue             = COALESCE(_patch->>'venue', venue),
    license           = COALESCE(NULLIF(_patch->>'license','')::public.resource_license_v1, license),
    doi               = COALESCE(_patch->>'doi', doi),
    isbn              = COALESCE(_patch->>'isbn', isbn),
    external_url      = COALESCE(_patch->>'external_url', external_url),
    thumbnail_url     = COALESCE(_patch->>'thumbnail_url', thumbnail_url),
    resource_type     = COALESCE(NULLIF(_patch->>'resource_type','')::public.resource_type_v1, resource_type),
    topics            = COALESCE(
      CASE WHEN _patch ? 'topics' THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'topics')) END,
      topics),
    keywords          = COALESCE(
      CASE WHEN _patch ? 'keywords' THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'keywords')) END,
      keywords),
    geographic_focus  = COALESCE(
      CASE WHEN _patch ? 'geographic_focus' THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'geographic_focus')) END,
      geographic_focus),
    metadata          = COALESCE(_patch->'metadata', metadata)
  WHERE id = _resource_id;

  PERFORM public.emit_platform_event(
    'registry_record_updated'::public.platform_event_type_v1,
    v_uid, _resource_id, 'knowledge_resource', _resource_id::text, 'knowledge_resources', v_row.source_type,
    NULL, _resource_id, NULL,
    jsonb_build_object('patch_keys', (SELECT jsonb_agg(k) FROM jsonb_object_keys(_patch) k))
  );
END $$;

CREATE OR REPLACE FUNCTION public.kr_draft_submit(_resource_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.knowledge_resources%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_row FROM public.knowledge_resources WHERE id = _resource_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'resource_not_found'; END IF;
  IF v_row.created_by <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.current_status NOT IN ('draft','changes_requested') THEN
    RAISE EXCEPTION 'resource_not_submittable';
  END IF;

  UPDATE public.knowledge_resources SET current_status = 'submitted' WHERE id = _resource_id;

  PERFORM public.emit_platform_event(
    'submission_submitted'::public.platform_event_type_v1,
    v_uid, _resource_id, 'knowledge_resource', _resource_id::text, 'knowledge_resources', v_row.source_type,
    NULL, _resource_id, NULL, '{}'::jsonb
  );
END $$;

CREATE OR REPLACE FUNCTION public.kr_publish_direct(
  _resource_id uuid,
  _visibility public.registry_visibility_v1 DEFAULT 'public',
  _verification public.verification_status_v1 DEFAULT 'governance_verified',
  _rationale text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.knowledge_resources%ROWTYPE;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT * INTO v_row FROM public.knowledge_resources WHERE id = _resource_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'resource_not_found'; END IF;
  IF v_row.current_status = 'published' THEN RETURN; END IF;

  UPDATE public.knowledge_resources SET
    current_status = 'published',
    visibility = _visibility,
    verification_status = _verification,
    approved_by = COALESCE(approved_by, v_uid),
    published_by = v_uid,
    approval_date = COALESCE(approval_date, now()),
    publication_date = now()
  WHERE id = _resource_id;

  PERFORM public.emit_platform_event(
    'directly_published'::public.platform_event_type_v1,
    v_uid, _resource_id, 'knowledge_resource', _resource_id::text, 'knowledge_resources', v_row.source_type,
    NULL, _resource_id, NULL,
    jsonb_build_object('rationale', _rationale, 'visibility', _visibility, 'verification', _verification)
  );
  PERFORM public.emit_platform_event(
    'registry_record_published'::public.platform_event_type_v1,
    v_uid, _resource_id, 'knowledge_resource', _resource_id::text, 'knowledge_resources', v_row.source_type,
    NULL, _resource_id, NULL, '{}'::jsonb
  );
END $$;

CREATE OR REPLACE FUNCTION public.kr_publish_from_decision(
  _resource_id uuid,
  _decision_id uuid,
  _visibility public.registry_visibility_v1 DEFAULT 'public',
  _verification public.verification_status_v1 DEFAULT 'governance_verified'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.knowledge_resources%ROWTYPE; v_dec public.review_decisions%ROWTYPE;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT * INTO v_dec FROM public.review_decisions WHERE id = _decision_id;
  IF v_dec.id IS NULL OR v_dec.decision <> 'approve' THEN
    RAISE EXCEPTION 'decision_not_approve';
  END IF;
  SELECT * INTO v_row FROM public.knowledge_resources WHERE id = _resource_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'resource_not_found'; END IF;
  IF v_row.current_status = 'published' THEN RETURN; END IF;

  UPDATE public.knowledge_resources SET
    current_status = 'published',
    visibility = _visibility,
    verification_status = _verification,
    approved_by = v_dec.decided_by,
    published_by = v_uid,
    approval_date = v_dec.decided_at,
    publication_date = now(),
    audit_ref = _decision_id
  WHERE id = _resource_id;

  PERFORM public.emit_platform_event(
    'approved'::public.platform_event_type_v1,
    v_uid, _resource_id, 'knowledge_resource', _resource_id::text, 'knowledge_resources', v_row.source_type,
    NULL, _resource_id, NULL, jsonb_build_object('decision_id', _decision_id)
  );
  PERFORM public.emit_platform_event(
    'registry_record_published'::public.platform_event_type_v1,
    v_uid, _resource_id, 'knowledge_resource', _resource_id::text, 'knowledge_resources', v_row.source_type,
    NULL, _resource_id, NULL, '{}'::jsonb
  );
END $$;

CREATE OR REPLACE FUNCTION public.kr_archive(_resource_id uuid, _rationale text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.knowledge_resources%ROWTYPE;
BEGIN
  PERFORM public._require_admin_or_mgmt();
  SELECT * INTO v_row FROM public.knowledge_resources WHERE id = _resource_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'resource_not_found'; END IF;
  UPDATE public.knowledge_resources SET current_status = 'archived' WHERE id = _resource_id;
  PERFORM public.emit_platform_event(
    'registry_record_archived'::public.platform_event_type_v1,
    v_uid, _resource_id, 'knowledge_resource', _resource_id::text, 'knowledge_resources', v_row.source_type,
    NULL, _resource_id, NULL, jsonb_build_object('rationale', _rationale)
  );
END $$;

-- Lock down EXECUTE
REVOKE ALL ON FUNCTION public.kr_draft_create(text, public.resource_type_v1, public.source_type_v1) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kr_draft_update(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kr_draft_submit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kr_publish_direct(uuid, public.registry_visibility_v1, public.verification_status_v1, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kr_publish_from_decision(uuid, uuid, public.registry_visibility_v1, public.verification_status_v1) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kr_archive(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.kr_draft_create(text, public.resource_type_v1, public.source_type_v1) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kr_draft_update(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kr_draft_submit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kr_publish_direct(uuid, public.registry_visibility_v1, public.verification_status_v1, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kr_publish_from_decision(uuid, uuid, public.registry_visibility_v1, public.verification_status_v1) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kr_archive(uuid, text) TO authenticated;
