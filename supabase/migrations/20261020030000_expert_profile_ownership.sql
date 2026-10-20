-- ============================================================================
-- Expert: SATU aturan pemilik profil = akun yang terhubung (original_contributor_id)
-- ============================================================================
-- Slide 37 (PB-EXP-02) memakai konsep "Link ke Expert Profile Existing / profil
-- expert terhubung". Sebelumnya basis data memakai tiga aturan berbeda:
--   * RLS (_expert_is_owner, experts_owner_read): created_by saja;
--   * portal trainer, kualifikasi, penulis modul: original_contributor_id OR created_by;
--   * admin_expert_decide: original_contributor_id AND created_by.
-- created_by hanya mencatat siapa yang MEMBUAT baris. Untuk profil yang
-- diterbitkan langsung oleh admin (expert_publish_direct) atau lewat skrip
-- provisioning, created_by = admin, sehingga admin "memiliki" semua profil itu:
-- portal trainer admin bisa memuat profil orang lain, modul admin bisa
-- tercatat atas nama expert lain, dan pemilik asli tidak bisa membaca
-- permintaan layanan / kontak / sertifikatnya sendiri lewat RLS.
--
-- Mulai migrasi ini: pemilik = original_contributor_id. created_by tetap ada
-- sebagai jejak audit. Indeks unik experts_one_active_profile_per_contributor
-- (20261015080000) sudah memakai kolom yang sama, jadi satu akun tetap paling
-- banyak punya satu profil aktif.
--
-- Pengecualian yang sengaja dipertahankan (keduanya hanya bisa lebih ketat,
-- tidak pernah memberi profil orang lain):
--   * cek konflik kepentingan saat admin menugaskan expert
--     (admin_service_request_transition) tetap memakai OR;
--   * admin_expert_decide hanya memakai ulang profil lama bila
--     original_contributor_id DAN created_by sama dengan pemohon.

BEGIN;

-- ------------------------------------------------------------- 1. data
-- a) Profil pendaftaran mandiri yang belum tertaut: tautkan ke pembuatnya,
--    satu profil per akun dan hanya bila akun itu belum punya profil aktif.
UPDATE public.experts e
   SET original_contributor_id = e.created_by
 WHERE e.id IN (
   SELECT DISTINCT ON (x.created_by) x.id
     FROM public.experts x
    WHERE x.original_contributor_id IS NULL
      AND x.source_type <> 'admin_direct'
      AND x.current_status <> 'archived'
      AND NOT EXISTS (SELECT 1 FROM public.experts o
                       WHERE o.original_contributor_id = x.created_by
                         AND o.current_status <> 'archived')
    ORDER BY x.created_by, (x.current_status = 'published') DESC, x.updated_at DESC);

-- b) Profil terbitan langsung admin yang tertaut ke admin pembuatnya: lepaskan
--    tautannya (profil tetap tayang, menunggu klaim/penautan ke akun expert yang
--    benar), kecuali admin itu sendiri memegang role expert.
UPDATE public.experts e
   SET original_contributor_id = NULL
 WHERE e.source_type = 'admin_direct'
   AND e.original_contributor_id = e.created_by
   AND NOT public.has_rbac_role(e.created_by, 'expert');

-- ------------------------------------------------------------- 2. RLS
CREATE OR REPLACE FUNCTION public._expert_is_owner(_expert_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.experts e
                  WHERE e.id = _expert_id AND e.original_contributor_id = auth.uid())
$$;

DROP POLICY IF EXISTS experts_owner_read ON public.experts;
CREATE POLICY experts_owner_read ON public.experts
  FOR SELECT TO authenticated
  USING (original_contributor_id = auth.uid());

-- ------------------------------------------------------------- 3. pembantu
CREATE OR REPLACE FUNCTION public._active_trainer_expert_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id
  FROM public.experts e
  WHERE e.original_contributor_id = _user_id
    AND e.current_status = 'published'
    AND e.visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM public.rbac_user_roles ur
      JOIN public.rbac_roles r ON r.id = ur.role_id
      WHERE ur.user_id = _user_id AND r.code = 'expert'
        AND COALESCE(ur.status, 'active') = 'active'
        AND COALESCE(ur.valid_from, ur.created_at) <= now()
        AND (ur.valid_until IS NULL OR ur.valid_until > now())
    )
    AND (
      SELECT ts.trainer_status
      FROM public.expert_trainer_status ts
      WHERE ts.expert_id = e.id
        AND ts.effective_from <= now()
        AND (ts.expires_at IS NULL OR ts.expires_at > now())
      ORDER BY ts.version DESC, ts.granted_at DESC
      LIMIT 1
    ) = 'active'
  ORDER BY e.updated_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public._my_verified_expert_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id FROM public.experts e
   WHERE e.original_contributor_id = _user_id
     AND e.current_status = 'published'
     AND public.has_rbac_role(_user_id, 'expert')
   ORDER BY e.updated_at DESC LIMIT 1
