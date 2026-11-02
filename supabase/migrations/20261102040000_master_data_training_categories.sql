-- ============================================================================
-- Data Master: kategori pelatihan (Request a Training)
-- ============================================================================
-- Dicek 2 Nov 2026 (database intern-update, kode branch ini):
--
-- * 13 kategori pelatihan (+ "Other") formulir Request a Training ditulis tetap di
--   kode (src/lib/trainingRequests.ts TRAINING_CATEGORIES). Slide 12 (Request a
--   Training: TNA, rekomendasi program) dan Slide 26/41 (tidak hard-coded).
-- * Database tidak memeriksa kategori: training_need_draft_submit memanggil
--   submit_draft_for_review, yang tidak punya cabang untuk training_need. Kategori
--   apa pun (atau tanpa kategori) diterima lewat API.
-- * Data: 0 draf dan 0 pengajuan Request a Training.
-- * Keputusan pemilik proyek 2 Nov: daftar TERPISAH dari topik Knowledge Hub dan
--   bidang keahlian (isinya sebagian sama, tujuannya berbeda).
--
-- Perubahan:
-- * Tabel training_category_taxonomy: dibaca siapa saja (formulir bisa dibuka
--   sebelum login); tulis hanya lewat RPC. 13 kategori diisi dengan urutan formulir.
--   Bila Data Master kategori sudah pernah dipakai (audit master_training_category_*),
--   pengisian dilewati agar menjalankan ulang migrasi tidak menimpa perubahan.
-- * master_training_categories_overview / _save / _set_active: sama persis dengan
--   topik Knowledge Hub (20261102020000), hanya nama yang berbeda.
-- * _training_need_payload_problem: proposed_topics wajib berisi 1-5 kategori; setiap
--   kategori harus ada di daftar (aktif atau nonaktif) atau "Other" (dijelaskan di
--   isian lain formulir).
-- * submit_draft_for_review: sama persis dengan 20261022020000, ditambah cabang
--   training_need yang memanggil pemeriksaan di atas.
-- Butuh 20261023010000 (_master_norm, _master_code).

BEGIN;

CREATE TABLE IF NOT EXISTS public.training_category_taxonomy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS training_category_taxonomy_name_norm_uidx ON public.training_category_taxonomy (public._master_norm(name));
ALTER TABLE public.training_category_taxonomy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS training_category_taxonomy_read ON public.training_category_taxonomy;
CREATE POLICY training_category_taxonomy_read ON public.training_category_taxonomy FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON public.training_category_taxonomy FROM anon, authenticated;
GRANT SELECT ON public.training_category_taxonomy TO anon, authenticated;
GRANT ALL ON public.training_category_taxonomy TO service_role;

-- Requests (submitted and drafts) whose proposed topics use a category.
CREATE OR REPLACE FUNCTION public._training_category_usage(_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH t AS (SELECT public._master_norm(name) AS n FROM public.training_category_taxonomy WHERE id = _id)
  SELECT (
    (SELECT count(*) FROM public.training_needs r, t
      WHERE EXISTS (SELECT 1 FROM unnest(COALESCE(r.proposed_topics, '{}'::text[])) x WHERE public._master_norm(x) = t.n))
  + (SELECT count(*) FROM public.review_drafts d, t
      WHERE d.subject_kind = 'training_need' AND jsonb_typeof(d.payload->'proposed_topics') = 'array'
        AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(d.payload->'proposed_topics') x WHERE public._master_norm(x) = t.n))
  )::integer
$$;
REVOKE ALL ON FUNCTION public._training_category_usage(uuid) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- data
DO $$
DECLARE
  v_list text[] := ARRAY['Fisheries Management', 'Aquaculture', 'Marine Conservation', 'Blue Economy', 'Climate Change',
    'Marine Spatial Planning', 'Fish Processing', 'Fish Health', 'Fisheries Technology', 'Ocean Literacy',
    'Coastal Community Development', 'Monitoring, Control & Surveillance', 'Leadership & Capacity Development'];
  v_name text; v_i integer := 0; v_id uuid; v_code text;
  v_managed boolean := EXISTS (SELECT 1 FROM public.governance_audit_log WHERE event_type LIKE 'master_training_category_%');
