import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExpertApplicationDocument, ExpertDraftPayload } from "@/lib/experts/application.types";
import { deriveExpertEffectiveStatus } from "@/lib/experts/application-status";

const DecisionType = z.enum(["approve", "return_for_revision", "reject"]);

export type AdminExpertDocument = ExpertApplicationDocument & {
  downloadUrl: string | null;
};

export type AdminExpertItem = {
  subjectId: string;
  draftId: string | null;
  submitterId: string | null;
  applicantName: string;
  email: string | null;
  phone: string | null;
  institution: string | null;
  country: string | null;
  jobTitle: string | null;
  roles: string[];
  expertise: string[];
  status: string; // pending, under_review, decision_pending, approved, rejected, revision_requested, resubmitted
  isResubmitted?: boolean;
  resubmittedAt?: string | null;
  lastRevisionRationale?: string | null;
  createdAt: string;
  updatedAt: string;
  documentsCount: number;
  publishedSlug?: string | null;
  isPublished?: boolean;
  isArchived?: boolean;
  archivedAt?: string | null;
  archiveRationale?: string | null;
  /** The expert is preparing an update of the published profile (not sent yet). */
  updateDrafting?: boolean;
  /** The published profile stays in the directory while this revision/update is reviewed. */
  liveVersionKept?: boolean;
  /** Summary the expert wrote when opening the update. */
  updateNote?: string | null;
};

export type AdminExpertDetail = AdminExpertItem & {
  /** Whether the current viewer may record decisions / archive / restore. */
  viewerCanDecide: boolean;
  biography: string | null;
  languages: string | null;
  yearsExperience: string | null;
  publications: string | null;
  keyProjects: string | null;
  documents: AdminExpertDocument[];
  /** Other directory profiles with the same name or email (Slide 37 Duplicate/Match). Advisory only. */
  possibleDuplicates: Array<{
    expertId: string;
    displayName: string;
    slug: string | null;
    status: string;
    matchReason: string;
  }>;
  decisionsHistory: Array<{
    id: string;
    decision: string;
    rationale: string | null;
    decidedBy: string | null;
    createdAt: string;
  }>;
};

// Official BARUNA chain: reviewer -> verifier -> approver; admin/super_admin bypass.
// Every curator may read the queue, but only approver/admin/super_admin may record
// a final decision, archive or restore (mirrors public._can_approve_academy).
const GOVERNANCE_READ_ROLES = ["super_admin", "admin", "reviewer", "verifier", "approver"];
const GOVERNANCE_DECIDE_ROLES = new Set(["super_admin", "admin", "approver"]);

type GovernanceAccess = { canRead: boolean; canDecide: boolean };

export async function getExpertGovernanceAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: { supabase: any; userId: string },
): Promise<GovernanceAccess> {
  const now = new Date().toISOString();
  const { data: assignments } = await context.supabase
    .from("rbac_user_roles")
    .select("rbac_roles!inner(code)")
    .eq("user_id", context.userId)
    .eq("status", "active")
    .lte("valid_from", now)
    .or(`valid_until.is.null,valid_until.gt.${now}`)
    .in("rbac_roles.code", GOVERNANCE_READ_ROLES);

  const codes = new Set<string>(
    ((assignments ?? []) as Array<{ rbac_roles: { code: string } | { code: string }[] }>).flatMap((row) =>
      Array.isArray(row.rbac_roles) ? row.rbac_roles.map((r) => r.code) : [row.rbac_roles.code],
    ),
  );

  if (codes.size === 0) {
    for (const role of ["super_admin", "admin"]) {
      const { data } = await context.supabase.rpc("has_rbac_role", {
        _user_id: context.userId,
        _role: role,
      });
      if (data) codes.add(role);
    }
  }

  return {
    canRead: codes.size > 0,
    canDecide: [...codes].some((code) => GOVERNANCE_DECIDE_ROLES.has(code)),
  };
}

async function assertAdminOrReviewer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: { supabase: any; userId: string },
) {
  return (await getExpertGovernanceAccess(context)).canRead;
}

