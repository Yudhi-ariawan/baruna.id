-- ============================================================================
-- Dynamic CMS: menu navigasi, halaman dari blok, dan formulir (kurikulum 3.1)
-- ============================================================================
-- Acuan: Slide 6 (8 menu), 13 (tidak ada konten tayang tanpa approval), 14-15
-- (tidak boleh hard-code), 16 (peran), 43 (LS-02 Admin Console), 45 (LS-04
-- publikasi/arsip). Rancangan: dokumen pribadi Rancangan Dynamic CMS (S3.1);
-- CATATAN_PERBAIKAN 2br. Dibuktikan oleh `npm run test:cms`.
--
-- Dicek 18 Nov 2026 (database intern-update):
-- * Izin <menu>.update (about, community, fellowship, partnership, events) juga
--   dimiliki registered_user dan participant (Slide 16 "terbatas"). Izin itu saja
--   TIDAK cukup untuk mengubah konten situs: penyunting juga harus memegang peran
--   pengelola (super_admin, admin, operator, approver, publisher).
-- * Pemutus mengikuti alur lain: _can_decide_review (super_admin, admin, approver)
--   dan bukan pembuat/pengaju draf. Menu navigasi berlaku untuk seluruh situs, jadi
--   memakai governance.manage (admin, super_admin) untuk menyunting dan memutuskan.
-- * Penayangan memakai _can_publish (publisher, admin, super_admin), sama dengan
--   publication_hold (20261116020000).
-- * Gambar diunggah server ke bucket publik `knowledge-module-covers` dengan awalan
--   `cms/`, sama dengan sampul course (20261104020000); database memeriksa berkasnya.
--
-- Perubahan:
-- * Tabel tayang: cms_pages, cms_forms, cms_menu_items (+ versi masing-masing),
--   cms_form_submissions, dan satu tabel draf cms_drafts (pola academy_program_drafts).
-- * View publik: cms_pages_public_v, cms_forms_public_v, cms_menu_public_v.
-- * Isi divalidasi di database: jenis blok, panjang teks, tautan hanya https:// atau
--   alamat internal, gambar hanya dari bucket CMS. Tidak ada HTML mentah.
-- * Kiriman formulir wajib login, dibatasi per pengguna per hari, dan hanya bisa
--   dibaca peninjau menu itu (Data Pribadi).
-- Semua tabel: RLS aktif, tulis hanya lewat RPC. Aman dijalankan lebih dari sekali.
-- ============================================================================

BEGIN;

-- ------------------------------------------------------------- helpers: izin
CREATE OR REPLACE FUNCTION public._cms_is_manager(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    public.has_rbac_role(_uid, 'super_admin') OR public.has_rbac_role(_uid, 'admin')
    OR public.has_rbac_role(_uid, 'operator') OR public.has_rbac_role(_uid, 'approver')
    OR public.has_rbac_role(_uid, 'publisher'))
