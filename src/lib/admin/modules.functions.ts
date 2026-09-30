import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publishApprovedModule } from "@/lib/experts/publishing.server";

const DecisionType = z.enum(["approve", "return_for_revision", "reject"]);

export type AdminModuleDocument = {
  type: string;
  name: string;
  size: number;
  fileType?: string;
  path?: string;
  uploadedAt?: string;
  downloadUrl: string | null;
};

export type AdminModuleItem = {
  subjectId: string;
  draftId: string | null;
  submitterId: string | null;
  title: string;
  summary: string | null;
  moduleType: string;
  language: string;
  estimatedHours: number;
  deliveryFormat: string | null;
  level: string | null;
  topic: string | null;
  authorName: string;
  authorEmail: string | null;
  authorInstitution: string | null;
  status: string; // "pending", "under_review", "approved", "rejected", "revision_requested", "resubmitted"
  isResubmitted?: boolean;
  resubmittedAt?: string | null;
  lastRevisionRationale?: string | null;
  createdAt: string;
  updatedAt: string;
  documentsCount: number;
  publishedModuleId?: string | null;
  isPublished?: boolean;
};

export type AdminModuleDetail = AdminModuleItem & {
  competency: string | null;
  targetParticipants: string | null;
  learningObjectives: string[];
  competencyOutcomes: string | null;
  assessmentMethod: string | null;
  passingScore: number | null;
  copyrightHolder: string | null;
  licensing: string | null;
  rationale: string | null;
  documents: AdminModuleDocument[];
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

export const listAdminModuleSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        status: z.string().optional(),
        search: z.string().trim().max(120).default(""),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data: input, context }): Promise<AdminModuleItem[]> => {
    if (!(await assertAdminOrReviewer(context))) {
      throw new Error("forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch review_subjects of kind 'module'
    const { data: subjects, error: subjErr } = await supabaseAdmin
      .from("review_subjects")
      .select("id, title, current_status, submitted_by, created_at, updated_at, metadata")
      .eq("kind", "module")
      .order("created_at", { ascending: false });

    if (subjErr) throw new Error(subjErr.message);
    if (!subjects || subjects.length === 0) return [];

    const subjectIds = subjects.map((s) => s.id);
    const submitterIds = Array.from(new Set(subjects.map((s) => s.submitted_by).filter(Boolean)));

    // Fetch linked review_drafts
    const { data: drafts } = await supabaseAdmin
      .from("review_drafts")
      .select("id, linked_subject_id, payload, title, status, updated_at")
      .in("linked_subject_id", subjectIds)
      .order("updated_at", { ascending: false });

    const draftMap = new Map<string, { id: string; payload: Record<string, unknown>; status: string; updated_at?: string }>();
    (drafts ?? []).forEach((d) => {
      if (d.linked_subject_id && !draftMap.has(d.linked_subject_id)) {
        draftMap.set(d.linked_subject_id, {
          id: d.id,
          payload: (d.payload as Record<string, unknown>) ?? {},
          status: d.status,
          updated_at: d.updated_at,
        });
      }
    });

    // Fetch published modules
    const { data: publishedModules } = await supabaseAdmin
      .from("module_registry")
      .select("id, source_submission_id, current_status")
      .in("source_submission_id", subjectIds);

    const publishedMap = new Map<string, { id: string; current_status: string }>();
    (publishedModules ?? []).forEach((m) => {
      if (m.source_submission_id) {
        publishedMap.set(m.source_submission_id, {
          id: m.id,
          current_status: m.current_status,
        });
      }
    });

    // Fetch author profiles
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, organization, phone")
      .in("id", submitterIds);

    const profileMap = new Map<string, { name: string; organization: string | null; phone: string | null }>();
    (profiles ?? []).forEach((p) => {
      profileMap.set(p.id, {
        name: p.display_name || "Trainer",
        organization: p.organization || null,
        phone: p.phone || null,
      });
    });

    // Fetch latest decisions for status resolution
    const { data: decisions } = await supabaseAdmin
      .from("review_decisions")
      .select("id, subject_id, decision, rationale, created_at")
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

    const items: AdminModuleItem[] = subjects.map((subj) => {
      const draft = draftMap.get(subj.id);
      const payload = draft?.payload ?? {};
      const metadata = (payload.metadata as Record<string, unknown>) ?? {};
      const contentOutline = (payload.content_outline as Record<string, unknown>) ?? {};
      const published = publishedMap.get(subj.id);
      const author = profileMap.get(subj.submitted_by);
      const latestDec = latestDecisionMap.get(subj.id);
      const lastDecision = latestDec?.decision;
      const subjMeta = (subj.metadata as Record<string, unknown>) ?? {};

      const lastDecisionTime = latestDec ? new Date(latestDec.createdAt).getTime() : 0;
      const draftUpdateTime = draft?.updated_at ? new Date(draft.updated_at).getTime() : 0;
      const subjUpdateTime = subj.updated_at ? new Date(subj.updated_at).getTime() : 0;

      // Has this module been resubmitted after a revision request?
      const isResubmitted =
        lastDecision === "return_for_revision" &&
        (draft?.status === "submitted" || subj.current_status === "pending") &&
        (draftUpdateTime > lastDecisionTime || subjUpdateTime > lastDecisionTime || subjMeta.review_status === "resubmitted");

      // Determine effective status
      let effectiveStatus = subj.current_status;
      if (subj.current_status === "approved" || lastDecision === "approve") {
        effectiveStatus = "approved";
      } else if (subj.current_status === "rejected" || lastDecision === "reject") {
        effectiveStatus = "rejected";
      } else if (isResubmitted) {
        effectiveStatus = "resubmitted";
      } else if (lastDecision === "return_for_revision") {
        effectiveStatus = "revision_requested";
      }

      // Count attached resources
      const attached = Array.isArray(metadata.attached_resources)
        ? metadata.attached_resources
        : Array.isArray(payload.documents)
          ? payload.documents
          : [];

      const authorName =
        (typeof metadata.copyright_holder === "string" && metadata.copyright_holder) ||
        author?.name ||
        "Trainer BARUNA";

      return {
        subjectId: subj.id,
        draftId: draft?.id ?? null,
        submitterId: subj.submitted_by,
        title: (typeof payload.title === "string" && payload.title) || subj.title || "Untitled Module",
        summary: typeof payload.summary === "string" ? payload.summary : null,
        moduleType: typeof payload.module_type === "string" ? payload.module_type : "technical",
        language: typeof payload.language === "string" ? payload.language : "English",
        estimatedHours: Number(payload.estimated_learning_hours || 0),
        deliveryFormat: typeof metadata.delivery_format === "string" ? metadata.delivery_format : "Self-paced",
        level: typeof metadata.level === "string" ? metadata.level : "Intermediate",
        topic: typeof contentOutline.topic === "string" ? contentOutline.topic : null,
        authorName,
        authorEmail: (typeof payload.email === "string" ? payload.email : null) || (typeof metadata.email === "string" ? metadata.email : null),
        authorInstitution: author?.organization ?? null,
        status: effectiveStatus,
        isResubmitted,
        resubmittedAt: isResubmitted
          ? (typeof subjMeta.resubmitted_at === "string" ? subjMeta.resubmitted_at : (draft?.updated_at || subj.updated_at))
          : null,
        lastRevisionRationale: latestDec?.rationale || (typeof subjMeta.last_rationale === "string" ? subjMeta.last_rationale : null),
        createdAt: subj.created_at,
        updatedAt: subj.updated_at,
        documentsCount: attached.length,
        publishedModuleId: published?.id ?? null,
        isPublished: published?.current_status === "published",
      };
    });

    // Status filter
    let filtered = items;
    if (input.status && input.status !== "all") {
      if (input.status === "pending") {
        filtered = items.filter(
          (it) =>
            it.status === "pending" ||
            it.status === "under_review" ||
            it.status === "decision_pending" ||
            it.status === "resubmitted",
        );
      } else if (input.status === "resubmitted") {
        filtered = items.filter((it) => it.status === "resubmitted");
      } else if (input.status === "revision_requested") {
        filtered = items.filter((it) => it.status === "revision_requested");
      } else {
        filtered = items.filter((it) => it.status === input.status);
      }
    }

    // Search filter
    if (input.search) {
      const q = input.search.toLowerCase();
      filtered = filtered.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.authorName.toLowerCase().includes(q) ||
          (it.topic && it.topic.toLowerCase().includes(q)) ||
          (it.authorInstitution && it.authorInstitution.toLowerCase().includes(q)),
      );
    }

    return filtered;
  });

