import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publishApprovedExpert } from "@/lib/experts/publishing.server";
import type { ExpertApplicationDocument, ExpertDraftPayload } from "@/lib/experts/application.types";
import {
  deriveExpertEffectiveStatus,
  getExpertDecisionBlocker,
} from "@/lib/experts/application-status";

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

async function getExpertGovernanceAccess(
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

async function setExpertRoleStatus(userId: string, status: "active" | "revoked") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: expertRole } = await supabaseAdmin
    .from("rbac_roles")
    .select("id")
    .eq("code", "expert")
    .maybeSingle();
  if (!expertRole) return;
  const { error } = await supabaseAdmin
    .from("rbac_user_roles")
    .update(
      status === "revoked"
        ? { status: "revoked", valid_until: new Date().toISOString() }
        : { status: "active", valid_until: null },
    )
    .eq("user_id", userId)
    .eq("role_id", expertRole.id);
  if (error) throw new Error(`Gagal memperbarui role expert: ${error.message}`);
}

const revokeExpertRole = (userId: string) => setExpertRoleStatus(userId, "revoked");

type ExpertSubjectSnapshot = {
  id: string;
  submitted_by: string | null;
  current_status: string;
  metadata: unknown;
  updated_at: string;
};

/** Effective status of one expert subject, read fresh from the database. */
async function loadExpertEffectiveStatus(subj: ExpertSubjectSnapshot) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: latestDecision }, { data: draft }, { data: published }] = await Promise.all([
    supabaseAdmin
      .from("review_decisions")
      .select("id, decision, supersedes_decision_id")
      .eq("subject_id", subj.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("review_drafts")
      .select("status")
      .eq("linked_subject_id", subj.id)
      .neq("status", "withdrawn")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("experts")
      .select("current_status")
      .eq("source_submission_id", subj.id)
      .maybeSingle(),
  ]);
  return deriveExpertEffectiveStatus({
    subjectStatus: subj.current_status,
    subjectMeta: (subj.metadata as Record<string, unknown>) ?? {},
    latestDecision: latestDecision?.decision,
    draftStatus: draft?.status,
    publishedExpertStatus: published?.current_status,
  });
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

    // Fetch subjects of kind 'expert'
    const { data: subjects, error: subjErr } = await supabaseAdmin
      .from("review_subjects")
      .select("id, title, current_status, submitted_by, created_at, updated_at, metadata")
      .eq("kind", "expert")
      .order("created_at", { ascending: false });

    if (subjErr) throw new Error(subjErr.message);
    if (!subjects || subjects.length === 0) return [];

    const subjectIds = subjects.map((s) => s.id);

    // Fetch latest decisions to resolve 'revision_requested' status
    const { data: decisions } = await supabaseAdmin
      .from("review_decisions")
      .select("subject_id, decision, rationale, created_at")
      .in("subject_id", subjectIds)
      .order("created_at", { ascending: false });

    const latestDecisionMap = new Map<string, { decision: string; rationale: string | null; createdAt: string }>();
    (decisions ?? []).forEach((d) => {
      if (!latestDecisionMap.has(d.subject_id)) {
        latestDecisionMap.set(d.subject_id, {
          decision: d.decision,
          rationale: d.rationale,
          createdAt: d.created_at,
        });
      }
    });

    // Fetch linked review_drafts
    const { data: drafts } = await supabaseAdmin
      .from("review_drafts")
      .select("id, linked_subject_id, payload, status, updated_at")
      .in("linked_subject_id", subjectIds)
      .neq("status", "withdrawn")
      .order("updated_at", { ascending: false });

    const draftMap = new Map<string, { id: string; payload: ExpertDraftPayload; status: string; updated_at?: string }>();
    (drafts ?? []).forEach((d) => {
      if (d.linked_subject_id && !draftMap.has(d.linked_subject_id)) {
        draftMap.set(d.linked_subject_id, {
          id: d.id,
          payload: (d.payload as unknown as ExpertDraftPayload) ?? {},
          status: d.status,
          updated_at: d.updated_at,
        });
      }
    });

    // Fetch published experts in directory
    const { data: publishedExperts } = await supabaseAdmin
      .from("experts")
      .select("id, slug, source_submission_id, current_status")
      .in("source_submission_id", subjectIds);

    const expertMap = new Map<string, { id: string; slug: string; current_status: string }>();
    (publishedExperts ?? []).forEach((e) => {
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
      .neq("status", "withdrawn")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = (draft?.payload as unknown as ExpertDraftPayload) ?? {};

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
        decisionsHistory: (decisions ?? []).map((d) => ({
          id: d.id,
          decision: d.decision,
          rationale: d.rationale,
          decidedBy: d.decided_by,
          createdAt: d.created_at,
        })),
      };
    });

