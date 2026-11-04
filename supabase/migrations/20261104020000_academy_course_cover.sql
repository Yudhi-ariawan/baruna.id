-- ============================================================================
-- Program Academy: cover image for a Master Course (lanjutan 20261104010000).
--
-- The image is uploaded by the server (role + size <= 2 MB + PNG/JPEG/WebP magic
-- bytes checked there) into the existing public bucket `knowledge-module-covers`
-- under `academy-courses/<32 hex>.<png|jpg|webp>`. The draft stores only that
-- path in `payload.cover_path`; it follows the same approval and versioning as
-- every other course field, and the catalog shows it once approved.
--
-- The database re-checks the path on submit and on approval: format, and that
-- the object really exists in the bucket with an image type and <= 2 MB.
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.master_courses ADD COLUMN IF NOT EXISTS cover_path text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'master_courses_cover_path_format') THEN
    ALTER TABLE public.master_courses ADD CONSTRAINT master_courses_cover_path_format
      CHECK (cover_path IS NULL OR cover_path ~ '^academy-courses/[0-9a-f]{32}\.(png|jpg|webp)$');
  END IF;
END $$;

-- NULL path = no cover (valid). Otherwise format + uploaded object + type + size.
CREATE OR REPLACE FUNCTION public._program_cover_ok(_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _path IS NULL THEN RETURN true; END IF;
  IF _path !~ '^academy-courses/[0-9a-f]{32}\.(png|jpg|webp)$' THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM storage.objects o
     WHERE o.bucket_id = 'knowledge-module-covers' AND o.name = _path
       AND COALESCE(o.metadata->>'mimetype', '') IN ('image/png', 'image/jpeg', 'image/webp')
       AND COALESCE((o.metadata->>'size')::bigint, 0) BETWEEN 1 AND 2097152);
END $$;
REVOKE ALL ON FUNCTION public._program_cover_ok(text) FROM PUBLIC, anon, authenticated;

-- Snapshot now carries the cover, so drafts opened from the live course keep it
-- and version records show which image was approved.
CREATE OR REPLACE FUNCTION public._program_course_snapshot(_course_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'course_code', c.course_code, 'title', c.title, 'description', c.description,
    'language', c.language, 'learning_template_code', (SELECT t.code FROM public.learning_templates t WHERE t.id = c.learning_template_id),
    'cover_path', c.cover_path,
    'modules', COALESCE((SELECT jsonb_agg(jsonb_build_object('module_code', m.module_code, 'title', m.title,
                 'learning_hours', m.learning_hours) ORDER BY m.sequence, m.module_code)
               FROM public.master_modules m WHERE m.master_course_id = c.id), '[]'::jsonb))
  FROM public.master_courses c WHERE c.id = _course_id
$$;
REVOKE ALL ON FUNCTION public._program_course_snapshot(uuid) FROM PUBLIC, anon, authenticated;