export const getAdminModuleDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ subjectId: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }): Promise<AdminModuleDetail | null> => {
    if (!(await assertAdminOrReviewer(context))) {
      throw new Error("forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: subj, error: subjErr } = await supabaseAdmin
      .from("review_subjects")
      .select("id, title, current_status, submitted_by, created_at, updated_at, metadata")
      .eq("id", input.subjectId)
      .eq("kind", "module")
      .maybeSingle();

    if (subjErr) throw new Error(subjErr.message);
    if (!subj) return null;

    // Fetch linked draft or revision snapshot
    const { data: draft } = await supabaseAdmin
      .from("review_drafts")
      .select("id, payload, status, updated_at")
      .eq("linked_subject_id", subj.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let payload = (draft?.payload as Record<string, unknown>) ?? {};
    if (!payload || Object.keys(payload).length === 0) {
      const { data: rev } = await supabaseAdmin
        .from("review_subject_revisions")
        .select("snapshot")
        .eq("subject_id", subj.id)
        .order("revision", { ascending: false })
        .limit(1)
        .maybeSingle();

      const snap = (rev?.snapshot as Record<string, unknown>) ?? {};
      payload = (snap.payload as Record<string, unknown>) ?? {};
    }

    const metadata = (payload.metadata as Record<string, unknown>) ?? {};
    const contentOutline = (payload.content_outline as Record<string, unknown>) ?? {};
    const assessment = (payload.assessment_approach as Record<string, unknown>) ?? {};

    // Fetch author profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, organization, phone")
      .eq("id", subj.submitted_by)
      .maybeSingle();

    // Extract attached resources and generate signed download URLs
    const rawAttached = Array.isArray(metadata.attached_resources)
      ? (metadata.attached_resources as Array<Record<string, unknown>>)
      : Array.isArray(payload.documents)
        ? (payload.documents as Array<Record<string, unknown>>)
        : [];

    const authorDisplayName =
      (typeof metadata.copyright_holder === "string" && metadata.copyright_holder) ||
      profile?.display_name ||
      "Trainer BARUNA";

    const documentsWithUrls: AdminModuleDocument[] = await Promise.all(
      rawAttached.map(async (doc) => {
        const type = String(doc.type || doc.category || "Dokumen Pendukung");
        const name = String(doc.fileName || doc.name || "Berkas");
        const size = Number(doc.fileSize || doc.size || 0);
        const fileType = typeof doc.fileType === "string" ? doc.fileType : (typeof doc.type === "string" ? doc.type : undefined);
        const storagePath = typeof doc.path === "string" ? doc.path : null;
        let downloadUrl: string | null = null;

        if (storagePath) {
          try {
            const { data: signed } = await supabaseAdmin.storage
              .from("expert-applications")
              .createSignedUrl(storagePath, 3600);
            downloadUrl = signed?.signedUrl ?? null;
          } catch {
            downloadUrl = null;
          }
        }

        return {
          type,
          name,
          size,
          fileType,
          path: storagePath || undefined,
          uploadedAt: typeof doc.uploadedAt === "string" ? doc.uploadedAt : undefined,
          downloadUrl,
        };
      }),
    );

    // Fetch decisions history
    const { data: decisions } = await supabaseAdmin
      .from("review_decisions")
      .select("id, decision, rationale, decided_by, created_at")
      .eq("subject_id", subj.id)
      .order("created_at", { ascending: false });

    // Fetch published module
    const { data: published } = await supabaseAdmin
      .from("module_registry")
      .select("id, current_status")
      .eq("source_submission_id", subj.id)
      .maybeSingle();

    const latestDec = decisions?.[0];
    const latestDecision = latestDec?.decision;
    const subjMeta = (subj.metadata as Record<string, unknown>) ?? {};
    const lastDecisionTime = latestDec ? new Date(latestDec.created_at).getTime() : 0;
    const draftUpdateTime = draft?.updated_at ? new Date(draft.updated_at).getTime() : 0;
    const subjUpdateTime = subj.updated_at ? new Date(subj.updated_at).getTime() : 0;

    const isResubmitted =
      latestDecision === "return_for_revision" &&
      (draft?.status === "submitted" || subj.current_status === "pending") &&
      (draftUpdateTime > lastDecisionTime || subjUpdateTime > lastDecisionTime || subjMeta.review_status === "resubmitted");

    let effectiveStatus = subj.current_status;
    if (subj.current_status === "approved" || latestDecision === "approve") {
      effectiveStatus = "approved";
    } else if (subj.current_status === "rejected" || latestDecision === "reject") {
      effectiveStatus = "rejected";
    } else if (isResubmitted) {
      effectiveStatus = "resubmitted";
    } else if (latestDecision === "return_for_revision") {
      effectiveStatus = "revision_requested";
    }

    const learningObjectives = Array.isArray(payload.learning_objectives)
      ? (payload.learning_objectives as string[]).map(String)
      : [];

    return {
      subjectId: subj.id,
      draftId: draft?.id ?? null,
      submitterId: subj.submitted_by,
      title: (typeof payload.title === "string" && payload.title) || subj.title || "Untitled Module",
      summary: typeof payload.summary === "string" ? payload.summary : null,
      moduleType: typeof payload.module_type === "string" ? payload.module_type : "technical",
      language: typeof payload.language === "string" ? payload.language : "English",
      estimatedHours: Number(payload.estimated_learning_hours || 0),
      deliveryFormat: typeof metadata.delivery_format === "string" ? metadata.delivery_format : "Self-paced",
      level: typeof metadata.level === "string" ? metadata.level : "Intermediate",
      topic: typeof contentOutline.topic === "string" ? contentOutline.topic : null,
      competency: typeof contentOutline.competency === "string" ? contentOutline.competency : null,
      targetParticipants: typeof payload.target_participants === "string" ? payload.target_participants : null,
      learningObjectives,
      competencyOutcomes: typeof payload.competency_outcomes === "string" ? payload.competency_outcomes : null,
      assessmentMethod: typeof assessment.method === "string" ? assessment.method : null,
      passingScore: typeof assessment.passing_score === "number" ? assessment.passing_score : null,
      copyrightHolder: typeof metadata.copyright_holder === "string" ? metadata.copyright_holder : (profile?.display_name ?? null),
      licensing: typeof metadata.licensing === "string" ? metadata.licensing : null,
      rationale: typeof payload.rationale === "string" ? payload.rationale : null,
      authorName: (typeof metadata.copyright_holder === "string" && metadata.copyright_holder) || profile?.display_name || "Trainer BARUNA",
      authorEmail: (typeof payload.email === "string" ? payload.email : null) || (typeof metadata.email === "string" ? metadata.email : null),
      authorInstitution: profile?.organization ?? null,
      status: effectiveStatus,
      isResubmitted,
      resubmittedAt: isResubmitted
        ? (typeof subjMeta.resubmitted_at === "string" ? subjMeta.resubmitted_at : (draft?.updated_at || subj.updated_at))
        : null,
      lastRevisionRationale: latestDec?.rationale || (typeof subjMeta.last_rationale === "string" ? subjMeta.last_rationale : null),
      createdAt: subj.created_at,
      updatedAt: subj.updated_at,
      documentsCount: documentsWithUrls.length,
      documents: documentsWithUrls,
      publishedModuleId: published?.id ?? null,
      isPublished: published?.current_status === "published",
      decisionsHistory: (decisions ?? []).map((d) => ({
        id: d.id,
        decision: d.decision,
        rationale: d.rationale,
        decidedBy: d.decided_by,
        createdAt: d.created_at,
      })),
    };
  });

export const recordAdminModuleDecision = createServerFn({ method: "POST" })
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
      throw new Error("Modul pelatihan tidak ditemukan.");
    }

    // 2. Insert decision record
    const rationaleText =
      input.rationale?.trim() ||
      (input.decision === "return_for_revision"
        ? "Perlu revisi silabus atau dokumen modul."
        : input.decision === "approve"
          ? "Modul disetujui & dipublikasikan."
          : "Modul ditolak.");

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
      throw new Error(decErr?.message || "Gagal mencatat keputusan evaluasi modul.");
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

      // Re-open linked review_drafts back to 'draft' so trainer can edit silabus & upload new files
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
        await publishApprovedModule({
          subjectId: input.subjectId,
          decisionId,
          decidedBy: context.userId,
        });
      } catch (publishErr) {
        console.error("[recordAdminModuleDecision] publishApprovedModule error:", publishErr);
        throw new Error(
          publishErr instanceof Error
            ? `Keputusan disetujui namun gagal mempublikasikan modul ke registry: ${publishErr.message}`
            : "Gagal mempublikasikan modul ke registry.",
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

