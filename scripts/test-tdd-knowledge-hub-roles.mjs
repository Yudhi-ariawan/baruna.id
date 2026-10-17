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
const createdExpertIds = [];

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
      .select("id, display_name")
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
  if (!profileData || !profileData.organization) {
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
    "Journal Article": "journal_article",
    "Policy Brief": "policy_brief",
    "Case Study": "case_study",
    "Best Practice": "best_practice",
    Video: "video",
    "Webinar Recording": "webinar_recording",
    Podcast: "podcast",
    Infographic: "infographic",
    "Photo Documentation": "poster",
    "Monitoring Template": "tool",
    "Assessment Tool": "tool",
    "Data Collection Form": "tool",
    Checklist: "tool",
    "Spreadsheet Tool": "tool",
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
    "Journal Article": "journal_article",
    "Policy Brief": "policy_brief",
    "Case Study": "case_study",
    "Best Practice": "best_practice",
    Video: "video",
    "Webinar Recording": "webinar_recording",
    Podcast: "podcast",
    Infographic: "infographic",
    "Photo Documentation": "poster",
    "Monitoring Template": "tool",
    "Assessment Tool": "tool",
    "Data Collection Form": "tool",
    Checklist: "tool",
    "Spreadsheet Tool": "tool",
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

  if (decision === "archive") {
    const archiveNote = rationale || "Publikasi diarsipkan (ditarik dari penayangan publik Knowledge Hub) oleh Administrator.";
    await admin
      .from("review_subjects")
      .update({
        title: latestTitle,
        current_status: "withdrawn",
        metadata: {
          ...currentMeta,
          review_status: "archived",
          last_decision: "archive",
          last_rationale: archiveNote,
          archived_reason: archiveNote,
          archived_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", subjectId);

    await admin
      .from("knowledge_resources")
      .update({
        current_status: "archived",
        visibility: "private",
        updated_at: new Date().toISOString(),
      })
      .eq("source_submission_id", subjectId);

    return { decisionId: `archive-${subjectId}`, publishedResourceId: null };
  }

  if (decision === "restore") {
    const restoreNote = rationale || "Publikasi dipulihkan dan ditayangkan kembali ke katalog publik Knowledge Hub.";
    await admin
      .from("review_subjects")
      .update({
        title: latestTitle,
        current_status: "approved",
        metadata: {
          ...currentMeta,
          review_status: "approved",
          last_decision: "restore",
          last_rationale: restoreNote,
          archived_reason: null,
          restored_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", subjectId);

    await admin
      .from("knowledge_resources")
      .update({
        current_status: "published",
        visibility: "public",
        updated_at: new Date().toISOString(),
      })
      .eq("source_submission_id", subjectId);

    return { decisionId: `restore-${subjectId}`, publishedResourceId: null };
  }

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
          resubmitted_at: null,
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

    await admin
      .from("knowledge_resources")
      .update({
        current_status: "archived",
        visibility: "private",
        updated_at: new Date().toISOString(),
      })
      .eq("source_submission_id", subjectId);

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
          resubmitted_at: null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", subjectId);

    if (draft) {
      await admin
        .from("review_drafts")
        .update({ status: "submitted", updated_at: new Date().toISOString() })
        .eq("id", draft.id);
    }

    const { data: existingKr } = await admin
      .from("knowledge_resources")
      .select("id, version")
      .eq("source_submission_id", subjectId)
      .maybeSingle();

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

    let relatedExpertIds = [];
    if (subj.submitted_by) {
      const { data: expMatch } = await admin
        .from("experts")
        .select("id")
        .or(`created_by.eq.${subj.submitted_by},original_contributor_id.eq.${subj.submitted_by}`)
        .eq("current_status", "published")
        .limit(1)
        .maybeSingle();
      if (expMatch?.id) relatedExpertIds = [expMatch.id];
    }

    const krData = {
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
      related_expert_ids: relatedExpertIds,
      metadata: resourceMetadata,
      updated_at: new Date().toISOString(),
    };

    let publishedResourceId;
    if (existingKr) {
      const { data: latestKrVer } = await admin
        .from("knowledge_resource_versions")
        .select("version")
        .eq("resource_id", existingKr.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextKrVersion =
        Math.max(Number(existingKr.version || 1), Number(latestKrVer?.version || 0)) + 1;

      const { error: updateErr } = await admin
        .from("knowledge_resources")
        .update({ ...krData, version: nextKrVersion })
        .eq("id", existingKr.id);
      if (updateErr) throw new Error(`knowledge_resources update failed: ${updateErr.message}`);
      publishedResourceId = existingKr.id;
    } else {
      const { data: insertedKr, error: insertErr } = await admin
        .from("knowledge_resources")
        .insert(krData)
        .select("id")
        .single();
      if (insertErr) throw new Error(`knowledge_resources insert failed: ${insertErr.message}`);
      createdResourceIds.push(insertedKr.id);
      publishedResourceId = insertedKr.id;
    }

    await admin
      .from("review_subjects")
      .update({
        current_status: "approved",
        published_version_id: publishedResourceId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subjectId);

    return { decisionId: decRecord.id, publishedResourceId };
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

  // Create Verified Trainer / Expert User + Published Expert Profile
  const { user: trainerUser, email: trainerEmail } = await createTestUser("trainer", {
    display_name: "Dr. Ir. Hendra Maritime, M.Sc",
    organization: "Pusat Riset Kelautan & Oseanografi",
    role: "expert",
    roles: ["expert"],
  });
  const { data: expertRbacRole } = await admin.from("rbac_roles").select("id").eq("code", "expert").single();
  if (expertRbacRole) {
    await admin.from("rbac_user_roles").insert({
      user_id: trainerUser.id,
      role_id: expertRbacRole.id,
      status: "active",
      is_primary: true,
      valid_from: new Date(Date.now() - 60000).toISOString(),
      reason: "tdd_kh_trainer",
    });
  }
  const { data: trainerExpert, error: trainerExpErr } = await admin
    .from("experts")
    .insert({
      source_type: "external_submission",
      original_contributor_id: trainerUser.id,
      created_by: trainerUser.id,
      display_name: "Dr. Ir. Hendra Maritime, M.Sc",
      headline: "Senior Marine Ecologist & Coastal Trainer",
      slug: `dr-ir-hendra-maritime-kh-${stamp}`,
      verification_status: "governance_verified",
      visibility: "public",
      current_status: "published",
      publication_date: new Date().toISOString(),
    })
    .select("id, slug")
    .single();
  if (trainerExpErr) throw new Error(`Gagal membuat profil expert uji: ${trainerExpErr.message}`);
  createdExpertIds.push(trainerExpert.id);

  assert(
    true,
    "0. Setup Akun Uji (3 Role Kontributor + Admin)",
    `Admin, Trainer (${trainerUser.id}), Participant (${participantUser.id}), & Registered User (${regUser.id}) siap`
  );

  // -------------------------------------------------------------------------
  // STEP 1: Test Bootstrap & Auto-Fill Identity for Trainer, Participant & Registered User
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

  const trainerBootstrap = await simulateContributorBootstrap(trainerUser.id);
  assert(
    trainerBootstrap.contributorRole === "trainer" &&
      trainerBootstrap.contributorName === "Dr. Ir. Hendra Maritime, M.Sc" &&
      trainerBootstrap.institution === "Pusat Riset Kelautan & Oseanografi",
    "1.3 Bootstrap Auto-Fill Trainer/Pakar dari Direktori Experts",
    `Role: ${trainerBootstrap.contributorRole}, Nama: "${trainerBootstrap.contributorName}", Instansi: "${trainerBootstrap.institution}"`
  );

  // Sign in all 3 contributor roles with real JWT sessions to test RLS & PostgreSQL RPCs
  const participantClient = await createAuthenticatedClient(participantEmail);
  const regUserClient = await createAuthenticatedClient(regEmail);
  const trainerClient = await createAuthenticatedClient(trainerEmail);

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

  // -------------------------------------------------------------------------
  // STEP 7: Admin Archives Published Resource (Tarik Tayang) & Restores It
  // -------------------------------------------------------------------------
  const archiveReason = "Data regulasi sedang diperbarui ke edisi 2026 Semester II.";
  await simulateAdminDecision({
    adminUserId: adminUser.id,
    subjectId: pubSubjectId,
    decision: "archive",
    rationale: archiveReason,
  });

  const { data: anonAfterArchive } = await publicAnonClient
    .from("knowledge_resources")
    .select("id")
    .eq("id", approvedPub.publishedResourceId)
    .eq("current_status", "published")
    .eq("visibility", "public");

  const { data: archivedSubj } = await admin
    .from("review_subjects")
    .select("current_status, metadata")
    .eq("id", pubSubjectId)
    .single();

  assert(
    (!anonAfterArchive || anonAfterArchive.length === 0) &&
      archivedSubj?.current_status === "withdrawn" &&
      archivedSubj?.metadata?.review_status === "archived" &&
      archivedSubj?.metadata?.archived_reason === archiveReason,
    "7.1 Admin Arsipkan Publikasi (Tarik Tayang) & Notifikasi Pemilik Publikasi Tersimpan",
    `Katalog Publik: ${anonAfterArchive?.length || 0} item (ditarik dari tayang), Subject Status: ${archivedSubj?.current_status}, Alasan Notifikasi: "${archivedSubj?.metadata?.archived_reason}"`
  );

  await simulateAdminDecision({
    adminUserId: adminUser.id,
    subjectId: pubSubjectId,
    decision: "restore",
    rationale: "Pembaruan selesai, publikasi ditayangkan kembali.",
  });

  const { data: anonAfterRestore } = await publicAnonClient
    .from("knowledge_resources")
    .select("id, current_status, visibility")
    .eq("id", approvedPub.publishedResourceId)
    .eq("current_status", "published")
    .eq("visibility", "public");

  const { data: restoredSubj } = await admin
    .from("review_subjects")
    .select("current_status, metadata")
    .eq("id", pubSubjectId)
    .single();

  assert(
    anonAfterRestore?.length === 1 &&
      restoredSubj?.current_status === "approved" &&
      restoredSubj?.metadata?.review_status === "approved",
    "7.2 Admin Pulihkan & Publikasikan Kembali dari Arsip",
    `Katalog Publik: ${anonAfterRestore?.length || 0} item kembali tayang, Subject Status: ${restoredSubj?.current_status}`
  );

  // -------------------------------------------------------------------------
  // STEP 8: Policy Brief (Trainer), Infographic (Registered User), Case Study (Participant) & Toolkit (Registered User) E2E + Archive/Restore
  // -------------------------------------------------------------------------
  const pbSub = await submitOrResubmitResourceAsUser({
    userClient: trainerClient,
    userId: trainerUser.id,
    userEmail: trainerEmail,
    payload: {
      type: "Policy Brief",
      typeGroup: "Research & Policy",
      title: "[TDD Policy Brief] Strategi Zonasi Konservasi Pesisir Terpadu 2026",
      description: "Rekomendasi kebijakan percepatan penetapan kawasan konservasi perairan daerah.",
      author: trainerBootstrap.contributorName,
      institution: trainerBootstrap.institution,
      country: "Indonesia",
      year: 2026,
      language: "Indonesian",
      keywords: ["zonasi", "konservasi", "policy brief"],
      topicCategory: "Marine Conservation & Spatial Planning",
      uploadedFilePath: `submissions/${trainerUser.id}/policy-brief-zonasi.pdf`,
      fileName: "policy-brief-zonasi.pdf",
      fileSize: 980400,
      policyBriefStructure: {
        policyIssue: "Tumpang tindih pemanfaatan ruang laut di wilayah pesisir padat tangkap.",
        keyFindings: "82% kawasan dengan zonasi partisipatif mengalami pemulihan stok ikan dalam 24 bulan.",
        recommendedActions: "Integrasikan peta kesepakatan masyarakat adat ke dalam Perda RZWP3K.",
        intendedAudience: "Kementerian Kelautan dan Perikanan, DKP Provinsi, Bappeda.",
      },
    },
  });

  const infoSub = await submitOrResubmitResourceAsUser({
    userClient: regUserClient,
    userId: regUser.id,
    userEmail: regEmail,
    payload: {
      type: "Infographic",
      typeGroup: "Visual & Infographics",
      title: "[TDD Infographic] Peta Rantai Dingin Perikanan Tangkap Nusantara",
      description: "Infografik alur penanganan ikan dari atas kapal hingga distribusi pasar ekspor.",
      author: regUserBootstrap.contributorName,
      institution: regUserBootstrap.institution,
      country: "Indonesia",
      year: 2026,
      language: "Indonesian",
      keywords: ["rantai dingin", "infografik", "mutu ikan"],
      topicCategory: "Fisheries & Capture Management",
      uploadedFilePath: `submissions/${regUser.id}/infografik-rantai-dingin.png`,
      fileName: "infografik-rantai-dingin.png",
      fileSize: 1240000,
      infographicStructure: {
        keyTakeaways: "Suhu 0-4°C wajib dijaga maksimal 30 menit pasca tangkap untuk menekan susut mutu hingga 35%.",
        dataSource: "Survei Rantai Pasok Pelabuhan Perikanan Nusantara 2025-2026.",
        targetAudience: "Nelayan, ABK, Pengelola TPI, dan Penyuluh Perikanan.",
        visualFormat: "Infografik Poster A3 Resolusi Tinggi (PNG)",
      },
    },
  });

  const csSub = await submitOrResubmitResourceAsUser({
    userClient: participantClient,
    userId: participantUser.id,
    userEmail: participantEmail,
    payload: {
      type: "Case Study",
      typeGroup: "Case Studies & Best Practices",
      title: "[TDD Case Study] Rehabilitasi Mangrove Berbasis Ekowisata di Pesisir Malang",
      description: "Studi kasus transformasi lahan tambak kritis menjadi kawasan ekowisata mangrove produktif.",
      author: participantBootstrap.contributorName,
      institution: participantBootstrap.institution,
      country: "Indonesia",
      year: 2026,
      language: "Indonesian",
      keywords: ["mangrove", "ekowisata", "studi kasus"],
      topicCategory: "Coastal Community & Blue Economy",
      uploadedFilePath: `submissions/${participantUser.id}/case-study-mangrove.pdf`,
      fileName: "case-study-mangrove.pdf",
      fileSize: 1540000,
      caseStudyStructure: {
        background: "Abrasi pantai menggerus 18 hektar tambak warga selama 2018-2022.",
        problem: "Degradasi sabuk hijau pantai dan penurunan pendapatan petambak tradisional.",
        intervention: "Penanaman 65.000 bibit Rhizophora dikombinasikan dengan silvofishery kepiting bakau.",
        process: "Pemetaan partisipatif -> Pembibitan kelompok -> Penanaman bertahap -> Ekowisata.",
        results: "Survival rate mangrove 88% dan peningkatan pendapatan kelompok 42% per tahun.",
        challenges: "Pasang tertinggi musiman dan serangan teritip pada bibit muda.",
        lessons: "Kombinasi insentif ekonomi silvofishery menjaga komitmen pemeliharaan jangka panjang.",
        recommendations: "Replikasi skema kemitraan desa pesisir dengan pendampingan penyuluh KKP.",
      },
    },
  });

  const tkSub = await submitOrResubmitResourceAsUser({
    userClient: regUserClient,
    userId: regUser.id,
    userEmail: regEmail,
    payload: {
      type: "Monitoring Template",
      typeGroup: "Templates & Toolkits",
      title: "[TDD Toolkit] Perangkat Audit Mutu Air & Biosekuriti Tambak Udang",
      description: "Paket instrumen pemantauan harian kualitas air, SOP biosekuriti, dan kalkulator pakan.",
      author: regUserBootstrap.contributorName,
      institution: regUserBootstrap.institution,
      country: "Indonesia",
      year: 2026,
      language: "Indonesian",
      keywords: ["toolkit", "biosekuriti", "kualitas air"],
      topicCategory: "Aquaculture & Mariculture",
      uploadedFilePath: `submissions/${regUser.id}/toolkit-audit-tambak.xlsx`,
      fileName: "toolkit-audit-tambak.xlsx",
      fileSize: 640000,
      toolkitStructure: {
        targetUsers: "Teknisi tambak, penyuluh perikanan, dan manajer kesehatan ikan.",
        includedTools: "Lembar Cek Harian DO/pH/Salinitas, Kalkulator FCR Otomatis, Daftar Periksa Biosekuriti.",
        prerequisites: "Microsoft Excel / Google Sheets, refraktometer, dan DO meter.",
        usageSteps: "1. Input parameter harian pagi & sore -> 2. Cek indikator warna ambang batas -> 3. Cetak laporan mingguan.",
      },
    },
  });

  const [approvedPb, approvedInfo, approvedCs, approvedTk] = await Promise.all([
    simulateAdminDecision({
      adminUserId: adminUser.id,
      subjectId: pbSub.subjectId,
      decision: "approve",
      rationale: "Policy Brief disetujui tayang di /knowledge-hub/policy-briefs.",
    }),
    simulateAdminDecision({
      adminUserId: adminUser.id,
      subjectId: infoSub.subjectId,
      decision: "approve",
      rationale: "Infografik disetujui tayang di /knowledge-hub/infographics.",
    }),
    simulateAdminDecision({
      adminUserId: adminUser.id,
      subjectId: csSub.subjectId,
      decision: "approve",
      rationale: "Case Study disetujui tayang di /knowledge-hub/case-studies.",
    }),
    simulateAdminDecision({
      adminUserId: adminUser.id,
      subjectId: tkSub.subjectId,
      decision: "approve",
      rationale: "Toolkit disetujui tayang di /knowledge-hub/toolkits.",
    }),
  ]);

  const { data: multiTypeRows } = await publicAnonClient
    .from("knowledge_resources")
    .select("id, title, resource_type, current_status, visibility, related_expert_ids, metadata")
    .in("id", [
      approvedPb.publishedResourceId,
      approvedInfo.publishedResourceId,
      approvedCs.publishedResourceId,
      approvedTk.publishedResourceId,
    ]);

  const pbRow = (multiTypeRows || []).find((r) => r.id === approvedPb.publishedResourceId);
  const infoRow = (multiTypeRows || []).find((r) => r.id === approvedInfo.publishedResourceId);
  const csRow = (multiTypeRows || []).find((r) => r.id === approvedCs.publishedResourceId);
  const tkRow = (multiTypeRows || []).find((r) => r.id === approvedTk.publishedResourceId);

  assert(
    pbRow?.resource_type === "policy_brief" &&
      pbRow?.related_expert_ids?.includes(trainerExpert.id) &&
      pbRow?.metadata?.policyBriefStructure?.policyIssue?.includes("Tumpang tindih") &&
      infoRow?.resource_type === "infographic" &&
      infoRow?.metadata?.infographicStructure?.keyTakeaways?.includes("Suhu 0-4°C") &&
      csRow?.resource_type === "case_study" &&
      csRow?.metadata?.caseStudyStructure?.results?.includes("88%") &&
      tkRow?.resource_type === "tool" &&
      tkRow?.metadata?.toolkitStructure?.includedTools?.includes("Kalkulator FCR"),
    "8.1 Verifikasi Tayang & Struktur Spesifik Policy Brief (Trainer), Infographic (RegUser), Case Study (Participant) & Toolkit (RegUser)",
    `PolicyBrief=${pbRow?.resource_type} (LinkedExpert=${pbRow?.related_expert_ids?.[0]}), Infographic=${infoRow?.resource_type}, CaseStudy=${csRow?.resource_type}, Toolkit=${tkRow?.resource_type}`
  );

  // Archive & Restore test across Policy Brief, Infographic, Case Study & Toolkit
  await Promise.all([
    simulateAdminDecision({
      adminUserId: adminUser.id,
      subjectId: pbSub.subjectId,
      decision: "archive",
      rationale: "Arsip sementara Policy Brief untuk evaluasi lintas kementerian.",
    }),
    simulateAdminDecision({
      adminUserId: adminUser.id,
      subjectId: infoSub.subjectId,
      decision: "archive",
      rationale: "Arsip sementara Infografik untuk revisi angka statistik.",
    }),
    simulateAdminDecision({
      adminUserId: adminUser.id,
      subjectId: csSub.subjectId,
      decision: "archive",
      rationale: "Arsip sementara Case Study.",
    }),
  ]);

  const { data: activeAfterMultiArchive } = await publicAnonClient
    .from("knowledge_resources")
    .select("id")
    .in("id", [
      approvedPb.publishedResourceId,
      approvedInfo.publishedResourceId,
      approvedCs.publishedResourceId,
    ])
    .eq("current_status", "published")
    .eq("visibility", "public");

  assert(
    !activeAfterMultiArchive || activeAfterMultiArchive.length === 0,
    "8.2 Arsipkan (Tarik Tayang) Policy Brief, Infographic & Case Study Sekaligus",
    `0/3 item tampil di katalog publik setelah diarsipkan oleh Admin`
  );

  // 8.3 Multi-cycle Post-Publication Revision on Policy Brief (Restore -> Return for Revision #1 -> Resubmit #1 -> Approve #2 -> Return for Revision #2 -> Resubmit #2 -> Approve #3)
  await simulateAdminDecision({
    adminUserId: adminUser.id,
    subjectId: pbSub.subjectId,
    decision: "restore",
    rationale: "Pulihkan Policy Brief sebelum siklus revisi berulang.",
  });

  for (let cycle = 1; cycle <= 2; cycle++) {
    await simulateAdminDecision({
      adminUserId: adminUser.id,
      subjectId: pbSub.subjectId,
      decision: "return_for_revision",
      rationale: `Revisi pasca-tayang siklus #${cycle}: mohon pertajam rekomendasi kebijakan fiskal.`,
    });

    const revBadgeDuring = await getActiveRevisionNotificationsCount(trainerUser.id);
    if (revBadgeDuring < 1) {
      throw new Error(
        `Expected active revision notification count >= 1 during cycle #${cycle}, got ${revBadgeDuring}`
      );
    }

    await submitOrResubmitResourceAsUser({
      userClient: trainerClient,
      userId: trainerUser.id,
      userEmail: trainerEmail,
      existingDraftId: pbSub.draftId,
      payload: {
        type: "Policy Brief",
        typeGroup: "Publications",
        title: `[TDD Policy Brief] Strategi Dekarbonisasi Pelabuhan Perikanan Nusantara (Revisi #${cycle})`,
        description: `Rekomendasi kebijakan transisi energi bersih (Pembaruan Siklus #${cycle}).`,
        author: trainerBootstrap.contributorName,
        institution: trainerBootstrap.institution,
        country: "Indonesia",
        year: 2026,
        language: "Indonesian",
        keywords: ["policy brief", "dekarbonisasi", `siklus-${cycle}`],
        topicCategory: "Marine Policy & Governance",
        uploadedFilePath: `submissions/${trainerUser.id}/policy-brief-dekarbonisasi-v${cycle + 1}.pdf`,
        fileName: `policy-brief-dekarbonisasi-v${cycle + 1}.pdf`,
        fileSize: 980000 + cycle * 10000,
        policyBriefStructure: {
          executiveSummary: `Ringkasan eksekutif pasca-revisi siklus #${cycle}.`,
          policyIssue: "Tumpang tindih kewenangan pengelolaan jaringan listrik pelabuhan perikanan.",
          policyOptions: "Opsi 1: Tarif listrik khusus pelabuhan hijau; Opsi 2: Kemitraan KPBU panel surya atap TPI.",
          recommendations: `Rekomendasi siklus #${cycle}: Terbitkan Permen KP tentang Standar Pelabuhan Perikanan Rendah Emisi.`,
        },
      },
    });

    const revBadgeAfter = await getActiveRevisionNotificationsCount(trainerUser.id);
    const { data: subjAfterResub } = await admin
      .from("review_subjects")
      .select("current_status, metadata")
      .eq("id", pbSub.subjectId)
      .single();

    if (revBadgeAfter !== 0 || subjAfterResub?.metadata?.review_status !== "resubmitted") {
      throw new Error(
        `Expected revBadge=0 and review_status='resubmitted' after resubmit in cycle #${cycle}, got badge=${revBadgeAfter}, review_status=${subjAfterResub?.metadata?.review_status}`
      );
    }

    await simulateAdminDecision({
      adminUserId: adminUser.id,
      subjectId: pbSub.subjectId,
      decision: "approve",
      rationale: `Persetujuan ulang Policy Brief siklus #${cycle}.`,
    });
  }

  const { data: pbFinalRow } = await publicAnonClient
    .from("knowledge_resources")
    .select("id, title, current_status, visibility, metadata")
    .eq("id", approvedPb.publishedResourceId)
    .maybeSingle();

  assert(
    pbFinalRow?.current_status === "published" &&
      pbFinalRow?.visibility === "public" &&
      pbFinalRow?.title?.includes("(Revisi #2)") &&
      pbFinalRow?.metadata?.policyBriefStructure?.recommendations?.includes("siklus #2"),
    "8.3 Siklus Revisi Berulang Pasca-Tayang (Publikasi: Return #1 -> Resubmit #1 -> Approve #2 -> Return #2 -> Resubmit #2 -> Approve #3)",
    `Judul akhir="${pbFinalRow?.title}", Status=${pbFinalRow?.current_status}, Rekomendasi terbarui="${pbFinalRow?.metadata?.policyBriefStructure?.recommendations}"`
  );
}

async function cleanup() {
  console.log("\n🧹 Membersihkan seluruh data pengujian TDD...");
  // Every step is checked: a silent failure here leaves test accounts behind on
  // every run, so the run fails loudly instead of claiming a clean database.
  const failures = [];
  const step = async (label, run) => {
    const { error } = await run();
    if (error) failures.push(`${label}: ${error.message}`);
  };
  if (createdResourceIds.length) {
    await step("knowledge_resources", () => admin.from("knowledge_resources").delete().in("id", createdResourceIds));
  }
  if (createdExpertIds.length) {
    await step("experts", () => admin.from("experts").delete().in("id", createdExpertIds));
  }
  if (createdSubjectIds.length) {
    await step("review_decisions", () => admin.from("review_decisions").delete().in("subject_id", createdSubjectIds));
    // Revision snapshots reference the drafts; without this the drafts (and so the
    // test accounts that own them) can never be deleted.
    await step("review_subject_revisions", () => admin.from("review_subject_revisions").delete().in("subject_id", createdSubjectIds));
    await step("review_drafts (linked)", () => admin.from("review_drafts").delete().in("linked_subject_id", createdSubjectIds));
    await step("review_subjects", () => admin.from("review_subjects").delete().in("id", createdSubjectIds));
  }
  if (createdDraftIds.length) {
    await step("review_drafts", () => admin.from("review_drafts").delete().in("id", createdDraftIds));
  }
  if (createdUserIds.length) {
    await step("admin_audit_log (actor)", () => admin.from("admin_audit_log").delete().in("actor_id", createdUserIds));
    await step("admin_audit_log (target)", () => admin.from("admin_audit_log").delete().in("target_user_id", createdUserIds));
    // Governance RPCs log the test accounts as actors; these rows block deleting the accounts.
    await step("platform_events", () => admin.from("platform_events").delete().in("actor_id", createdUserIds));
    await step("governance_audit_log", () => admin.from("governance_audit_log").delete().in("actor_id", createdUserIds));
    await step("participant_biodata", () => admin.from("participant_biodata").delete().in("user_id", createdUserIds));
    await step("rbac_user_roles", () => admin.from("rbac_user_roles").delete().in("user_id", createdUserIds));
    await step("user_roles", () => admin.from("user_roles").delete().in("user_id", createdUserIds));
    await step("profiles", () => admin.from("profiles").delete().in("id", createdUserIds));
    for (const uid of createdUserIds) {
      // The auth API is a separate HTTP call; retry transient network failures.
      await step(`auth user ${uid}`, async () => {
        let result;
        for (let attempt = 1; attempt <= 3; attempt++) {
          result = await admin.auth.admin.deleteUser(uid);
          if (!result.error || !/fetch failed|network|timeout/i.test(result.error.message)) break;
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
        return result;
      });
    }
  }
  if (failures.length) {
    console.error(`❌ Pembersihan tidak tuntas (${failures.length} langkah gagal); data uji tersisa di database:`);
    for (const f of failures) console.error(`   - ${f}`);
    process.exitCode = 1;
    return;
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
