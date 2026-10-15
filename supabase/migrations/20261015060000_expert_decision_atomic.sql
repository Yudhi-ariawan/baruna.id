-- ============================================================================
-- Expert: keputusan, publikasi, arsip, pulihkan, dan kirim ulang revisi ATOMIK
-- ============================================================================
-- Sebelumnya semua langkah ini dijalankan server function sebagai 5-12 query
-- terpisah lewat service role:
--   * gagal di tengah meninggalkan data setengah jadi, dan "rollback" menghapus
--     baris review_decisions (jejak audit);
--   * tolak/minta revisi meng-UPDATE SEMUA versi expert_trainer_status (riwayat
--     level/reputasi tertimpa);
--   * publikasi menghapus lalu mengisi ulang bahasa/proyek/publikasi tanpa cek
--     error; dua admin yang menekan "Sinkronkan" bersamaan bisa menghilangkan
--     atau menggandakan data; pemberian status trainer gagal hanya dicatat log;
--   * sinkron ulang mengaktifkan lagi trainer yang sengaja dinonaktifkan admin;
--   * pencabutan role expert selalu gagal (revoked_at tidak diisi, melanggar
--     rbac_user_roles_revocation_check) dan bisa melanggar aturan satu role primer;
--   * arsip/pulihkan tanpa kunci; kirim ulang revisi 3 langkah terpisah.
--
-- Sekarang setiap aksi adalah SATU transaksi dengan kunci baris pada
-- review_subjects (FOR UPDATE) dan pemeriksaan updated_at yang dilihat admin:
--   admin_expert_decide(subject, keputusan, alasan, expected_updated_at)
--       keputusan: approve | reject | return_for_revision | sync
--   admin_expert_archive(subject, alasan, expected_updated_at)
--   admin_expert_restore(subject, expected_updated_at)
--   expert_revision_resubmit(subject, draft, nama, payload, catatan, expected_updated_at)
-- Hanya approver/admin/super admin (public._can_decide_review) yang boleh
-- memutuskan; pemohon tidak boleh memutuskan pengajuannya sendiri.
-- Status efektif dihitung di database oleh _expert_effective_status, sama
-- persis dengan deriveExpertEffectiveStatus (src/lib/experts/application-status.ts).

BEGIN;