$$;
REVOKE ALL ON FUNCTION public._cms_is_manager(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cms_can_edit(_uid uuid, _domain text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND CASE
    WHEN _domain = 'navigation' THEN public.has_permission(_uid, 'governance.manage')
    WHEN _domain IN ('about', 'community', 'fellowship', 'partnership', 'events')
      THEN public.has_permission(_uid, _domain || '.update') AND public._cms_is_manager(_uid)
    ELSE false END
$$;
REVOKE ALL ON FUNCTION public._cms_can_edit(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cms_can_decide(_uid uuid, _domain text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND CASE
    WHEN _domain = 'navigation' THEN public.has_permission(_uid, 'governance.manage')
    ELSE public._can_decide_review(_uid) END
$$;
REVOKE ALL ON FUNCTION public._cms_can_decide(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cms_can_review_submissions(_uid uuid, _domain text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (public._can_decide_review(_uid)
    OR (_domain IN ('about', 'community', 'fellowship', 'partnership', 'events')
        AND public.has_permission(_uid, _domain || '.review') AND public.has_rbac_role(_uid, 'reviewer')))
$$;
REVOKE ALL ON FUNCTION public._cms_can_review_submissions(uuid, text) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- helpers: isi
-- Optional/required string in an object: absent or null counts as empty.
CREATE OR REPLACE FUNCTION public._cms_s(_o jsonb, _k text, _min integer, _max integer)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v jsonb := _o -> _k; t text;
BEGIN
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN RETURN _min = 0; END IF;
  IF jsonb_typeof(v) <> 'string' THEN RETURN false; END IF;
  t := btrim(v #>> '{}');
  IF t = '' THEN RETURN _min = 0; END IF;
  RETURN char_length(t) BETWEEN GREATEST(_min, 1) AND _max;
END $$;
REVOKE ALL ON FUNCTION public._cms_s(jsonb, text, integer, integer) FROM PUBLIC, anon, authenticated;

-- Internal path (/academy, /p/x) or https:// address; nothing else (no javascript:, data:, //host).
CREATE OR REPLACE FUNCTION public._cms_url_ok(_u text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _u IS NOT NULL AND char_length(_u) BETWEEN 1 AND 500 AND _u !~ '\s'
     AND (_u = '/' OR _u ~ '^/[A-Za-z0-9_\-]' OR _u ~* '^https://[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+(:[0-9]{2,5})?(/.*)?$')
$$;
REVOKE ALL ON FUNCTION public._cms_url_ok(text) FROM PUBLIC, anon, authenticated;

-- Image: absent/empty = none; otherwise a CMS upload that really exists (image, <= 2 MB).
CREATE OR REPLACE FUNCTION public._cms_image_ok(_o jsonb, _k text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb := _o -> _k; p text;
BEGIN
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN RETURN true; END IF;
  IF jsonb_typeof(v) <> 'string' THEN RETURN false; END IF;
  p := v #>> '{}';
  IF p = '' THEN RETURN true; END IF;
  IF p !~ '^cms/[0-9a-f]{32}\.(png|jpg|webp)$' THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM storage.objects o
     WHERE o.bucket_id = 'knowledge-module-covers' AND o.name = p
       AND COALESCE(o.metadata->>'mimetype', '') IN ('image/png', 'image/jpeg', 'image/webp')
       AND COALESCE((o.metadata->>'size')::bigint, 0) BETWEEN 1 AND 2097152);
END $$;
REVOKE ALL ON FUNCTION public._cms_image_ok(jsonb, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cms_slug_ok(_s text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _s IS NOT NULL AND char_length(_s) BETWEEN 2 AND 80 AND _s ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
$$;
REVOKE ALL ON FUNCTION public._cms_slug_ok(text) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- tables
CREATE TABLE IF NOT EXISTS public.cms_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL CHECK (domain IN ('about', 'community', 'fellowship', 'partnership', 'events')),
  slug text NOT NULL UNIQUE CHECK (char_length(slug) BETWEEN 2 AND 80 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_id text NOT NULL,
  title_en text,
  summary_id text,
  summary_en text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(blocks) = 'array'),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'on_hold', 'archived')),
  version integer NOT NULL DEFAULT 1,
  status_reason text,
  status_changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status_changed_at timestamptz,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cms_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL CHECK (domain IN ('about', 'community', 'fellowship', 'partnership', 'events')),
  slug text NOT NULL UNIQUE CHECK (char_length(slug) BETWEEN 2 AND 80 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_id text NOT NULL,
  title_en text,
  description_id text,
  description_en text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(fields) = 'array'),
  notify_on_submit boolean NOT NULL DEFAULT true,
  max_per_user_per_day integer NOT NULL DEFAULT 3 CHECK (max_per_user_per_day BETWEEN 1 AND 20),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'closed', 'archived')),
  version integer NOT NULL DEFAULT 1,
  status_reason text,
  status_changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cms_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.cms_menu_items(id) ON DELETE CASCADE,
  label_id text NOT NULL,
  label_en text,
  href text NOT NULL,
  is_external boolean NOT NULL DEFAULT false,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cms_menu_items_parent_idx ON public.cms_menu_items (parent_id, sort_order);

CREATE TABLE IF NOT EXISTS public.cms_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('page', 'form', 'menu')),
  target_id uuid,
  domain text NOT NULL CHECK (domain IN ('about', 'community', 'fellowship', 'partnership', 'events', 'navigation')),
  base_version integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'revision_requested', 'approved', 'rejected', 'withdrawn')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text,
  result_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cms_drafts_one_open_uidx
  ON public.cms_drafts (kind, target_id)
  WHERE target_id IS NOT NULL AND status IN ('draft', 'submitted', 'revision_requested');
CREATE UNIQUE INDEX IF NOT EXISTS cms_drafts_one_open_menu_uidx
  ON public.cms_drafts (kind)
  WHERE kind = 'menu' AND status IN ('draft', 'submitted', 'revision_requested');
CREATE INDEX IF NOT EXISTS cms_drafts_status_idx ON public.cms_drafts (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.cms_page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.cms_pages(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  draft_id uuid REFERENCES public.cms_drafts(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, version)
);
CREATE TABLE IF NOT EXISTS public.cms_form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.cms_forms(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  draft_id uuid REFERENCES public.cms_drafts(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_id, version)
);
CREATE TABLE IF NOT EXISTS public.cms_menu_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL UNIQUE,
  snapshot jsonb NOT NULL,
  draft_id uuid REFERENCES public.cms_drafts(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cms_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.cms_forms(id) ON DELETE CASCADE,
  form_version integer NOT NULL,
  submitter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'archived')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cms_form_submissions_form_idx ON public.cms_form_submissions (form_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cms_form_submissions_user_idx ON public.cms_form_submissions (submitter_id, form_id, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cms_pages', 'cms_forms', 'cms_menu_items', 'cms_drafts', 'cms_page_versions',
                           'cms_form_versions', 'cms_menu_versions', 'cms_form_submissions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------- public views
CREATE OR REPLACE VIEW public.cms_pages_public_v AS
  SELECT id, domain, slug, title_id, title_en, summary_id, summary_en, blocks, version, published_at, updated_at
    FROM public.cms_pages WHERE status = 'published';
CREATE OR REPLACE VIEW public.cms_forms_public_v AS
  SELECT id, domain, slug, title_id, title_en, description_id, description_en, fields, max_per_user_per_day, version
    FROM public.cms_forms WHERE status = 'published';
CREATE OR REPLACE VIEW public.cms_menu_public_v AS
  SELECT m.id, m.parent_id, m.label_id, m.label_en, m.href, m.is_external, m.icon, m.sort_order
    FROM public.cms_menu_items m
   WHERE m.is_active AND (m.parent_id IS NULL OR EXISTS (
     SELECT 1 FROM public.cms_menu_items p WHERE p.id = m.parent_id AND p.is_active));
REVOKE ALL ON public.cms_pages_public_v, public.cms_forms_public_v, public.cms_menu_public_v FROM anon, authenticated;
GRANT SELECT ON public.cms_pages_public_v, public.cms_forms_public_v, public.cms_menu_public_v TO anon, authenticated;
GRANT ALL ON public.cms_pages_public_v, public.cms_forms_public_v, public.cms_menu_public_v TO service_role;

-- ------------------------------------------------------------- validation
CREATE OR REPLACE FUNCTION public._cms_block_problem(_b jsonb, _domain text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type text := _b->>'type'; v_item jsonb; v_n integer;
BEGIN
  IF jsonb_typeof(_b) IS DISTINCT FROM 'object' THEN RETURN 'cms_block_invalid'; END IF;
  IF v_type = 'banner' THEN
    IF NOT public._cms_s(_b, 'title_id', 2, 160) OR NOT public._cms_s(_b, 'title_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
    IF NOT public._cms_s(_b, 'text_id', 0, 1000) OR NOT public._cms_s(_b, 'text_en', 0, 1000) THEN RETURN 'cms_block_text_invalid'; END IF;
    IF NOT public._cms_image_ok(_b, 'image') THEN RETURN 'cms_block_image_invalid'; END IF;
    IF _b ? 'stats' AND jsonb_typeof(_b->'stats') <> 'null' THEN
      IF jsonb_typeof(_b->'stats') <> 'array' OR jsonb_array_length(_b->'stats') > 4 THEN RETURN 'cms_block_stats_invalid'; END IF;
      FOR v_item IN SELECT * FROM jsonb_array_elements(_b->'stats') LOOP
        IF NOT public._cms_s(v_item, 'label_id', 1, 60) OR NOT public._cms_s(v_item, 'label_en', 0, 60)
           OR NOT public._cms_s(v_item, 'value', 1, 30) THEN RETURN 'cms_block_stats_invalid'; END IF;
      END LOOP;
    END IF;
  ELSIF v_type = 'text' THEN
    IF NOT public._cms_s(_b, 'heading_id', 0, 160) OR NOT public._cms_s(_b, 'heading_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
    IF NOT public._cms_s(_b, 'body_id', 1, 5000) OR NOT public._cms_s(_b, 'body_en', 0, 5000) THEN RETURN 'cms_block_text_invalid'; END IF;
  ELSIF v_type = 'cards' THEN
    IF NOT public._cms_s(_b, 'heading_id', 0, 160) OR NOT public._cms_s(_b, 'heading_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
    IF jsonb_typeof(_b->'items') IS DISTINCT FROM 'array' THEN RETURN 'cms_block_items_invalid'; END IF;
    v_n := jsonb_array_length(_b->'items');
    IF v_n < 1 OR v_n > 12 THEN RETURN 'cms_block_items_invalid'; END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(_b->'items') LOOP
      IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN RETURN 'cms_block_items_invalid'; END IF;
      IF NOT public._cms_s(v_item, 'title_id', 2, 160) OR NOT public._cms_s(v_item, 'title_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
      IF NOT public._cms_s(v_item, 'text_id', 0, 600) OR NOT public._cms_s(v_item, 'text_en', 0, 600) THEN RETURN 'cms_block_text_invalid'; END IF;
      IF NOT public._cms_image_ok(v_item, 'image') THEN RETURN 'cms_block_image_invalid'; END IF;
      IF NOT public._cms_s(v_item, 'url', 0, 500) OR (COALESCE(btrim(v_item->>'url'), '') <> '' AND NOT public._cms_url_ok(btrim(v_item->>'url'))) THEN
        RETURN 'cms_block_url_invalid';
      END IF;
    END LOOP;
  ELSIF v_type = 'cta' THEN
    IF NOT public._cms_s(_b, 'title_id', 2, 160) OR NOT public._cms_s(_b, 'title_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
    IF NOT public._cms_s(_b, 'text_id', 0, 600) OR NOT public._cms_s(_b, 'text_en', 0, 600) THEN RETURN 'cms_block_text_invalid'; END IF;
    IF NOT public._cms_s(_b, 'button_id', 1, 60) OR NOT public._cms_s(_b, 'button_en', 0, 60) THEN RETURN 'cms_block_button_invalid'; END IF;
    IF NOT public._cms_url_ok(btrim(COALESCE(_b->>'url', ''))) THEN RETURN 'cms_block_url_invalid'; END IF;
  ELSIF v_type = 'faq' THEN
    IF NOT public._cms_s(_b, 'heading_id', 0, 160) OR NOT public._cms_s(_b, 'heading_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
    IF jsonb_typeof(_b->'items') IS DISTINCT FROM 'array' THEN RETURN 'cms_block_items_invalid'; END IF;
    v_n := jsonb_array_length(_b->'items');
    IF v_n < 1 OR v_n > 20 THEN RETURN 'cms_block_items_invalid'; END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(_b->'items') LOOP
      IF NOT public._cms_s(v_item, 'q_id', 2, 300) OR NOT public._cms_s(v_item, 'q_en', 0, 300)
         OR NOT public._cms_s(v_item, 'a_id', 1, 2000) OR NOT public._cms_s(v_item, 'a_en', 0, 2000) THEN
        RETURN 'cms_block_items_invalid';
      END IF;
    END LOOP;
  ELSIF v_type = 'links' THEN
    IF NOT public._cms_s(_b, 'heading_id', 0, 160) OR NOT public._cms_s(_b, 'heading_en', 0, 160) THEN RETURN 'cms_block_title_invalid'; END IF;
    IF jsonb_typeof(_b->'items') IS DISTINCT FROM 'array' THEN RETURN 'cms_block_items_invalid'; END IF;
    v_n := jsonb_array_length(_b->'items');
    IF v_n < 1 OR v_n > 20 THEN RETURN 'cms_block_items_invalid'; END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(_b->'items') LOOP
      IF NOT public._cms_s(v_item, 'label_id', 1, 160) OR NOT public._cms_s(v_item, 'label_en', 0, 160) THEN RETURN 'cms_block_items_invalid'; END IF;
      IF NOT public._cms_url_ok(btrim(COALESCE(v_item->>'url', ''))) THEN RETURN 'cms_block_url_invalid'; END IF;
    END LOOP;
  ELSIF v_type = 'form' THEN
    IF NOT EXISTS (SELECT 1 FROM public.cms_forms f WHERE f.slug = btrim(COALESCE(_b->>'form_slug', ''))
                    AND f.domain = _domain AND f.status <> 'archived') THEN
      RETURN 'cms_block_form_unknown';
    END IF;
  ELSE
    RETURN 'cms_block_type_invalid';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._cms_block_problem(jsonb, text) FROM PUBLIC, anon, authenticated;

-- Returns NULL when valid, otherwise an error code; block errors carry the block
-- number (1-based) after a colon, e.g. 'cms_block_url_invalid:3'.
CREATE OR REPLACE FUNCTION public._cms_page_problem(_p jsonb, _target uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_domain text := _p->>'domain'; v_slug text := btrim(COALESCE(_p->>'slug', '')); v_b jsonb; v_i integer := 0; v_err text;
  v_live public.cms_pages%ROWTYPE;
BEGIN
  IF jsonb_typeof(_p) IS DISTINCT FROM 'object' THEN RETURN 'cms_payload_invalid'; END IF;
  IF v_domain IS NULL OR v_domain NOT IN ('about', 'community', 'fellowship', 'partnership', 'events') THEN RETURN 'cms_domain_invalid'; END IF;
  IF _target IS NOT NULL THEN
    SELECT * INTO v_live FROM public.cms_pages WHERE id = _target;
    IF v_live.id IS NULL THEN RETURN 'cms_target_not_found'; END IF;
    IF v_slug <> v_live.slug OR v_domain <> v_live.domain THEN RETURN 'cms_slug_immutable'; END IF;
  ELSE
    IF NOT public._cms_slug_ok(v_slug) THEN RETURN 'cms_slug_invalid'; END IF;
    IF EXISTS (SELECT 1 FROM public.cms_pages WHERE slug = v_slug) THEN RETURN 'cms_slug_exists'; END IF;
  END IF;
  -- A page named after a menu is that menu's landing page and belongs to it.
  IF v_slug IN ('about', 'community', 'fellowship', 'partnership', 'events') AND v_slug <> v_domain THEN RETURN 'cms_slug_reserved'; END IF;
  IF NOT public._cms_s(_p, 'title_id', 3, 160) THEN RETURN 'cms_title_invalid'; END IF;
  IF NOT public._cms_s(_p, 'title_en', 0, 160) THEN RETURN 'cms_title_en_invalid'; END IF;
  IF NOT public._cms_s(_p, 'summary_id', 0, 500) OR NOT public._cms_s(_p, 'summary_en', 0, 500) THEN RETURN 'cms_summary_invalid'; END IF;
  IF jsonb_typeof(_p->'blocks') IS DISTINCT FROM 'array' THEN RETURN 'cms_blocks_invalid'; END IF;
  IF jsonb_array_length(_p->'blocks') < 1 THEN RETURN 'cms_blocks_required'; END IF;
  IF jsonb_array_length(_p->'blocks') > 30 THEN RETURN 'cms_blocks_too_many'; END IF;
  FOR v_b IN SELECT * FROM jsonb_array_elements(_p->'blocks') LOOP
    v_i := v_i + 1;
    v_err := public._cms_block_problem(v_b, v_domain);
    IF v_err IS NOT NULL THEN RETURN v_err || ':' || v_i; END IF;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._cms_page_problem(jsonb, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cms_form_problem(_p jsonb, _target uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_domain text := _p->>'domain'; v_slug text := btrim(COALESCE(_p->>'slug', '')); v_f jsonb; v_i integer := 0;
  v_keys text[] := '{}'; v_key text; v_type text; v_opt jsonb; v_opts text[]; v_live public.cms_forms%ROWTYPE;
BEGIN
  IF jsonb_typeof(_p) IS DISTINCT FROM 'object' THEN RETURN 'cms_payload_invalid'; END IF;
  IF v_domain IS NULL OR v_domain NOT IN ('about', 'community', 'fellowship', 'partnership', 'events') THEN RETURN 'cms_domain_invalid'; END IF;
  IF _target IS NOT NULL THEN
    SELECT * INTO v_live FROM public.cms_forms WHERE id = _target;
    IF v_live.id IS NULL THEN RETURN 'cms_target_not_found'; END IF;
    IF v_slug <> v_live.slug OR v_domain <> v_live.domain THEN RETURN 'cms_slug_immutable'; END IF;
  ELSE
    IF NOT public._cms_slug_ok(v_slug) THEN RETURN 'cms_slug_invalid'; END IF;
    IF EXISTS (SELECT 1 FROM public.cms_forms WHERE slug = v_slug) THEN RETURN 'cms_slug_exists'; END IF;
  END IF;
  IF NOT public._cms_s(_p, 'title_id', 3, 160) THEN RETURN 'cms_title_invalid'; END IF;
  IF NOT public._cms_s(_p, 'title_en', 0, 160) THEN RETURN 'cms_title_en_invalid'; END IF;
  IF NOT public._cms_s(_p, 'description_id', 0, 2000) OR NOT public._cms_s(_p, 'description_en', 0, 2000) THEN RETURN 'cms_description_invalid'; END IF;
  IF jsonb_typeof(_p->'notify_on_submit') IS DISTINCT FROM 'boolean' THEN RETURN 'cms_payload_invalid'; END IF;
  IF jsonb_typeof(_p->'max_per_user_per_day') IS DISTINCT FROM 'number'
     OR (_p->>'max_per_user_per_day')::numeric NOT BETWEEN 1 AND 20
     OR (_p->>'max_per_user_per_day')::numeric <> trunc((_p->>'max_per_user_per_day')::numeric) THEN RETURN 'cms_form_limit_invalid'; END IF;
  IF jsonb_typeof(_p->'fields') IS DISTINCT FROM 'array' OR jsonb_array_length(_p->'fields') < 1 THEN RETURN 'cms_form_fields_required'; END IF;
  IF jsonb_array_length(_p->'fields') > 30 THEN RETURN 'cms_form_fields_too_many'; END IF;
  FOR v_f IN SELECT * FROM jsonb_array_elements(_p->'fields') LOOP
    v_i := v_i + 1;
    IF jsonb_typeof(v_f) IS DISTINCT FROM 'object' THEN RETURN 'cms_field_invalid:' || v_i; END IF;
    v_key := v_f->>'key';
    IF v_key IS NULL OR v_key !~ '^[a-z][a-z0-9_]{1,39}$' THEN RETURN 'cms_field_key_invalid:' || v_i; END IF;
    IF v_key = ANY (v_keys) THEN RETURN 'cms_field_key_duplicate:' || v_i; END IF;
    v_keys := array_append(v_keys, v_key);
    IF NOT public._cms_s(v_f, 'label_id', 2, 160) OR NOT public._cms_s(v_f, 'label_en', 0, 160) THEN RETURN 'cms_field_label_invalid:' || v_i; END IF;
    IF NOT public._cms_s(v_f, 'help_id', 0, 300) OR NOT public._cms_s(v_f, 'help_en', 0, 300) THEN RETURN 'cms_field_help_invalid:' || v_i; END IF;
    IF jsonb_typeof(v_f->'required') IS DISTINCT FROM 'boolean' THEN RETURN 'cms_field_invalid:' || v_i; END IF;
    v_type := v_f->>'type';
    IF v_type IS NULL OR v_type NOT IN ('text', 'textarea', 'email', 'number', 'date', 'select', 'checkbox') THEN RETURN 'cms_field_type_invalid:' || v_i; END IF;
    IF v_type = 'select' THEN
      IF jsonb_typeof(v_f->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(v_f->'options') NOT BETWEEN 2 AND 30 THEN
        RETURN 'cms_field_options_invalid:' || v_i;
      END IF;
      v_opts := '{}';
      FOR v_opt IN SELECT * FROM jsonb_array_elements(v_f->'options') LOOP
        IF jsonb_typeof(v_opt) <> 'string' OR char_length(btrim(v_opt #>> '{}')) NOT BETWEEN 1 AND 100
           OR btrim(v_opt #>> '{}') = ANY (v_opts) THEN RETURN 'cms_field_options_invalid:' || v_i; END IF;
        v_opts := array_append(v_opts, btrim(v_opt #>> '{}'));
      END LOOP;
    END IF;
    IF v_f ? 'max_length' AND jsonb_typeof(v_f->'max_length') <> 'null' THEN
      IF v_type NOT IN ('text', 'textarea') OR jsonb_typeof(v_f->'max_length') <> 'number'
         OR (v_f->>'max_length')::numeric NOT BETWEEN 1 AND 5000 THEN RETURN 'cms_field_max_invalid:' || v_i; END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._cms_form_problem(jsonb, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cms_menu_item_problem(_m jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_href text := btrim(COALESCE(_m->>'href', ''));
BEGIN
  IF jsonb_typeof(_m) IS DISTINCT FROM 'object' THEN RETURN 'cms_menu_item_invalid'; END IF;
  IF NOT public._cms_s(_m, 'label_id', 1, 40) OR NOT public._cms_s(_m, 'label_en', 0, 40) THEN RETURN 'cms_menu_label_invalid'; END IF;
  IF NOT public._cms_url_ok(v_href) THEN RETURN 'cms_menu_href_invalid'; END IF;
  IF jsonb_typeof(_m->'is_external') IS DISTINCT FROM 'boolean' OR jsonb_typeof(_m->'is_active') IS DISTINCT FROM 'boolean' THEN
    RETURN 'cms_menu_item_invalid';
  END IF;
  IF (_m->>'is_external')::boolean <> (v_href ~* '^https://') THEN RETURN 'cms_menu_external_mismatch'; END IF;
  IF _m ? 'icon' AND jsonb_typeof(_m->'icon') <> 'null' AND (_m->>'icon') NOT IN
     ('home', 'academy', 'knowledge', 'experts', 'fellowship', 'community', 'events', 'partnership', 'about', 'link') THEN
    RETURN 'cms_menu_icon_invalid';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._cms_menu_item_problem(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cms_menu_problem(_p jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_top jsonb; v_child jsonb; v_i integer := 0; v_err text;
BEGIN
  IF jsonb_typeof(_p) IS DISTINCT FROM 'object' OR jsonb_typeof(_p->'items') IS DISTINCT FROM 'array' THEN RETURN 'cms_payload_invalid'; END IF;
  IF jsonb_array_length(_p->'items') < 1 THEN RETURN 'cms_menu_empty'; END IF;
  IF jsonb_array_length(_p->'items') > 12 THEN RETURN 'cms_menu_too_many'; END IF;
  FOR v_top IN SELECT * FROM jsonb_array_elements(_p->'items') LOOP
    v_i := v_i + 1;
    v_err := public._cms_menu_item_problem(v_top);
    IF v_err IS NOT NULL THEN RETURN v_err || ':' || v_i; END IF;
    IF v_top ? 'children' AND jsonb_typeof(v_top->'children') <> 'null' THEN
      IF jsonb_typeof(v_top->'children') <> 'array' OR jsonb_array_length(v_top->'children') > 12 THEN RETURN 'cms_menu_children_invalid:' || v_i; END IF;
      FOR v_child IN SELECT * FROM jsonb_array_elements(v_top->'children') LOOP
        IF v_child ? 'children' AND jsonb_typeof(v_child->'children') = 'array' AND jsonb_array_length(v_child->'children') > 0 THEN
          RETURN 'cms_menu_too_deep:' || v_i;
        END IF;
        v_err := public._cms_menu_item_problem(v_child);
        IF v_err IS NOT NULL THEN RETURN v_err || ':' || v_i; END IF;
      END LOOP;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._cms_menu_problem(jsonb) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- snapshots (payload shape)
CREATE OR REPLACE FUNCTION public._cms_page_snapshot(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('domain', domain, 'slug', slug, 'title_id', title_id, 'title_en', COALESCE(title_en, ''),
           'summary_id', COALESCE(summary_id, ''), 'summary_en', COALESCE(summary_en, ''), 'blocks', blocks)
    FROM public.cms_pages WHERE id = _id
$$;
REVOKE ALL ON FUNCTION public._cms_page_snapshot(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cms_form_snapshot(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('domain', domain, 'slug', slug, 'title_id', title_id, 'title_en', COALESCE(title_en, ''),
           'description_id', COALESCE(description_id, ''), 'description_en', COALESCE(description_en, ''),
           'fields', fields, 'notify_on_submit', notify_on_submit, 'max_per_user_per_day', max_per_user_per_day)
    FROM public.cms_forms WHERE id = _id
$$;
REVOKE ALL ON FUNCTION public._cms_form_snapshot(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cms_menu_snapshot()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('items', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('label_id', t.label_id, 'label_en', COALESCE(t.label_en, ''), 'href', t.href,
             'is_external', t.is_external, 'is_active', t.is_active, 'icon', t.icon,
             'children', COALESCE((SELECT jsonb_agg(jsonb_build_object('label_id', c.label_id, 'label_en', COALESCE(c.label_en, ''),
                 'href', c.href, 'is_external', c.is_external, 'is_active', c.is_active, 'icon', c.icon) ORDER BY c.sort_order, c.created_at)
               FROM public.cms_menu_items c WHERE c.parent_id = t.id), '[]'::jsonb))
           ORDER BY t.sort_order, t.created_at)
      FROM public.cms_menu_items t WHERE t.parent_id IS NULL), '[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION public._cms_menu_snapshot() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cms_menu_version()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(max(version), 0) FROM public.cms_menu_versions
$$;
REVOKE ALL ON FUNCTION public._cms_menu_version() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cms_draft_problem(_d public.cms_drafts)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _d.kind WHEN 'page' THEN public._cms_page_problem(_d.payload, _d.target_id)
                      WHEN 'form' THEN public._cms_form_problem(_d.payload, _d.target_id)
                      ELSE public._cms_menu_problem(_d.payload) END
$$;
REVOKE ALL ON FUNCTION public._cms_draft_problem(public.cms_drafts) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cms_live_snapshot(_kind text, _target uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _kind WHEN 'page' THEN public._cms_page_snapshot(_target)
                    WHEN 'form' THEN public._cms_form_snapshot(_target)
                    ELSE public._cms_menu_snapshot() END
$$;
REVOKE ALL ON FUNCTION public._cms_live_snapshot(text, uuid) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- read
CREATE OR REPLACE FUNCTION public.cms_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_edit text[]; v_review text[]; d text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  v_edit := '{}'; v_review := '{}';
  FOREACH d IN ARRAY ARRAY['about', 'community', 'fellowship', 'partnership', 'events'] LOOP
    IF public._cms_can_edit(v_uid, d) THEN v_edit := array_append(v_edit, d); END IF;
    IF public._cms_can_review_submissions(v_uid, d) THEN v_review := array_append(v_review, d); END IF;
  END LOOP;
  IF cardinality(v_edit) = 0 AND cardinality(v_review) = 0 AND NOT public._can_decide_review(v_uid)
     AND NOT public._can_publish(v_uid) AND NOT public._cms_can_edit(v_uid, 'navigation') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'can', jsonb_build_object('editDomains', to_jsonb(v_edit), 'reviewDomains', to_jsonb(v_review),
      'decide', public._can_decide_review(v_uid), 'publish', public._can_publish(v_uid),
      'editMenu', public._cms_can_edit(v_uid, 'navigation'), 'decideMenu', public._cms_can_decide(v_uid, 'navigation')),
    'pages', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'domain', p.domain, 'slug', p.slug,
        'title', p.title_id, 'status', p.status, 'version', p.version, 'updatedAt', p.updated_at, 'statusReason', p.status_reason,
        'openDraftId', (SELECT x.id FROM public.cms_drafts x WHERE x.kind = 'page' AND x.target_id = p.id
                          AND x.status IN ('draft', 'submitted', 'revision_requested')))
        ORDER BY p.domain, p.slug) FROM public.cms_pages p), '[]'::jsonb),
    'forms', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'domain', f.domain, 'slug', f.slug,
        'title', f.title_id, 'status', f.status, 'version', f.version, 'updatedAt', f.updated_at, 'statusReason', f.status_reason,
        'newSubmissions', (SELECT count(*) FROM public.cms_form_submissions s WHERE s.form_id = f.id AND s.status = 'new'),
        'openDraftId', (SELECT x.id FROM public.cms_drafts x WHERE x.kind = 'form' AND x.target_id = f.id
                          AND x.status IN ('draft', 'submitted', 'revision_requested')))
        ORDER BY f.domain, f.slug) FROM public.cms_forms f), '[]'::jsonb),
    'menu', jsonb_build_object('version', public._cms_menu_version(), 'snapshot', public._cms_menu_snapshot(),
        'openDraftId', (SELECT x.id FROM public.cms_drafts x WHERE x.kind = 'menu' AND x.status IN ('draft', 'submitted', 'revision_requested'))),
    'drafts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', x.id, 'kind', x.kind, 'domain', x.domain, 'targetId', x.target_id, 'status', x.status,
        'title', COALESCE(NULLIF(btrim(x.payload->>'title_id'), ''), CASE WHEN x.kind = 'menu' THEN 'Menu navigasi' END, '(tanpa judul)'),
        'slug', x.payload->>'slug',
        'createdBy', (SELECT display_name FROM public.profiles WHERE id = x.created_by), 'mine', x.created_by = v_uid,
        'submittedAt', x.submitted_at, 'updatedAt', x.updated_at, 'decisionNote', x.decision_note)
        ORDER BY (x.status = 'submitted') DESC, x.updated_at DESC)
        FROM (SELECT * FROM public.cms_drafts
               WHERE status IN ('draft', 'submitted', 'revision_requested') OR updated_at > now() - interval '30 days'
               ORDER BY updated_at DESC LIMIT 200) x), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.cms_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cms_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.cms_draft_get(_draft_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_d public.cms_drafts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_d FROM public.cms_drafts WHERE id = _draft_id;
  IF v_d.id IS NULL THEN RAISE EXCEPTION 'cms_draft_not_found'; END IF;
  IF NOT (public._cms_can_edit(v_uid, v_d.domain) OR public._cms_can_decide(v_uid, v_d.domain)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'id', v_d.id, 'kind', v_d.kind, 'domain', v_d.domain, 'targetId', v_d.target_id, 'status', v_d.status,
    'payload', v_d.payload, 'baseVersion', v_d.base_version, 'updatedAt', v_d.updated_at, 'submittedAt', v_d.submitted_at,
    'decisionNote', v_d.decision_note, 'decidedAt', v_d.decided_at,
    'createdBy', (SELECT display_name FROM public.profiles WHERE id = v_d.created_by),
    'mine', v_d.created_by = v_uid,
    'canEdit', v_d.created_by = v_uid AND public._cms_can_edit(v_uid, v_d.domain),
    'canDecide', public._cms_can_decide(v_uid, v_d.domain) AND v_uid <> v_d.created_by AND v_uid IS DISTINCT FROM v_d.submitted_by,
    'problem', public._cms_draft_problem(v_d),
    'live', CASE WHEN v_d.kind = 'menu' THEN public._cms_menu_snapshot()
                 WHEN v_d.target_id IS NULL THEN NULL ELSE public._cms_live_snapshot(v_d.kind, v_d.target_id) END,
    'versions', CASE v_d.kind
      WHEN 'page' THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('version', v.version, 'approvedAt', v.approved_at,
          'approvedBy', (SELECT display_name FROM public.profiles WHERE id = v.approved_by)) ORDER BY v.version DESC)
          FROM public.cms_page_versions v WHERE v.page_id = v_d.target_id), '[]'::jsonb)
      WHEN 'form' THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('version', v.version, 'approvedAt', v.approved_at,
          'approvedBy', (SELECT display_name FROM public.profiles WHERE id = v.approved_by)) ORDER BY v.version DESC)
          FROM public.cms_form_versions v WHERE v.form_id = v_d.target_id), '[]'::jsonb)
      ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object('version', v.version, 'approvedAt', v.approved_at,
          'approvedBy', (SELECT display_name FROM public.profiles WHERE id = v.approved_by)) ORDER BY v.version DESC)
          FROM (SELECT * FROM public.cms_menu_versions ORDER BY version DESC LIMIT 20) v), '[]'::jsonb) END);
END $$;
REVOKE ALL ON FUNCTION public.cms_draft_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cms_draft_get(uuid) TO authenticated;

-- ------------------------------------------------------------- drafts
CREATE OR REPLACE FUNCTION public.cms_draft_open(_kind text, _target_id uuid, _domain text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_payload jsonb; v_version integer; v_domain text; v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF _kind IS NULL OR _kind NOT IN ('page', 'form', 'menu') THEN RAISE EXCEPTION 'cms_kind_invalid'; END IF;

  IF _kind = 'menu' THEN
    v_domain := 'navigation';
    IF NOT public._cms_can_edit(v_uid, v_domain) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext('cms_menu'));
    IF EXISTS (SELECT 1 FROM public.cms_drafts WHERE kind = 'menu' AND status IN ('draft', 'submitted', 'revision_requested')) THEN
      RAISE EXCEPTION 'cms_draft_exists';
    END IF;
    v_version := public._cms_menu_version();
    v_payload := public._cms_menu_snapshot();
    INSERT INTO public.cms_drafts (kind, target_id, domain, base_version, payload, created_by)
    VALUES ('menu', NULL, v_domain, v_version, v_payload, v_uid) RETURNING id INTO v_id;
  ELSIF _target_id IS NULL THEN
    v_domain := _domain;
    IF v_domain IS NULL OR v_domain NOT IN ('about', 'community', 'fellowship', 'partnership', 'events') THEN RAISE EXCEPTION 'cms_domain_invalid'; END IF;
    IF NOT public._cms_can_edit(v_uid, v_domain) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
    v_payload := CASE _kind WHEN 'page'
      THEN jsonb_build_object('domain', v_domain, 'slug', '', 'title_id', '', 'title_en', '', 'summary_id', '', 'summary_en', '', 'blocks', '[]'::jsonb)
      ELSE jsonb_build_object('domain', v_domain, 'slug', '', 'title_id', '', 'title_en', '', 'description_id', '', 'description_en', '',
             'fields', '[]'::jsonb, 'notify_on_submit', true, 'max_per_user_per_day', 3) END;
    INSERT INTO public.cms_drafts (kind, target_id, domain, base_version, payload, created_by)
    VALUES (_kind, NULL, v_domain, NULL, v_payload, v_uid) RETURNING id INTO v_id;
  ELSE
    PERFORM pg_advisory_xact_lock(hashtextextended('cms_draft:' || _target_id::text, 0));
    IF _kind = 'page' THEN
      SELECT domain, version, status INTO v_domain, v_version, v_status FROM public.cms_pages WHERE id = _target_id;
    ELSE
      SELECT domain, version, status INTO v_domain, v_version, v_status FROM public.cms_forms WHERE id = _target_id;
    END IF;
    IF v_domain IS NULL THEN RAISE EXCEPTION 'cms_target_not_found'; END IF;
    IF NOT public._cms_can_edit(v_uid, v_domain) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
    IF v_status = 'archived' THEN RAISE EXCEPTION 'cms_archived'; END IF;
    IF EXISTS (SELECT 1 FROM public.cms_drafts WHERE kind = _kind AND target_id = _target_id
                AND status IN ('draft', 'submitted', 'revision_requested')) THEN
      RAISE EXCEPTION 'cms_draft_exists';
    END IF;
    v_payload := public._cms_live_snapshot(_kind, _target_id);
    INSERT INTO public.cms_drafts (kind, target_id, domain, base_version, payload, created_by)
    VALUES (_kind, _target_id, v_domain, v_version, v_payload, v_uid) RETURNING id INTO v_id;
  END IF;
  PERFORM public.log_governance_event('cms_draft_opened', v_uid, NULL, 'cms_draft', v_id::text,
    NULL, jsonb_build_object('kind', _kind, 'target_id', _target_id, 'domain', v_domain, 'base_version', v_version));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.cms_draft_open(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cms_draft_open(text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cms_draft_save(_draft_id uuid, _payload jsonb, _expected_updated_at timestamptz)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_d public.cms_drafts%ROWTYPE; v_now timestamptz := clock_timestamp();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_d FROM public.cms_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_d.id IS NULL THEN RAISE EXCEPTION 'cms_draft_not_found'; END IF;
  IF v_d.created_by <> v_uid OR NOT public._cms_can_edit(v_uid, v_d.domain) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF v_d.status NOT IN ('draft', 'revision_requested') THEN RAISE EXCEPTION 'cms_draft_not_editable'; END IF;
  IF _expected_updated_at IS NULL OR _expected_updated_at <> v_d.updated_at THEN RAISE EXCEPTION 'cms_draft_stale'; END IF;
  IF jsonb_typeof(_payload) IS DISTINCT FROM 'object' OR octet_length(_payload::text) > 200000 THEN RAISE EXCEPTION 'cms_payload_invalid'; END IF;
  -- The menu a page/form belongs to never changes inside a draft.
  IF v_d.kind <> 'menu' AND (_payload->>'domain') IS DISTINCT FROM v_d.domain THEN RAISE EXCEPTION 'cms_domain_immutable'; END IF;
  UPDATE public.cms_drafts SET payload = _payload, updated_at = v_now WHERE id = _draft_id;
  RETURN v_now;
END $$;
REVOKE ALL ON FUNCTION public.cms_draft_save(uuid, jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cms_draft_save(uuid, jsonb, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.cms_draft_submit(_draft_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_d public.cms_drafts%ROWTYPE; v_problem text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_d FROM public.cms_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_d.id IS NULL THEN RAISE EXCEPTION 'cms_draft_not_found'; END IF;
  IF v_d.created_by <> v_uid OR NOT public._cms_can_edit(v_uid, v_d.domain) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF v_d.status NOT IN ('draft', 'revision_requested') THEN RAISE EXCEPTION 'cms_draft_not_editable'; END IF;
  v_problem := public._cms_draft_problem(v_d);
  IF v_problem IS NOT NULL THEN RAISE EXCEPTION '%', v_problem; END IF;
  IF (v_d.kind = 'menu' OR v_d.target_id IS NOT NULL)
     AND v_d.payload = public._cms_live_snapshot(v_d.kind, v_d.target_id) THEN
    RAISE EXCEPTION 'cms_draft_unchanged';
  END IF;
  UPDATE public.cms_drafts
     SET status = 'submitted', submitted_by = v_uid, submitted_at = clock_timestamp(), updated_at = clock_timestamp()
   WHERE id = _draft_id;
  PERFORM public.log_governance_event('cms_draft_submitted', v_uid, NULL, 'cms_draft', _draft_id::text,
    NULL, jsonb_build_object('kind', v_d.kind, 'target_id', v_d.target_id, 'domain', v_d.domain));
END $$;
REVOKE ALL ON FUNCTION public.cms_draft_submit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cms_draft_submit(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cms_draft_withdraw(_draft_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_d public.cms_drafts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_d FROM public.cms_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_d.id IS NULL THEN RAISE EXCEPTION 'cms_draft_not_found'; END IF;
  -- The author withdraws their own draft; a decider may clear an abandoned one.
  IF NOT ((v_d.created_by = v_uid AND public._cms_can_edit(v_uid, v_d.domain)) OR public._cms_can_decide(v_uid, v_d.domain)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_d.status NOT IN ('draft', 'submitted', 'revision_requested') THEN RAISE EXCEPTION 'cms_draft_not_editable'; END IF;
  UPDATE public.cms_drafts SET status = 'withdrawn', updated_at = clock_timestamp() WHERE id = _draft_id;
  PERFORM public.log_governance_event('cms_draft_withdrawn', v_uid, NULL, 'cms_draft', _draft_id::text,
    jsonb_build_object('status', v_d.status), jsonb_build_object('status', 'withdrawn'));
END $$;
REVOKE ALL ON FUNCTION public.cms_draft_withdraw(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cms_draft_withdraw(uuid) TO authenticated;

-- ------------------------------------------------------------- apply (internal)
CREATE OR REPLACE FUNCTION public._cms_apply_page(_d public.cms_drafts, _uid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p jsonb := _d.payload; v_id uuid; v_version integer;
BEGIN
  IF _d.target_id IS NULL THEN
    INSERT INTO public.cms_pages (domain, slug, title_id, title_en, summary_id, summary_en, blocks, status, version)
    VALUES (_d.domain, btrim(v_p->>'slug'), btrim(v_p->>'title_id'), NULLIF(btrim(COALESCE(v_p->>'title_en', '')), ''),
            NULLIF(btrim(COALESCE(v_p->>'summary_id', '')), ''), NULLIF(btrim(COALESCE(v_p->>'summary_en', '')), ''),
            v_p->'blocks', 'published', 1)
    RETURNING id, version INTO v_id, v_version;
  ELSE
    v_id := _d.target_id;
    UPDATE public.cms_pages
       SET title_id = btrim(v_p->>'title_id'), title_en = NULLIF(btrim(COALESCE(v_p->>'title_en', '')), ''),
           summary_id = NULLIF(btrim(COALESCE(v_p->>'summary_id', '')), ''), summary_en = NULLIF(btrim(COALESCE(v_p->>'summary_en', '')), ''),
           blocks = v_p->'blocks', version = version + 1, updated_at = now()
     WHERE id = v_id RETURNING version INTO v_version;
  END IF;
  INSERT INTO public.cms_page_versions (page_id, version, snapshot, draft_id, approved_by)
  VALUES (v_id, v_version, public._cms_page_snapshot(v_id), _d.id, _uid);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public._cms_apply_page(public.cms_drafts, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cms_apply_form(_d public.cms_drafts, _uid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p jsonb := _d.payload; v_id uuid; v_version integer;
BEGIN
  IF _d.target_id IS NULL THEN
    INSERT INTO public.cms_forms (domain, slug, title_id, title_en, description_id, description_en, fields,
                                  notify_on_submit, max_per_user_per_day, status, version)
    VALUES (_d.domain, btrim(v_p->>'slug'), btrim(v_p->>'title_id'), NULLIF(btrim(COALESCE(v_p->>'title_en', '')), ''),
            NULLIF(btrim(COALESCE(v_p->>'description_id', '')), ''), NULLIF(btrim(COALESCE(v_p->>'description_en', '')), ''),
            v_p->'fields', (v_p->>'notify_on_submit')::boolean, (v_p->>'max_per_user_per_day')::integer, 'published', 1)
    RETURNING id, version INTO v_id, v_version;
  ELSE
    v_id := _d.target_id;
    UPDATE public.cms_forms
       SET title_id = btrim(v_p->>'title_id'), title_en = NULLIF(btrim(COALESCE(v_p->>'title_en', '')), ''),
           description_id = NULLIF(btrim(COALESCE(v_p->>'description_id', '')), ''),
           description_en = NULLIF(btrim(COALESCE(v_p->>'description_en', '')), ''),
           fields = v_p->'fields', notify_on_submit = (v_p->>'notify_on_submit')::boolean,
           max_per_user_per_day = (v_p->>'max_per_user_per_day')::integer, version = version + 1, updated_at = now()
     WHERE id = v_id RETURNING version INTO v_version;
  END IF;
  INSERT INTO public.cms_form_versions (form_id, version, snapshot, draft_id, approved_by)
  VALUES (v_id, v_version, public._cms_form_snapshot(v_id), _d.id, _uid);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public._cms_apply_form(public.cms_drafts, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cms_apply_menu(_d public.cms_drafts, _uid uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_top jsonb; v_child jsonb; v_parent uuid; v_i integer := 0; v_j integer; v_version integer;
BEGIN
  DELETE FROM public.cms_menu_items WHERE id IS NOT NULL;
  FOR v_top IN SELECT * FROM jsonb_array_elements(_d.payload->'items') LOOP
    v_i := v_i + 1;
    INSERT INTO public.cms_menu_items (parent_id, label_id, label_en, href, is_external, icon, sort_order, is_active)
    VALUES (NULL, btrim(v_top->>'label_id'), NULLIF(btrim(COALESCE(v_top->>'label_en', '')), ''), btrim(v_top->>'href'),
            (v_top->>'is_external')::boolean, NULLIF(v_top->>'icon', ''), v_i, (v_top->>'is_active')::boolean)
    RETURNING id INTO v_parent;
    v_j := 0;
    IF jsonb_typeof(v_top->'children') = 'array' THEN
      FOR v_child IN SELECT * FROM jsonb_array_elements(v_top->'children') LOOP
        v_j := v_j + 1;
        INSERT INTO public.cms_menu_items (parent_id, label_id, label_en, href, is_external, icon, sort_order, is_active)
        VALUES (v_parent, btrim(v_child->>'label_id'), NULLIF(btrim(COALESCE(v_child->>'label_en', '')), ''), btrim(v_child->>'href'),
                (v_child->>'is_external')::boolean, NULLIF(v_child->>'icon', ''), v_j, (v_child->>'is_active')::boolean);
      END LOOP;
    END IF;
  END LOOP;
  v_version := public._cms_menu_version() + 1;
  INSERT INTO public.cms_menu_versions (version, snapshot, draft_id, approved_by)
  VALUES (v_version, public._cms_menu_snapshot(), _d.id, _uid);
  RETURN v_version;
END $$;
REVOKE ALL ON FUNCTION public._cms_apply_menu(public.cms_drafts, uuid) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- decide
CREATE OR REPLACE FUNCTION public.cms_draft_decide(_draft_id uuid, _decision text, _note text, _expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_d public.cms_drafts%ROWTYPE; v_note text := NULLIF(btrim(COALESCE(_note, '')), '');
  v_problem text; v_live_version integer; v_result uuid; v_before jsonb; v_menu_version integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF _decision IS NULL OR _decision NOT IN ('approve', 'request_revision', 'reject') THEN RAISE EXCEPTION 'cms_decision_invalid'; END IF;
  IF _decision <> 'approve' AND (v_note IS NULL OR char_length(v_note) < 5) THEN RAISE EXCEPTION 'cms_note_required'; END IF;
  IF char_length(COALESCE(v_note, '')) > 2000 THEN RAISE EXCEPTION 'cms_note_too_long'; END IF;

  SELECT * INTO v_d FROM public.cms_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_d.id IS NULL THEN RAISE EXCEPTION 'cms_draft_not_found'; END IF;
  IF NOT public._cms_can_decide(v_uid, v_d.domain) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF v_d.created_by = v_uid OR v_d.submitted_by = v_uid THEN RAISE EXCEPTION 'cms_self_decision_forbidden'; END IF;
  IF v_d.status <> 'submitted' THEN RAISE EXCEPTION 'cms_not_submitted'; END IF;
  IF _expected_updated_at IS NULL OR _expected_updated_at <> v_d.updated_at THEN RAISE EXCEPTION 'cms_draft_stale'; END IF;

  IF _decision = 'approve' THEN
    IF v_d.kind = 'menu' THEN
      PERFORM pg_advisory_xact_lock(hashtext('cms_menu'));
      IF public._cms_menu_version() IS DISTINCT FROM v_d.base_version THEN RAISE EXCEPTION 'cms_stale'; END IF;
      v_before := public._cms_menu_snapshot();
    ELSIF v_d.target_id IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(hashtextextended('cms_draft:' || v_d.target_id::text, 0));
      IF v_d.kind = 'page' THEN
        SELECT version INTO v_live_version FROM public.cms_pages WHERE id = v_d.target_id FOR UPDATE;
      ELSE
        SELECT version INTO v_live_version FROM public.cms_forms WHERE id = v_d.target_id FOR UPDATE;
      END IF;
      IF v_live_version IS NULL THEN RAISE EXCEPTION 'cms_target_not_found'; END IF;
      IF v_live_version IS DISTINCT FROM v_d.base_version THEN RAISE EXCEPTION 'cms_stale'; END IF;
      v_before := public._cms_live_snapshot(v_d.kind, v_d.target_id);
    ELSE
      PERFORM pg_advisory_xact_lock(hashtext('cms_new:' || v_d.kind));
    END IF;
    -- Re-checked: a slug may have been taken or a linked form archived since submit.
    v_problem := public._cms_draft_problem(v_d);
    IF v_problem IS NOT NULL THEN RAISE EXCEPTION '%', v_problem; END IF;
    IF v_d.kind = 'page' THEN v_result := public._cms_apply_page(v_d, v_uid);
    ELSIF v_d.kind = 'form' THEN v_result := public._cms_apply_form(v_d, v_uid);
    ELSE v_menu_version := public._cms_apply_menu(v_d, v_uid);
    END IF;
  END IF;

  UPDATE public.cms_drafts
     SET status = CASE _decision WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'revision_requested' END,
         decided_by = v_uid, decided_at = clock_timestamp(), decision_note = v_note, result_id = v_result,
         updated_at = clock_timestamp()
   WHERE id = _draft_id;
  PERFORM public.log_governance_event('cms_draft_' || CASE _decision WHEN 'approve' THEN 'approved'
                                        WHEN 'reject' THEN 'rejected' ELSE 'revision_requested' END,
    v_uid, NULL, 'cms_' || v_d.kind, COALESCE(v_result, v_d.target_id, v_d.id)::text,
    v_before, jsonb_build_object('draft_id', v_d.id, 'note', v_note, 'payload', v_d.payload, 'menu_version', v_menu_version));
  RETURN jsonb_build_object('status', _decision, 'resultId', v_result, 'menuVersion', v_menu_version);
END $$;
REVOKE ALL ON FUNCTION public.cms_draft_decide(uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cms_draft_decide(uuid, text, text, timestamptz) TO authenticated;

-- ------------------------------------------------------------- status (LS-04)
-- page: published <-> on_hold (publisher); form: published <-> closed (publisher);
-- either -> archived (decider). Reason required; archived stays archived.
CREATE OR REPLACE FUNCTION public.cms_set_status(_kind text, _id uuid, _status text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_old text; v_reason text := btrim(COALESCE(_reason, '')); v_hold text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF char_length(v_reason) < 5 OR char_length(v_reason) > 500 THEN RAISE EXCEPTION 'cms_reason_required'; END IF;
  IF _kind NOT IN ('page', 'form') OR _kind IS NULL THEN RAISE EXCEPTION 'cms_kind_invalid'; END IF;
  v_hold := CASE _kind WHEN 'page' THEN 'on_hold' ELSE 'closed' END;
  IF _status IS NULL OR _status NOT IN ('published', v_hold, 'archived') THEN RAISE EXCEPTION 'cms_status_invalid'; END IF;
  IF _status = 'archived' THEN
    IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  ELSIF NOT public._can_publish(v_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('cms_draft:' || _id::text, 0));
  IF _kind = 'page' THEN
    SELECT status INTO v_old FROM public.cms_pages WHERE id = _id FOR UPDATE;
  ELSE
    SELECT status INTO v_old FROM public.cms_forms WHERE id = _id FOR UPDATE;
  END IF;
  IF v_old IS NULL THEN RAISE EXCEPTION 'cms_target_not_found'; END IF;
  IF v_old = 'archived' THEN RAISE EXCEPTION 'cms_archived'; END IF;
  IF v_old = _status THEN RAISE EXCEPTION 'cms_status_unchanged'; END IF;
  IF _status = 'archived' AND EXISTS (SELECT 1 FROM public.cms_drafts WHERE kind = _kind AND target_id = _id
                                       AND status IN ('draft', 'submitted', 'revision_requested')) THEN
    RAISE EXCEPTION 'cms_open_drafts_exist';
  END IF;
  IF _kind = 'page' THEN
    UPDATE public.cms_pages SET status = _status, status_reason = v_reason, status_changed_by = v_uid,
           status_changed_at = now(), updated_at = now() WHERE id = _id;
  ELSE
    UPDATE public.cms_forms SET status = _status, status_reason = v_reason, status_changed_by = v_uid,
           status_changed_at = now(), updated_at = now() WHERE id = _id;
  END IF;
  PERFORM public.log_governance_event('cms_status_changed', v_uid, NULL, 'cms_' || _kind, _id::text,
    jsonb_build_object('status', v_old), jsonb_build_object('status', _status, 'reason', v_reason));
END $$;
REVOKE ALL ON FUNCTION public.cms_set_status(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cms_set_status(text, uuid, text, text) TO authenticated;

-- ------------------------------------------------------------- form submissions
CREATE OR REPLACE FUNCTION public._cms_submission_problem(_fields jsonb, _data jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_f jsonb; v_key text; v_type text; v_v jsonb; v_t text; v_max integer; v_req boolean; v_keys text[] := '{}'; k text;
BEGIN
  IF jsonb_typeof(_data) IS DISTINCT FROM 'object' OR octet_length(_data::text) > 60000 THEN RETURN 'cms_submission_invalid'; END IF;
  FOR v_f IN SELECT * FROM jsonb_array_elements(_fields) LOOP
    v_key := v_f->>'key'; v_type := v_f->>'type'; v_req := COALESCE((v_f->>'required')::boolean, false);
    v_keys := array_append(v_keys, v_key);
    v_v := _data -> v_key;
    IF v_type = 'checkbox' THEN
      IF v_v IS NOT NULL AND jsonb_typeof(v_v) NOT IN ('boolean', 'null') THEN RETURN 'cms_submission_invalid:' || v_key; END IF;
      IF v_req AND (v_v IS NULL OR jsonb_typeof(v_v) <> 'boolean' OR NOT (v_v::text)::boolean) THEN RETURN 'cms_submission_required:' || v_key; END IF;
      CONTINUE;
    END IF;
    IF v_v IS NULL OR jsonb_typeof(v_v) = 'null' OR (jsonb_typeof(v_v) = 'string' AND btrim(v_v #>> '{}') = '') THEN
      IF v_req THEN RETURN 'cms_submission_required:' || v_key; END IF;
      CONTINUE;
    END IF;
    IF v_type = 'number' THEN
      IF jsonb_typeof(v_v) <> 'number' THEN RETURN 'cms_submission_invalid:' || v_key; END IF;
      CONTINUE;
    END IF;
    IF jsonb_typeof(v_v) <> 'string' THEN RETURN 'cms_submission_invalid:' || v_key; END IF;
    v_t := btrim(v_v #>> '{}');
    IF v_type IN ('text', 'textarea') THEN
      v_max := COALESCE((v_f->>'max_length')::integer, CASE v_type WHEN 'text' THEN 500 ELSE 5000 END);
      IF char_length(v_t) > v_max THEN RETURN 'cms_submission_too_long:' || v_key; END IF;
    ELSIF v_type = 'email' THEN
      IF char_length(v_t) > 254 OR v_t !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RETURN 'cms_submission_invalid:' || v_key; END IF;
    ELSIF v_type = 'date' THEN
      IF v_t !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN 'cms_submission_invalid:' || v_key; END IF;
      BEGIN PERFORM v_t::date; EXCEPTION WHEN others THEN RETURN 'cms_submission_invalid:' || v_key; END;
    ELSIF v_type = 'select' THEN
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_f->'options') o WHERE btrim(o) = v_t) THEN
        RETURN 'cms_submission_invalid:' || v_key;
      END IF;
    END IF;
  END LOOP;
  FOR k IN SELECT jsonb_object_keys(_data) LOOP
    IF NOT (k = ANY (v_keys)) THEN RETURN 'cms_submission_unknown_field'; END IF;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._cms_submission_problem(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cms_form_submit(_slug text, _data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_f public.cms_forms%ROWTYPE; v_problem text; v_id uuid; v_count integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_f FROM public.cms_forms WHERE slug = btrim(COALESCE(_slug, ''));
  IF v_f.id IS NULL OR v_f.status <> 'published' THEN RAISE EXCEPTION 'cms_form_not_open'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('cms_submit:' || v_f.id::text || ':' || v_uid::text, 0));
  SELECT count(*) INTO v_count FROM public.cms_form_submissions
   WHERE form_id = v_f.id AND submitter_id = v_uid AND created_at > now() - interval '1 day';
  IF v_count >= v_f.max_per_user_per_day THEN RAISE EXCEPTION 'cms_submission_limit'; END IF;
  v_problem := public._cms_submission_problem(v_f.fields, _data);
  IF v_problem IS NOT NULL THEN RAISE EXCEPTION '%', v_problem; END IF;
  INSERT INTO public.cms_form_submissions (form_id, form_version, submitter_id, data)
  VALUES (v_f.id, v_f.version, v_uid, _data) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.cms_form_submit(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cms_form_submit(text, jsonb) TO authenticated;

-- How many times the signed-in user sent this form in the last 24 hours (for the form page).
CREATE OR REPLACE FUNCTION public.cms_form_my_status(_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_f public.cms_forms%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_f FROM public.cms_forms WHERE slug = btrim(COALESCE(_slug, '')) AND status = 'published';
  IF v_f.id IS NULL THEN RAISE EXCEPTION 'cms_form_not_open'; END IF;
  RETURN jsonb_build_object('limit', v_f.max_per_user_per_day,
    'sentToday', (SELECT count(*) FROM public.cms_form_submissions WHERE form_id = v_f.id AND submitter_id = v_uid
                   AND created_at > now() - interval '1 day'),
    'lastSentAt', (SELECT max(created_at) FROM public.cms_form_submissions WHERE form_id = v_f.id AND submitter_id = v_uid));
END $$;
REVOKE ALL ON FUNCTION public.cms_form_my_status(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cms_form_my_status(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cms_form_submission_list(_form_id uuid, _status text, _limit integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_f public.cms_forms%ROWTYPE; v_limit integer := LEAST(GREATEST(COALESCE(_limit, 200), 1), 2000);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_f FROM public.cms_forms WHERE id = _form_id;
  IF v_f.id IS NULL THEN RAISE EXCEPTION 'cms_target_not_found'; END IF;
  IF NOT public._cms_can_review_submissions(v_uid, v_f.domain) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _status IS NOT NULL AND _status NOT IN ('new', 'reviewed', 'archived') THEN RAISE EXCEPTION 'cms_status_invalid'; END IF;
  RETURN jsonb_build_object(
    'form', jsonb_build_object('id', v_f.id, 'slug', v_f.slug, 'title', v_f.title_id, 'domain', v_f.domain, 'fields', v_f.fields),
    'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'createdAt', s.created_at, 'status', s.status,
        'formVersion', s.form_version, 'data', s.data,
        'submitter', (SELECT display_name FROM public.profiles WHERE id = s.submitter_id),
        'submitterEmail', (SELECT email FROM auth.users WHERE id = s.submitter_id),
        'reviewedAt', s.reviewed_at) ORDER BY s.created_at DESC)
      FROM (SELECT * FROM public.cms_form_submissions
             WHERE form_id = v_f.id AND (_status IS NULL OR status = _status)
             ORDER BY created_at DESC LIMIT v_limit) s), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.cms_form_submission_list(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cms_form_submission_list(uuid, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.cms_form_mark(_submission_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_domain text; v_old text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF _status IS NULL OR _status NOT IN ('new', 'reviewed', 'archived') THEN RAISE EXCEPTION 'cms_status_invalid'; END IF;
  SELECT f.domain, s.status INTO v_domain, v_old
    FROM public.cms_form_submissions s JOIN public.cms_forms f ON f.id = s.form_id
   WHERE s.id = _submission_id FOR UPDATE OF s;
  IF v_domain IS NULL THEN RAISE EXCEPTION 'cms_target_not_found'; END IF;
  IF NOT public._cms_can_review_submissions(v_uid, v_domain) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.cms_form_submissions
     SET status = _status, reviewed_by = CASE WHEN _status = 'new' THEN NULL ELSE v_uid END,
         reviewed_at = CASE WHEN _status = 'new' THEN NULL ELSE now() END
   WHERE id = _submission_id;
  PERFORM public.log_governance_event('cms_submission_marked', v_uid, NULL, 'cms_form_submission', _submission_id::text,
    jsonb_build_object('status', v_old), jsonb_build_object('status', _status));
END $$;
REVOKE ALL ON FUNCTION public.cms_form_mark(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cms_form_mark(uuid, text) TO authenticated;

COMMIT;
