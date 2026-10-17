-- ============================================================================
-- Expert: bahasa profil dipetakan ke taksonomi bahasa (languages_taxonomy)
-- ============================================================================
-- Ditemukan lewat uji langsung ke database asli: expert_languages.language_code
-- punya foreign key ke public.languages_taxonomy(code) (kode ISO: id, en, es, ...).
-- Tabel itu ada di database tetapi TIDAK ada di file migrasi repo. Kode lama
-- membuat kode dari nama ("Bahasa Indonesia" -> "bahasaindones"), sehingga hampir
-- semua insert ditolak, dan kegagalannya diabaikan (tanpa cek error): bahasa
-- expert hampir tidak pernah tersimpan di database asli.
--
-- Sekarang nama bahasa dipetakan ke kode taksonomi (kode, nama, nama asli, atau
-- alias umum: "Indonesia", "Inggris", "Mandarin", ...). Bahasa yang tidak ada di
-- taksonomi tetap tersimpan di experts.languages (dipakai direktori) tetapi tidak
-- dimasukkan ke expert_languages. Bila tidak satu pun bisa dipetakan, baris lama
-- dibiarkan (tidak dihapus). Bila tabel taksonomi tidak ada di suatu database,
-- fungsi memakai kode turunan nama seperti sebelumnya.

BEGIN;

CREATE OR REPLACE FUNCTION public._expert_language_code(_name text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n text; v_s text; v_alias text; v_code text;
BEGIN
  v_n := lower(btrim(regexp_replace(COALESCE(_name, ''), '\s*\([^)]*\)', '', 'g')));
  IF v_n = '' THEN RETURN NULL; END IF;
  IF to_regclass('public.languages_taxonomy') IS NULL THEN
    RETURN NULLIF(left(regexp_replace(v_n, '[^a-z0-9]', '', 'g'), 12), '');
  END IF;
  v_s := regexp_replace(v_n, '^bahasa\s+', '');
  v_alias := CASE v_s
    WHEN 'indonesia' THEN 'id' WHEN 'indonesian' THEN 'id' WHEN 'inggris' THEN 'en'
    WHEN 'melayu' THEN 'ms' WHEN 'malaysia' THEN 'ms' WHEN 'mandarin' THEN 'zh' WHEN 'china' THEN 'zh'
    WHEN 'filipino' THEN 'tl' WHEN 'tagalog' THEN 'tl' WHEN 'jepang' THEN 'ja' WHEN 'korea' THEN 'ko'
    WHEN 'jerman' THEN 'de' WHEN 'prancis' THEN 'fr' WHEN 'perancis' THEN 'fr' WHEN 'spanyol' THEN 'es'
    WHEN 'arab' THEN 'ar' WHEN 'belanda' THEN 'nl' WHEN 'rusia' THEN 'ru' WHEN 'portugis' THEN 'pt'
    WHEN 'vietnam' THEN 'vi' WHEN 'thailand' THEN 'th' ELSE NULL END;
  EXECUTE $q$
    SELECT code FROM public.languages_taxonomy
     WHERE active IS NOT FALSE
       AND (lower(code) = $1 OR lower(name) = $2 OR lower(native_name) = $2
            OR $2 = ANY (regexp_split_to_array(lower(regexp_replace(name, '\s*\([^)]*\)', '', 'g')), '\s*/\s*')))
     ORDER BY display_order, code LIMIT 1$q$
    INTO v_code USING COALESCE(v_alias, v_s), v_s;
  RETURN v_code;
END $$;

CREATE OR REPLACE FUNCTION public._expert_sync_languages(_expert uuid, _pl jsonb, _names text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_items jsonb; v_structured boolean;
BEGIN
  v_structured := jsonb_typeof(_pl->'structuredLanguages') = 'array' AND jsonb_array_length(_pl->'structuredLanguages') > 0;
  IF v_structured THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', public._jtext(e, 'language'),
                                                 'prof', COALESCE(public._jtext(e, 'proficiency'), 'fluent')) ORDER BY o), '[]'::jsonb)
      INTO v_items
      FROM jsonb_array_elements(_pl->'structuredLanguages') WITH ORDINALITY t(e, o)
     WHERE jsonb_typeof(e) = 'object' AND public._jtext(e, 'language') IS NOT NULL;
  ELSIF cardinality(COALESCE(_names, '{}')) > 0 THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', btrim(l), 'prof', 'fluent') ORDER BY o), '[]'::jsonb)
      INTO v_items FROM unnest(_names) WITH ORDINALITY u(l, o) WHERE btrim(l) <> '';
  ELSE
    RETURN;
  END IF;

  -- Nothing mappable: keep what the profile already has instead of wiping it.
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_items) i WHERE public._expert_language_code(i->>'name') IS NOT NULL) THEN
    RETURN;
  END IF;
  DELETE FROM public.expert_languages WHERE expert_id = _expert;
  INSERT INTO public.expert_languages (expert_id, language_code, language_name, proficiency_level, visibility)
  SELECT DISTINCT ON (code) _expert, code, name, public._expert_proficiency(prof), 'public'
    FROM (SELECT public._expert_language_code(i->>'name') AS code, i->>'name' AS name, i->>'prof' AS prof, o
            FROM jsonb_array_elements(v_items) WITH ORDINALITY t(i, o)) x
   WHERE code IS NOT NULL
   ORDER BY code, o DESC;
END $$;

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

REVOKE ALL ON FUNCTION public._expert_language_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._expert_sync_languages(uuid, jsonb, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._expert_publish_from_subject(uuid, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;

COMMIT;
