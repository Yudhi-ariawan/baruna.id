-- ============================================================================
-- Expert jadi trainer otomatis HANYA bila memilih peran "Trainer"
-- ============================================================================
-- Keputusan pemilik proyek (22 Okt 2026), menunggu konfirmasi mentor
-- (MENUNGGU_ARAHAN_MENTOR butir 4).
--
-- Dicek 22 Okt 2026 (database intern-update, kode branch ini):
-- * Pendaftar expert memilih peran (boleh lebih dari satu): Speaker, Trainer,
--   Reviewer, Mentor, Technical Expert. Tetapi _expert_publish_from_subject
--   (20261015090000) membuat SEMUA expert yang disetujui menjadi trainer aktif,
--   sehingga expert yang hanya memilih "Reviewer" pun bisa mengajukan modul.
-- * trainer_status_backfill_self (20261020030000, dipanggil saat Portal Trainer
--   dibuka) memberi status trainer aktif kepada expert mana pun yang belum punya
--   status, sehingga jalur Kualifikasi Trainer (Slide 39) tidak pernah terpakai
--   (0 pengajuan di intern-update).
-- * Data intern-update: 4 expert tayang, semuanya memilih "Trainer" dan sudah
--   trainer aktif. Perubahan ini TIDAK mengubah data mereka.
--
-- Perubahan:
-- * _expert_chose_trainer(payload): peran "Trainer" ada di payload.roles (tanpa
--   membedakan huruf besar/kecil, spasi diabaikan).
-- * _expert_publish_from_subject: baris status trainer pertama hanya dibuat bila
--   expert memilih Trainer. Selebihnya sama persis dengan 20261015090000.
-- * trainer_status_backfill_self: sama, hanya untuk expert yang memilih Trainer.
-- Expert yang tidak memilih Trainer melihat "Trainer qualification required" di
-- portal dan mengajukan lewat /experts/trainer-application (alur yang sudah ada).

BEGIN;

CREATE OR REPLACE FUNCTION public._expert_chose_trainer(_payload jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(_payload->'roles') = 'array'
     AND EXISTS (SELECT 1 FROM jsonb_array_elements(_payload->'roles') r
                  WHERE jsonb_typeof(r) = 'string' AND lower(btrim(r #>> '{}')) = 'trainer')
$$;
REVOKE ALL ON FUNCTION public._expert_chose_trainer(jsonb) FROM PUBLIC, anon, authenticated;

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
  PERFORM public._expert_sync_languages(v_id, v_pl, v_langs);

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

  -- Status trainer: hanya bila expert memilih peran "Trainer" pada pengajuan yang
  -- disetujui (pilihan itu diperiksa verifikator bersama CV dan dokumen). Expert lain
  -- tetap expert dan bisa mengajukan Kualifikasi Trainer (Slide 39). Baris baru hanya
  -- bila belum ada; persetujuan baru hanya membatalkan penonaktifan yang dibuat oleh
  -- keputusan tolak/revisi. Status trainer yang sudah ada tidak pernah dicabut di sini.
  IF NOT EXISTS (SELECT 1 FROM public.expert_trainer_status WHERE expert_id = v_id) THEN
    PERFORM pg_advisory_xact_lock(hashtext('expert_trainer_status:' || v_id::text));
    IF public._expert_chose_trainer(v_pl)
       AND NOT EXISTS (SELECT 1 FROM public.expert_trainer_status WHERE expert_id = v_id) THEN
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
  -- Only an expert whose approved application chose the Trainer role; others apply
  -- for trainer qualification (Slide 39).
  IF v_expert.source_submission_id IS NOT NULL
     AND NOT public._expert_chose_trainer(public._expert_subject_payload(v_expert.source_submission_id)->'payload') THEN
    RETURN false;
  END IF;
  INSERT INTO public.expert_trainer_status (expert_id, trainer_status, trainer_level, unique_graduated_participants,
                                            granted_by, granted_at, effective_from, rationale, version)
  VALUES (v_expert.id, 'active', 'certified', 0, v_expert.approved_by, now(), now(), 'legacy_backfill', 1);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.trainer_status_backfill_self() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trainer_status_backfill_self() TO authenticated;

REVOKE ALL ON FUNCTION public._expert_publish_from_subject(uuid, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;

COMMIT;
