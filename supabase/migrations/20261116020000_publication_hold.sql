-- ============================================================================
-- Publisher: take approved content off the air and put it back (Slide 16; keputusan
-- pemilik proyek 16 Nov, MENUNGGU_ARAHAN_MENTOR butir 5, opsi C "versi ringkas";
-- CATATAN_PERBAIKAN 2ba). Proven by `npm run test:publication-hold`.
--
-- Slide 16: Publisher "mempublikasikan konten/data ke pengguna sesuai hak akses",
-- limited access on Academy, Knowledge Hub and Experts. Slide 21 keeps
-- "approval = go live" for Academy, so approving still publishes; the Publisher
-- (and Admin) can now take a live item down temporarily and put it back.
--
-- Before: the publisher role had nothing to do (AUDIT_PERAN "tahap belum ada").
-- Now, for Course Offerings, Knowledge Hub publications, modules and expert profiles:
-- * publication_hold(kind, id, reason): only live items; reason required. Registry
--   items go from 'published' to 'approved' (approved, not on air); an offering goes
--   from 'published' to 'closed'. Every public reader already shows only
--   'published', so the item disappears everywhere; nothing else changes (no new
--   version, no archive).
-- * publication_release(kind, id, note): back to 'published' (an offering only while
--   its Master Course is active). An item archived meanwhile stays archived.
-- * While held, a guard trigger keeps any other flow (an approved revision, the
--   Program Academy status switch) from putting the item back on the air; the
--   approved change itself is kept and goes live on release.
-- * publication_list(): live and held items for the Penayangan page.
-- Allowed: publisher, admin, super_admin (_can_publish). Audit in admin_audit_log.
-- Not here: scheduled publishing; Events/Partnership/Community/About have no
-- database content yet. Re-runnable.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._can_publish(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (public.has_rbac_role(_uid, 'publisher') OR public.has_rbac_role(_uid, 'admin')
                               OR public.has_rbac_role(_uid, 'super_admin'))
$$;
REVOKE ALL ON FUNCTION public._can_publish(uuid) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['course_offerings', 'knowledge_resources', 'module_registry', 'experts'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS publication_held_at timestamptz', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS publication_held_by uuid REFERENCES auth.users(id) ON DELETE SET NULL', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS publication_hold_reason text', t);
  END LOOP;
END $$;

-- Keeps a held item off the air whatever else updates it.
CREATE OR REPLACE FUNCTION public._publication_hold_guard_registry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.publication_held_at IS NOT NULL AND NEW.current_status = 'published' THEN
    NEW.current_status := 'approved';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public._publication_hold_guard_offering()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.publication_held_at IS NOT NULL AND NEW.status = 'published' THEN
    NEW.status := 'closed';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_publication_hold_guard ON public.knowledge_resources;
CREATE TRIGGER trg_publication_hold_guard BEFORE INSERT OR UPDATE ON public.knowledge_resources
  FOR EACH ROW EXECUTE FUNCTION public._publication_hold_guard_registry();
DROP TRIGGER IF EXISTS trg_publication_hold_guard ON public.module_registry;
CREATE TRIGGER trg_publication_hold_guard BEFORE INSERT OR UPDATE ON public.module_registry
  FOR EACH ROW EXECUTE FUNCTION public._publication_hold_guard_registry();
DROP TRIGGER IF EXISTS trg_publication_hold_guard ON public.experts;
CREATE TRIGGER trg_publication_hold_guard BEFORE INSERT OR UPDATE ON public.experts
  FOR EACH ROW EXECUTE FUNCTION public._publication_hold_guard_registry();
DROP TRIGGER IF EXISTS trg_publication_hold_guard ON public.course_offerings;
CREATE TRIGGER trg_publication_hold_guard BEFORE INSERT OR UPDATE ON public.course_offerings
  FOR EACH ROW EXECUTE FUNCTION public._publication_hold_guard_offering();

CREATE OR REPLACE FUNCTION public.publication_hold(_kind text, _id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reason text := btrim(COALESCE(_reason, ''));
  v_status text; v_visibility text; v_held timestamptz; v_title text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_publish(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_reason) < 5 OR char_length(v_reason) > 500 THEN RAISE EXCEPTION 'publication_reason_required'; END IF;

  IF _kind = 'course_offering' THEN
    SELECT status, 'public', publication_held_at, offering_title INTO v_status, v_visibility, v_held, v_title
      FROM public.course_offerings WHERE id = _id FOR UPDATE;
  ELSIF _kind = 'knowledge_resource' THEN
    SELECT current_status::text, visibility::text, publication_held_at, title INTO v_status, v_visibility, v_held, v_title
      FROM public.knowledge_resources WHERE id = _id FOR UPDATE;
  ELSIF _kind = 'module' THEN
    SELECT current_status::text, visibility::text, publication_held_at, title INTO v_status, v_visibility, v_held, v_title
      FROM public.module_registry WHERE id = _id FOR UPDATE;
  ELSIF _kind = 'expert' THEN
    SELECT current_status::text, visibility::text, publication_held_at, display_name INTO v_status, v_visibility, v_held, v_title
      FROM public.experts WHERE id = _id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'publication_kind_invalid';
  END IF;
  IF v_status IS NULL THEN RAISE EXCEPTION 'publication_not_found'; END IF;
  IF v_held IS NOT NULL THEN RAISE EXCEPTION 'publication_already_held'; END IF;
  IF v_status <> 'published' OR v_visibility <> 'public' THEN RAISE EXCEPTION 'publication_not_live'; END IF;

  IF _kind = 'course_offering' THEN
    UPDATE public.course_offerings SET publication_held_at = now(), publication_held_by = v_uid,
           publication_hold_reason = v_reason, status = 'closed', updated_at = now() WHERE id = _id;
  ELSIF _kind = 'knowledge_resource' THEN
    UPDATE public.knowledge_resources SET publication_held_at = now(), publication_held_by = v_uid,
           publication_hold_reason = v_reason, current_status = 'approved' WHERE id = _id;
  ELSIF _kind = 'module' THEN
    UPDATE public.module_registry SET publication_held_at = now(), publication_held_by = v_uid,
           publication_hold_reason = v_reason, current_status = 'approved' WHERE id = _id;
  ELSE
    UPDATE public.experts SET publication_held_at = now(), publication_held_by = v_uid,
           publication_hold_reason = v_reason, current_status = 'approved' WHERE id = _id;
  END IF;

  INSERT INTO public.admin_audit_log (event_type, actor_id, entity_type, entity_id, before_data, after_data)
  VALUES ('publication_held', v_uid, _kind, _id::text, jsonb_build_object('status', v_status),
          jsonb_build_object('reason', v_reason, 'title', v_title));
  RETURN jsonb_build_object('kind', _kind, 'id', _id, 'held', true);
END $$;
REVOKE ALL ON FUNCTION public.publication_hold(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publication_hold(text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.publication_release(_kind text, _id uuid, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_note text := NULLIF(btrim(COALESCE(_note, '')), '');
  v_status text; v_held timestamptz; v_title text; v_new text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_publish(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(COALESCE(v_note, '')) > 500 THEN RAISE EXCEPTION 'notes_too_long'; END IF;

  IF _kind = 'course_offering' THEN
    SELECT o.status, o.publication_held_at, o.offering_title INTO v_status, v_held, v_title
      FROM public.course_offerings o WHERE o.id = _id FOR UPDATE;
    IF v_status IS NULL THEN RAISE EXCEPTION 'publication_not_found'; END IF;
    IF v_held IS NULL THEN RAISE EXCEPTION 'publication_not_held'; END IF;
    -- Same rule as program_set_status: only offerings of an active Master Course go live.
    v_new := CASE WHEN v_status = 'closed' AND EXISTS (
                     SELECT 1 FROM public.course_offerings o JOIN public.master_courses c ON c.id = o.master_course_id
                      WHERE o.id = _id AND c.status = 'active') THEN 'published' ELSE v_status END;
    UPDATE public.course_offerings SET publication_held_at = NULL, publication_held_by = NULL, publication_hold_reason = NULL,
           status = v_new, updated_at = now() WHERE id = _id;
  ELSIF _kind IN ('knowledge_resource', 'module', 'expert') THEN
    IF _kind = 'knowledge_resource' THEN
      SELECT current_status::text, publication_held_at, title INTO v_status, v_held, v_title FROM public.knowledge_resources WHERE id = _id FOR UPDATE;
    ELSIF _kind = 'module' THEN
      SELECT current_status::text, publication_held_at, title INTO v_status, v_held, v_title FROM public.module_registry WHERE id = _id FOR UPDATE;
    ELSE
      SELECT current_status::text, publication_held_at, display_name INTO v_status, v_held, v_title FROM public.experts WHERE id = _id FOR UPDATE;
    END IF;
    IF v_status IS NULL THEN RAISE EXCEPTION 'publication_not_found'; END IF;
    IF v_held IS NULL THEN RAISE EXCEPTION 'publication_not_held'; END IF;
    -- Archived (or otherwise changed) meanwhile: only the hold is lifted.
    v_new := CASE WHEN v_status = 'approved' THEN 'published' ELSE v_status END;
    IF _kind = 'knowledge_resource' THEN
      UPDATE public.knowledge_resources SET publication_held_at = NULL, publication_held_by = NULL, publication_hold_reason = NULL,
             current_status = v_new::public.registry_status_v1 WHERE id = _id;
    ELSIF _kind = 'module' THEN
      UPDATE public.module_registry SET publication_held_at = NULL, publication_held_by = NULL, publication_hold_reason = NULL,
             current_status = v_new::public.registry_status_v1 WHERE id = _id;
    ELSE
      UPDATE public.experts SET publication_held_at = NULL, publication_held_by = NULL, publication_hold_reason = NULL,
             current_status = v_new::public.registry_status_v1 WHERE id = _id;
    END IF;
  ELSE
    RAISE EXCEPTION 'publication_kind_invalid';
  END IF;

  INSERT INTO public.admin_audit_log (event_type, actor_id, entity_type, entity_id, before_data, after_data)
  VALUES ('publication_released', v_uid, _kind, _id::text, jsonb_build_object('status', v_status),
          jsonb_build_object('status', v_new, 'note', v_note, 'title', v_title));
  RETURN jsonb_build_object('kind', _kind, 'id', _id, 'status', v_new, 'live', v_new = 'published');
END $$;
REVOKE ALL ON FUNCTION public.publication_release(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publication_release(text, uuid, text) TO authenticated;

-- Live and held items for the Penayangan page (latest 300 per kind).
CREATE OR REPLACE FUNCTION public.publication_list()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_publish(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(x) FROM (
    (SELECT jsonb_build_object('kind', 'course_offering', 'id', o.id,
            'title', COALESCE(m.title || ' — ', '') || o.offering_title, 'ref', o.offering_code,
            'live', o.status = 'published', 'heldAt', o.publication_held_at, 'heldReason', o.publication_hold_reason,
            'heldByName', (SELECT display_name FROM public.profiles WHERE id = o.publication_held_by), 'updatedAt', o.updated_at) AS x
       FROM public.course_offerings o LEFT JOIN public.master_courses m ON m.id = o.master_course_id
      WHERE o.status = 'published' OR o.publication_held_at IS NOT NULL
      ORDER BY o.updated_at DESC LIMIT 300)
    UNION ALL
    (SELECT jsonb_build_object('kind', 'knowledge_resource', 'id', r.id, 'title', r.title, 'ref', r.resource_type::text,
            'live', r.current_status = 'published' AND r.visibility = 'public', 'heldAt', r.publication_held_at,
            'heldReason', r.publication_hold_reason,
            'heldByName', (SELECT display_name FROM public.profiles WHERE id = r.publication_held_by), 'updatedAt', r.updated_at)
       FROM public.knowledge_resources r
      WHERE (r.current_status = 'published' AND r.visibility = 'public') OR r.publication_held_at IS NOT NULL
      ORDER BY r.updated_at DESC LIMIT 300)
    UNION ALL
    (SELECT jsonb_build_object('kind', 'module', 'id', mr.id, 'title', mr.title, 'ref', mr.module_type::text,
            'live', mr.current_status = 'published' AND mr.visibility = 'public', 'heldAt', mr.publication_held_at,
            'heldReason', mr.publication_hold_reason,
            'heldByName', (SELECT display_name FROM public.profiles WHERE id = mr.publication_held_by), 'updatedAt', mr.updated_at)
       FROM public.module_registry mr
      WHERE (mr.current_status = 'published' AND mr.visibility = 'public') OR mr.publication_held_at IS NOT NULL
      ORDER BY mr.updated_at DESC LIMIT 300)
    UNION ALL
    (SELECT jsonb_build_object('kind', 'expert', 'id', e.id, 'title', e.display_name, 'ref', e.slug,
            'live', e.current_status = 'published' AND e.visibility = 'public', 'heldAt', e.publication_held_at,
            'heldReason', e.publication_hold_reason,
            'heldByName', (SELECT display_name FROM public.profiles WHERE id = e.publication_held_by), 'updatedAt', e.updated_at)
       FROM public.experts e
      WHERE (e.current_status = 'published' AND e.visibility = 'public') OR e.publication_held_at IS NOT NULL
      ORDER BY e.updated_at DESC LIMIT 300)
  ) s), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.publication_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publication_list() TO authenticated;

COMMIT;