export const recordAdminExpertDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        subjectId: z.string().uuid(),
        decision: DecisionType,
        rationale: z.string().max(5000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertExpertDecider(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { clearExpertStatsCache } = await import("@/lib/experts/directory.functions");

    // 1. Fetch subject
    const { data: subj, error: subjErr } = await supabaseAdmin
      .from("review_subjects")
      .select("id, kind, submitted_by, current_status, metadata, updated_at")
      .eq("id", input.subjectId)
      .single();

    if (subjErr || !subj || subj.kind !== "expert") {
      throw new Error("Pengajuan tidak ditemukan.");
    }
    // Segregation of duties (same rule as public.finalize_decision).
    if (subj.submitted_by === context.userId) {
      throw new Error("self_approval_forbidden: Anda tidak dapat memutuskan pengajuan expert milik sendiri.");
    }

    // 2. Transition guard against the single source of truth for status.
    const currentStatus = await loadExpertEffectiveStatus(subj);
    const blocker = getExpertDecisionBlocker(currentStatus, input.decision);
    if (blocker) throw new Error(blocker);

    // Approving an already-approved expert is an idempotent directory re-sync:
    // no new decision row, so repeated clicks never pile up final decisions.
    if (input.decision === "approve" && currentStatus === "approved") {
      await publishApprovedExpert({ subjectId: input.subjectId, decidedBy: context.userId });
      clearExpertStatsCache();
      return { success: true, decisionId: null, decision: input.decision, resynced: true };
    }

    const rationaleText =
      input.rationale?.trim() ||
      (input.decision === "return_for_revision"
        ? "Perlu revisi kelengkapan dokumen."
        : input.decision === "approve"
          ? "Pengajuan telah diverifikasi dan disetujui."
          : "Pengajuan ditolak.");

    // 3. Claim the subject with an optimistic lock on updated_at (bumped by the
    //    touch trigger on every write). A concurrent decision or applicant
    //    resubmission makes this update match zero rows, so only one writer wins.
    const now = new Date().toISOString();
    const currentMeta = (subj.metadata as Record<string, unknown>) ?? {};
    const nextSubjectState =
      input.decision === "approve"
        ? {
            current_status: "approved",
            metadata: {
              ...currentMeta,
              review_status: "approved",
              last_decision: "approve",
              last_rationale: rationaleText,
              approved_at: now,
              resubmitted_at: null,
              archived_at: null,
              archive_rationale: null,
            },
          }
        : input.decision === "return_for_revision"
          ? {
              current_status: "pending",
              metadata: {
                ...currentMeta,
                review_status: "revision_requested",
                last_decision: "return_for_revision",
                last_rationale: rationaleText,
                revised_at: now,
                resubmitted_at: null,
              },
            }
          : {
              current_status: "rejected",
              metadata: {
                ...currentMeta,
                review_status: "rejected",
                last_decision: "reject",
                last_rationale: rationaleText,
                rejected_at: now,
              },
            };

    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("review_subjects")
      .update({
        current_status: nextSubjectState.current_status,
        metadata: nextSubjectState.metadata as never,
        updated_at: now,
      })
      .eq("id", input.subjectId)
      .eq("updated_at", subj.updated_at)
      .select("id");
    if (claimErr) throw new Error(claimErr.message);
    if (!claimed || claimed.length === 0) {
      throw new Error(
        "Pengajuan ini baru saja diperbarui (oleh verifikator lain atau pemohon). Muat ulang data lalu coba lagi.",
      );
    }

    const restoreSubject = async () => {
      const { error } = await supabaseAdmin
        .from("review_subjects")
        .update({ current_status: subj.current_status, metadata: currentMeta as never })
        .eq("id", input.subjectId);
      if (error) console.error("[recordAdminExpertDecision] subject restore failed:", error.message);
    };

    // 4. Insert decision record. Link the supersedes chain so the unique index
    //    review_decisions_one_current_final never collides on repeated cycles.
    const { data: prevDecisions } = await supabaseAdmin
      .from("review_decisions")
      .select("id, decision, supersedes_decision_id, created_at")
      .eq("subject_id", input.subjectId)
      .order("created_at", { ascending: false });

    let supersedesDecisionId: string | null = null;
    if (input.decision === "approve" || input.decision === "reject") {
      const existingNullFinal = prevDecisions?.find(
        (d) => !d.supersedes_decision_id && (d.decision === "approve" || d.decision === "reject"),
      );
      if (existingNullFinal) {
        supersedesDecisionId = existingNullFinal.id;
      } else if (prevDecisions && prevDecisions.length > 0) {
        supersedesDecisionId = prevDecisions[0].id;
      }
    }

    const { data: decRecord, error: decErr } = await supabaseAdmin
      .from("review_decisions")
      .insert({
        subject_id: input.subjectId,
        decided_by: context.userId,
        decision: input.decision,
        rationale: rationaleText,
        supersedes_decision_id: supersedesDecisionId,
      })
      .select("id")
      .single();

    if (decErr || !decRecord) {
      await restoreSubject();
      throw new Error(decErr?.message || "Gagal mencatat keputusan verifikasi.");
    }

    const decisionId = decRecord.id;

    const rollbackDecision = async () => {
      await supabaseAdmin.from("review_decisions").delete().eq("id", decisionId);
      await restoreSubject();
    };

    const deactivatePublishedExpertState = async () => {
      const { data: expertRecord } = await supabaseAdmin
        .from("experts")
        .select("id")
        .eq("source_submission_id", input.subjectId)
        .maybeSingle();

      if (expertRecord) {
        const { error: expertErr } = await supabaseAdmin
          .from("experts")
          .update({
            current_status: "archived",
            visibility: "private",
            updated_at: new Date().toISOString(),
          })
          .eq("id", expertRecord.id);
        if (expertErr) console.error("[recordAdminExpertDecision] expert deactivate failed:", expertErr.message);

        const { error: trainerErr } = await supabaseAdmin
          .from("expert_trainer_status")
          .update({ trainer_status: "inactive" })
          .eq("expert_id", expertRecord.id);
        if (trainerErr) console.error("[recordAdminExpertDecision] trainer deactivate failed:", trainerErr.message);
      }

      if (subj.submitted_by) {
        await revokeExpertRole(subj.submitted_by);
      }
    };

    if (input.decision === "return_for_revision") {
      // Re-open exactly ONE editable draft. review_drafts_one_editable_per_subject
      // allows a single status='draft' row per subject, so blindly re-opening every
      // linked draft would fail the unique index and leave the applicant stuck.
      const { data: latestDraft } = await supabaseAdmin
        .from("review_drafts")
        .select("id, status")
        .eq("linked_subject_id", input.subjectId)
        .neq("status", "withdrawn")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let reopenError: string | null = null;
      if (latestDraft && latestDraft.status !== "draft") {
        const { error } = await supabaseAdmin
          .from("review_drafts")
          .update({ status: "draft", updated_at: now })
          .eq("id", latestDraft.id);
        reopenError = error?.message ?? null;
      } else if (!latestDraft && subj.submitted_by) {
        // Legacy subject without a live draft: seed one from the latest revision snapshot.
        const { data: rev } = await supabaseAdmin
          .from("review_subject_revisions")
          .select("snapshot")
          .eq("subject_id", input.subjectId)
          .order("revision", { ascending: false })
          .limit(1)
          .maybeSingle();
        const snapshot = (rev?.snapshot as Record<string, unknown>) ?? {};
        const { data: subjectRow } = await supabaseAdmin
          .from("review_subjects")
          .select("title")
          .eq("id", input.subjectId)
          .single();
        const { error } = await supabaseAdmin.from("review_drafts").insert({
          subject_kind: "expert",
          submitter_id: subj.submitted_by,
          title: (typeof snapshot.title === "string" && snapshot.title) || subjectRow?.title || "Pengajuan Expert",
          payload: (snapshot.payload ?? {}) as never,
          status: "draft",
          linked_subject_id: input.subjectId,
        });
        reopenError = error?.message ?? null;
      }

      if (reopenError) {
        await rollbackDecision();
        throw new Error(`Gagal membuka kembali draf untuk revisi pemohon: ${reopenError}`);
      }

      await deactivatePublishedExpertState();
      clearExpertStatsCache();

      return { success: true, decisionId, decision: input.decision };
    }

    if (input.decision === "approve") {
      const { error: draftErr } = await supabaseAdmin
        .from("review_drafts")
        .update({
          status: "submitted",
          updated_at: now,
        })
        .eq("linked_subject_id", input.subjectId)
        .neq("status", "withdrawn");
      if (draftErr) console.error("[recordAdminExpertDecision] draft lock failed:", draftErr.message);

      try {
        await publishApprovedExpert({
          subjectId: input.subjectId,
          decisionId,
          decidedBy: context.userId,
        });
      } catch (publishErr) {
        // The decision stays recorded (status approved); the admin can retry via
        // "Sinkronkan / Perbarui Publikasi", which is an idempotent re-sync.
        console.error("[recordAdminExpertDecision] post-decision error:", publishErr);
        throw new Error(
          publishErr instanceof Error
            ? `Keputusan disetujui namun gagal mempublikasikan profil: ${publishErr.message}`
            : "Gagal mempublikasikan profil expert ke direktori.",
        );
      }

      clearExpertStatsCache();
      return { success: true, decisionId, decision: input.decision };
    }

    // reject
    await deactivatePublishedExpertState();
    clearExpertStatsCache();
    return { success: true, decisionId, decision: input.decision };
  });

