ALTER TABLE public.experts DROP CONSTRAINT IF EXISTS experts_status_canonical_ck;
ALTER TABLE public.experts ADD CONSTRAINT experts_status_canonical_ck
  CHECK (current_status IN ('approved','published','archived','deprecated','revoked'));

ALTER TABLE public.knowledge_resources DROP CONSTRAINT IF EXISTS kr_status_canonical_ck;
ALTER TABLE public.knowledge_resources ADD CONSTRAINT kr_status_canonical_ck
  CHECK (current_status IN ('approved','published','archived','deprecated','revoked'));

ALTER TABLE public.module_registry DROP CONSTRAINT IF EXISTS mr_status_canonical_ck;
ALTER TABLE public.module_registry ADD CONSTRAINT mr_status_canonical_ck
  CHECK (current_status IN ('approved','published','archived','deprecated','revoked'));
