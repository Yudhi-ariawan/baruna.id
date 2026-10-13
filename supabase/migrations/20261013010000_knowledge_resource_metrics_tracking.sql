-- Atomic, public-safe counters for Knowledge Hub resources.
-- Counters live outside knowledge_resources so analytics traffic does not
-- mutate the resource content timestamp or its publication lifecycle.

CREATE TABLE IF NOT EXISTS public.knowledge_resource_metrics (
  resource_id uuid PRIMARY KEY REFERENCES public.knowledge_resources(id) ON DELETE CASCADE,
  view_count bigint NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  download_count bigint NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.knowledge_resource_metrics IS
  'Atomic aggregate counters for published Knowledge Hub resources.';

GRANT SELECT ON public.knowledge_resource_metrics TO anon, authenticated;
GRANT ALL ON public.knowledge_resource_metrics TO service_role;

ALTER TABLE public.knowledge_resource_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_resource_metrics_public_read
  ON public.knowledge_resource_metrics;
CREATE POLICY knowledge_resource_metrics_public_read
  ON public.knowledge_resource_metrics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.knowledge_resources resource
      WHERE resource.id = resource_id
        AND resource.current_status = 'published'
        AND resource.visibility = 'public'
    )
  );

-- Preserve any legacy counters that were stored in metadata JSON.
INSERT INTO public.knowledge_resource_metrics (resource_id, view_count, download_count)
SELECT
  resource.id,
  CASE
    WHEN COALESCE(
      resource.metadata #>> '{metrics,views}',
      resource.metadata ->> 'view_count',
      resource.metadata ->> 'viewCount',
      resource.metadata ->> 'views',
      ''
    ) ~ '^[0-9]+$'
      THEN COALESCE(
        resource.metadata #>> '{metrics,views}',
        resource.metadata ->> 'view_count',
        resource.metadata ->> 'viewCount',
        resource.metadata ->> 'views'
      )::bigint
    ELSE 0
  END,
  CASE
    WHEN COALESCE(
      resource.metadata #>> '{metrics,downloads}',
      resource.metadata ->> 'download_count',
      resource.metadata ->> 'downloadCount',
      resource.metadata ->> 'downloads',
      ''
    ) ~ '^[0-9]+$'
      THEN COALESCE(
        resource.metadata #>> '{metrics,downloads}',
        resource.metadata ->> 'download_count',
        resource.metadata ->> 'downloadCount',
        resource.metadata ->> 'downloads'
      )::bigint
    ELSE 0
  END
FROM public.knowledge_resources resource
ON CONFLICT (resource_id) DO UPDATE
SET
  view_count = GREATEST(
    public.knowledge_resource_metrics.view_count,
    EXCLUDED.view_count
  ),
  download_count = GREATEST(
    public.knowledge_resource_metrics.download_count,
    EXCLUDED.download_count
  );

CREATE OR REPLACE FUNCTION public.increment_resource_views(_resource_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_count bigint;
BEGIN
  INSERT INTO public.knowledge_resource_metrics (resource_id, view_count, download_count)
  SELECT resource.id, 1, 0
  FROM public.knowledge_resources resource
  WHERE resource.id = _resource_id
    AND resource.current_status = 'published'
    AND resource.visibility = 'public'
  ON CONFLICT (resource_id) DO UPDATE
  SET
    view_count = public.knowledge_resource_metrics.view_count + 1,
    updated_at = now()
  RETURNING view_count INTO next_count;

  IF next_count IS NULL THEN
    RAISE EXCEPTION 'resource_not_found_or_not_public';
  END IF;

  RETURN next_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_resource_downloads(_resource_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_count bigint;
BEGIN
  INSERT INTO public.knowledge_resource_metrics (resource_id, view_count, download_count)
  SELECT resource.id, 0, 1
  FROM public.knowledge_resources resource
  WHERE resource.id = _resource_id
    AND resource.current_status = 'published'
    AND resource.visibility = 'public'
  ON CONFLICT (resource_id) DO UPDATE
  SET
    download_count = public.knowledge_resource_metrics.download_count + 1,
    updated_at = now()
  RETURNING download_count INTO next_count;

  IF next_count IS NULL THEN
    RAISE EXCEPTION 'resource_not_found_or_not_public';
  END IF;

  RETURN next_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_resource_views(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_resource_downloads(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_resource_views(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_resource_downloads(uuid) TO anon, authenticated, service_role;
