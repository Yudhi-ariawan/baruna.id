-- 1) Extend registry_status_v1 with deprecated + revoked (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid='registry_status_v1'::regtype AND enumlabel='deprecated') THEN
    ALTER TYPE public.registry_status_v1 ADD VALUE 'deprecated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid='registry_status_v1'::regtype AND enumlabel='revoked') THEN
    ALTER TYPE public.registry_status_v1 ADD VALUE 'revoked';
  END IF;
END $$;
