-- Canonical partner catalogue used by public platform aggregates.
-- Starts empty: partners are counted only after an official active record exists.

CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organization_type text,
  country text,
  website_url text,
  logo_url text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partners_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS partners_active_status_idx
  ON public.partners (status)
  WHERE status = 'active';

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partners_public_read_active ON public.partners;
CREATE POLICY partners_public_read_active
  ON public.partners
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

GRANT SELECT ON public.partners TO anon, authenticated;
GRANT ALL ON public.partners TO service_role;
