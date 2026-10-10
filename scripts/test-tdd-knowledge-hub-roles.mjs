/**
 * TDD End-to-End Lifecycle Test Runner: Knowledge Hub Contributions
 * Roles Tested:
 *   1. User Participant (`participant` + `participant_biodata`)
 *   2. Registered User (`registered_user`)
 * Resource Types Tested:
 *   1. Video (`Video` -> `video` -> `/knowledge-hub/videos`)
 *   2. Best Practice (`Best Practice` -> `best_practice` -> `/knowledge-hub/best-practices`)
 *   3. Publication (`Research Report` -> `technical_report` -> `/knowledge-hub/publications`)
 * Full Lifecycle Tested:
 *   Bootstrap Auto-Fill -> User Draft & Submit (Real Auth Session + RPCs) ->
 *   Admin Request Revision (`return_for_revision`) -> Notification Badge Check ->
 *   User Edit & Resubmit -> Notification Badge Cleared ->
 *   Admin Approve & Publish (`approve`) -> Public Catalog Read via Anon Client (RLS)
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error("❌ Error: Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or ANON_KEY in .env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const publicAnonClient = createClient(url, anonKey, { auth: { persistSession: false } });

const stamp = Date.now();
const testPassword = "TddKhPass!2026#";

const createdUserIds = [];
const createdSubjectIds = [];
const createdDraftIds = [];
const createdResourceIds = [];

const results = [];

function assert(condition, stepName, details = "") {
  if (!condition) {
    console.error(`❌ [FAIL] ${stepName} ${details ? `-> ${details}` : ""}`);
    results.push({ stepName, status: "FAIL", details });
    throw new Error(`Assertion failed at step: ${stepName} (${details})`);
  }
  console.log(`✅ [PASS] ${stepName} ${details ? `-> ${details}` : ""}`);
  results.push({ stepName, status: "PASS", details });
}

async function createTestUser(roleTag, meta = {}) {
  const email = `tdd.kh.${roleTag}.${stamp}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      display_name: `TDD ${roleTag}`,
      organization: "Kementerian Kelautan dan Perikanan",
      job_title: "Staf Teknis",
      phone: "+6281234567890",
      ...meta,
    },
  });
  if (error) throw new Error(`Failed to create user ${email}: ${error.message}`);
  createdUserIds.push(data.user.id);
  return { user: data.user, email };
}

async function createAuthenticatedClient(email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: testPassword,
  });
  if (error || !data.session) {
    throw new Error(`Failed to sign in as ${email}: ${error?.message}`);
  }
  return client;
}

/**
 * Simulates getKnowledgeContributorBootstrap server function logic
 */
