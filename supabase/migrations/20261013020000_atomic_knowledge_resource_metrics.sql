-- Migration: 20261013020000_atomic_knowledge_resource_metrics.sql
-- Purpose: Extend knowledge_resource_metrics with atomic save and share counters and provide atomic RPCs
-- to eliminate race conditions and write contention on knowledge_resources.

CREATE TABLE IF NOT EXISTS public.knowledge_resource_metrics (
  resource_id uuid PRIMARY KEY REFERENCES public.knowledge_resources(id) ON DELETE CASCADE,
  view_count bigint NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  download_count bigint NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  save_count bigint NOT NULL DEFAULT 0 CHECK (save_count >= 0),
  share_count bigint NOT NULL DEFAULT 0 CHECK (share_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_resource_metrics
  ADD COLUMN IF NOT EXISTS save_count bigint NOT NULL DEFAULT 0 CHECK (save_count >= 0),
  ADD COLUMN IF NOT EXISTS share_count bigint NOT NULL DEFAULT 0 CHECK (share_count >= 0);

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

-- Backfill save_count and share_count from legacy metadata JSON
UPDATE public.knowledge_resource_metrics m
SET
  save_count = GREATEST(
    m.save_count,
    CASE
      WHEN COALESCE(
        r.metadata #>> '{metrics,saves}',
        r.metadata ->> 'save_count',
        r.metadata ->> 'saveCount',
        r.metadata ->> 'saves',
        ''
      ) ~ '^[0-9]+$'
        THEN COALESCE(
          r.metadata #>> '{metrics,saves}',
          r.metadata ->> 'save_count',
          r.metadata ->> 'saveCount',
          r.metadata ->> 'saves'
        )::bigint
      ELSE 0
    END
  ),
  share_count = GREATEST(
    m.share_count,
    CASE
      WHEN COALESCE(
        r.metadata #>> '{metrics,shares}',
        r.metadata ->> 'share_count',
        r.metadata ->> 'shareCount',
        r.metadata ->> 'shares',
        ''
      ) ~ '^[0-9]+$'
        THEN COALESCE(
          r.metadata #>> '{metrics,shares}',
          r.metadata ->> 'share_count',
          r.metadata ->> 'shareCount',
          r.metadata ->> 'shares'
        )::bigint
      ELSE 0
    END
  )
FROM public.knowledge_resources r
WHERE r.id = m.resource_id;

-- Unified atomic metric mutation RPC
CREATE OR REPLACE FUNCTION public.record_resource_metric(
  _resource_id uuid,
  _action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Ensure row exists for this public published resource
  INSERT INTO public.knowledge_resource_metrics (resource_id, view_count, download_count, save_count, share_count)
  SELECT r.id, 0, 0, 0, 0
  FROM public.knowledge_resources r
  WHERE r.id = _resource_id
    AND r.current_status = 'published'
    AND r.visibility = 'public'
  ON CONFLICT (resource_id) DO NOTHING;

  IF _action = 'view' THEN
    UPDATE public.knowledge_resource_metrics
    SET view_count = view_count + 1, updated_at = now()
    WHERE resource_id = _resource_id;
  ELSIF _action = 'download' THEN
    UPDATE public.knowledge_resource_metrics
    SET download_count = download_count + 1, updated_at = now()
    WHERE resource_id = _resource_id;
  ELSIF _action = 'save' THEN
    UPDATE public.knowledge_resource_metrics
    SET save_count = save_count + 1, updated_at = now()
    WHERE resource_id = _resource_id;
  ELSIF _action = 'unsave' THEN
    UPDATE public.knowledge_resource_metrics
    SET save_count = GREATEST(0, save_count - 1), updated_at = now()
    WHERE resource_id = _resource_id;
  ELSIF _action = 'share' THEN
    UPDATE public.knowledge_resource_metrics
    SET share_count = share_count + 1, updated_at = now()
    WHERE resource_id = _resource_id;
  END IF;

  SELECT jsonb_build_object(
    'views', COALESCE(view_count, 0),
    'downloads', COALESCE(download_count, 0),
    'saves', COALESCE(save_count, 0),
    'shares', COALESCE(share_count, 0)
  )
  INTO v_result
  FROM public.knowledge_resource_metrics
  WHERE resource_id = _resource_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.record_resource_metric(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_resource_metric(uuid, text) TO anon, authenticated, service_role;