$$;

-- ------------------------------------------------------------- 4. portal trainer
CREATE OR REPLACE FUNCTION public.trainer_portal_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid(); v_expert public.experts%ROWTYPE; v_status public.expert_trainer_status%ROWTYPE;
  v_has_expert_role boolean := false; v_modules jsonb := '[]'; v_history jsonb := '[]';
  v_drafts jsonb := '[]'; v_certificates jsonb := '[]'; v_rules jsonb := '[]';
  v_countries jsonb := '[]'; v_organization text; v_training_roles jsonb := '[]';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.id=ur.role_id
    WHERE ur.user_id=v_uid AND r.code='expert' AND COALESCE(ur.status,'active')='active'
      AND COALESCE(ur.valid_from,ur.created_at)<=now() AND (ur.valid_until IS NULL OR ur.valid_until>now())) INTO v_has_expert_role;
  SELECT * INTO v_expert FROM public.experts e WHERE e.original_contributor_id=v_uid
    ORDER BY (e.current_status='published') DESC,e.updated_at DESC LIMIT 1;
  IF NOT v_has_expert_role OR v_expert.id IS NULL THEN RETURN jsonb_build_object('access','registered_user'); END IF;
  SELECT * INTO v_status FROM public.expert_trainer_status s WHERE s.expert_id=v_expert.id
    AND s.effective_from<=now() AND (s.expires_at IS NULL OR s.expires_at>now())
    ORDER BY s.version DESC,s.granted_at DESC LIMIT 1;
  IF v_status.id IS NULL OR v_status.trainer_status<>'active' THEN
    RETURN jsonb_build_object('access','expert_non_trainer','expertName',v_expert.display_name,
      'trainerStatus',COALESCE(v_status.trainer_status::text,'not_applied'));
  END IF;
  SELECT ee.organization INTO v_organization FROM public.expert_employment ee WHERE ee.expert_id=v_expert.id
    ORDER BY ee.is_current DESC,ee.updated_at DESC LIMIT 1;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'summary',m.summary,
    'status',m.current_status,'hours',m.estimated_learning_hours,'version',m.version,'language',m.language,
    'moduleType',m.module_type,'targetParticipants',m.target_participants,'updatedAt',m.updated_at)
    ORDER BY m.updated_at DESC),'[]') INTO v_modules FROM public.module_registry m WHERE m.author_expert_id=v_expert.id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',h.id,'title',h.activity_title,'organizer',h.organizer,
    'role',h.role,'startDate',h.start_date,'endDate',h.end_date,'participants',h.participant_count,
    'country',h.country) ORDER BY h.start_date DESC NULLS LAST),'[]') INTO v_history
    FROM public.expert_training_facilitation_history h WHERE h.expert_id=v_expert.id;
  -- Bounded: newest 100 drafts, newest 20 review events each. Withdrawn branches
  -- only carry their attachment lists (used to resolve old draft links and to
  -- inherit files), not the full payload.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'status',d.status,
    'subjectId',d.linked_subject_id,'reviewStatus',s.current_status,
    'payload',CASE WHEN d.status='withdrawn' THEN jsonb_strip_nulls(jsonb_build_object(
        'documents',d.payload->'documents','attachments',d.payload->'attachments',
        'metadata',jsonb_strip_nulls(jsonb_build_object('attached_resources',d.payload->'metadata'->'attached_resources'))))
      ELSE d.payload END,
    'createdAt',d.created_at,'updatedAt',d.updated_at,
    'reviewHistory',COALESCE((SELECT jsonb_agg(item ORDER BY item->>'at' DESC) FROM (
      SELECT item FROM (
        SELECT jsonb_build_object('kind','review','at',rr.submitted_at,'actor',COALESCE(p.display_name,'BARUNA Reviewer'),
          'decision',rr.recommendation,'comment',rr.rationale) item FROM public.review_records rr
          LEFT JOIN public.profiles p ON p.id=rr.reviewer_id WHERE rr.subject_id=s.id AND rr.status='submitted'
        UNION ALL
        SELECT jsonb_build_object('kind','decision','at',rd.decided_at,'actor',COALESCE(p.display_name,'BARUNA Approver'),
          'decision',rd.decision,'comment',rd.rationale) item FROM public.review_decisions rd
          LEFT JOIN public.profiles p ON p.id=rd.decided_by WHERE rd.subject_id=s.id
      ) all_events ORDER BY item->>'at' DESC LIMIT 20
    ) events),'[]'::jsonb)) ORDER BY d.updated_at DESC),'[]') INTO v_drafts
    FROM (SELECT * FROM public.review_drafts WHERE submitter_id=v_uid AND subject_kind='module'
          ORDER BY updated_at DESC LIMIT 100) d
    LEFT JOIN public.review_subjects s ON s.id=d.linked_subject_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'type',c.certificate_type,'title',c.title,
    'subtitle',c.subtitle,'number',c.certificate_number,'issueDate',c.issue_date,
    'documentUrl',c.document_url,'metadata',c.metadata) ORDER BY c.issue_date DESC),'[]') INTO v_certificates
    FROM public.expert_trainer_certificates c WHERE c.expert_id=v_expert.id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('level',r.trainer_level,'minimumParticipants',r.min_unique_graduated_participants,
    'evidenceRequirements',r.evidence_requirements) ORDER BY r.min_unique_graduated_participants),'[]') INTO v_rules
    FROM public.trainer_level_rules r WHERE r.effective_from<=now() AND (r.effective_until IS NULL OR r.effective_until>now());
  SELECT COALESCE(jsonb_agg(jsonb_build_object('country',country,'participants',participants) ORDER BY participants DESC),'[]') INTO v_countries
    FROM (SELECT COALESCE(h.country,'Unspecified') country,SUM(COALESCE(h.participant_count,0))::int participants
      FROM public.expert_training_facilitation_history h WHERE h.expert_id=v_expert.id GROUP BY COALESCE(h.country,'Unspecified')) x;
  SELECT COALESCE(jsonb_agg(role ORDER BY role),'[]') INTO v_training_roles FROM (
    SELECT DISTINCT h.role FROM public.expert_training_facilitation_history h
    WHERE h.expert_id=v_expert.id AND h.role IS NOT NULL AND trim(h.role)<>''
  ) roles;
  RETURN jsonb_build_object('access','active_trainer','trainer',jsonb_build_object(
    'expertId',v_expert.id,'fullName',v_expert.display_name,'title',v_expert.headline,'organization',v_organization,
    'country',v_expert.country,'expertiseAreas',v_expert.expertise_areas,'languages',v_expert.languages,
    'trainingRoles',v_training_roles,'level',v_status.trainer_level,'status',v_status.trainer_status,
    'approvedAt',v_status.granted_at,'uniqueSuccessfulParticipants',v_status.unique_graduated_participants),
    'modules',v_modules,'history',v_history,'moduleDrafts',v_drafts,'certificates',v_certificates,
    'moduleQuota',public._trainer_module_quota(v_uid),
    'recognitionRules',v_rules,'analytics',jsonb_build_object('countries',v_countries,
      'completionRate',NULL,'averageRating',NULL,'hasUnresolvedComplaint',NULL));