export const syncExpertToDirectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ subjectId: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }) => {
    await assertExpertDecider(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subj } = await supabaseAdmin
      .from("review_subjects")
      .select("id, kind, submitted_by, current_status, metadata, updated_at")
      .eq("id", input.subjectId)
      .maybeSingle();
    if (!subj || subj.kind !== "expert") throw new Error("Data pengajuan tidak ditemukan.");
    // Never publish a profile that has not been approved (PB-EXP-01: approval before activation).
    if ((await loadExpertEffectiveStatus(subj)) !== "approved") {
      throw new Error("Hanya expert yang sudah disetujui yang dapat disinkronkan ke direktori.");
    }
    const { clearExpertStatsCache } = await import("@/lib/experts/directory.functions");
    const result = await publishApprovedExpert({
      subjectId: input.subjectId,
      decidedBy: context.userId,
    });
    clearExpertStatsCache();
    return { success: true, ...result };
  });

export const archiveAdminExpert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        subjectId: z.string().uuid(),
        rationale: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    await assertExpertDecider(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { clearExpertStatsCache } = await import("@/lib/experts/directory.functions");
    const rationaleText = input.rationale?.trim() || "Diarsipkan oleh Administrator.";

    // 1. Fetch current subject
    const { data: subj, error: subjErr } = await supabaseAdmin
      .from("review_subjects")
      .select("id, kind, submitted_by, current_status, metadata, updated_at")
      .eq("id", input.subjectId)
      .single();

    if (subjErr || !subj || subj.kind !== "expert") {
      throw new Error("Data pengajuan tidak ditemukan.");
    }
    // Re-archiving would overwrite metadata.previous_status with "archived" and
    // make a later restore guess the wrong lifecycle state.
    if ((await loadExpertEffectiveStatus(subj)) === "archived") {
      throw new Error("Pakar ini sudah berstatus arsip.");
    }

    const subjMeta = (subj.metadata as Record<string, unknown>) ?? {};

    // 2. Update review_subjects (with fallback to 'withdrawn' if 'archived' check constraint not yet applied on remote DB)
    const updatePayload = {
      current_status: "archived",
      metadata: {
        ...subjMeta,
        previous_status: subj.current_status,
        review_status: "archived",
        archived_at: new Date().toISOString(),
        archived_by: context.userId,
        archive_rationale: rationaleText,
      } as never,
      updated_at: new Date().toISOString(),
    };

    const { error: updateErr } = await supabaseAdmin
      .from("review_subjects")
      .update(updatePayload)
      .eq("id", input.subjectId);

    if (updateErr) {
      if (updateErr.message.includes("review_subjects_current_status_check")) {
        const { error: fallbackErr } = await supabaseAdmin
          .from("review_subjects")
          .update({
            ...updatePayload,
            current_status: "withdrawn",
          })
          .eq("id", input.subjectId);
        if (fallbackErr) throw new Error(fallbackErr.message);
      } else {
        throw new Error(updateErr.message);
      }
    }

    // 3. Update public.experts, expert_trainer_status, and rbac_user_roles
    const { data: expertRecord } = await supabaseAdmin
      .from("experts")
      .select("id, current_status")
      .eq("source_submission_id", input.subjectId)
      .maybeSingle();

    if (expertRecord) {
      const { error: expertErr } = await supabaseAdmin
        .from("experts")
        .update({
          current_status: "archived",
          visibility: "private",
          updated_at: new Date().toISOString(),
        })
        .eq("id", expertRecord.id);
      if (expertErr) throw new Error(`Gagal menyembunyikan profil expert: ${expertErr.message}`);

      // expert_trainer_status is versioned history: append, never overwrite.
      const { deactivateTrainerForArchive } = await import("@/lib/experts/trainer-status.server");
      try {
        await deactivateTrainerForArchive(expertRecord.id, context.userId);
      } catch (trainerErr) {
        console.error("[archiveAdminExpert] trainer deactivate failed:", trainerErr);
      }
    }

    if (subj.submitted_by) {
      await revokeExpertRole(subj.submitted_by);
    }

    clearExpertStatsCache();

    // 4. Governance audit log (append-only table, avoids review_decisions unique constraint collision)
    const { error: auditErr } = await supabaseAdmin.from("governance_audit_log").insert({
      event_type: "expert_archived",
      actor_id: context.userId,
      subject_id: input.subjectId,
      entity_type: "experts",
      entity_id: expertRecord?.id ?? input.subjectId,
      before: {
        status: subj.current_status,
      },
      after: {
        status: "archived",
        rationale: rationaleText,
      },
    });
    if (auditErr) console.warn("governance_audit_log insert skipped:", auditErr.message);

    return { success: true, subjectId: input.subjectId, status: "archived" };
  });