BEGIN
  IF v_managed THEN RETURN; END IF;
  FOREACH v_name IN ARRAY v_list LOOP
    v_i := v_i + 1;
    SELECT id INTO v_id FROM public.training_category_taxonomy WHERE public._master_norm(name) = public._master_norm(v_name);
    IF v_id IS NULL THEN
      v_code := public._master_code(v_name);
      WHILE EXISTS (SELECT 1 FROM public.training_category_taxonomy WHERE code = v_code) LOOP
        v_code := v_code || '_' || left(replace(gen_random_uuid()::text, '-', ''), 4);
      END LOOP;
      INSERT INTO public.training_category_taxonomy (code, name, active, display_order) VALUES (v_code, v_name, true, v_i * 10);
    ELSE
      UPDATE public.training_category_taxonomy SET active = true, display_order = v_i * 10 WHERE id = v_id;
    END IF;
    v_id := NULL;
  END LOOP;

  -- Categories already used by requests but missing from the list: kept (inactive).
  FOR v_name IN
    SELECT DISTINCT btrim(x) FROM public.training_needs r, unnest(COALESCE(r.proposed_topics, '{}'::text[])) x WHERE btrim(x) <> ''
    UNION
    SELECT DISTINCT btrim(x) FROM public.review_drafts d, jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(d.payload->'proposed_topics') = 'array' THEN d.payload->'proposed_topics' ELSE '[]'::jsonb END) x
     WHERE d.subject_kind = 'training_need' AND btrim(x) <> ''
  LOOP
    IF char_length(v_name) <= 120 AND lower(v_name) <> 'other' AND NOT EXISTS (
         SELECT 1 FROM public.training_category_taxonomy WHERE public._master_norm(name) = public._master_norm(v_name)) THEN
      v_code := public._master_code(v_name);
      WHILE EXISTS (SELECT 1 FROM public.training_category_taxonomy WHERE code = v_code) LOOP
        v_code := v_code || '_' || left(replace(gen_random_uuid()::text, '-', ''), 4);
      END LOOP;
      INSERT INTO public.training_category_taxonomy (code, name, active, display_order) VALUES (v_code, v_name, false, 1000);
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------- read (console)
CREATE OR REPLACE FUNCTION public.master_training_categories_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', t.id, 'code', t.code, 'name', t.name, 'description', t.description, 'active', t.active,
      'displayOrder', t.display_order, 'usage', public._training_category_usage(t.id), 'updatedAt', t.updated_at)
      ORDER BY t.active DESC, t.display_order, t.name) FROM public.training_category_taxonomy t), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.master_training_categories_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_training_categories_overview() TO authenticated;

-- ------------------------------------------------------------- write
CREATE OR REPLACE FUNCTION public.master_training_category_save(
  _id uuid, _name text, _description text DEFAULT NULL, _display_order integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := regexp_replace(btrim(COALESCE(_name, '')), '\s+', ' ', 'g');
  v_desc text := NULLIF(btrim(COALESCE(_description, '')), '');
  v_row public.training_category_taxonomy%ROWTYPE; v_code text; v_order integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_name) < 2 OR char_length(v_name) > 120 OR v_name ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'training_category_name_invalid'; END IF;
  IF char_length(COALESCE(v_desc, '')) > 500 THEN RAISE EXCEPTION 'training_category_description_too_long'; END IF;
  IF _display_order IS NOT NULL AND (_display_order < 0 OR _display_order > 100000) THEN RAISE EXCEPTION 'training_category_order_invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('master_training_category'));

  IF EXISTS (SELECT 1 FROM public.training_category_taxonomy
              WHERE public._master_norm(name) = public._master_norm(v_name) AND id IS DISTINCT FROM _id) THEN
    RAISE EXCEPTION 'training_category_name_exists';
  END IF;

  IF _id IS NULL THEN
    v_code := public._master_code(v_name);
    WHILE EXISTS (SELECT 1 FROM public.training_category_taxonomy WHERE code = v_code) LOOP
      v_code := v_code || '_' || left(replace(gen_random_uuid()::text, '-', ''), 4);
    END LOOP;
    v_order := COALESCE(_display_order, (SELECT COALESCE(max(display_order), 0) + 10 FROM public.training_category_taxonomy WHERE active));
    INSERT INTO public.training_category_taxonomy (code, name, description, active, display_order)
    VALUES (v_code, v_name, v_desc, true, v_order) RETURNING * INTO v_row;
    PERFORM public.log_governance_event('master_training_category_created', v_uid, NULL, 'training_category_taxonomy', v_row.id::text,
      NULL, to_jsonb(v_row));
  ELSE
    SELECT * INTO v_row FROM public.training_category_taxonomy WHERE id = _id FOR UPDATE;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'training_category_not_found'; END IF;
    -- A name stored on submitted requests is not changed under them.
    IF v_row.name IS DISTINCT FROM v_name AND public._training_category_usage(_id) > 0 THEN
      RAISE EXCEPTION 'training_category_in_use_rename_forbidden';
    END IF;
    UPDATE public.training_category_taxonomy
       SET name = v_name, description = v_desc, display_order = COALESCE(_display_order, display_order), updated_at = now()
     WHERE id = _id;
    PERFORM public.log_governance_event('master_training_category_updated', v_uid, NULL, 'training_category_taxonomy', _id::text,
      to_jsonb(v_row), (SELECT to_jsonb(t) FROM public.training_category_taxonomy t WHERE t.id = _id));
    SELECT * INTO v_row FROM public.training_category_taxonomy WHERE id = _id;
  END IF;
  RETURN jsonb_build_object('id', v_row.id, 'code', v_row.code, 'name', v_row.name, 'active', v_row.active,
                            'displayOrder', v_row.display_order);