async function assertExpertDecider(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: { supabase: any; userId: string },
) {
  const access = await getExpertGovernanceAccess(context);
  if (!access.canDecide) {
    throw new Error(
      "forbidden: hanya Approver atau Administrator yang dapat memutuskan, mengarsipkan, atau memulihkan expert.",
    );
  }
}

export const listAdminExpertApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        status: z.string().optional(),
        search: z.string().trim().max(120).default(""),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data: input, context }): Promise<AdminExpertItem[]> => {
    if (!(await assertAdminOrReviewer(context))) {
      throw new Error("forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Paged and chunked reads: a plain select stops at 1000 rows and a long
    // .in() list overflows the URL, both silently breaking the queue at scale.
    const { fetchAllPages, fetchByIdChunks } = await import("@/lib/supabase/batch.server");
    const subjects = await fetchAllPages((from, to) =>
      supabaseAdmin
        .from("review_subjects")
        .select("id, title, current_status, submitted_by, created_at, updated_at, metadata")
        .eq("kind", "expert")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    );
    if (subjects.length === 0) return [];

    const subjectIds = subjects.map((s) => s.id);
    const submitterBySubject = new Map(subjects.map((s) => [s.id, s.submitted_by]));

    const [decisions, drafts, publishedExperts] = await Promise.all([
      fetchByIdChunks(subjectIds, (ids, from, to) =>
        supabaseAdmin
          .from("review_decisions")
          .select("id, subject_id, decision, rationale, created_at")
          .in("subject_id", ids)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchByIdChunks(subjectIds, (ids, from, to) =>
        supabaseAdmin
          .from("review_drafts")
          .select("id, linked_subject_id, submitter_id, payload, status, updated_at")
          .in("linked_subject_id", ids)
          .neq("status", "withdrawn")
          .order("updated_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchByIdChunks(subjectIds, (ids, from, to) =>
        supabaseAdmin
          .from("experts")
          .select("id, slug, source_submission_id, current_status")
          .in("source_submission_id", ids)
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);

    const latestDecisionMap = new Map<string, { decision: string; rationale: string | null; createdAt: string }>();
    decisions.forEach((d) => {
      if (!latestDecisionMap.has(d.subject_id)) {
        latestDecisionMap.set(d.subject_id, {
          decision: d.decision,
          rationale: d.rationale,
          createdAt: d.created_at,
        });
      }
    });

    // Only the applicant's own draft counts (same rule as public._expert_effective_status).
    const draftMap = new Map<string, { id: string; payload: ExpertDraftPayload; status: string; updated_at?: string }>();
    drafts.forEach((d) => {
      if (
        d.linked_subject_id &&
        d.submitter_id === submitterBySubject.get(d.linked_subject_id) &&
        !draftMap.has(d.linked_subject_id)
      ) {
        draftMap.set(d.linked_subject_id, {
          id: d.id,
          payload: (d.payload as unknown as ExpertDraftPayload) ?? {},
          status: d.status,
          updated_at: d.updated_at,
        });
      }
    });

    const expertMap = new Map<string, { id: string; slug: string; current_status: string }>();
    publishedExperts.forEach((e) => {
      if (e.source_submission_id) {
        expertMap.set(e.source_submission_id, {
          id: e.id,
          slug: e.slug,
          current_status: e.current_status,
        });
      }
    });

    let items: AdminExpertItem[] = subjects.map((subj) => {
      const draft = draftMap.get(subj.id);
      const payload = draft?.payload;
      const rawPayload = (payload ?? {}) as Record<string, unknown>;
      const published = expertMap.get(subj.id);

      const applicantName =
        (typeof rawPayload.fullName === "string" && rawPayload.fullName) ||
        (typeof rawPayload.display_name === "string" && rawPayload.display_name) ||
        subj.title ||
        "Nama Tidak Tertera";
      const email = payload?.email ?? null;
      const phone = payload?.phone ?? null;
      const institution = payload?.institution ?? null;
      const country = payload?.country ?? null;
      const jobTitle = payload?.title ?? null;
      const roles = Array.isArray(payload?.roles) ? (payload.roles as string[]) : [];
      const expertise = Array.isArray(payload?.expertise) ? (payload.expertise as string[]) : [];
      const documentsCount = Array.isArray(payload?.documents) ? payload.documents.length : 0;

      const lastDec = latestDecisionMap.get(subj.id);
      const subjMeta = (subj.metadata as Record<string, unknown>) ?? {};

      const status = deriveExpertEffectiveStatus({
        subjectStatus: subj.current_status,
        subjectMeta: subjMeta,
        latestDecision: lastDec?.decision,
        draftStatus: draft?.status,
        publishedExpertStatus: published?.current_status,
      });
      const isResubmitted = status === "resubmitted";
      const isArchived = status === "archived";

      return {
        subjectId: subj.id,
        draftId: draft?.id ?? null,
        submitterId: subj.submitted_by,
        applicantName,
        email,
        phone,
        institution,
        country,
        jobTitle,
        roles,
        expertise,
        status,
        isResubmitted,
        resubmittedAt: isResubmitted
          ? (typeof subjMeta.resubmitted_at === "string" ? subjMeta.resubmitted_at : (draft?.updated_at || subj.updated_at))
          : null,
        lastRevisionRationale: lastDec?.rationale || (typeof subjMeta.last_rationale === "string" ? subjMeta.last_rationale : null),
        createdAt: subj.created_at,
        updatedAt: subj.updated_at,
        documentsCount,
        publishedSlug: published?.slug ?? null,
        isPublished: published?.current_status === "published",
        isArchived,
        archivedAt: typeof subjMeta.archived_at === "string" ? subjMeta.archived_at : null,
        archiveRationale: typeof subjMeta.archive_rationale === "string" ? subjMeta.archive_rationale : null,
      };
    });

    if (input.status && input.status !== "all") {
      if (input.status === "archived") {
        items = items.filter((it) => it.status === "archived");
      } else if (input.status === "revision_requested") {
        items = items.filter((it) => it.status === "revision_requested");
      } else if (input.status === "resubmitted") {
        items = items.filter((it) => it.status === "resubmitted");
      } else if (input.status === "pending") {
        items = items.filter((it) => it.status === "pending" || it.status === "under_review" || it.status === "decision_pending" || it.status === "resubmitted");
      } else {
        items = items.filter((it) => it.status === input.status);
      }
    }

    if (input.search) {
      const q = input.search.toLowerCase();
      return items.filter(
        (it) =>
          it.applicantName.toLowerCase().includes(q) ||
          (it.email && it.email.toLowerCase().includes(q)) ||
          (it.institution && it.institution.toLowerCase().includes(q)) ||
          it.expertise.some((e) => e.toLowerCase().includes(q)),
      );
    }

    return items;
  });

export const getAdminExpertDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ subjectId: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }): Promise<AdminExpertDetail | null> => {
    const access = await getExpertGovernanceAccess(context);
    if (!access.canRead) {
      throw new Error("forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: subj, error: subjErr } = await supabaseAdmin
      .from("review_subjects")
      .select("id, title, current_status, submitted_by, created_at, updated_at, metadata")
      .eq("id", input.subjectId)
      .eq("kind", "expert")
      .maybeSingle();

    if (subjErr) throw new Error(subjErr.message);
    if (!subj) return null;

    const { data: draft } = await supabaseAdmin
      .from("review_drafts")
      .select("id, payload, status, updated_at")
      .eq("linked_subject_id", subj.id)
      .eq("submitter_id", subj.submitted_by)
      .neq("status", "withdrawn")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // While the expert prepares an update (not sent), verifiers see the published
    // version, not the unsent draft (migration 20261022030000).
    const metaForDraft = (subj.metadata as Record<string, unknown>) ?? {};
    const updateDrafting =
      subj.current_status === "approved" && metaForDraft.update_open === true && draft?.status === "draft";
    let shownDraft = draft;
    if (updateDrafting && typeof metaForDraft.previous_draft_id === "string") {
      const { data: previous } = await supabaseAdmin
        .from("review_drafts")
        .select("id, payload, status, updated_at")
        .eq("id", metaForDraft.previous_draft_id)
        .maybeSingle();
      if (previous) shownDraft = previous;
    }
    const payload = (shownDraft?.payload as unknown as ExpertDraftPayload) ?? {};

    // Generate signed URLs for all documents attached
    const rawDocuments = Array.isArray(payload?.documents) ? payload.documents : [];
    const documentsWithUrls: AdminExpertDocument[] = await Promise.all(
      rawDocuments.map(async (doc) => {
        let downloadUrl: string | null = null;
        if (doc.path) {
          try {
            const { data: signed } = await supabaseAdmin.storage
              .from("expert-applications")
              .createSignedUrl(doc.path, 3600);
            downloadUrl = signed?.signedUrl ?? null;
          } catch {
            downloadUrl = null;
          }
        }
        return {
          ...doc,
          downloadUrl,
        };
      }),
    );

    // Fetch decisions history if any
    const { data: decisions } = await supabaseAdmin
      .from("review_decisions")
      .select("id, decision, rationale, decided_by, created_at")
      .eq("subject_id", subj.id)
      .order("created_at", { ascending: false });

    const rawPayload = (payload ?? {}) as Record<string, unknown>;

    // Fetch published expert record
    const { data: publishedExpert } = await supabaseAdmin
      .from("experts")
      .select("id, slug, current_status")
      .eq("source_submission_id", subj.id)
      .maybeSingle();

    const latestDec = (decisions ?? [])[0];
    const subjMeta = (subj.metadata as Record<string, unknown>) ?? {};

    // Duplicate/Match: profiles owned by other accounts with the same name or email.
    // A failed check must not block the review, so errors yield an empty list.
    const candidateName =
      (typeof rawPayload.fullName === "string" && rawPayload.fullName) ||
      (typeof rawPayload.display_name === "string" && rawPayload.display_name) ||
      "";
    const { data: duplicateRows } = await supabaseAdmin.rpc("expert_duplicate_candidates", {
      _name: candidateName,
      _email: typeof rawPayload.email === "string" ? rawPayload.email : "",
      _exclude_user: subj.submitted_by,
    });

    const status = deriveExpertEffectiveStatus({
      subjectStatus: subj.current_status,
      subjectMeta: subjMeta,
      latestDecision: latestDec?.decision,
      draftStatus: draft?.status,
      publishedExpertStatus: publishedExpert?.current_status,
    });
    const isResubmitted = status === "resubmitted";
    const isArchived = status === "archived";

    return {
      viewerCanDecide: access.canDecide && subj.submitted_by !== context.userId,
      subjectId: subj.id,
      draftId: draft?.id ?? null,
      submitterId: subj.submitted_by,
      applicantName:
        (typeof rawPayload.fullName === "string" && rawPayload.fullName) ||
        (typeof rawPayload.display_name === "string" && rawPayload.display_name) ||
        subj.title ||
        "Nama Tidak Tertera",
      email: payload?.email ?? null,
      phone: payload?.phone ?? null,
      institution: payload?.institution ?? null,
      country: payload?.country ?? null,
      jobTitle: payload?.title ?? null,
      roles: Array.isArray(payload?.roles) ? (payload.roles as string[]) : [],
      expertise: Array.isArray(payload?.expertise) ? (payload.expertise as string[]) : [],
      biography: payload?.biography ?? null,
      languages: typeof payload?.languages === "string" ? payload.languages : null,
      yearsExperience:
        typeof payload?.yearsExperience === "string" ? payload.yearsExperience : null,
      publications: typeof payload?.publications === "string" ? payload.publications : null,
      keyProjects: typeof payload?.keyProjects === "string" ? payload.keyProjects : null,
      status,
      isResubmitted,
      resubmittedAt: isResubmitted
        ? (typeof subjMeta.resubmitted_at === "string" ? subjMeta.resubmitted_at : (draft?.updated_at || subj.updated_at))
        : null,
      lastRevisionRationale: latestDec?.rationale || (typeof subjMeta.last_rationale === "string" ? subjMeta.last_rationale : null),
      createdAt: subj.created_at,
      updatedAt: subj.updated_at,
      documentsCount: documentsWithUrls.length,
      documents: documentsWithUrls,
      possibleDuplicates: (duplicateRows ?? []).map((d) => ({
        expertId: d.expert_id,
        displayName: d.display_name,
        slug: d.slug,
        status: d.current_status,
        matchReason: d.match_reason,
      })),
      publishedSlug: publishedExpert?.slug ?? null,
      isPublished: publishedExpert?.current_status === "published",
      isArchived,
      archivedAt: typeof subjMeta.archived_at === "string" ? subjMeta.archived_at : null,
      archiveRationale: typeof subjMeta.archive_rationale === "string" ? subjMeta.archive_rationale : null,
      updateDrafting,
      liveVersionKept: subjMeta.live_version_kept === true,
      updateNote: typeof subjMeta.update_note === "string" ? subjMeta.update_note : null,
        decisionsHistory: (decisions ?? []).map((d) => ({
          id: d.id,
          decision: d.decision,
          rationale: d.rationale,
          decidedBy: d.decided_by,
          createdAt: d.created_at,
        })),
      };
    });

const EXPERT_DECISION_ERRORS: Record<string, string> = {
  stale_subject:
    "Pengajuan ini baru saja diperbarui (oleh verifikator lain atau pemohon). Muat ulang data lalu coba lagi.",
  self_decision_forbidden: "Anda tidak dapat memutuskan, mengarsipkan, atau memulihkan pengajuan expert milik sendiri.",
  expert_archived: "Pakar berstatus arsip. Pulihkan terlebih dahulu sebelum mencatat keputusan baru.",
  awaiting_applicant_revision:
    "Pemohon sedang merevisi pengajuannya. Tunggu sampai revisi dikirim ulang sebelum menyetujui.",
  already_rejected: "Pengajuan ini sudah berstatus ditolak.",
  already_awaiting_revision: "Pengajuan ini sudah menunggu revisi dari pemohon.",
  rejected_is_final: "Pengajuan yang sudah ditolak tidak dapat dikembalikan untuk revisi.",
  expert_not_approved: "Hanya expert yang sudah disetujui yang dapat disinkronkan ke direktori.",
  already_archived: "Pakar ini sudah berstatus arsip.",
  not_archived: "Pakar ini tidak sedang berstatus arsip.",
  expert_subject_not_found: "Data pengajuan tidak ditemukan.",
  rationale_too_long: "Alasan terlalu panjang.",
  forbidden: "forbidden: hanya Approver atau Administrator yang dapat memutuskan, mengarsipkan, atau memulihkan expert.",
  exactly_one_primary_role_required: "Role pengguna tidak konsisten (role primer). Hubungi super admin.",
  expert_update_open: "Expert sedang menyiapkan pembaruan profil. Tunggu sampai pembaruan dikirim, lalu putuskan.",
  nothing_to_decide: "Tidak ada pengajuan yang menunggu keputusan. Untuk menarik profil dari direktori, gunakan Arsipkan.",
};

function toFriendlyExpertDecisionError(message: string | undefined | null): string {
  if (!message) return "Gagal memproses keputusan expert.";
  if (message.includes("Could not find the function") || message.includes("schema cache")) {
    return "Fitur keputusan expert membutuhkan migrasi database 20261015060000. Jalankan supabase/check_migrations.sql.";
  }
  for (const [code, friendly] of Object.entries(EXPERT_DECISION_ERRORS)) {
    if (message.includes(code)) return friendly;
  }
  return message;
}

type ExpertRpcResult = {
  subjectId: string;
  status: string;
  decisionId?: string | null;
  changed?: boolean;
  resynced?: boolean;
  expertId?: string;
  slug?: string;
  photo?: { path?: unknown; name?: unknown; type?: unknown } | null;
};

/**
 * The avatar copy is a storage operation, so it cannot join the database
 * transaction. It runs only after the decision has committed and is idempotent;
 * if it fails the profile simply keeps its previous avatar and the admin can
 * re-sync later.
 */
async function publishAvatarAfterCommit(subjectId: string, result: ExpertRpcResult) {
  const photo = result.photo;
  if (!result.expertId || !photo || typeof photo.path !== "string") return;
  const name = typeof photo.name === "string" ? photo.name : "";
  const type = typeof photo.type === "string" ? photo.type : "";
  if (!type.startsWith("image/") && !/\.(jpg|jpeg|png|webp|gif)$/i.test(name)) return;
  try {
    const { publishExpertAvatar } = await import("@/lib/experts/publishing.server");
    const url = await publishExpertAvatar(subjectId, photo.path, name || undefined);
    if (!url) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("experts").update({ avatar_url: url }).eq("id", result.expertId);
    if (error) console.error("[expert avatar] update failed:", error.message);
  } catch (err) {
    console.error("[expert avatar] publish failed:", err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callExpertRpc(context: { supabase: any }, fn: string, args: Record<string, unknown>) {
  const { data, error } = await context.supabase.rpc(fn, args);
  if (error) throw new Error(toFriendlyExpertDecisionError(error.message));
  return data as ExpertRpcResult;
}

/**
 * Decision, publication, trainer status and role change run in ONE database
 * transaction (public.admin_expert_decide, migration 20261015060000): a failure
 * anywhere rolls everything back, and `expectedUpdatedAt` (the version the admin
 * was looking at) stops two admins or a double click from both winning.
 */
export const recordAdminExpertDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        subjectId: z.string().uuid(),
        decision: DecisionType,
        rationale: z.string().max(5000).optional(),
        expectedUpdatedAt: z.string().max(64).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertExpertDecider(context);
    const result = await callExpertRpc(context, "admin_expert_decide", {
      _subject_id: input.subjectId,
      _decision: input.decision,
      _rationale: input.rationale?.trim() || null,
      _expected_updated_at: input.expectedUpdatedAt ?? null,
    });
    if (result.expertId) await publishAvatarAfterCommit(input.subjectId, result);
    const { clearExpertStatsCache } = await import("@/lib/experts/directory.functions");
    clearExpertStatsCache();
    return {
      success: true,
      decisionId: result.decisionId ?? null,
      decision: input.decision,
      resynced: Boolean(result.resynced),
    };
  });

export const syncExpertToDirectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ subjectId: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }) => {
    await assertExpertDecider(context);
    const result = await callExpertRpc(context, "admin_expert_decide", {
      _subject_id: input.subjectId,
      _decision: "sync",
      _rationale: null,
      _expected_updated_at: null,
    });
    await publishAvatarAfterCommit(input.subjectId, result);
    const { clearExpertStatsCache } = await import("@/lib/experts/directory.functions");
    clearExpertStatsCache();
    return { success: true, expertId: result.expertId ?? null, slug: result.slug ?? null };
  });

export const archiveAdminExpert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        subjectId: z.string().uuid(),
        rationale: z.string().trim().max(1000).optional(),
        expectedUpdatedAt: z.string().max(64).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertExpertDecider(context);
    await callExpertRpc(context, "admin_expert_archive", {
      _subject_id: input.subjectId,
      _rationale: input.rationale?.trim() || null,
      _expected_updated_at: input.expectedUpdatedAt ?? null,
    });
    const { clearExpertStatsCache } = await import("@/lib/experts/directory.functions");
    clearExpertStatsCache();
    return { success: true, subjectId: input.subjectId, status: "archived" };
  });

export const unarchiveAdminExpert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ subjectId: z.string().uuid(), expectedUpdatedAt: z.string().max(64).optional() }).parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertExpertDecider(context);
    const result = await callExpertRpc(context, "admin_expert_restore", {
      _subject_id: input.subjectId,
      _expected_updated_at: input.expectedUpdatedAt ?? null,
    });
    if (result.expertId) await publishAvatarAfterCommit(input.subjectId, result);
    const { clearExpertStatsCache } = await import("@/lib/experts/directory.functions");
    clearExpertStatsCache();
    return { success: true, subjectId: input.subjectId, status: result.status };
  });
