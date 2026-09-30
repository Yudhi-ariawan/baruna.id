import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publishApprovedExpert } from "@/lib/experts/publishing.server";
import type { ExpertApplicationDocument, ExpertDraftPayload } from "@/lib/experts/application.types";

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
};

export type AdminExpertDetail = AdminExpertItem & {
  biography: string | null;
  languages: string | null;
  yearsExperience: string | null;
  publications: string | null;
  keyProjects: string | null;
  documents: AdminExpertDocument[];
  decisionsHistory: Array<{
    id: string;
    decision: string;
    rationale: string | null;
    decidedBy: string | null;
    createdAt: string;
  }>;
};

async function assertAdminOrReviewer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: { supabase: any; userId: string },
) {
  const roles = ["super_admin", "admin", "management", "qa_reviewer", "verifier", "approver"];
  for (const role of roles) {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: role,
    });
    if (data) return true;
  }
  return false;
}

export const listAdminExpertApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
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
      .in("linked_subject_id", subjectIds);

    const draftMap = new Map<string, { id: string; payload: ExpertDraftPayload; status: string; updated_at?: string }>();
    (drafts ?? []).forEach((d) => {
      if (d.linked_subject_id) {
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
      const lastDecision = lastDec?.decision;
      const subjMeta = (subj.metadata as Record<string, unknown>) ?? {};

      const lastDecisionTime = lastDec ? new Date(lastDec.createdAt).getTime() : 0;
      const draftUpdateTime = draft?.updated_at ? new Date(draft.updated_at).getTime() : 0;
      const subjUpdateTime = subj.updated_at ? new Date(subj.updated_at).getTime() : 0;

      const isResubmitted =
        lastDecision === "return_for_revision" &&
        (subj.current_status === "pending" || draft?.status === "submitted") &&
        (draftUpdateTime > lastDecisionTime || subjUpdateTime > lastDecisionTime || subjMeta.review_status === "resubmitted");

      let status = subj.current_status;
      if (subj.current_status === "approved" || lastDecision === "approve") {
        status = "approved";
      } else if (subj.current_status === "rejected" || lastDecision === "reject") {
        status = "rejected";
      } else if (isResubmitted) {
        status = "resubmitted";
      } else if (lastDecision === "return_for_revision") {
        status = "revision_requested";
      }

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
      };
    });

    if (input.status && input.status !== "all") {
      if (input.status === "revision_requested") {
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
  .inputValidator((input) => z.object({ subjectId: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }): Promise<AdminExpertDetail | null> => {
    if (!(await assertAdminOrReviewer(context))) {
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
    const latestDecision = latestDec?.decision;
    const subjMeta = (subj.metadata as Record<string, unknown>) ?? {};
    const lastDecisionTime = latestDec ? new Date(latestDec.created_at).getTime() : 0;
    const draftUpdateTime = draft?.updated_at ? new Date(draft.updated_at).getTime() : 0;
    const subjUpdateTime = subj.updated_at ? new Date(subj.updated_at).getTime() : 0;

    const isResubmitted =
      latestDecision === "return_for_revision" &&
      (subj.current_status === "pending" || draft?.status === "submitted") &&
      (draftUpdateTime > lastDecisionTime || subjUpdateTime > lastDecisionTime || subjMeta.review_status === "resubmitted");

    let status = subj.current_status;
    if (subj.current_status === "approved" || latestDecision === "approve") {
      status = "approved";
    } else if (subj.current_status === "rejected" || latestDecision === "reject") {
      status = "rejected";
    } else if (isResubmitted) {
      status = "resubmitted";
    } else if (latestDecision === "return_for_revision") {
      status = "revision_requested";
    }

    return {
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
        publishedSlug: publishedExpert?.slug ?? null,
        isPublished: publishedExpert?.current_status === "published",
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
  .inputValidator((input) =>
    z
      .object({
        subjectId: z.string().uuid(),
        decision: DecisionType,
        rationale: z.string().max(5000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    if (!(await assertAdminOrReviewer(context))) {
      throw new Error("forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch subject
    const { data: subj, error: subjErr } = await supabaseAdmin
      .from("review_subjects")
      .select("id, kind, title, description, external_ref, submitted_by, current_status, metadata")
      .eq("id", input.subjectId)
      .single();

    if (subjErr || !subj) {
      throw new Error("Pengajuan tidak ditemukan.");
    }

    // 2. Insert decision record
    const rationaleText =
      input.rationale?.trim() ||
      (input.decision === "return_for_revision"
        ? "Perlu revisi kelengkapan dokumen."
        : input.decision === "approve"
          ? "Pengajuan telah diverifikasi dan disetujui."
          : "Pengajuan ditolak.");

    const { data: decRecord, error: decErr } = await supabaseAdmin
      .from("review_decisions")
      .insert({
        subject_id: input.subjectId,
        decided_by: context.userId,
        decision: input.decision,
        rationale: rationaleText,
      })
      .select("id")
      .single();

    if (decErr || !decRecord) {
      throw new Error(decErr?.message || "Gagal mencatat keputusan verifikasi.");
    }

    const decisionId = decRecord.id;

    if (input.decision === "return_for_revision") {
      const currentMeta = (subj.metadata as Record<string, unknown>) ?? {};
      await supabaseAdmin
        .from("review_subjects")
        .update({
          current_status: "pending",
          metadata: {
            ...currentMeta,
            review_status: "revision_requested",
            last_decision: "return_for_revision",
            last_rationale: rationaleText,
            revised_at: new Date().toISOString(),
          } as never,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.subjectId);

      // Re-open draft so submitter can edit and replace files
      await supabaseAdmin
        .from("review_drafts")
        .update({
          status: "draft",
          updated_at: new Date().toISOString(),
        })
        .eq("linked_subject_id", input.subjectId);

      return { success: true, decisionId, decision: input.decision };
    }

    if (input.decision === "approve") {
      await supabaseAdmin
        .from("review_subjects")
        .update({
          current_status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.subjectId);

      try {
        await publishApprovedExpert({
          subjectId: input.subjectId,
          decisionId,
          decidedBy: context.userId,
        });
      } catch (publishErr) {
        console.error("[recordAdminExpertDecision] post-decision error:", publishErr);
        throw new Error(
          publishErr instanceof Error
            ? `Keputusan disetujui namun gagal mempublikasikan profil: ${publishErr.message}`
            : "Gagal mempublikasikan profil expert ke direktori.",
        );
      }

      return { success: true, decisionId, decision: input.decision };
    }

    if (input.decision === "reject") {
      await supabaseAdmin
        .from("review_subjects")
        .update({
          current_status: "rejected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.subjectId);

      return { success: true, decisionId, decision: input.decision };
    }

    return { success: true, decisionId, decision: input.decision };
  });

export const syncExpertToDirectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ subjectId: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }) => {
    if (!(await assertAdminOrReviewer(context))) {
      throw new Error("forbidden");
    }
    const result = await publishApprovedExpert({
      subjectId: input.subjectId,
      decidedBy: context.userId,
    });
    return { success: true, ...result };
  });