END $$;
REVOKE ALL ON FUNCTION public.master_training_category_save(uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_training_category_save(uuid, text, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.master_training_category_set_active(_id uuid, _active boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.training_category_taxonomy%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _active IS NULL THEN RAISE EXCEPTION 'training_category_active_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('master_training_category'));
  SELECT * INTO v_row FROM public.training_category_taxonomy WHERE id = _id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'training_category_not_found'; END IF;
  IF v_row.active = _active THEN RETURN jsonb_build_object('id', _id, 'active', _active, 'changed', false); END IF;
  -- The Request a Training form needs at least one category to offer.
  IF NOT _active AND NOT EXISTS (SELECT 1 FROM public.training_category_taxonomy WHERE active AND id <> _id) THEN
    RAISE EXCEPTION 'training_category_last_active';
  END IF;
  UPDATE public.training_category_taxonomy SET active = _active, updated_at = now() WHERE id = _id;
  PERFORM public.log_governance_event(CASE WHEN _active THEN 'master_training_category_activated' ELSE 'master_training_category_deactivated' END,
    v_uid, NULL, 'training_category_taxonomy', _id::text, jsonb_build_object('active', v_row.active, 'name', v_row.name),
    jsonb_build_object('active', _active, 'usage', public._training_category_usage(_id)));
  RETURN jsonb_build_object('id', _id, 'active', _active, 'changed', true);
END $$;
REVOKE ALL ON FUNCTION public.master_training_category_set_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.master_training_category_set_active(uuid, boolean) TO authenticated;

-- ------------------------------------------------------------- submissions
-- Request a Training payload: 1-5 proposed topics, each from the list (active or
-- inactive) or "Other".
CREATE OR REPLACE FUNCTION public._training_need_payload_problem(_p jsonb)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_item jsonb; v_name text;
BEGIN
  IF _p IS NULL OR jsonb_typeof(_p) <> 'object' THEN RETURN 'training_payload_invalid'; END IF;
  IF jsonb_typeof(_p->'proposed_topics') IS DISTINCT FROM 'array' OR jsonb_array_length(_p->'proposed_topics') = 0 THEN
    RETURN 'training_category_required';
  END IF;
  IF jsonb_array_length(_p->'proposed_topics') > 5 THEN RETURN 'training_category_too_many'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(_p->'proposed_topics') LOOP
    IF jsonb_typeof(v_item) <> 'string' THEN RETURN 'training_payload_invalid'; END IF;
    v_name := btrim(v_item #>> '{}');
    IF v_name = '' THEN RETURN 'training_category_required'; END IF;
    IF lower(v_name) <> 'other' AND NOT EXISTS (
         SELECT 1 FROM public.training_category_taxonomy t WHERE public._master_norm(t.name) = public._master_norm(v_name)) THEN
      RETURN 'training_category_unknown';
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._training_need_payload_problem(jsonb) FROM PUBLIC, anon, authenticated;

-- Latest definition (20261022020000) plus the training_need branch.
CREATE OR REPLACE FUNCTION public.submit_draft_for_review(_draft_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_draft public.review_drafts%ROWTYPE;
  v_hash text;
  v_subject_id uuid;
  v_prev_hash text;
  v_next_rev integer;
  v_uid uuid := auth.uid();
  v_problem text;
  v_linked public.review_subjects%ROWTYPE;
  v_was_revised boolean;
  v_is_update boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_draft FROM public.review_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_draft.id IS NULL THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF v_draft.submitter_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_draft.status <> 'draft' THEN RAISE EXCEPTION 'draft_already_submitted'; END IF;

  -- Draf hanya boleh menuju pengajuan milik sendiri dengan jenis yang sama.
  IF v_draft.linked_subject_id IS NOT NULL THEN
    SELECT * INTO v_linked FROM public.review_subjects WHERE id = v_draft.linked_subject_id FOR UPDATE;
    IF v_linked.id IS NULL OR v_linked.submitted_by <> v_uid OR v_linked.kind <> v_draft.subject_kind THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  IF v_draft.subject_kind = 'expert' THEN
    v_problem := public._expert_payload_problem(COALESCE(v_draft.payload, '{}'::jsonb), v_uid, true);
    IF v_problem IS NOT NULL THEN RAISE EXCEPTION '%', v_problem; END IF;
    IF v_draft.linked_subject_id IS NULL THEN
      -- PB-EXP-02: satu pengajuan aktif dan satu profil per akun.
      PERFORM pg_advisory_xact_lock(hashtextextended('expert_submit:' || v_uid::text, 0));
      IF EXISTS (SELECT 1 FROM public.experts
                  WHERE (original_contributor_id = v_uid OR created_by = v_uid)
                    AND current_status IN ('approved', 'published')) THEN
        RAISE EXCEPTION 'expert_profile_exists';
      END IF;
      IF EXISTS (SELECT 1 FROM public.review_subjects
                  WHERE kind = 'expert' AND submitted_by = v_uid
                    AND current_status IN ('pending', 'under_review', 'decision_pending')
                    AND metadata->>'review_status' = 'revision_requested') THEN
        RAISE EXCEPTION 'expert_revision_pending';
      END IF;
      IF EXISTS (SELECT 1 FROM public.review_subjects
                  WHERE kind = 'expert' AND submitted_by = v_uid
                    AND current_status IN ('pending', 'under_review', 'decision_pending')) THEN
        RAISE EXCEPTION 'expert_application_already_pending';
      END IF;
    ELSIF public._expert_effective_status(v_draft.linked_subject_id) <> 'revision_requested' THEN
      RAISE EXCEPTION 'not_awaiting_revision';
    END IF;
  ELSIF v_draft.subject_kind = 'module' THEN
    PERFORM public._module_trainer_gate(v_uid);
    PERFORM public._assert_module_attachments(COALESCE(v_draft.payload, '{}'::jsonb), v_uid, true);
  ELSIF v_draft.subject_kind = 'training_need' THEN
    v_problem := public._training_need_payload_problem(COALESCE(v_draft.payload, '{}'::jsonb));
    IF v_problem IS NOT NULL THEN RAISE EXCEPTION '%', v_problem; END IF;
  ELSIF v_draft.subject_kind = 'knowledge_resource' THEN
    v_problem := public._kr_payload_problem(COALESCE(v_draft.payload, '{}'::jsonb), v_uid);
    IF v_problem IS NOT NULL THEN RAISE EXCEPTION '%', v_problem; END IF;
    IF v_draft.linked_subject_id IS NOT NULL THEN
      -- An update the owner opened on the live publication (status stays approved).
      v_is_update := v_linked.current_status = 'approved' AND v_linked.metadata->>'update_open' = 'true';
      -- Otherwise a linked submission is only re-sent while a curator has asked for a revision.
      IF NOT v_is_update AND (
           v_linked.current_status <> 'pending'
           OR COALESCE(v_linked.metadata->>'review_status', '') NOT IN ('revision_requested', 'pending', 'resubmitted')) THEN
        RAISE EXCEPTION 'not_awaiting_revision';
      END IF;
    END IF;
  END IF;

  v_hash := encode(extensions.digest(
    COALESCE(v_draft.title,'') || '|' ||
    COALESCE(v_draft.description,'') || '|' ||
    COALESCE(v_draft.external_ref,'') || '|' ||
    COALESCE(v_draft.payload::text,'{}'),
    'sha256'), 'hex');

  IF v_draft.linked_subject_id IS NOT NULL THEN
    SELECT content_hash INTO v_prev_hash
      FROM public.review_subject_revisions
      WHERE subject_id = v_draft.linked_subject_id
      ORDER BY revision DESC LIMIT 1;
    IF v_prev_hash IS NOT NULL AND v_prev_hash = v_hash THEN
      RAISE EXCEPTION 'revision_unchanged';
    END IF;
    v_subject_id := v_draft.linked_subject_id;
  ELSE
    INSERT INTO public.review_subjects (kind, external_ref, title, description, submitted_by, current_status, required_recommendations, metadata)
    VALUES (v_draft.subject_kind, v_draft.external_ref, v_draft.title, v_draft.description, v_uid, 'pending', 1, '{}'::jsonb)
    RETURNING id INTO v_subject_id;
    UPDATE public.review_drafts SET linked_subject_id = v_subject_id WHERE id = v_draft.id;
  END IF;

  SELECT COALESCE(MAX(revision),0)+1 INTO v_next_rev
    FROM public.review_subject_revisions WHERE subject_id = v_subject_id;

  INSERT INTO public.review_subject_revisions (subject_id, draft_id, revision, snapshot, content_hash)
  VALUES (v_subject_id, v_draft.id, v_next_rev,
          jsonb_build_object(
            'title', v_draft.title,
            'description', v_draft.description,
            'external_ref', v_draft.external_ref,
            'payload', v_draft.payload,
            'subject_kind', v_draft.subject_kind
          ),
          v_hash);

  UPDATE public.review_drafts SET status = 'submitted', content_hash = v_hash WHERE id = v_draft.id;

  UPDATE public.review_subjects SET current_status = 'pending' WHERE id = v_subject_id AND current_status IN ('pending','withdrawn');

  -- Revisi expert yang dikirim ulang: status antrean ditulis di transaksi yang sama
  -- (dulu disinkronkan server function sesudahnya dan kegagalannya hanya dilog).
  IF v_draft.subject_kind = 'expert' AND v_draft.linked_subject_id IS NOT NULL THEN
    UPDATE public.review_subjects
       SET current_status = 'pending', title = v_draft.title,
           metadata = COALESCE(metadata, '{}'::jsonb)
                      || jsonb_build_object('review_status', 'resubmitted', 'resubmitted_at', now())
     WHERE id = v_subject_id;
  END IF;

  -- Knowledge Hub: same rule the server function applied afterwards, now atomic.
  -- An owner's update joins the queue as a resubmission; the live version stays on air.
  IF v_draft.subject_kind = 'knowledge_resource' AND v_draft.linked_subject_id IS NOT NULL THEN
    v_was_revised := v_is_update
                     OR COALESCE(v_linked.metadata->>'review_status', '') = 'revision_requested'
                     OR jsonb_typeof(v_linked.metadata->'last_rationale') = 'string';
    UPDATE public.review_subjects
       SET current_status = 'pending',
           title = COALESCE(NULLIF(btrim(v_draft.payload->>'title'), ''), v_draft.title),
           metadata = (COALESCE(metadata, '{}'::jsonb) - 'update_open' - 'previous_draft_id')
                      || CASE WHEN v_was_revised
                              THEN jsonb_build_object('review_status', 'resubmitted', 'resubmitted_at', now())
                              ELSE jsonb_build_object('review_status', 'pending') END
                      || CASE WHEN v_is_update THEN jsonb_build_object('live_version_kept', true) ELSE '{}'::jsonb END,
           updated_at = now()
     WHERE id = v_subject_id;
  END IF;

  PERFORM public.log_governance_event(
    'draft_submitted', v_uid, v_subject_id, 'review_draft', v_draft.id::text,
    NULL,
    jsonb_build_object('revision', v_next_rev, 'content_hash', v_hash, 'live_update', v_is_update));

  RETURN v_subject_id;
END; $function$;
-- (grants unchanged: CREATE OR REPLACE keeps them)

COMMIT;
