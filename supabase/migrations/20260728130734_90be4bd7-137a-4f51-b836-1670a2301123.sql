-- ============================================================================
-- Phase 1.3 · Increment 3b — Knowledge Resources completion
-- Additive: closes verification gaps in Increment 3.
-- ============================================================================

-- 1) Citation fields ---------------------------------------------------------
ALTER TABLE public.knowledge_resources
  ADD COLUMN IF NOT EXISTS citation_text text,
  ADD COLUMN IF NOT EXISTS citation_key  text;

-- 2) URL scheme safety -------------------------------------------------------
CREATE OR REPLACE FUNCTION public._safe_http_url(_u text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _u IS NULL OR _u ~* '^https?://[^\s]+$'
$$;

CREATE OR REPLACE FUNCTION public.enforce_kr_url_safety() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public._safe_http_url(NEW.external_url) THEN
    RAISE EXCEPTION 'unsafe_url: external_url';
  END IF;
  IF NOT public._safe_http_url(NEW.thumbnail_url) THEN
    RAISE EXCEPTION 'unsafe_url: thumbnail_url';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_kr_url_safety
  BEFORE INSERT OR UPDATE ON public.knowledge_resources
  FOR EACH ROW EXECUTE FUNCTION public.enforce_kr_url_safety();

CREATE OR REPLACE FUNCTION public.enforce_krf_url_safety() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public._safe_http_url(NEW.file_url) THEN
    RAISE EXCEPTION 'unsafe_url: file_url';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_krf_url_safety
  BEFORE INSERT OR UPDATE ON public.knowledge_resource_files
  FOR EACH ROW EXECUTE FUNCTION public.enforce_krf_url_safety();

-- 3) Hard duplicate prevention for active rows ------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS ux_kr_doi_active
  ON public.knowledge_resources (lower(doi))
  WHERE doi IS NOT NULL AND current_status <> 'archived';

CREATE UNIQUE INDEX IF NOT EXISTS ux_kr_isbn_active
  ON public.knowledge_resources (lower(isbn))
  WHERE isbn IS NOT NULL AND current_status <> 'archived';

CREATE OR REPLACE FUNCTION public._normalize_url(_u text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _u IS NULL THEN NULL
    ELSE lower(regexp_replace(regexp_replace(_u, '^https?://', ''), '/+$', ''))
  END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_kr_extern_url_active
  ON public.knowledge_resources ((public._normalize_url(external_url)))
  WHERE external_url IS NOT NULL AND current_status <> 'archived';

-- 4) Soft duplicate detection RPC --------------------------------------------
CREATE OR REPLACE FUNCTION public.find_kr_duplicate_candidates(
  _title text DEFAULT NULL,
  _doi text DEFAULT NULL,
  _isbn text DEFAULT NULL,
  _external_url text DEFAULT NULL,
  _file_hash text DEFAULT NULL,
  _author_name text DEFAULT NULL,
  _institution_id uuid DEFAULT NULL
) RETURNS TABLE (
  resource_id uuid,
  title text,
  resource_type public.resource_type_v1,
  match_kind text,
  match_score numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT r.id, r.title, r.resource_type, 'doi_exact'::text, 1.00::numeric
      FROM public.knowledge_resources r
      WHERE _doi IS NOT NULL AND lower(r.doi) = lower(_doi)
    UNION ALL
    SELECT r.id, r.title, r.resource_type, 'isbn_exact'::text, 1.00::numeric
      FROM public.knowledge_resources r
      WHERE _isbn IS NOT NULL AND lower(r.isbn) = lower(_isbn)
    UNION ALL
    SELECT r.id, r.title, r.resource_type, 'external_url_normalized'::text, 0.95::numeric
      FROM public.knowledge_resources r
      WHERE _external_url IS NOT NULL
        AND public._normalize_url(r.external_url) = public._normalize_url(_external_url)
    UNION ALL
    SELECT DISTINCT r.id, r.title, r.resource_type, 'file_hash_exact'::text, 0.95::numeric
      FROM public.knowledge_resources r
      JOIN public.knowledge_resource_files f ON f.resource_id = r.id
      WHERE _file_hash IS NOT NULL AND lower(f.checksum) = lower(_file_hash)
    UNION ALL
    SELECT DISTINCT r.id, r.title, r.resource_type, 'title_author_institution'::text, 0.65::numeric
      FROM public.knowledge_resources r
      LEFT JOIN public.knowledge_resource_authors a ON a.resource_id = r.id
      WHERE _title IS NOT NULL
        AND lower(r.title) LIKE '%' || lower(_title) || '%'
        AND ( _author_name IS NULL OR lower(a.display_name) LIKE '%' || lower(_author_name) || '%')
        AND ( _institution_id IS NULL OR r.source_institution_id = _institution_id);
END $$;

REVOKE ALL ON FUNCTION public.find_kr_duplicate_candidates(text,text,text,text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_kr_duplicate_candidates(text,text,text,text,text,text,uuid) TO authenticated;

-- 5) Publication immutability for file bindings ------------------------------
CREATE OR REPLACE FUNCTION public.enforce_krf_published_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_status public.registry_status_v1;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT current_status INTO v_status FROM public.knowledge_resources WHERE id = NEW.resource_id;
    IF v_status = 'published'
       AND (NEW.file_url IS DISTINCT FROM OLD.file_url
         OR NEW.checksum IS DISTINCT FROM OLD.checksum
         OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
         OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes) THEN
      RAISE EXCEPTION 'file_immutable_after_publication';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    SELECT current_status INTO v_status FROM public.knowledge_resources WHERE id = NEW.resource_id;
    IF v_status = 'published'
       AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')) THEN
      RAISE EXCEPTION 'file_add_forbidden_after_publication';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT current_status INTO v_status FROM public.knowledge_resources WHERE id = OLD.resource_id;
    IF v_status = 'published'
       AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')) THEN
      RAISE EXCEPTION 'file_delete_forbidden_after_publication';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_krf_published_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.knowledge_resource_files
  FOR EACH ROW EXECUTE FUNCTION public.enforce_krf_published_immutable();