END $$;

CREATE OR REPLACE FUNCTION public.trainer_status_backfill_self()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_expert public.experts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('trainer_status_backfill:' || v_uid::text, 0));
  SELECT * INTO v_expert FROM public.experts e
   WHERE e.original_contributor_id = v_uid AND e.current_status = 'published'
   ORDER BY e.updated_at DESC LIMIT 1;
  IF v_expert.id IS NULL OR NOT public.has_rbac_role(v_uid, 'expert') THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.expert_trainer_status WHERE expert_id = v_expert.id) THEN RETURN false; END IF;
  INSERT INTO public.expert_trainer_status (expert_id, trainer_status, trainer_level, unique_graduated_participants,
                                            granted_by, granted_at, effective_from, rationale, version)
  VALUES (v_expert.id, 'active', 'certified', 0, v_expert.approved_by, now(), now(), 'legacy_backfill', 1);
  RETURN true;
END $$;

-- ------------------------------------------------------------- 5. penulis modul
-- Publishes the last SUBMITTED revision (what reviewers saw), never an open draft.
CREATE OR REPLACE FUNCTION public._publish_module_from_subject(_subject_id uuid, _decision_id uuid, _actor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub public.review_subjects%ROWTYPE;
  v_payload jsonb; v_expert uuid; v_existing public.module_registry%ROWTYPE;
  v_mt module_type_v1; v_title text; v_objectives text[]; v_hours numeric; v_next integer;
  v_decided_at timestamptz; v_id uuid;
BEGIN
  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id;
  SELECT r.snapshot->'payload' INTO v_payload FROM public.review_subject_revisions r
   WHERE r.subject_id = _subject_id ORDER BY r.revision DESC LIMIT 1;
  IF v_payload IS NULL OR jsonb_typeof(v_payload) <> 'object' OR v_payload = '{}'::jsonb THEN
    SELECT d.payload INTO v_payload FROM public.review_drafts d
     WHERE d.linked_subject_id = _subject_id AND d.status <> 'withdrawn'
     ORDER BY d.updated_at DESC LIMIT 1;
  END IF;
  v_payload := CASE WHEN jsonb_typeof(v_payload) = 'object' THEN v_payload ELSE '{}'::jsonb END;

  -- The submitter's own linked profile; prefer the published one so a stale
  -- archived profile never becomes the author.
  SELECT e.id INTO v_expert FROM public.experts e
   WHERE e.original_contributor_id = v_sub.submitted_by
   ORDER BY (e.current_status = 'published') DESC, e.updated_at DESC LIMIT 1;

  v_mt := CASE WHEN (v_payload->>'module_type') = ANY (enum_range(NULL::module_type_v1)::text[])
               THEN (v_payload->>'module_type')::module_type_v1 ELSE 'technical' END;
  v_title := COALESCE(NULLIF(btrim(v_payload->>'title'), ''), v_sub.title, 'Untitled Module');
  v_objectives := CASE WHEN jsonb_typeof(v_payload->'learning_objectives') = 'array'
                       THEN ARRAY(SELECT jsonb_array_elements_text(v_payload->'learning_objectives'))
                       ELSE '{}'::text[] END;
  v_hours := CASE WHEN (v_payload->>'estimated_learning_hours') ~ '^\d+(\.\d+)?$'
                  THEN (v_payload->>'estimated_learning_hours')::numeric ELSE 0 END;
  SELECT decided_at INTO v_decided_at FROM public.review_decisions WHERE id = _decision_id;

  SELECT * INTO v_existing FROM public.module_registry
   WHERE source_submission_id = _subject_id ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    v_next := GREATEST(v_existing.version,
      COALESCE((SELECT max(version) FROM public.module_registry_versions WHERE module_id = v_existing.id), 0)) + 1;
    UPDATE public.module_registry SET
      approved_by = _actor, published_by = _actor,
      approval_date = COALESCE(v_decided_at, now()), publication_date = now(),
      verification_status = 'governance_verified', visibility = 'public', current_status = 'published',
      audit_ref = _decision_id, title = v_title,
      summary = CASE WHEN jsonb_typeof(v_payload->'summary') = 'string' THEN v_payload->>'summary' END,
      language = COALESCE(NULLIF(v_payload->>'language', ''), 'English'),
      module_type = v_mt,
      target_participants = CASE WHEN jsonb_typeof(v_payload->'target_participants') = 'string' THEN v_payload->>'target_participants' END,
      estimated_learning_hours = v_hours, learning_objectives = v_objectives,
      content_outline = CASE WHEN jsonb_typeof(v_payload->'content_outline') = 'object' THEN v_payload->'content_outline' ELSE '{}'::jsonb END,
      assessment_approach = CASE WHEN jsonb_typeof(v_payload->'assessment_approach') = 'object' THEN v_payload->'assessment_approach' ELSE '{}'::jsonb END,
      author_expert_id = v_expert,
      metadata = CASE WHEN jsonb_typeof(v_payload->'metadata') = 'object' THEN v_payload->'metadata' ELSE '{}'::jsonb END,
      version = v_next, updated_at = now()
    WHERE id = v_existing.id;
    RETURN v_existing.id;
  END IF;

  INSERT INTO public.module_registry (
    source_type, source_submission_id, original_contributor_id, created_by, approved_by, published_by,
    approval_date, publication_date, verification_status, visibility, current_status, audit_ref,
    title, summary, language, module_type, target_participants, estimated_learning_hours,
    learning_objectives, content_outline, assessment_approach, author_expert_id, metadata
  ) VALUES (
    'external_submission', _subject_id, v_sub.submitted_by, v_sub.submitted_by, _actor, _actor,
    COALESCE(v_decided_at, now()), now(), 'governance_verified', 'public', 'published', _decision_id,
    v_title,
    CASE WHEN jsonb_typeof(v_payload->'summary') = 'string' THEN v_payload->>'summary' END,
    COALESCE(NULLIF(v_payload->>'language', ''), 'English'), v_mt,
    CASE WHEN jsonb_typeof(v_payload->'target_participants') = 'string' THEN v_payload->>'target_participants' END,
    v_hours, v_objectives,
    CASE WHEN jsonb_typeof(v_payload->'content_outline') = 'object' THEN v_payload->'content_outline' ELSE '{}'::jsonb END,
    CASE WHEN jsonb_typeof(v_payload->'assessment_approach') = 'object' THEN v_payload->'assessment_approach' ELSE '{}'::jsonb END,
    v_expert,
    CASE WHEN jsonb_typeof(v_payload->'metadata') = 'object' THEN v_payload->'metadata' ELSE '{}'::jsonb END
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ------------------------------------------------------------- 6. terbit langsung admin
-- Profil terbitan admin belum tertaut ke akun mana pun (original_contributor_id
-- NULL); admin tercatat sebagai created_by/approved_by/published_by saja.
-- Sekaligus memperbaiki: sejak 20260916010000 kolom slug NOT NULL tetapi fungsi
-- ini tidak mengisinya, sehingga setiap pemanggilan selalu gagal.
CREATE OR REPLACE FUNCTION public.expert_publish_direct(
  _payload jsonb,
  _visibility registry_visibility_v1 DEFAULT 'public',
  _verification verification_status_v1 DEFAULT 'institutionally_verified',
  _rationale text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_name text; v_base text; v_slug text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public._require_admin_or_mgmt();
  IF _rationale IS NULL OR length(trim(_rationale)) = 0 THEN
    RAISE EXCEPTION 'rationale_required';
  END IF;
  v_name := COALESCE(_payload->>'display_name','');
  IF length(trim(v_name)) = 0 THEN RAISE EXCEPTION 'display_name_required'; END IF;

  v_base := public._expert_slugify(v_name);
  PERFORM pg_advisory_xact_lock(hashtext('expert_slug:' || v_base));
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.experts WHERE slug = v_slug) LOOP
    v_slug := v_base || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
  END LOOP;

  INSERT INTO public.experts (
    source_type, created_by, original_contributor_id, slug,
    approved_by, published_by, approval_date, publication_date,
    verification_status, visibility, current_status,
    display_name, headline, bio, country, city,
    languages, expertise_areas, orcid, personal_url, avatar_url
  ) VALUES (
    'admin_direct', v_uid, NULL, v_slug,
    v_uid, v_uid, now(), now(),
    _verification, _visibility, 'published',
    v_name, _payload->>'headline', _payload->>'bio',
    _payload->>'country', _payload->>'city',
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(_payload->'languages') x), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(_payload->'expertise_areas') x), ARRAY[]::text[]),
    _payload->>'orcid', _payload->>'personal_url', _payload->>'avatar_url'
  ) RETURNING id INTO v_id;

  PERFORM public.log_governance_event(
    'expert_direct_published', v_uid, v_id, 'expert', v_id::text,
    NULL, jsonb_build_object('rationale', _rationale));
  PERFORM public.emit_platform_event(
    'record_published'::platform_event_type_v1,
    v_uid, v_id, 'expert', v_id::text, 'experts',
    'admin_direct', NULL, v_id, NULL,
    jsonb_build_object('rationale', _rationale, 'visibility', _visibility));
  RETURN v_id;
END $$;

-- ------------------------------------------------------------- 7. laporan
DO $$
DECLARE v_unlinked integer; v_admin_linked integer;
BEGIN
  SELECT count(*) INTO v_unlinked FROM public.experts
   WHERE original_contributor_id IS NULL AND current_status <> 'archived';
  SELECT count(*) INTO v_admin_linked FROM public.experts
   WHERE source_type = 'admin_direct' AND original_contributor_id = created_by;
  RAISE NOTICE 'Profil expert aktif tanpa akun tertaut: % (tampil di direktori, menunggu penautan/klaim)', v_unlinked;
  IF v_admin_linked > 0 THEN
    RAISE NOTICE 'Profil terbitan admin yang masih tertaut ke admin pembuatnya (admin memegang role expert): % — periksa manual', v_admin_linked;
  END IF;
END $$;

COMMIT;