-- ------------------------------------------------------------ status efektif
CREATE OR REPLACE FUNCTION public._expert_effective_status(_subject_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub public.review_subjects%ROWTYPE;
  v_status text; v_review text; v_last text; v_draft text; v_pub text;
  v_cycle boolean;
BEGIN
  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id;
  IF v_sub.id IS NULL THEN RETURN NULL; END IF;
  v_status := COALESCE(v_sub.current_status, 'pending');
  v_review := CASE WHEN jsonb_typeof(v_sub.metadata->'review_status') = 'string'
                   THEN v_sub.metadata->>'review_status' END;
  SELECT d.decision INTO v_last FROM public.review_decisions d
   WHERE d.subject_id = _subject_id ORDER BY d.created_at DESC LIMIT 1;
  SELECT r.status INTO v_draft FROM public.review_drafts r
   WHERE r.linked_subject_id = _subject_id AND r.submitter_id = v_sub.submitted_by
     AND r.status <> 'withdrawn'
   ORDER BY r.updated_at DESC LIMIT 1;
  SELECT e.current_status::text INTO v_pub FROM public.experts e
   WHERE e.source_submission_id = _subject_id LIMIT 1;

  IF v_status IN ('archived', 'withdrawn') OR v_review = 'archived'
     OR (v_pub = 'archived' AND v_status = 'approved'
         AND COALESCE(v_review, '') NOT IN ('revision_requested', 'resubmitted', 'rejected')) THEN
    RETURN 'archived';
  END IF;
  IF v_status = 'approved' OR (COALESCE(v_last, '') = 'approve' AND v_status NOT IN ('pending', 'rejected')) THEN
    RETURN 'approved';
  END IF;
  IF v_status = 'rejected' OR (COALESCE(v_last, '') = 'reject' AND v_status <> 'pending') THEN
    RETURN 'rejected';
  END IF;
  v_cycle := COALESCE(v_last, '') = 'return_for_revision'
             OR COALESCE(v_review, '') IN ('revision_requested', 'resubmitted');
  IF v_cycle AND v_review = 'resubmitted' AND v_draft = 'submitted'
     AND v_status NOT IN ('approved', 'withdrawn', 'archived') THEN
    RETURN 'resubmitted';
  END IF;
  IF v_cycle THEN RETURN 'revision_requested'; END IF;
  IF v_status IN ('under_review', 'decision_pending') THEN RETURN v_status; END IF;
  RETURN 'pending';
END $$;

-- ------------------------------------------------------------ role expert
-- Memberi / mencabut role expert sambil menjaga tepat satu role primer aktif
-- (pemicu tertunda rbac_user_roles_validate_primary).
CREATE OR REPLACE FUNCTION public._expert_set_role(_uid uuid, _actor uuid, _active boolean, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role uuid; v_row public.rbac_user_roles; v_other_primary boolean; v_promote uuid;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT id INTO v_role FROM public.rbac_roles WHERE code = 'expert';
  IF v_role IS NULL THEN RAISE EXCEPTION 'expert_role_missing'; END IF;
  SELECT * INTO v_row FROM public.rbac_user_roles WHERE user_id = _uid AND role_id = v_role FOR UPDATE;
  SELECT EXISTS (SELECT 1 FROM public.rbac_user_roles
                  WHERE user_id = _uid AND status = 'active' AND is_primary AND role_id <> v_role)
    INTO v_other_primary;

  IF _active THEN
    IF v_row.id IS NULL THEN
      INSERT INTO public.rbac_user_roles (user_id, role_id, status, is_primary, scope, valid_from,
                                          granted_by, approved_by, approved_at, reason)
      VALUES (_uid, v_role, 'active', NOT v_other_primary, '{}'::jsonb, now(), _actor, _actor, now(), _reason);
    ELSIF v_row.status <> 'active' OR v_row.valid_from > now()
          OR (v_row.valid_until IS NOT NULL AND v_row.valid_until <= now()) THEN
      UPDATE public.rbac_user_roles
         SET status = 'active', valid_from = LEAST(valid_from, now()), valid_until = NULL,
             revoked_at = NULL, revoked_by = NULL, is_primary = NOT v_other_primary,
             approved_by = _actor, approved_at = now(), reason = _reason
       WHERE id = v_row.id;
    END IF;
    RETURN;
  END IF;

  IF v_row.id IS NULL OR v_row.status = 'revoked' THEN RETURN; END IF;
  IF v_row.is_primary AND v_row.status = 'active' THEN
    -- Pindahkan status primer ke role aktif lain (utamakan registered_user).
    SELECT ur.id INTO v_promote FROM public.rbac_user_roles ur
      JOIN public.rbac_roles r ON r.id = ur.role_id
     WHERE ur.user_id = _uid AND ur.status = 'active' AND ur.role_id <> v_role
     ORDER BY (r.code = 'registered_user') DESC, ur.created_at
     LIMIT 1;
    IF v_promote IS NOT NULL THEN
      UPDATE public.rbac_user_roles SET is_primary = true WHERE id = v_promote;
    END IF;
  END IF;
  UPDATE public.rbac_user_roles
     SET status = 'revoked', is_primary = false, revoked_at = now(), revoked_by = _actor, reason = _reason
   WHERE id = v_row.id;
END $$;

-- ------------------------------------------------------------ status trainer
-- expert_trainer_status adalah riwayat ber-versi: hanya menambah versi baru.
CREATE OR REPLACE FUNCTION public._expert_trainer_append(
  _expert_id uuid, _status public.trainer_status_v1, _actor uuid, _rationale text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_latest public.expert_trainer_status; v_next integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('expert_trainer_status:' || _expert_id::text));
  SELECT * INTO v_latest FROM public.expert_trainer_status
   WHERE expert_id = _expert_id ORDER BY version DESC, granted_at DESC LIMIT 1;
  IF v_latest.id IS NULL OR v_latest.trainer_status = _status THEN RETURN false; END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO v_next FROM public.expert_trainer_status WHERE expert_id = _expert_id;
  INSERT INTO public.expert_trainer_status (
    expert_id, trainer_status, trainer_level, unique_graduated_participants, evidence_ref,
    granted_by, granted_at, effective_from, expires_at, rationale, version)
  VALUES (_expert_id, _status, v_latest.trainer_level, v_latest.unique_graduated_participants,
          v_latest.evidence_ref, _actor, now(), now(), v_latest.expires_at, _rationale, v_next);
  RETURN true;
END $$;

-- Mengembalikan status trainer yang dimatikan oleh aksi ber-penanda (arsip atau
-- keputusan). Penonaktifan manual oleh admin TIDAK pernah dibatalkan otomatis.
CREATE OR REPLACE FUNCTION public._expert_trainer_restore(_expert_id uuid, _actor uuid, _marker text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_latest public.expert_trainer_status; v_prev text;
BEGIN
  SELECT * INTO v_latest FROM public.expert_trainer_status
   WHERE expert_id = _expert_id ORDER BY version DESC, granted_at DESC LIMIT 1;
  IF v_latest.id IS NULL THEN RETURN; END IF;
  -- Data lama: penonaktifan versi lama menimpa semua baris tanpa alasan.
  IF v_latest.trainer_status = 'inactive' AND COALESCE(v_latest.rationale, '') = '' THEN
    PERFORM public._expert_trainer_append(_expert_id, 'active', _actor, _reason || '(legacy)');
    RETURN;
  END IF;
  IF COALESCE(v_latest.rationale, '') NOT LIKE _marker || '%' THEN RETURN; END IF;
  v_prev := substr(v_latest.rationale, char_length(_marker) + 1);
  IF v_prev IN ('candidate', 'active', 'inactive', 'suspended', 'retired') THEN
    PERFORM public._expert_trainer_append(_expert_id, v_prev::public.trainer_status_v1, _actor, _reason);
  END IF;
END $$;

-- ------------------------------------------------------------ helpers payload
CREATE OR REPLACE FUNCTION public._jtext(_j jsonb, _key text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(btrim(CASE WHEN jsonb_typeof(_j->_key) = 'string' THEN _j->>_key END), '')
$$;

CREATE OR REPLACE FUNCTION public._expert_proficiency(_level text)
RETURNS public.language_proficiency_v1 LANGUAGE sql IMMUTABLE AS $$
  SELECT (CASE lower(btrim(COALESCE(_level, '')))
    WHEN 'native' THEN 'native' WHEN 'fluent' THEN 'C2' WHEN 'c2' THEN 'C2'
    WHEN 'professional' THEN 'C1' WHEN 'c1' THEN 'C1' WHEN 'b2' THEN 'B2'
    WHEN 'intermediate' THEN 'B1' WHEN 'b1' THEN 'B1' WHEN 'a2' THEN 'A2'
    WHEN 'basic' THEN 'A1' WHEN 'a1' THEN 'A1' ELSE 'C1' END)::public.language_proficiency_v1
$$;

CREATE OR REPLACE FUNCTION public._expert_slugify(_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(NULLIF(btrim(regexp_replace(lower(COALESCE(_name, '')), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'expert')
$$;

-- Payload yang dipublikasikan: draf terbaru MILIK PEMOHON yang tertaut ke subjek
-- (draf orang lain yang ditautkan tidak pernah dipakai), cadangan snapshot revisi.
CREATE OR REPLACE FUNCTION public._expert_subject_payload(_subject_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sub public.review_subjects%ROWTYPE; v_payload jsonb; v_title text;
BEGIN
  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id;
  SELECT r.payload, r.title INTO v_payload, v_title FROM public.review_drafts r
   WHERE r.linked_subject_id = _subject_id AND r.submitter_id = v_sub.submitted_by
     AND r.subject_kind = 'expert' AND r.status <> 'withdrawn'
   ORDER BY r.updated_at DESC LIMIT 1;
  IF v_payload IS NULL OR v_payload = '{}'::jsonb THEN
    SELECT s.snapshot->'payload' INTO v_payload FROM public.review_subject_revisions s
     WHERE s.subject_id = _subject_id ORDER BY s.revision DESC LIMIT 1;
  END IF;
  RETURN jsonb_build_object('payload', COALESCE(v_payload, '{}'::jsonb), 'draft_title', v_title);
END $$;

-- ------------------------------------------------------------ publikasi profil
-- Dipanggil di dalam transaksi pemanggil (subjek sudah terkunci).
-- _new_decision = true hanya untuk persetujuan baru; sinkron ulang tidak pernah
-- mengubah status trainer yang sudah ada.
CREATE OR REPLACE FUNCTION public._expert_publish_from_subject(
  _subject_id uuid, _decision_id uuid, _actor uuid, _new_decision boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub public.review_subjects%ROWTYPE;
  v_pl jsonb; v_draft_title text;
  v_name text; v_headline text; v_bio text; v_country text; v_city text; v_url text;
  v_institution text; v_langs text[]; v_expertise text[];
  v_existing public.experts%ROWTYPE; v_id uuid; v_slug text; v_base text; v_version integer;
  v_emp uuid; v_photo jsonb; v_email text; v_phone text;
BEGIN
  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id;
  IF v_sub.id IS NULL OR v_sub.kind <> 'expert' THEN RAISE EXCEPTION 'expert_subject_not_found'; END IF;
  SELECT x->'payload', x->>'draft_title' INTO v_pl, v_draft_title FROM public._expert_subject_payload(_subject_id) x;

  v_name := COALESCE(public._jtext(v_pl, 'fullName'), public._jtext(v_pl, 'display_name'),
                     NULLIF(btrim(v_draft_title), ''), NULLIF(btrim(v_sub.title), ''), 'Marine Expert');
  v_headline := COALESCE(public._jtext(v_pl, 'title'), 'Marine & Fisheries Expert');
  v_bio := COALESCE(public._jtext(v_pl, 'biography'), public._jtext(v_pl, 'bio'), '');
  v_country := COALESCE(public._jtext(v_pl, 'country'), 'Indonesia');
  v_city := public._jtext(v_pl, 'city');
  v_url := public._jtext(v_pl, 'website');
  v_institution := public._jtext(v_pl, 'institution');
  v_email := public._jtext(v_pl, 'email');
  v_phone := public._jtext(v_pl, 'phone');

  IF jsonb_typeof(v_pl->'structuredLanguages') = 'array' AND jsonb_array_length(v_pl->'structuredLanguages') > 0 THEN
    v_langs := ARRAY(SELECT public._jtext(e, 'language') FROM jsonb_array_elements(v_pl->'structuredLanguages') WITH ORDINALITY t(e, o)
                      WHERE jsonb_typeof(e) = 'object' AND public._jtext(e, 'language') IS NOT NULL ORDER BY o);
  ELSIF jsonb_typeof(v_pl->'languages') = 'array' THEN
    v_langs := ARRAY(SELECT e #>> '{}' FROM jsonb_array_elements(v_pl->'languages') WITH ORDINALITY t(e, o)
                      WHERE jsonb_typeof(e) IN ('string', 'number') ORDER BY o);
  ELSIF public._jtext(v_pl, 'languages') IS NOT NULL THEN
    v_langs := ARRAY(SELECT btrim(regexp_replace(x, '\s*\([^)]*\)', '', 'g'))
                       FROM unnest(string_to_array(v_pl->>'languages', ',')) WITH ORDINALITY u(x, o)
                      WHERE btrim(regexp_replace(x, '\s*\([^)]*\)', '', 'g')) <> '' ORDER BY o);
  ELSE
    v_langs := '{}';
  END IF;
  v_expertise := CASE
    WHEN jsonb_typeof(v_pl->'expertise') = 'array' THEN
      ARRAY(SELECT e #>> '{}' FROM jsonb_array_elements(v_pl->'expertise') WITH ORDINALITY t(e, o)
             WHERE jsonb_typeof(e) IN ('string', 'number') ORDER BY o)
    WHEN jsonb_typeof(v_pl->'expertise_areas') = 'array' THEN
      ARRAY(SELECT e #>> '{}' FROM jsonb_array_elements(v_pl->'expertise_areas') WITH ORDINALITY t(e, o)
             WHERE jsonb_typeof(e) IN ('string', 'number') ORDER BY o)
    ELSE '{}' END;

  -- Satu profil per orang: baris dari subjek ini, atau profil yang sudah dimiliki
  -- pemohon (dibuat oleh sistem untuk akun yang sama).
  SELECT * INTO v_existing FROM public.experts WHERE source_submission_id = _subject_id FOR UPDATE;
  IF v_existing.id IS NULL THEN
    SELECT * INTO v_existing FROM public.experts
     WHERE original_contributor_id = v_sub.submitted_by AND created_by = v_sub.submitted_by
     ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  END IF;

  IF v_existing.id IS NULL THEN
    v_base := public._expert_slugify(v_name);
    PERFORM pg_advisory_xact_lock(hashtext('expert_slug:' || v_base));
    v_slug := v_base;
    IF EXISTS (SELECT 1 FROM public.experts WHERE slug = v_slug) THEN
      v_slug := v_base || '-' || left(replace(_subject_id::text, '-', ''), 8);
    END IF;
    WHILE EXISTS (SELECT 1 FROM public.experts WHERE slug = v_slug) LOOP
      v_slug := v_base || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
    END LOOP;
    INSERT INTO public.experts (
      source_type, source_submission_id, original_contributor_id, created_by, approved_by, published_by,
      approval_date, publication_date, verification_status, visibility, current_status, audit_ref,
      display_name, slug, headline, bio, country, city, languages, expertise_areas, personal_url)
    VALUES ('external_submission', _subject_id, v_sub.submitted_by, v_sub.submitted_by,
            COALESCE(_actor, v_sub.submitted_by), COALESCE(_actor, v_sub.submitted_by), now(), now(),
            'governance_verified', 'public', 'published', _decision_id,
            v_name, v_slug, v_headline, v_bio, v_country, v_city, v_langs, v_expertise, v_url)
    RETURNING id INTO v_id;
  ELSE
    v_id := v_existing.id;
    v_slug := v_existing.slug;  -- URL publik tidak pernah berubah saat disetujui ulang.
  END IF;

  -- Data turunan (bahasa, proyek, publikasi, pekerjaan). Diganti dalam transaksi
  -- yang sama: gagal = tidak ada yang berubah. Hanya diganti bila payload memuatnya.
  IF jsonb_typeof(v_pl->'structuredLanguages') = 'array' AND jsonb_array_length(v_pl->'structuredLanguages') > 0
     OR cardinality(v_langs) > 0 THEN
    DELETE FROM public.expert_languages WHERE expert_id = v_id;
    INSERT INTO public.expert_languages (expert_id, language_code, language_name, proficiency_level, visibility)
    SELECT DISTINCT ON (code) v_id, code, name, public._expert_proficiency(prof), 'public'
      FROM (
        SELECT name, prof, o,
               COALESCE(NULLIF(left(regexp_replace(lower(name), '[^a-z0-9]', '', 'g'), 12), ''),
                        'lang-' || (row_number() OVER (ORDER BY o) - 1)) AS code
          FROM (
            SELECT public._jtext(e, 'language') AS name, COALESCE(public._jtext(e, 'proficiency'), 'fluent') AS prof, o
              FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_pl->'structuredLanguages') = 'array'
                                              AND jsonb_array_length(v_pl->'structuredLanguages') > 0
                                             THEN v_pl->'structuredLanguages' ELSE '[]'::jsonb END) WITH ORDINALITY t(e, o)
             WHERE jsonb_typeof(e) = 'object' AND public._jtext(e, 'language') IS NOT NULL
            UNION ALL
            SELECT btrim(l), 'fluent', o FROM unnest(v_langs) WITH ORDINALITY u(l, o)
             WHERE NOT (jsonb_typeof(v_pl->'structuredLanguages') = 'array'
                        AND jsonb_array_length(v_pl->'structuredLanguages') > 0)
               AND btrim(l) <> ''
          ) items
      ) coded
     ORDER BY code, o DESC;
  END IF;

  IF jsonb_typeof(v_pl->'structuredProjects') = 'array' AND jsonb_array_length(v_pl->'structuredProjects') > 0 THEN
    DELETE FROM public.expert_projects WHERE expert_id = v_id;
    INSERT INTO public.expert_projects (expert_id, project_name, institution_or_funder, role, description, evidence_ref, visibility)
    SELECT v_id, COALESCE(public._jtext(e, 'name'), public._jtext(e, 'title')),
           COALESCE(public._jtext(e, 'institution'), public._jtext(e, 'clientOrOrg')),
           public._jtext(e, 'role'),
           NULLIF(array_to_string(ARRAY[public._jtext(e, 'description'), public._jtext(e, 'outcome'),
                                        'Periode: ' || public._jtext(e, 'period')], E'\n'), ''),
           public._jtext(e, 'url'), 'public'
      FROM jsonb_array_elements(v_pl->'structuredProjects') WITH ORDINALITY t(e, o)
     WHERE jsonb_typeof(e) = 'object' AND COALESCE(public._jtext(e, 'name'), public._jtext(e, 'title')) IS NOT NULL
     ORDER BY o;
  END IF;

  IF jsonb_typeof(v_pl->'structuredPublications') = 'array' AND jsonb_array_length(v_pl->'structuredPublications') > 0 THEN
    DELETE FROM public.expert_publications WHERE expert_id = v_id;
    INSERT INTO public.expert_publications (expert_id, title, venue, year, url, visibility)
    SELECT v_id, public._jtext(e, 'title'),
           COALESCE(public._jtext(e, 'venue'), public._jtext(e, 'publisherOrJournal')),
           CASE WHEN yr BETWEEN 1901 AND 2099 THEN yr END,
           COALESCE(public._jtext(e, 'url'), public._jtext(e, 'doi')), 'public'
      FROM (
        SELECT e, o, CASE
                 WHEN jsonb_typeof(e->'year') = 'number' AND abs((e->>'year')::numeric) < 100000
                   THEN trunc((e->>'year')::numeric)::integer
                 WHEN jsonb_typeof(e->'year') = 'string' AND (e->>'year') ~ '^\s*[+-]?\d{1,6}'
                   THEN substring(e->>'year' FROM '^\s*([+-]?\d{1,6})')::integer
               END AS yr
          FROM jsonb_array_elements(v_pl->'structuredPublications') WITH ORDINALITY t(e, o)
         WHERE jsonb_typeof(e) = 'object'
      ) p
     WHERE public._jtext(e, 'title') IS NOT NULL
     ORDER BY o;
  END IF;

  SELECT id INTO v_emp FROM public.expert_employment WHERE expert_id = v_id
   ORDER BY is_current DESC, updated_at DESC LIMIT 1;
  IF v_emp IS NULL THEN
    INSERT INTO public.expert_employment (expert_id, organization, role, is_current, visibility)
    VALUES (v_id, COALESCE(v_institution, 'BARUNA Network'), v_headline, true, 'public');
  ELSE
    UPDATE public.expert_employment
       SET organization = COALESCE(v_institution, 'BARUNA Network'), role = v_headline, is_current = true, visibility = 'public'
     WHERE id = v_emp;
  END IF;

  -- Baris profil diperbarui SETELAH data turunan, supaya snapshot versi
  -- (trg_experts_version_snapshot) memuat data turunan yang baru.
  IF v_existing.id IS NOT NULL THEN
    SELECT GREATEST(COALESCE(v_existing.version, 1),
                    COALESCE((SELECT max(version) FROM public.expert_versions WHERE expert_id = v_id), 0)) + 1
      INTO v_version;
    UPDATE public.experts
       SET source_type = 'external_submission', source_submission_id = _subject_id,
           original_contributor_id = v_sub.submitted_by, created_by = v_sub.submitted_by,
           approved_by = COALESCE(_actor, v_sub.submitted_by), published_by = COALESCE(_actor, v_sub.submitted_by),
           approval_date = now(), publication_date = now(), verification_status = 'governance_verified',
           visibility = 'public', current_status = 'published', audit_ref = _decision_id,
           display_name = v_name, headline = v_headline, bio = v_bio, country = v_country, city = v_city,
           languages = v_langs, expertise_areas = v_expertise, personal_url = v_url, version = v_version
     WHERE id = v_id;
  END IF;

  -- Kontak privat (dibaca pemeriksa duplikat A2; tidak pernah tampil publik).
  IF v_email IS NOT NULL OR v_phone IS NOT NULL THEN
    INSERT INTO public.expert_contact_private (expert_id, email, phone)
    VALUES (v_id, v_email, v_phone)
    ON CONFLICT (expert_id) DO UPDATE
      SET email = COALESCE(EXCLUDED.email, public.expert_contact_private.email),
          phone = COALESCE(EXCLUDED.phone, public.expert_contact_private.phone),
          updated_at = now();
  END IF;

  -- Status trainer (perilaku saat ini: expert yang disetujui menjadi trainer aktif,
  -- keputusan B1 masih menunggu mentor). Baris baru hanya bila belum ada; persetujuan
  -- baru hanya membatalkan penonaktifan yang dibuat oleh keputusan tolak/revisi.
  IF NOT EXISTS (SELECT 1 FROM public.expert_trainer_status WHERE expert_id = v_id) THEN
    PERFORM pg_advisory_xact_lock(hashtext('expert_trainer_status:' || v_id::text));
    IF NOT EXISTS (SELECT 1 FROM public.expert_trainer_status WHERE expert_id = v_id) THEN
      INSERT INTO public.expert_trainer_status (expert_id, trainer_status, trainer_level, unique_graduated_participants,
                                                granted_by, granted_at, effective_from, rationale, version)
      VALUES (v_id, 'active', 'certified', 0, _actor, now(), now(), 'expert_application_approved', 1);
    END IF;
  ELSIF _new_decision THEN
    PERFORM public._expert_trainer_restore(v_id, _actor, 'expert_decision_deactivated;previous=', 'expert_reapproved');
  END IF;

  PERFORM public._expert_set_role(v_sub.submitted_by, _actor, true, 'expert_application_approved');

  UPDATE public.profiles
     SET organization = COALESCE(v_institution, organization),
         job_title = v_headline,
         phone = COALESCE(v_phone, phone)
   WHERE id = v_sub.submitted_by;

  SELECT d INTO v_photo FROM jsonb_array_elements(
           CASE WHEN jsonb_typeof(v_pl->'documents') = 'array' THEN v_pl->'documents' ELSE '[]'::jsonb END) d
   WHERE jsonb_typeof(d) = 'object' AND d->>'category' = 'photo' LIMIT 1;

  RETURN jsonb_build_object('expertId', v_id, 'slug', v_slug, 'photo', v_photo);
END $$;

-- Menonaktifkan hasil publikasi saat ditolak / diminta revisi (bukan arsip).
CREATE OR REPLACE FUNCTION public._expert_deactivate_outputs(_subject_id uuid, _actor uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sub public.review_subjects%ROWTYPE; v_expert uuid; v_latest public.expert_trainer_status;
BEGIN
  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id;
  SELECT id INTO v_expert FROM public.experts WHERE source_submission_id = _subject_id FOR UPDATE;
  IF v_expert IS NOT NULL THEN
    UPDATE public.experts SET current_status = 'archived', visibility = 'private'
     WHERE id = v_expert AND (current_status <> 'archived' OR visibility <> 'private');
    SELECT * INTO v_latest FROM public.expert_trainer_status
     WHERE expert_id = v_expert ORDER BY version DESC, granted_at DESC LIMIT 1;
    IF v_latest.id IS NOT NULL AND v_latest.trainer_status <> 'inactive' THEN
      PERFORM public._expert_trainer_append(v_expert, 'inactive', _actor,
        'expert_decision_deactivated;previous=' || v_latest.trainer_status::text);
    END IF;
  END IF;
  PERFORM public._expert_set_role(v_sub.submitted_by, _actor, false, _reason);
END $$;

CREATE OR REPLACE FUNCTION public._expert_audit(_event text, _actor uuid, _subject_id uuid, _entity text, _before jsonb, _after jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF to_regclass('public.governance_audit_log') IS NOT NULL THEN
    INSERT INTO public.governance_audit_log (event_type, actor_id, subject_id, entity_type, entity_id, before, after)
    VALUES (_event, _actor, _subject_id, 'experts', _entity, _before, _after);
  END IF;
END $$;

-- ------------------------------------------------------------ keputusan
CREATE OR REPLACE FUNCTION public.admin_expert_decide(
  _subject_id uuid, _decision text, _rationale text DEFAULT NULL, _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub public.review_subjects%ROWTYPE;
  v_meta jsonb; v_eff text; v_prev uuid; v_dec uuid; v_pub jsonb; v_draft public.review_drafts%ROWTYPE;
  v_snap jsonb; v_reason text := NULLIF(btrim(COALESCE(_rationale, '')), '');
BEGIN
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _decision NOT IN ('approve', 'reject', 'return_for_revision', 'sync') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF char_length(COALESCE(v_reason, '')) > 5000 THEN RAISE EXCEPTION 'rationale_too_long'; END IF;

  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id FOR UPDATE;
  IF v_sub.id IS NULL OR v_sub.kind <> 'expert' THEN RAISE EXCEPTION 'expert_subject_not_found'; END IF;
  IF v_sub.submitted_by = v_uid THEN RAISE EXCEPTION 'self_decision_forbidden'; END IF;
  IF _expected_updated_at IS NOT NULL AND v_sub.updated_at <> _expected_updated_at THEN
    RAISE EXCEPTION 'stale_subject';
  END IF;
  v_meta := COALESCE(v_sub.metadata, '{}'::jsonb);
  v_eff := public._expert_effective_status(_subject_id);

  IF _decision = 'sync' OR (_decision = 'approve' AND v_eff = 'approved') THEN
    IF v_eff <> 'approved' THEN RAISE EXCEPTION 'expert_not_approved'; END IF;
    v_pub := public._expert_publish_from_subject(_subject_id, NULL, v_uid, false);
    RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'status', 'approved',
                              'changed', false, 'resynced', true) || v_pub;
  END IF;

  IF v_eff = 'archived' THEN RAISE EXCEPTION 'expert_archived'; END IF;
  IF _decision = 'approve' AND v_eff = 'revision_requested' THEN RAISE EXCEPTION 'awaiting_applicant_revision'; END IF;
  IF _decision = 'reject' AND v_eff = 'rejected' THEN RAISE EXCEPTION 'already_rejected'; END IF;
  IF _decision = 'return_for_revision' AND v_eff = 'revision_requested' THEN RAISE EXCEPTION 'already_awaiting_revision'; END IF;
  IF _decision = 'return_for_revision' AND v_eff = 'rejected' THEN RAISE EXCEPTION 'rejected_is_final'; END IF;

  SELECT id INTO v_prev FROM public.review_decisions WHERE subject_id = _subject_id
   ORDER BY created_at DESC, decided_at DESC LIMIT 1;

  IF _decision = 'approve' THEN
    v_reason := COALESCE(v_reason, 'Pengajuan telah diverifikasi dan disetujui.');
    INSERT INTO public.review_decisions (subject_id, decided_by, decision, rationale, supersedes_decision_id)
    VALUES (_subject_id, v_uid, 'approve', v_reason, v_prev) RETURNING id INTO v_dec;
    UPDATE public.review_subjects
       SET current_status = 'approved',
           metadata = v_meta || jsonb_build_object('review_status', 'approved', 'last_decision', 'approve',
             'last_rationale', v_reason, 'approved_at', now(), 'resubmitted_at', NULL,
             'archived_at', NULL, 'archive_rationale', NULL)
     WHERE id = _subject_id;
    UPDATE public.review_drafts SET status = 'submitted'
     WHERE linked_subject_id = _subject_id AND submitter_id = v_sub.submitted_by AND status = 'draft';
    v_pub := public._expert_publish_from_subject(_subject_id, v_dec, v_uid, true);
    RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'decisionId', v_dec,
                              'status', 'approved', 'changed', true) || v_pub;
  END IF;

  IF _decision = 'reject' THEN
    v_reason := COALESCE(v_reason, 'Pengajuan ditolak.');
    INSERT INTO public.review_decisions (subject_id, decided_by, decision, rationale, supersedes_decision_id)
    VALUES (_subject_id, v_uid, 'reject', v_reason, v_prev) RETURNING id INTO v_dec;
    UPDATE public.review_subjects
       SET current_status = 'rejected',
           metadata = v_meta || jsonb_build_object('review_status', 'rejected', 'last_decision', 'reject',
             'last_rationale', v_reason, 'rejected_at', now())
     WHERE id = _subject_id;
    PERFORM public._expert_deactivate_outputs(_subject_id, v_uid, 'expert_application_rejected');
    RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'decisionId', v_dec,
                              'status', 'rejected', 'changed', true);
  END IF;

  -- return_for_revision
  v_reason := COALESCE(v_reason, 'Perlu revisi kelengkapan dokumen.');
  INSERT INTO public.review_decisions (subject_id, decided_by, decision, rationale, supersedes_decision_id)
  VALUES (_subject_id, v_uid, 'return_for_revision', v_reason, v_prev) RETURNING id INTO v_dec;
  UPDATE public.review_subjects
     SET current_status = 'pending',
         metadata = v_meta || jsonb_build_object('review_status', 'revision_requested',
           'last_decision', 'return_for_revision', 'last_rationale', v_reason,
           'revised_at', now(), 'resubmitted_at', NULL)
   WHERE id = _subject_id;
  -- Buka kembali TEPAT SATU draf milik pemohon (indeks unik satu draf per subjek).
  IF NOT EXISTS (SELECT 1 FROM public.review_drafts WHERE linked_subject_id = _subject_id AND status = 'draft') THEN
    SELECT * INTO v_draft FROM public.review_drafts
     WHERE linked_subject_id = _subject_id AND submitter_id = v_sub.submitted_by AND status <> 'withdrawn'
     ORDER BY updated_at DESC LIMIT 1;
    IF v_draft.id IS NOT NULL THEN
      UPDATE public.review_drafts SET status = 'draft' WHERE id = v_draft.id;
    ELSE
      SELECT snapshot INTO v_snap FROM public.review_subject_revisions
       WHERE subject_id = _subject_id ORDER BY revision DESC LIMIT 1;
      INSERT INTO public.review_drafts (subject_kind, submitter_id, title, payload, status, linked_subject_id)
      VALUES ('expert', v_sub.submitted_by,
              COALESCE(public._jtext(v_snap, 'title'), v_sub.title, 'Pengajuan Expert'),
              CASE WHEN jsonb_typeof(v_snap->'payload') = 'object' THEN v_snap->'payload' ELSE '{}'::jsonb END,
              'draft', _subject_id);
    END IF;
  END IF;
  PERFORM public._expert_deactivate_outputs(_subject_id, v_uid, 'expert_returned_for_revision');
  RETURN jsonb_build_object('subjectId', _subject_id, 'decision', _decision, 'decisionId', v_dec,
                            'status', 'revision_requested', 'changed', true);
END $$;

-- ------------------------------------------------------------ arsip
CREATE OR REPLACE FUNCTION public.admin_expert_archive(
  _subject_id uuid, _rationale text DEFAULT NULL, _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_sub public.review_subjects%ROWTYPE; v_meta jsonb; v_expert uuid;
  v_latest public.expert_trainer_status;
  v_reason text := COALESCE(NULLIF(btrim(COALESCE(_rationale, '')), ''), 'Diarsipkan oleh Administrator.');
BEGIN
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_reason) > 1000 THEN RAISE EXCEPTION 'rationale_too_long'; END IF;
  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id FOR UPDATE;
  IF v_sub.id IS NULL OR v_sub.kind <> 'expert' THEN RAISE EXCEPTION 'expert_subject_not_found'; END IF;
  IF v_sub.submitted_by = v_uid THEN RAISE EXCEPTION 'self_decision_forbidden'; END IF;
  IF _expected_updated_at IS NOT NULL AND v_sub.updated_at <> _expected_updated_at THEN RAISE EXCEPTION 'stale_subject'; END IF;
  IF public._expert_effective_status(_subject_id) = 'archived' THEN RAISE EXCEPTION 'already_archived'; END IF;

  v_meta := COALESCE(v_sub.metadata, '{}'::jsonb) || jsonb_build_object(
    'previous_status', v_sub.current_status, 'review_status', 'archived', 'archived_at', now(),
    'archived_by', v_uid, 'archive_rationale', v_reason);
  UPDATE public.review_subjects SET current_status = 'archived', metadata = v_meta WHERE id = _subject_id;

  SELECT id INTO v_expert FROM public.experts WHERE source_submission_id = _subject_id FOR UPDATE;
  IF v_expert IS NOT NULL THEN
    UPDATE public.experts SET current_status = 'archived', visibility = 'private' WHERE id = v_expert;
    SELECT * INTO v_latest FROM public.expert_trainer_status
     WHERE expert_id = v_expert ORDER BY version DESC, granted_at DESC LIMIT 1;
    IF v_latest.id IS NOT NULL AND v_latest.trainer_status <> 'inactive' THEN
      PERFORM public._expert_trainer_append(v_expert, 'inactive', v_uid,
        'expert_archived;previous=' || v_latest.trainer_status::text);
    END IF;
  END IF;
  PERFORM public._expert_set_role(v_sub.submitted_by, v_uid, false, 'expert_archived');
  PERFORM public._expert_audit('expert_archived', v_uid, _subject_id, COALESCE(v_expert, _subject_id)::text,
    jsonb_build_object('status', v_sub.current_status), jsonb_build_object('status', 'archived', 'rationale', v_reason));
  RETURN jsonb_build_object('subjectId', _subject_id, 'status', 'archived');
END $$;

CREATE OR REPLACE FUNCTION public.admin_expert_restore(
  _subject_id uuid, _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_sub public.review_subjects%ROWTYPE; v_meta jsonb; v_prev text;
  v_expert uuid; v_pub jsonb := '{}'::jsonb;
BEGIN
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id FOR UPDATE;
  IF v_sub.id IS NULL OR v_sub.kind <> 'expert' THEN RAISE EXCEPTION 'expert_subject_not_found'; END IF;
  IF v_sub.submitted_by = v_uid THEN RAISE EXCEPTION 'self_decision_forbidden'; END IF;
  IF _expected_updated_at IS NOT NULL AND v_sub.updated_at <> _expected_updated_at THEN RAISE EXCEPTION 'stale_subject'; END IF;
  IF public._expert_effective_status(_subject_id) <> 'archived' THEN RAISE EXCEPTION 'not_archived'; END IF;

  v_meta := COALESCE(v_sub.metadata, '{}'::jsonb);
  v_prev := CASE WHEN jsonb_typeof(v_meta->'previous_status') = 'string'
                  AND v_meta->>'previous_status' IN ('pending', 'under_review', 'decision_pending', 'approved', 'rejected')
                 THEN v_meta->>'previous_status' ELSE 'approved' END;
  UPDATE public.review_subjects
     SET current_status = v_prev,
         metadata = v_meta || jsonb_build_object('review_status', v_prev, 'unarchived_at', now(), 'unarchived_by', v_uid)
   WHERE id = _subject_id;

  IF v_prev = 'approved' THEN
    SELECT id INTO v_expert FROM public.experts WHERE source_submission_id = _subject_id FOR UPDATE;
    IF v_expert IS NOT NULL THEN
      UPDATE public.experts SET current_status = 'published', visibility = 'public' WHERE id = v_expert;
      PERFORM public._expert_trainer_restore(v_expert, v_uid, 'expert_archived;previous=', 'expert_unarchived');
      PERFORM public._expert_set_role(v_sub.submitted_by, v_uid, true, 'expert_unarchived');
    ELSE
      v_pub := public._expert_publish_from_subject(_subject_id, NULL, v_uid, false);
      v_expert := (v_pub->>'expertId')::uuid;
    END IF;
  END IF;
  PERFORM public._expert_audit('expert_unarchived', v_uid, _subject_id, COALESCE(v_expert, _subject_id)::text,
    jsonb_build_object('status', v_sub.current_status), jsonb_build_object('status', v_prev));
  RETURN jsonb_build_object('subjectId', _subject_id,
                            'status', CASE WHEN v_prev = 'approved' THEN 'published' ELSE v_prev END) || v_pub;
END $$;

-- ------------------------------------------------------------ kirim ulang revisi
-- Validasi isi payload (kelengkapan, kepemilikan dokumen) sama dengan
-- getExpertPayloadIncompleteFields + assertOwnedDocumentPaths di TypeScript,
-- sehingga pemanggilan langsung dari SDK tidak bisa melewatinya.
CREATE OR REPLACE FUNCTION public._expert_payload_problem(_payload jsonb, _uid uuid, _require_complete boolean)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_doc jsonb; v_path text; v_missing text[] := '{}';
BEGIN
  IF jsonb_typeof(_payload) IS DISTINCT FROM 'object' THEN RETURN 'payload_invalid'; END IF;
  IF octet_length(_payload::text) > 300000 THEN RETURN 'payload_too_large'; END IF;
  IF jsonb_typeof(_payload->'documents') = 'array' THEN
    IF jsonb_array_length(_payload->'documents') > 8 THEN RETURN 'too_many_documents'; END IF;
    FOR v_doc IN SELECT * FROM jsonb_array_elements(_payload->'documents') LOOP
      v_path := CASE WHEN jsonb_typeof(v_doc) = 'object' AND jsonb_typeof(v_doc->'path') = 'string' THEN v_doc->>'path' END;
      IF v_path IS NULL OR v_path NOT LIKE 'users/' || _uid::text || '/%' OR position('..' IN v_path) > 0 THEN
        RETURN 'document_not_owned';
      END IF;
    END LOOP;
  ELSIF _payload ? 'documents' AND jsonb_typeof(_payload->'documents') <> 'null' THEN
    RETURN 'payload_invalid';
  END IF;
  IF _require_complete THEN
    IF public._jtext(_payload, 'fullName') IS NULL THEN v_missing := array_append(v_missing, 'nama lengkap'::text); END IF;
    IF public._jtext(_payload, 'title') IS NULL THEN v_missing := array_append(v_missing, 'jabatan/gelar profesional'::text); END IF;
    IF public._jtext(_payload, 'institution') IS NULL THEN v_missing := array_append(v_missing, 'institusi'::text); END IF;
    IF public._jtext(_payload, 'country') IS NULL THEN v_missing := array_append(v_missing, 'negara'::text); END IF;
    IF public._jtext(_payload, 'email') IS NULL THEN v_missing := array_append(v_missing, 'email'::text); END IF;
    IF NOT (jsonb_typeof(_payload->'expertise') = 'array' AND jsonb_array_length(_payload->'expertise') > 0) THEN
      v_missing := array_append(v_missing, 'bidang keahlian'::text); END IF;
    IF NOT (jsonb_typeof(_payload->'roles') = 'array' AND jsonb_array_length(_payload->'roles') > 0) THEN
      v_missing := array_append(v_missing, 'peran yang tersedia'::text); END IF;
    IF public._jtext(_payload, 'biography') IS NULL THEN v_missing := array_append(v_missing, 'biografi profesional'::text); END IF;
    IF cardinality(v_missing) > 0 THEN RETURN 'payload_incomplete: ' || array_to_string(v_missing, ', '); END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.expert_revision_resubmit(
  _subject_id uuid, _draft_id uuid, _display_name text, _payload jsonb,
  _notes text DEFAULT NULL, _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_sub public.review_subjects%ROWTYPE; v_draft public.review_drafts%ROWTYPE;
  v_problem text; v_rev integer; v_now timestamptz := now();
  v_name text := NULLIF(btrim(COALESCE(_display_name, '')), '');
  v_notes text := COALESCE(NULLIF(btrim(COALESCE(_notes, '')), ''), 'Dokumen revisi dikirimkan ulang oleh calon expert.');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF v_name IS NULL OR char_length(v_name) > 160 THEN RAISE EXCEPTION 'display_name_required'; END IF;
  IF char_length(v_notes) > 2000 THEN RAISE EXCEPTION 'notes_too_long'; END IF;
  v_problem := public._expert_payload_problem(_payload, v_uid, true);
  IF v_problem IS NOT NULL THEN RAISE EXCEPTION '%', v_problem; END IF;

  SELECT * INTO v_sub FROM public.review_subjects WHERE id = _subject_id FOR UPDATE;
  IF v_sub.id IS NULL OR v_sub.kind <> 'expert' OR v_sub.submitted_by <> v_uid THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF _expected_updated_at IS NOT NULL AND v_sub.updated_at <> _expected_updated_at THEN RAISE EXCEPTION 'stale_subject'; END IF;

  -- Draf yang bisa diedit milik pemohon untuk subjek ini (draft id lama boleh sudah tergantikan).
  SELECT * INTO v_draft FROM public.review_drafts
   WHERE linked_subject_id = _subject_id AND submitter_id = v_uid AND status <> 'withdrawn'
   ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  IF public._expert_effective_status(_subject_id) <> 'revision_requested'
     OR v_draft.id IS NULL OR v_draft.status <> 'draft' THEN
    RAISE EXCEPTION 'not_awaiting_revision';
  END IF;

  UPDATE public.review_subjects
     SET current_status = 'pending', title = v_name,
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'review_status', 'resubmitted', 'resubmitted_at', v_now, 'resubmission_notes', v_notes)
   WHERE id = _subject_id;
  UPDATE public.review_drafts SET payload = _payload, status = 'submitted', title = v_name WHERE id = v_draft.id;
  SELECT COALESCE(max(revision), 0) + 1 INTO v_rev FROM public.review_subject_revisions WHERE subject_id = _subject_id;
  INSERT INTO public.review_subject_revisions (subject_id, draft_id, revision, snapshot, content_hash, submitted_at)
  VALUES (_subject_id, v_draft.id, v_rev,
          jsonb_build_object('payload', _payload, 'resubmitted_at', v_now, 'notes', v_notes, 'title', v_name),
          md5(_payload::text) || '-' || v_rev, v_now);
  RETURN jsonb_build_object('success', true, 'subjectId', _subject_id, 'revision', v_rev);
END $$;

-- ------------------------------------------------------------ hak akses
REVOKE ALL ON FUNCTION public._expert_effective_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._expert_set_role(uuid, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._expert_trainer_append(uuid, public.trainer_status_v1, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._expert_trainer_restore(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._expert_subject_payload(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._expert_publish_from_subject(uuid, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._expert_deactivate_outputs(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._expert_audit(text, uuid, uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._expert_effective_status(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.admin_expert_decide(uuid, text, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_expert_archive(uuid, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_expert_restore(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expert_revision_resubmit(uuid, uuid, text, jsonb, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_expert_decide(uuid, text, text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_expert_archive(uuid, text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_expert_restore(uuid, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expert_revision_resubmit(uuid, uuid, text, jsonb, text, timestamptz) TO authenticated, service_role;

-- Jalur lama yang melewati alur di atas (E7): expert_publish_from_decision mencari
-- keputusan 'approved' (aplikasi memakai 'approve') dan expert_archive mengubah
-- profil tanpa subjek/trainer/role. Tidak dipakai aplikasi; ditutup untuk browser.
DO $$ BEGIN
  IF to_regprocedure('public.expert_publish_from_decision(uuid, uuid, registry_visibility_v1, verification_status_v1)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.expert_publish_from_decision(uuid, uuid, registry_visibility_v1, verification_status_v1) FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('public.expert_archive(uuid, text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.expert_archive(uuid, text) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

COMMIT;