export const unarchiveAdminExpert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ subjectId: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }) => {
    await assertExpertDecider(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { clearExpertStatsCache } = await import("@/lib/experts/directory.functions");

    // 1. Fetch current subject
    const { data: subj, error: subjErr } = await supabaseAdmin
      .from("review_subjects")
      .select("id, kind, submitted_by, current_status, metadata, updated_at")
      .eq("id", input.subjectId)
      .single();

    if (subjErr || !subj || subj.kind !== "expert") {
      throw new Error("Data pengajuan tidak ditemukan.");
    }
    if ((await loadExpertEffectiveStatus(subj)) !== "archived") {
      throw new Error("Pakar ini tidak sedang berstatus arsip.");
    }

    const subjMeta = (subj.metadata as Record<string, unknown>) ?? {};
    const prevStatus =
      typeof subjMeta.previous_status === "string" &&
      subjMeta.previous_status !== "archived" &&
      subjMeta.previous_status !== "withdrawn"
        ? subjMeta.previous_status
        : "approved";
    const restoresPublication = prevStatus === "approved";

    // 2. Update review_subjects
    const { error: restoreErr } = await supabaseAdmin
      .from("review_subjects")
      .update({
        current_status: prevStatus,
        metadata: {
          ...subjMeta,
          review_status: prevStatus,
          unarchived_at: new Date().toISOString(),
          unarchived_by: context.userId,
        } as never,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.subjectId);
    if (restoreErr) throw new Error(restoreErr.message);

    // 3. Only an approved expert goes back to the public directory. A subject that
    //    was archived while pending/rejected must NOT regain a public profile or role.
    const { data: expertRecord } = await supabaseAdmin
      .from("experts")
      .select("id")
      .eq("source_submission_id", input.subjectId)
      .maybeSingle();

    if (restoresPublication && expertRecord) {
      const { error: expertErr } = await supabaseAdmin
        .from("experts")
        .update({
          current_status: "published",
          visibility: "public",
          updated_at: new Date().toISOString(),
        })
        .eq("id", expertRecord.id);
      if (expertErr) throw new Error(`Gagal memulihkan profil expert: ${expertErr.message}`);

      const { restoreTrainerAfterArchive } = await import("@/lib/experts/trainer-status.server");
      try {
        await restoreTrainerAfterArchive(expertRecord.id, context.userId);
      } catch (trainerErr) {
        console.error("[unarchiveAdminExpert] trainer restore failed:", trainerErr);
      }

      if (subj.submitted_by) {
        await setExpertRoleStatus(subj.submitted_by, "active");
      }
    } else if (restoresPublication) {
      await publishApprovedExpert({
        subjectId: input.subjectId,
        decidedBy: context.userId,
      });
    }

    clearExpertStatsCache();

    // 4. Governance audit log
    const { error: auditErr } = await supabaseAdmin.from("governance_audit_log").insert({
      event_type: "expert_unarchived",
      actor_id: context.userId,
      subject_id: input.subjectId,
      entity_type: "experts",
      entity_id: expertRecord?.id ?? input.subjectId,
      before: {
        status: subj.current_status,
      },
      after: {
        status: prevStatus,
      },
    });
    if (auditErr) console.warn("governance_audit_log insert skipped:", auditErr.message);

    return {
      success: true,
      subjectId: input.subjectId,
      status: restoresPublication ? "published" : prevStatus,
    };
  });