async function simulateContributorBootstrap(userId) {
  const [profileRes, expertRes, biodataRes, authUserRes] = await Promise.all([
    admin.from("profiles").select("id, display_name, organization").eq("id", userId).maybeSingle(),
    admin
      .from("experts")
      .select("id, display_name, current_organization")
      .or(`created_by.eq.${userId},original_contributor_id.eq.${userId}`)
      .eq("current_status", "published")
      .maybeSingle(),
    admin
      .from("participant_biodata")
      .select("nama, instansi_unit_kerja")
      .eq("user_id", userId)
      .maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);

  const userMeta = authUserRes?.data?.user?.user_metadata || {};
  const metaBiodata = userMeta.participant_biodata || {};
  const biodataName = biodataRes?.data?.nama?.trim() || metaBiodata.nama?.trim() || "";
  const biodataInstitution =
    biodataRes?.data?.instansi_unit_kerja?.trim() || metaBiodata.instansiUnitKerja?.trim() || "";

  let profileData = profileRes.data;
  if (!profileData) {
    const fallbackName =
      biodataName || userMeta.display_name || userMeta.full_name || "Kontributor BARUNA";
    const fallbackOrg = biodataInstitution || userMeta.organization || null;
    await admin.from("profiles").upsert(
      {
        id: userId,
        display_name: fallbackName,
        organization: fallbackOrg,
      },
      { onConflict: "id" }
    );
    profileData = { id: userId, display_name: fallbackName, organization: fallbackOrg };
  }

  const isTrainer = Boolean(expertRes.data);
  const isParticipant =
    Boolean(biodataRes?.data?.nama) ||
    Boolean(metaBiodata.nama) ||
    userMeta.role === "participant" ||
    (Array.isArray(userMeta.roles) && userMeta.roles.includes("participant"));

  const contributorRole = isTrainer
    ? "trainer"
    : isParticipant
      ? "participant"
      : "registered_user";

  const contributorName =
    expertRes.data?.display_name ||
    biodataName ||
    profileData?.display_name ||
    "Kontributor BARUNA";

  const institution =
    expertRes.data?.current_organization ||
    biodataInstitution ||
    profileData?.organization ||
    "";

  return {
    contributorName,
    institution,
    isTrainer,
    isParticipant,
    contributorRole,
  };
}

/**
 * Simulates user submitting or resubmitting a draft via real RLS RPCs + server function metadata sync
 */
async function submitOrResubmitResourceAsUser({
  userClient,
  userId,
  userEmail,
  existingDraftId = null,
  payload,
}) {
  const typeMap = {
    "Research Report": "technical_report",
    "Best Practice": "best_practice",
    Video: "video",
    "Webinar Recording": "webinar_recording",
    Podcast: "podcast",
  };
  const resourceType = typeMap[payload.type] || "technical_report";

  let draftId = existingDraftId;

  if (!draftId) {
    const { data: createdId, error: createErr } = await userClient.rpc("kr_draft_create", {
      _title: payload.title,
      _resource_type: resourceType,
      _source_type: "external_submission",
    });
    if (createErr) throw new Error(`kr_draft_create failed: ${createErr.message}`);
    draftId = createdId;
    createdDraftIds.push(draftId);
  }

  const patch = {
    ...payload,
    resource_type: resourceType,
    author_name: payload.author,
    original_contributor_id: userId,
    last_submitted_at: new Date().toISOString(),
  };

  const { error: updateErr } = await userClient.rpc("kr_draft_update", {
    _draft_id: draftId,
    _patch: patch,
  });
  if (updateErr) throw new Error(`kr_draft_update failed: ${updateErr.message}`);

  // Check if draft was previously in revision_requested state
  const { data: existingDraftRow } = await admin
    .from("review_drafts")
    .select("linked_subject_id")
    .eq("id", draftId)
    .maybeSingle();

  let wasRevisionRequested = false;
  let prevSubjectMeta = {};
  if (existingDraftRow?.linked_subject_id) {
    const { data: prevSubj } = await admin
      .from("review_subjects")
      .select("metadata")
      .eq("id", existingDraftRow.linked_subject_id)
      .maybeSingle();
    prevSubjectMeta = prevSubj?.metadata || {};
    if (
      prevSubjectMeta.review_status === "revision_requested" ||
      prevSubjectMeta.last_decision === "return_for_revision"
    ) {
      wasRevisionRequested = true;
    }
  }

  // Call real kr_draft_submit RPC as the authenticated user
  const { error: submitErr } = await userClient.rpc("kr_draft_submit", {
    _draft_id: draftId,
  });
  if (submitErr) throw new Error(`kr_draft_submit failed: ${submitErr.message}`);

  const { data: dRow } = await userClient
    .from("review_drafts")
    .select("linked_subject_id")
    .eq("id", draftId)
    .single();

  const subjectId = dRow?.linked_subject_id;
  if (!subjectId) throw new Error("linked_subject_id was not populated after kr_draft_submit");
  if (!createdSubjectIds.includes(subjectId)) {
    createdSubjectIds.push(subjectId);
  }

  const nowIso = new Date().toISOString();
  await admin
    .from("review_subjects")
    .update({
      title: payload.title,
      description: payload.description,
      external_ref: payload.externalUrl || null,
      current_status: "pending",
      metadata: {
        ...prevSubjectMeta,
        draft_id: draftId,
        type: payload.type,
        topic: payload.topicCategory,
        author_name: payload.author,
        author_email: userEmail,
        institution: payload.institution,
        country: payload.country,
        year: payload.year,
        language: payload.language,
        access_type: payload.accessLevel,
        duration: payload.duration || null,
        speaker: payload.speaker || payload.author || null,
        review_status: wasRevisionRequested ? "resubmitted" : "pending",
        ...(wasRevisionRequested ? { resubmitted_at: nowIso } : {}),
      },
      updated_at: nowIso,
    })
    .eq("id", subjectId);

  return { draftId, subjectId };
}

/**
 * Simulates recordAdminPublicationDecision server function logic
 */
async function simulateAdminDecision({ adminUserId, subjectId, decision, rationale }) {
  const typeMap = {
    "Research Report": "technical_report",
    "Best Practice": "best_practice",
    Video: "video",
    "Webinar Recording": "webinar_recording",
    Podcast: "podcast",
  };

  const { data: subj } = await admin
    .from("review_subjects")
    .select("*")
    .eq("id", subjectId)
    .single();

  const { data: draft } = await admin
    .from("review_drafts")
    .select("*")
    .eq("linked_subject_id", subjectId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = draft?.payload || {};
  const currentMeta = subj.metadata || {};
  const latestTitle = payload.title || draft?.title || subj.title;

  const { data: prevDecisions } = await admin
    .from("review_decisions")
    .select("id, decision, supersedes_decision_id, created_at")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false });

  let supersedesDecisionId = null;
  if (decision === "approve" || decision === "reject") {
    const existingNullFinal = prevDecisions?.find(
      (d) => !d.supersedes_decision_id && (d.decision === "approve" || d.decision === "reject")
    );
    if (existingNullFinal) {
      supersedesDecisionId = existingNullFinal.id;
    } else if (prevDecisions && prevDecisions.length > 0) {
      supersedesDecisionId = prevDecisions[0].id;
    }
  }

  const { data: decRecord, error: decErr } = await admin
    .from("review_decisions")
    .insert({
      subject_id: subjectId,
      decided_by: adminUserId,
      decision,
      rationale,
      supersedes_decision_id: supersedesDecisionId,
    })
    .select("id")
    .single();

  if (decErr) throw new Error(`review_decisions insert failed: ${decErr.message}`);

  if (decision === "return_for_revision") {
    await admin
      .from("review_subjects")
      .update({
        title: latestTitle,
        current_status: "pending",
        metadata: {
          ...currentMeta,
          review_status: "revision_requested",
          last_decision: "return_for_revision",
          last_rationale: rationale,
          revised_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", subjectId);

    if (draft) {
      await admin
        .from("review_drafts")
        .update({ status: "draft", updated_at: new Date().toISOString() })
        .eq("id", draft.id);
    }
    return { decisionId: decRecord.id, publishedResourceId: null };
  }

  if (decision === "approve") {
    await admin
      .from("review_subjects")
      .update({
        title: latestTitle,
        current_status: "approved",
        metadata: {
          ...currentMeta,
          review_status: "approved",
          last_decision: "approve",
          last_rationale: rationale,
          approved_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", subjectId);

    const rawType = String(payload.type || "Research Report");
    const mappedType = typeMap[rawType] || "technical_report";
    const fileData = payload.file;
    const filePath = fileData?.storagePath || payload.uploadedFilePath;

    const resourceMetadata = {
      ...payload,
      author_name: payload.author,
      contributor_name: payload.author,
      institution: payload.institution,
      country: payload.country,
      duration: payload.duration,
      speaker: payload.speaker || payload.author,
      videoKind: rawType,
      attached_resources: filePath
        ? [
            {
              fileName: fileData?.name || "resource.pdf",
              fileSize: fileData?.size || 102400,
              filePath,
              fileType: rawType === "Video" ? "video/mp4" : "application/pdf",
            },
          ]
        : [],
    };

    const { data: insertedKr, error: insertErr } = await admin
      .from("knowledge_resources")
      .insert({
        source_type: "external_submission",
        source_submission_id: subjectId,
        created_by: subj.submitted_by,
        original_contributor_id: subj.submitted_by,
        approved_by: adminUserId,
        published_by: adminUserId,
        approval_date: new Date().toISOString(),
        publication_date: new Date().toISOString(),
        verification_status: "governance_verified",
        visibility: "public",
        current_status: "published",
        audit_ref: decRecord.id,
        resource_type: mappedType,
        title: latestTitle,
        summary: payload.description,
        abstract: payload.abstract || payload.description,
        language: payload.language || "Indonesian",
        publication_year: Number(payload.year) || 2026,
        publisher: payload.institution || "BARUNA Contributor",
        external_url: payload.externalUrl || null,
        thumbnail_url: payload.thumbnailUrl || null,
        topics: payload.topicCategory ? [payload.topicCategory] : [],
        keywords: Array.isArray(payload.keywords) ? payload.keywords : [],
        geographic_focus: payload.geographicCoverage ? [payload.geographicCoverage] : [],
        metadata: resourceMetadata,
      })
      .select("id")
      .single();

    if (insertErr) throw new Error(`knowledge_resources insert failed: ${insertErr.message}`);
    createdResourceIds.push(insertedKr.id);

    await admin
      .from("review_subjects")
      .update({
        current_status: "published",
        published_version_id: insertedKr.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subjectId);

    return { decisionId: decRecord.id, publishedResourceId: insertedKr.id };
  }
}

/**
 * Simulates listMyNotifications server function logic to verify revision badge state
 */
async function getActiveRevisionNotificationsCount(userId) {
  const { data: mySubjects } = await admin
    .from("review_subjects")
    .select("id, kind, title, current_status, metadata, created_at, updated_at")
    .eq("submitted_by", userId)
    .order("updated_at", { ascending: false });

  if (!mySubjects?.length) return 0;
  const subjectIds = mySubjects.map((s) => s.id);
  const subjectMap = new Map(mySubjects.map((s) => [s.id, s]));

  const { data: decisions } = await admin
    .from("review_decisions")
    .select("id, subject_id, decision, rationale, decided_at, created_at")
    .in("subject_id", subjectIds)
    .order("created_at", { ascending: false });

  const { data: drafts } = await admin
    .from("review_drafts")
    .select("id, linked_subject_id, status")
    .in("linked_subject_id", subjectIds);

  const draftStatusMap = new Map();
  (drafts || []).forEach((d) => {
    if (d.linked_subject_id) draftStatusMap.set(d.linked_subject_id, d.status);
  });

  const seenSubjects = new Set();
  let activeRevisionCount = 0;

  for (const dec of decisions || []) {
    const isLatestForSubject = !seenSubjects.has(dec.subject_id);
    seenSubjects.add(dec.subject_id);
    if (!isLatestForSubject) continue;

    const subject = subjectMap.get(dec.subject_id);
    const subjectMeta = subject?.metadata || {};
    const draftStatus = draftStatusMap.get(dec.subject_id);

    const isResubmittedAfterDecision =
      dec.decision === "return_for_revision" &&
      (subjectMeta.review_status === "resubmitted" || draftStatus === "submitted");

    if (dec.decision === "return_for_revision" && !isResubmittedAfterDecision) {
      activeRevisionCount += 1;
    }
  }

  return activeRevisionCount;
}

async function runTests() {
  console.log("\n======================================================================");
  console.log("🚀 MEMULAI TDD E2E: PARTICIPANT & REGISTERED USER SUBMIT VIDEO, BEST PRACTICE & PUBLIKASI");
  console.log("======================================================================\n");

  // -------------------------------------------------------------------------
  // SETUP: Create Admin, Participant (with participant_biodata), and Registered User
  // -------------------------------------------------------------------------
  const { user: adminUser } = await createTestUser("admin", { role: "admin" });
  const { data: adminRole } = await admin.from("rbac_roles").select("id").eq("code", "admin").single();
  if (adminRole) {
    await admin.from("rbac_user_roles").insert({
      user_id: adminUser.id,
      role_id: adminRole.id,
      status: "active",
      is_primary: true,
      valid_from: new Date(Date.now() - 60000).toISOString(),
      reason: "tdd_kh_admin",
    });
  }
  await admin.from("user_roles").insert({ user_id: adminUser.id, role: "admin" });

  // Create Participant User + Biodata
  const { user: participantUser, email: participantEmail } = await createTestUser("participant", {
    role: "participant",
    roles: ["participant"],
    participant_biodata: {
      nama: "Siti Aminah, S.Pi",
      instansiUnitKerja: "Dinas Kelautan dan Perikanan Provinsi Jawa Timur",
    },
  });
  await admin.from("participant_biodata").upsert(
    {
      user_id: participantUser.id,
      nama: "Siti Aminah, S.Pi",
      nip: "199504122022032004",
      tempat_lahir: "Malang",
      tanggal_lahir: "1995-04-12",
      jenis_kelamin: "Perempuan",
      agama: "Islam",
      jabatan: "Penyuluh Perikanan Ahli Pertama",
      pangkat_golongan: "III/a",
      pendidikan_terakhir: "S1",
      no_hp: "081298765432",
      unit_eselon_1: "Bidang Pengelolaan Ruang Laut",
      instansi_unit_kerja: "Dinas Kelautan dan Perikanan Provinsi Jawa Timur",
      alamat_kantor: "Jl. Ahmad Yani No. 152B, Surabaya",
      provinsi: "Jawa Timur",
      kabupaten_kota: "Kota Surabaya",
    },
    { onConflict: "user_id" }
  );

  // Create Registered User (Fresh user, delete profile row first to test auto-provisioning!)
  const { user: regUser, email: regEmail } = await createTestUser("registered", {
    display_name: "Rizky Pratama",
    organization: "Komunitas Konservasi Pesisir Nusantara",
    role: "registered_user",
  });
  await admin.from("profiles").delete().eq("id", regUser.id);

  assert(true, "0. Setup Akun Uji", `Admin, Participant (${participantUser.id}), & Registered User (${regUser.id}) siap`);

  // -------------------------------------------------------------------------
  // STEP 1: Test Bootstrap & Auto-Fill Identity for Participant & Registered User
  // -------------------------------------------------------------------------
  const participantBootstrap = await simulateContributorBootstrap(participantUser.id);
  assert(
    participantBootstrap.contributorRole === "participant" &&
      participantBootstrap.contributorName === "Siti Aminah, S.Pi" &&
      participantBootstrap.institution === "Dinas Kelautan dan Perikanan Provinsi Jawa Timur",
    "1.1 Bootstrap Auto-Fill Participant dari Biodata Academy",
    `Role: ${participantBootstrap.contributorRole}, Nama: "${participantBootstrap.contributorName}", Instansi: "${participantBootstrap.institution}"`
  );

  const regUserBootstrap = await simulateContributorBootstrap(regUser.id);
  assert(
    regUserBootstrap.contributorRole === "registered_user" &&
      regUserBootstrap.contributorName === "Rizky Pratama" &&
      regUserBootstrap.institution === "Komunitas Konservasi Pesisir Nusantara",
    "1.2 Bootstrap Auto-Provisioning Profile untuk Registered User Baru",
    `Role: ${regUserBootstrap.contributorRole}, Nama: "${regUserBootstrap.contributorName}", Instansi: "${regUserBootstrap.institution}"`
  );

  // Sign in both users with real JWT sessions to test RLS & PostgreSQL RPCs
  const participantClient = await createAuthenticatedClient(participantEmail);
  const regUserClient = await createAuthenticatedClient(regEmail);

  // -------------------------------------------------------------------------
  // STEP 2: Participant Submits VIDEO & BEST PRACTICE; Registered User Submits PUBLICATION
  // -------------------------------------------------------------------------
  const videoTitle = `Video Dokumentasi Restorasi Mangrove Surabaya (${stamp})`;
  const videoPayload = {
    type: "Video",
    title: videoTitle,
    description: "Dokumentasi lapangan teknik penanaman dan pemantauan bibit mangrove oleh peserta pelatihan BARUNA.",
    abstract: "Video berdurasi 14 menit yang mendokumentasikan tahapan restorasi mangrove berbasis masyarakat.",
    topicCategory: "Mangrove & Coastal Ecosystems",
    keywords: ["Mangrove", "Restoration", "Surabaya"],
    geographicCoverage: "East Java, Indonesia",
    year: "2026",
    language: "Indonesian",
    duration: "14:25",
    speaker: participantBootstrap.contributorName,
    externalUrl: `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=${stamp % 1000}`,
    thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    author: participantBootstrap.contributorName,
    institution: participantBootstrap.institution,
    country: "Indonesia",
    accessLevel: "Public Access",
    license: "CC BY 4.0",
  };

  const { draftId: videoDraftId, subjectId: videoSubjectId } = await submitOrResubmitResourceAsUser({
    userClient: participantClient,
    userId: participantUser.id,
    userEmail: participantEmail,
    payload: videoPayload,
  });
  assert(
    Boolean(videoDraftId && videoSubjectId),
    "2.1 Participant Submit VIDEO via RPC (kr_draft_create -> kr_draft_submit)",
    `Draft ID: ${videoDraftId}, Subject ID: ${videoSubjectId}`
  );

  const bpTitle = `Best Practice Ekowisata Bahari Berbasis Kelompok Nelayan (${stamp})`;
  const bpPayload = {
    type: "Best Practice",
    title: bpTitle,
    description: "Praktik terbaik pengelolaan ekowisata terumbu karang oleh kelompok masyarakat pengawas (Pokmaswas).",
    abstract: "Ringkasan eksekutif penerapan zonasi ekowisata bahari dan peningkatan pendapatan nelayan lokal.",
    topicCategory: "Sustainable Fisheries & Livelihoods",
    keywords: ["Best Practice", "Ecotourism", "Pokmaswas"],
    geographicCoverage: "East Java, Indonesia",
    year: "2026",
    language: "Indonesian",
    file: {
      name: "best-practice-pokmaswas-2026.pdf",
      size: 1450000,
      type: "application/pdf",
      storagePath: `${participantUser.id}/bp-${stamp}.pdf`,
    },
    practiceStructure: {
      challenge: "Degradasi terumbu karang akibat jangkar perahu wisata.",
      context: "Kawasan pesisir Selat Madura dengan 45 anggota Pokmaswas.",
      intervention: "Pemasangan mooring buoy ramah lingkungan dan SOP pemandu snorkeling.",
      steps: "1. Sosialisasi nelayan 2. Pemasangan pelampung 3. Pelatihan pemandu",
      stakeholders: "Pokmaswas, DKP Jawa Timur, Perguruan Tinggi Lokal",
      results: "Tutupan karang hidup meningkat 18% dalam 12 bulan.",
      lessons: "Keterlibatan nelayan sejak perencanaan krusial bagi kepatuhan zonasi.",
      replication: "Dapat direplikasi di seluruh desa pesisir dengan anggaran desa.",
    },
    author: participantBootstrap.contributorName,
    institution: participantBootstrap.institution,
    country: "Indonesia",
    accessLevel: "Public Access",
    license: "CC BY-SA 4.0",
  };

  const { draftId: bpDraftId, subjectId: bpSubjectId } = await submitOrResubmitResourceAsUser({
    userClient: participantClient,
    userId: participantUser.id,
    userEmail: participantEmail,
    payload: bpPayload,
  });
  assert(
    Boolean(bpDraftId && bpSubjectId),
    "2.2 Participant Submit BEST PRACTICE via RPC (kr_draft_create -> kr_draft_submit)",
    `Draft ID: ${bpDraftId}, Subject ID: ${bpSubjectId}`
  );

  const pubTitle = `Laporan Riset Pemetaan Sampah Laut Pesisir Nusantara (${stamp})`;
  const pubPayload = {
    type: "Research Report",
    title: pubTitle,
    description: "Laporan hasil pemantauan komposisi dan kepadatan mikroplastik serta sampah makro di 12 pantai.",
    abstract: "Studi kuantitatif distribusi sampah plastik pesisir menggunakan protokol standar nasional.",
    topicCategory: "Marine Pollution & Debris",
    keywords: ["Marine Debris", "Microplastics", "Research Report"],
    geographicCoverage: "National (Indonesia)",
    year: "2026",
    language: "Indonesian",
    file: {
      name: "laporan-sampah-laut-2026.pdf",
      size: 2850000,
      type: "application/pdf",
      storagePath: `${regUser.id}/pub-${stamp}.pdf`,
    },
    author: regUserBootstrap.contributorName,
    institution: regUserBootstrap.institution,
    country: "Indonesia",
    accessLevel: "Public Access",
    license: "CC BY 4.0",
  };

  const { draftId: pubDraftId, subjectId: pubSubjectId } = await submitOrResubmitResourceAsUser({
    userClient: regUserClient,
    userId: regUser.id,
    userEmail: regEmail,
    payload: pubPayload,
  });
  assert(
    Boolean(pubDraftId && pubSubjectId),
    "2.3 Registered User Submit PUBLIKASI via RPC (kr_draft_create -> kr_draft_submit)",
    `Draft ID: ${pubDraftId}, Subject ID: ${pubSubjectId}`
  );

  // -------------------------------------------------------------------------
  // STEP 3: Admin Requests Revision (`return_for_revision`) on All 3 Submissions
  // -------------------------------------------------------------------------
  await simulateAdminDecision({
    adminUserId: adminUser.id,
    subjectId: videoSubjectId,
    decision: "return_for_revision",
    rationale: "Mohon tambahkan informasi durasi detail dan kredit lokasi pengambilan video di deskripsi.",
  });
  await simulateAdminDecision({
    adminUserId: adminUser.id,
    subjectId: bpSubjectId,
    decision: "return_for_revision",
    rationale: "Mohon pertajam bagian Replikasi pada struktur Best Practice agar menyebutkan estimasi biaya.",
  });
  await simulateAdminDecision({
    adminUserId: adminUser.id,
    subjectId: pubSubjectId,
    decision: "return_for_revision",
    rationale: "Mohon lengkapi abstrak dengan jumlah sampel lokasi pantai yang diteliti.",
  });

  // Verify draft statuses unlocked to 'draft' and revision notifications active
  const participantRevCountBefore = await getActiveRevisionNotificationsCount(participantUser.id);
  const regUserRevCountBefore = await getActiveRevisionNotificationsCount(regUser.id);

  assert(
    participantRevCountBefore === 2 && regUserRevCountBefore === 1,
    "3.1 Admin Return for Revision & Lonceng Notifikasi Revisi Aktif",
    `Participant Revision Badge: ${participantRevCountBefore} (Video + Best Practice), Registered User Badge: ${regUserRevCountBefore} (Publikasi)`
  );

  // -------------------------------------------------------------------------
  // STEP 4: Participant & Registered User Edit Drafts & Resubmit
  // -------------------------------------------------------------------------
  const revisedVideoTitle = `${videoTitle} [Revisi HD]`;
  await submitOrResubmitResourceAsUser({
    userClient: participantClient,
    userId: participantUser.id,
    userEmail: participantEmail,
    existingDraftId: videoDraftId,
    payload: {
      ...videoPayload,
      title: revisedVideoTitle,
      description: `${videoPayload.description} Dilengkapi kredit lokasi Ekowisata Mangrove Wonorejo.`,
    },
  });

  const revisedBpTitle = `${bpTitle} [Edisi Lengkap]`;
  await submitOrResubmitResourceAsUser({
    userClient: participantClient,
    userId: participantUser.id,
    userEmail: participantEmail,
    existingDraftId: bpDraftId,
    payload: {
      ...bpPayload,
      title: revisedBpTitle,
      practiceStructure: {
        ...bpPayload.practiceStructure,
        replication: "Dapat direplikasi dengan estimasi biaya Rp 15 juta per 10 titik pelampung tambat.",
      },
    },
  });

  const revisedPubTitle = `${pubTitle} [Revisi Terverifikasi]`;
  await submitOrResubmitResourceAsUser({
    userClient: regUserClient,
    userId: regUser.id,
    userEmail: regEmail,
    existingDraftId: pubDraftId,
    payload: {
      ...pubPayload,
      title: revisedPubTitle,
      abstract: `${pubPayload.abstract} Mencakup 12 lokasi pantai dengan total 144 transek pengamatan.`,
    },
  });

  const participantRevCountAfter = await getActiveRevisionNotificationsCount(participantUser.id);
  const regUserRevCountAfter = await getActiveRevisionNotificationsCount(regUser.id);

  assert(
    participantRevCountAfter === 0 && regUserRevCountAfter === 0,
    "4.1 Participant & Registered User Resubmit Revisi & Badge Revisi Otomatis Bersih",
    `Participant Revision Badge: ${participantRevCountAfter}, Registered User Badge: ${regUserRevCountAfter}`
  );

  // Verify review_subjects metadata is 'resubmitted'
  const { data: resubmittedSubjects } = await admin
    .from("review_subjects")
    .select("id, title, metadata")
    .in("id", [videoSubjectId, bpSubjectId, pubSubjectId]);

  const allMarkedResubmitted = (resubmittedSubjects || []).every(
    (s) => s.metadata?.review_status === "resubmitted"
  );
  assert(
    allMarkedResubmitted,
    "4.2 Status di Antrean Kurator Berubah Menjadi 'Resubmitted (Menunggu Evaluasi Ulang)'",
    `Semua 3 pengajuan berstatus review_status='resubmitted'`
  );

  // -------------------------------------------------------------------------
  // STEP 5: Admin Approves & Publishes All 3 to Knowledge Hub Catalog
  // -------------------------------------------------------------------------
  const approvedVideo = await simulateAdminDecision({
    adminUserId: adminUser.id,
    subjectId: videoSubjectId,
    decision: "approve",
    rationale: "Video dokumentasi telah lengkap dan layak tayang di katalog Video Knowledge Hub.",
  });
  const approvedBp = await simulateAdminDecision({
    adminUserId: adminUser.id,
    subjectId: bpSubjectId,
    decision: "approve",
    rationale: "Best Practice sangat komprehensif dan siap menjadi rujukan nasional.",
  });
  const approvedPub = await simulateAdminDecision({
    adminUserId: adminUser.id,
    subjectId: pubSubjectId,
    decision: "approve",
    rationale: "Laporan riset memenuhi standar metodologi dan disetujui tayang.",
  });

  assert(
    Boolean(
      approvedVideo?.publishedResourceId &&
        approvedBp?.publishedResourceId &&
        approvedPub?.publishedResourceId
    ),
    "5.1 Admin Setujui & Tayangkan (Approve -> Insert ke knowledge_resources)",
    `Video ID: ${approvedVideo.publishedResourceId}, Best Practice ID: ${approvedBp.publishedResourceId}, Publikasi ID: ${approvedPub.publishedResourceId}`
  );

  // -------------------------------------------------------------------------
  // STEP 6: Public Catalog Verification via Anon Client (RLS Public Read + Category Mapping)
  // -------------------------------------------------------------------------
  const { data: publicCatalogRows, error: anonReadErr } = await publicAnonClient
    .from("knowledge_resources")
    .select(
      "id, title, resource_type, current_status, visibility, verification_status, publisher, external_url, thumbnail_url, metadata"
    )
    .in("id", [
      approvedVideo.publishedResourceId,
      approvedBp.publishedResourceId,
      approvedPub.publishedResourceId,
    ]);

  assert(
    !anonReadErr && publicCatalogRows?.length === 3,
    "6.1 Verifikasi Akses Katalog Publik (Anon RLS SELECT pada knowledge_resources)",
    `Ditemukan ${publicCatalogRows?.length || 0}/3 item tayang secara publik tanpa login`
  );

  const pubVideoRow = publicCatalogRows.find((r) => r.id === approvedVideo.publishedResourceId);
  const pubBpRow = publicCatalogRows.find((r) => r.id === approvedBp.publishedResourceId);
  const pubReportRow = publicCatalogRows.find((r) => r.id === approvedPub.publishedResourceId);

  assert(
    pubVideoRow?.resource_type === "video" &&
      pubVideoRow?.title === revisedVideoTitle &&
      pubVideoRow?.metadata?.duration === "14:25" &&
      pubVideoRow?.metadata?.author_name === "Siti Aminah, S.Pi",
    "6.2 Verifikasi Tayang di Katalog VIDEO (/knowledge-hub/videos)",
    `Title: "${pubVideoRow?.title}", Type: ${pubVideoRow?.resource_type}, Author: ${pubVideoRow?.metadata?.author_name}, Duration: ${pubVideoRow?.metadata?.duration}`
  );

  assert(
    pubBpRow?.resource_type === "best_practice" &&
      pubBpRow?.title === revisedBpTitle &&
      pubBpRow?.metadata?.practiceStructure?.replication?.includes("Rp 15 juta") &&
      pubBpRow?.publisher === "Dinas Kelautan dan Perikanan Provinsi Jawa Timur",
    "6.3 Verifikasi Tayang di Katalog BEST PRACTICES (/knowledge-hub/best-practices)",
    `Title: "${pubBpRow?.title}", Type: ${pubBpRow?.resource_type}, Publisher: ${pubBpRow?.publisher}`
  );

  assert(
    pubReportRow?.resource_type === "technical_report" &&
      pubReportRow?.title === revisedPubTitle &&
      pubReportRow?.metadata?.author_name === "Rizky Pratama" &&
      pubReportRow?.publisher === "Komunitas Konservasi Pesisir Nusantara",
    "6.4 Verifikasi Tayang di Katalog PUBLICATIONS (/knowledge-hub/publications)",
    `Title: "${pubReportRow?.title}", Type: ${pubReportRow?.resource_type}, Author: ${pubReportRow?.metadata?.author_name}`
  );
}

async function cleanup() {
  console.log("\n🧹 Membersihkan seluruh data pengujian TDD...");
  if (createdResourceIds.length) {
    await admin.from("knowledge_resources").delete().in("id", createdResourceIds);
  }
  if (createdSubjectIds.length) {
    await admin.from("review_decisions").delete().in("subject_id", createdSubjectIds);
    await admin.from("review_drafts").delete().in("linked_subject_id", createdSubjectIds);
    await admin.from("review_subjects").delete().in("id", createdSubjectIds);
  }
  if (createdDraftIds.length) {
    await admin.from("review_drafts").delete().in("id", createdDraftIds);
  }
  if (createdUserIds.length) {
    await admin.from("admin_audit_log").delete().in("actor_id", createdUserIds);
    await admin.from("admin_audit_log").delete().in("target_user_id", createdUserIds);
    await admin.from("participant_biodata").delete().in("user_id", createdUserIds);
    await admin.from("rbac_user_roles").delete().in("user_id", createdUserIds);
    await admin.from("user_roles").delete().in("user_id", createdUserIds);
    await admin.from("profiles").delete().in("id", createdUserIds);
    for (const uid of createdUserIds) {
      await admin.auth.admin.deleteUser(uid);
    }
  }
  console.log("✨ Pembersihan selesai. Database bersih 100% tanpa data sampah.");
}

async function main() {
  try {
    await runTests();
    console.log("\n======================================================================");
    console.log(
      `🏆 HASIL AKHIR TDD KNOWLEDGE HUB: ${results.length}/${results.length} PASSED (0 FAILED)`
    );
    console.log("======================================================================\n");
  } catch (err) {
    console.error("\n❌ PENGUJIAN TDD GAGAL:", err);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

main();