-- Same as 20261104010000 plus the cover check (after the template check).
CREATE OR REPLACE FUNCTION public._program_course_problem(_p jsonb, _target uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text := btrim(COALESCE(_p->>'course_code', ''));
  v_item jsonb; v_codes text[] := '{}'; v_mcode text; v_hours numeric; v_live text[];
BEGIN
  IF jsonb_typeof(_p) IS DISTINCT FROM 'object' THEN RETURN 'program_payload_invalid'; END IF;
  IF _target IS NULL THEN
    IF v_code !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR char_length(v_code) NOT BETWEEN 3 AND 80 THEN RETURN 'program_course_code_invalid'; END IF;
    IF EXISTS (SELECT 1 FROM public.master_courses WHERE lower(course_code) = lower(v_code)) THEN RETURN 'program_course_code_exists'; END IF;
  ELSIF v_code IS DISTINCT FROM (SELECT course_code FROM public.master_courses WHERE id = _target) THEN
    RETURN 'program_course_code_immutable';
  END IF;
  IF NOT public._program_text_ok(_p->>'title', 3, 200) THEN RETURN 'program_title_invalid'; END IF;
  IF char_length(COALESCE(_p->>'description', '')) > 4000 THEN RETURN 'program_description_too_long'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.languages_taxonomy WHERE lower(code) = lower(btrim(COALESCE(_p->>'language', '')))) THEN
    RETURN 'program_language_unknown';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.learning_templates WHERE code = btrim(COALESCE(_p->>'learning_template_code', ''))) THEN
    RETURN 'program_template_unknown';
  END IF;
  IF _p ? 'cover_path' AND jsonb_typeof(_p->'cover_path') <> 'null'
     AND (jsonb_typeof(_p->'cover_path') <> 'string' OR NOT public._program_cover_ok(_p->>'cover_path')) THEN
    RETURN 'program_cover_invalid';
  END IF;

  IF jsonb_typeof(_p->'modules') IS DISTINCT FROM 'array' OR jsonb_array_length(_p->'modules') = 0 THEN RETURN 'program_modules_required'; END IF;
  IF jsonb_array_length(_p->'modules') > 60 THEN RETURN 'program_modules_too_many'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(_p->'modules') LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN RETURN 'program_payload_invalid'; END IF;
    v_mcode := upper(btrim(COALESCE(v_item->>'module_code', '')));
    IF v_mcode !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' OR char_length(v_mcode) NOT BETWEEN 2 AND 30 THEN RETURN 'program_module_code_invalid'; END IF;
    IF v_mcode = ANY (v_codes) THEN RETURN 'program_module_code_duplicate'; END IF;
    v_codes := array_append(v_codes, v_mcode);
    IF NOT public._program_text_ok(v_item->>'title', 2, 200) THEN RETURN 'program_module_title_invalid'; END IF;
    IF jsonb_typeof(v_item->'learning_hours') IS DISTINCT FROM 'number' THEN RETURN 'program_module_hours_invalid'; END IF;
    v_hours := (v_item->>'learning_hours')::numeric;
    IF v_hours <= 0 OR v_hours > 500 THEN RETURN 'program_module_hours_invalid'; END IF;
  END LOOP;

  -- Completion counts every module and progress is stored per module code: once
  -- anyone applied/enrolled, the set of module codes cannot change.
  IF _target IS NOT NULL AND public._program_course_in_use(_target) THEN
    SELECT COALESCE(array_agg(upper(module_code) ORDER BY upper(module_code)), '{}') INTO v_live
      FROM public.master_modules WHERE master_course_id = _target;
    IF (SELECT COALESCE(array_agg(x ORDER BY x), '{}') FROM unnest(v_codes) x) IS DISTINCT FROM v_live THEN
      RETURN 'program_modules_locked_in_use';
    END IF;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._program_course_problem(jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- Same as 20261104010000 plus cover_path (a draft without the key clears the cover).
CREATE OR REPLACE FUNCTION public._program_apply_course(_d public.academy_program_drafts, _uid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p jsonb := _d.payload; v_id uuid; v_version integer; v_tpl uuid; v_item jsonb; v_seq integer := 0; v_codes text[] := '{}';
  v_cover text := NULLIF(btrim(COALESCE(_d.payload->>'cover_path', '')), '');
BEGIN
  SELECT id INTO v_tpl FROM public.learning_templates WHERE code = btrim(v_p->>'learning_template_code');
  IF _d.target_id IS NULL THEN
    INSERT INTO public.master_courses (course_code, title, description, language, learning_template_id, cover_path, status, version)
    VALUES (lower(btrim(v_p->>'course_code')), btrim(v_p->>'title'), NULLIF(btrim(COALESCE(v_p->>'description', '')), ''),
            lower(btrim(v_p->>'language')), v_tpl, v_cover, 'active', 1)
    RETURNING id, version INTO v_id, v_version;
  ELSE
    v_id := _d.target_id;
    UPDATE public.master_courses
       SET title = btrim(v_p->>'title'), description = NULLIF(btrim(COALESCE(v_p->>'description', '')), ''),
           language = lower(btrim(v_p->>'language')), learning_template_id = v_tpl, cover_path = v_cover,
           version = COALESCE(version, 1) + 1, updated_at = now()
     WHERE id = v_id RETURNING version INTO v_version;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_p->'modules') LOOP
    v_seq := v_seq + 1;
    v_codes := array_append(v_codes, upper(btrim(v_item->>'module_code')));
    INSERT INTO public.master_modules (master_course_id, module_code, title, sequence, learning_hours, status, version)
    VALUES (v_id, upper(btrim(v_item->>'module_code')), btrim(v_item->>'title'), v_seq, (v_item->>'learning_hours')::numeric, 'active', 1)
    ON CONFLICT (master_course_id, module_code) DO UPDATE
      SET title = EXCLUDED.title, sequence = EXCLUDED.sequence, learning_hours = EXCLUDED.learning_hours,
          version = CASE WHEN (public.master_modules.title, public.master_modules.learning_hours)
                              IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.learning_hours)
                         THEN COALESCE(public.master_modules.version, 1) + 1 ELSE public.master_modules.version END,
          updated_at = now();
  END LOOP;
  -- Removing modules was only allowed while nobody used the course (validated above).
  DELETE FROM public.master_modules WHERE master_course_id = v_id AND NOT (upper(module_code) = ANY (v_codes));

  INSERT INTO public.master_course_versions (master_course_id, version, snapshot, draft_id, approved_by)
  VALUES (v_id, v_version, public._program_course_snapshot(v_id), _d.id, _uid);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public._program_apply_course(public.academy_program_drafts, uuid) FROM PUBLIC, anon, authenticated;
