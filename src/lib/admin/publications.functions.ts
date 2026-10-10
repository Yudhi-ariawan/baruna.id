import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { groupForType } from "@/lib/resources";

type ResourceType = Database["public"]["Enums"]["resource_type_v1"];
const typeMap: Record<string, ResourceType> = {
  "Training Module": "module",
  "Presentation Slides": "training_material",
  "Technical Guideline": "guideline",
  "SOP / Manual": "guideline",
  Handbook: "book",
  "E-Book": "book",
  "Research Report": "technical_report",
  "Journal Article": "journal_article",
  "Policy Brief": "policy_brief",
  "Case Study": "case_study",
  "Best Practice": "best_practice",
  "Webinar Recording": "webinar_recording",
  Video: "video",
  Podcast: "podcast",
  Infographic: "infographic",
  "Photo Documentation": "poster",
  "Monitoring Template": "tool",
  "Assessment Tool": "tool",
  "Data Collection Form": "tool",
  Checklist: "tool",
  "Spreadsheet Tool": "tool",
};

const PUBLIC_COVER_BUCKET = "knowledge-resource-covers";

async function publishResourceCover(
  subjectId: string,
  sourcePath: string,
  fileName?: string
): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const { data: blob, error: downloadError } = await supabaseAdmin.storage
      .from("knowledge-resource-submissions")
      .download(sourcePath);

    if (downloadError || !blob) {
      console.warn("[publishResourceCover] Download failed, falling back to signed url:", downloadError);
      const { data: signed } = await supabaseAdmin.storage
        .from("knowledge-resource-submissions")
        .createSignedUrl(sourcePath, 31536000);
      return signed?.signedUrl ?? null;
    }

    const buckets = await supabaseAdmin.storage.listBuckets();
    if (!buckets.data?.some((b) => b.id === PUBLIC_COVER_BUCKET)) {
      const created = await supabaseAdmin.storage.createBucket(PUBLIC_COVER_BUCKET, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      });
      if (created.error && !created.error.message?.includes("already exists")) {
        console.warn("[publishResourceCover] createBucket notice:", created.error);
      }
    }

    const extension = String(fileName || sourcePath).split(".").pop()?.toLowerCase() || "jpg";
    const destination = `publications/${subjectId}/cover.${extension}`;
    const contentType = blob.type || (extension === "png" ? "image/png" : "image/jpeg");

    const uploaded = await supabaseAdmin.storage
      .from(PUBLIC_COVER_BUCKET)
      .upload(destination, blob, { contentType, upsert: true });

    if (uploaded.error) {
      console.warn("[publishResourceCover] upload to public covers failed, falling back to signed url:", uploaded.error);
      const { data: signed } = await supabaseAdmin.storage
        .from("knowledge-resource-submissions")
        .createSignedUrl(sourcePath, 31536000);
      return signed?.signedUrl ?? null;
    }

    return supabaseAdmin.storage.from(PUBLIC_COVER_BUCKET).getPublicUrl(destination).data.publicUrl;
  } catch (err) {
    console.warn("[publishResourceCover] error:", err);
    return null;
  }
}

export type AdminPublicationItem = {
  subjectId: string;
  draftId: string | null;
  submitterId: string | null;
  title: string;
  type: string;
  typeGroup: string;
  topic: string | null;
  authorName: string;
  authorEmail: string | null;
  authorInstitution: string | null;
  authorCountry: string | null;
  status: "pending" | "under_review" | "approved" | "rejected" | "revision_requested" | "resubmitted";
  statusLabel: string;
  isResubmitted?: boolean;
  resubmittedAt?: string | null;
  abstract: string | null;
  coverage: string | null;
  year: number | null;
  language: string | null;
  license: string | null;
  accessType: string | null;
  keywords: string[];
  externalUrl: string | null;
  fileInfo?: {
    name: string;
    size?: number;
    path?: string;
    downloadUrl?: string | null;
  };
  coverInfo?: {
    name: string;
    size?: number;
    path?: string;
    downloadUrl?: string | null;
  };
  lastRevisionRationale?: string | null;
  practiceStructure?: {
    challenge?: string;
    context?: string;
    intervention?: string;
    steps?: string;
    stakeholders?: string;
    results?: string;
    lessons?: string;
    replication?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  isPublished?: boolean;
  publishedResourceId?: string | null;
  decisionsHistory?: Array<{
    id: string;
    decision: string;
    rationale: string | null;
    decidedBy: string | null;
    createdAt: string;
  }>;
};

export type AdminPublicationStats = {
  total: number;
  pending: number;
  revision: number;
  approved: number;
  rejected: number;
};

async function assertAdminOrReviewer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: { supabase: any; userId: string },
) {
  const allowed = ["super_admin", "admin", "management", "qa_reviewer", "verifier", "approver"];
  const now = new Date().toISOString();
  const { data: assignments } = await context.supabase
    .from("rbac_user_roles")
    .select("rbac_roles!inner(code)")
    .eq("user_id", context.userId)
    .eq("status", "active")
    .lte("valid_from", now)
    .or(`valid_until.is.null,valid_until.gt.${now}`)
    .in("rbac_roles.code", allowed)
    .limit(1);

  if (assignments && assignments.length > 0) return true;

  for (const role of allowed.slice(0, 2)) {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: role,
    });
    if (data) return true;
  }
  return false;
}

export const listAdminPublicationSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: AdminPublicationItem[]; stats: AdminPublicationStats }> => {
    if (!(await assertAdminOrReviewer(context))) {
      throw new Error("Akses ditolak: Hanya administrator atau kurator yang dapat mengakses data ini.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch review_subjects where kind = 'knowledge_resource'
    const { data: subjects, error: subjError } = await supabaseAdmin
      .from("review_subjects")
      .select("id, kind, title, description, external_ref, submitted_by, current_status, metadata, created_at, updated_at")
      .eq("kind", "knowledge_resource")
      .order("updated_at", { ascending: false });

    if (subjError) {
      console.error("[listAdminPublicationSubmissions] subjects query error:", subjError);
    }

    // 2. Fetch linked review_drafts (ordered ascending so the latest draft wins in the Map)
    const { data: drafts } = await supabaseAdmin
      .from("review_drafts")
      .select("id, title, payload, status, linked_subject_id, submitter_id, created_at, updated_at")
      .eq("subject_kind", "knowledge_resource")
      .order("updated_at", { ascending: true });

    const draftBySubjectId = new Map(
      (drafts ?? []).filter((d) => d.linked_subject_id).map((d) => [d.linked_subject_id as string, d]),
    );

    // 3. Fetch latest decisions
    const subjectIds = (subjects ?? []).map((s) => s.id);
    const { data: decisions } = subjectIds.length > 0
      ? await supabaseAdmin
          .from("review_decisions")
          .select("id, subject_id, decision, rationale, decided_by, created_at")
          .in("subject_id", subjectIds)
          .order("created_at", { ascending: false })
      : { data: [] };

    const decisionsBySubject = new Map<string, typeof decisions>();
    for (const d of decisions ?? []) {
      const list = decisionsBySubject.get(d.subject_id) ?? [];
      list.push(d);
      decisionsBySubject.set(d.subject_id, list);
    }

    // 4. Fetch published knowledge_resources
    const { data: publishedKrs } = subjectIds.length > 0
      ? await supabaseAdmin
          .from("knowledge_resources")
          .select("id, source_submission_id, current_status")
          .in("source_submission_id", subjectIds)
      : { data: [] };

    const publishedBySubjId = new Map((publishedKrs ?? []).map((k) => [k.source_submission_id, k]));

    // 5. Fetch submitter profiles
    const submitterIds = [...new Set((subjects ?? []).map((s) => s.submitted_by).filter(Boolean))];
    const { data: profiles } = submitterIds.length > 0
      ? await supabaseAdmin
          .from("profiles")
          .select("id, display_name, organization, job_title")
          .in("id", submitterIds)
      : { data: [] };

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const items: AdminPublicationItem[] = [];

    for (const subj of subjects ?? []) {
      const draft = draftBySubjectId.get(subj.id);
      const subjMeta = (subj.metadata as Record<string, unknown>) ?? {};
      const payload = (draft?.payload as Record<string, unknown>) ?? {};
      const profile = subj.submitted_by ? profileById.get(subj.submitted_by) : undefined;
      const subjDecisions = decisionsBySubject.get(subj.id) ?? [];
      const latestDec = subjDecisions[0];
      const published = publishedBySubjId.get(subj.id);

      // Check if this was a resubmitted revision
      const isResubmitted =
        subjMeta.review_status === "resubmitted" ||
        (draft?.status === "submitted" &&
          (subjMeta.review_status === "revision_requested" ||
            latestDec?.decision === "return_for_revision"));
      const resubmittedAt =
        (typeof subjMeta.resubmitted_at === "string" ? subjMeta.resubmitted_at : null) ||
        (isResubmitted ? draft?.updated_at || subj.updated_at : null);

      // Determine effective status
      let status: AdminPublicationItem["status"] = "pending";
      let statusLabel = "Menunggu Kurasi";

      if (subj.current_status === "approved" || subjMeta.review_status === "approved" || published?.current_status === "published") {
        status = "approved";
        statusLabel = "Disetujui & Tayang";
      } else if (subj.current_status === "rejected" || subjMeta.review_status === "rejected" || latestDec?.decision === "reject") {
        status = "rejected";
        statusLabel = "Ditolak";
      } else if (isResubmitted) {
        status = "resubmitted";
        statusLabel = "Revisi Diajukan Ulang";
      } else if (subjMeta.review_status === "revision_requested" || latestDec?.decision === "return_for_revision") {
        status = "revision_requested";
        statusLabel = "Perlu Revisi";
      } else if (subj.current_status === "under_review") {
        status = "under_review";
        statusLabel = "Sedang Ditinjau";
      }

      const rawType = String(payload.type ?? payload.resource_type ?? "Research Report");
      const filePayload = payload.file as { name?: string; size?: number; storagePath?: string } | undefined;
      const attachedPath = filePayload?.storagePath || (typeof payload.uploadedFilePath === "string" ? payload.uploadedFilePath : undefined);

      let downloadUrl: string | null = null;
      if (attachedPath) {
        try {
          const { data: signed } = await supabaseAdmin.storage
            .from("knowledge-resource-submissions")
            .createSignedUrl(attachedPath, 3600);
          downloadUrl = signed?.signedUrl ?? null;
        } catch {
          // ignore signed url error
        }
      }

      const coverPayload = payload.coverFile as { name?: string; size?: number; storagePath?: string } | undefined;
      const coverAttachedPath = coverPayload?.storagePath || (typeof payload.coverFilePath === "string" ? payload.coverFilePath : undefined);

      let coverDownloadUrl: string | null = null;
      if (coverAttachedPath) {
        try {
          const { data: signedCover } = await supabaseAdmin.storage
            .from("knowledge-resource-submissions")
            .createSignedUrl(coverAttachedPath, 3600);
          coverDownloadUrl = signedCover?.signedUrl ?? null;
        } catch {
          // ignore signed url error
        }
      }

      const keywordsList = Array.isArray(payload.keywords)
        ? (payload.keywords as string[])
        : payload.keywords
          ? String(payload.keywords).split(",").map((s) => s.trim())
          : [];

      items.push({
        subjectId: subj.id,
        draftId: draft?.id ?? null,
        submitterId: subj.submitted_by,
        title: (typeof payload.title === "string" && payload.title) || subj.title || "Tanpa Judul",
        type: rawType,
        typeGroup: groupForType(rawType),
        topic: typeof payload.topicCategory === "string" ? payload.topicCategory : typeof payload.topic === "string" ? payload.topic : null,
        authorName: (typeof payload.author === "string" && payload.author) || profile?.display_name || "Kontributor",
        authorEmail: typeof payload.email === "string" ? payload.email : null,
        authorInstitution: (typeof payload.institution === "string" && payload.institution) || profile?.organization || null,
        authorCountry: typeof payload.country === "string" ? payload.country : "Indonesia",
        status,
        statusLabel,
        isResubmitted: Boolean(isResubmitted),
        resubmittedAt,
        abstract: (typeof payload.abstract === "string" && payload.abstract) || (typeof payload.description === "string" && payload.description) || null,
        coverage: typeof payload.geographicCoverage === "string" ? payload.geographicCoverage : typeof payload.coverage === "string" ? payload.coverage : null,
        year: Number(payload.year) || null,
        language: typeof payload.language === "string" ? payload.language : "Indonesian",
        license: typeof payload.license === "string" ? payload.license : "CC BY-NC 4.0",
        accessType: typeof payload.accessType === "string" ? payload.accessType : "open",
        keywords: keywordsList,
        externalUrl: typeof payload.externalUrl === "string" && payload.externalUrl.trim() ? payload.externalUrl.trim() : null,
        fileInfo: filePayload?.name || payload.fileName
          ? {
              name: filePayload?.name || String(payload.fileName),
              size: filePayload?.size ?? (Number(payload.fileSize) || undefined),
              path: attachedPath,
              downloadUrl,
            }
          : undefined,
        coverInfo: coverPayload?.name || payload.coverFileName || coverAttachedPath
          ? {
              name: coverPayload?.name || String(payload.coverFileName || "cover-image.jpg"),
              size: coverPayload?.size ?? (Number(payload.coverFileSize) || undefined),
              path: coverAttachedPath,
              downloadUrl: coverDownloadUrl,
            }
          : undefined,
        lastRevisionRationale: latestDec?.rationale || (typeof subjMeta.last_rationale === "string" ? subjMeta.last_rationale : null),
        practiceStructure:
          payload.practiceStructure && typeof payload.practiceStructure === "object" && !Array.isArray(payload.practiceStructure)
            ? (payload.practiceStructure as AdminPublicationItem["practiceStructure"])
            : null,
        createdAt: subj.created_at,
        updatedAt: subj.updated_at,
        isPublished: published?.current_status === "published",
        publishedResourceId: published?.id ?? null,
        decisionsHistory: (subjDecisions ?? []).map((d) => ({
          id: d.id,
          decision: d.decision,
          rationale: d.rationale,
          decidedBy: d.decided_by,
          createdAt: d.created_at,
        })),
      });
    }

    const stats: AdminPublicationStats = {
      total: items.length,
      pending: items.filter((i) => i.status === "pending" || i.status === "under_review" || i.status === "resubmitted").length,
      revision: items.filter((i) => i.status === "revision_requested").length,
      approved: items.filter((i) => i.status === "approved").length,
      rejected: items.filter((i) => i.status === "rejected").length,
    };

    return { items, stats };
  });

const DecisionInput = z.object({
  subjectId: z.string().uuid(),
  decision: z.enum(["approve", "return_for_revision", "reject"]),
  rationale: z.string().max(5000).optional(),
});

export const recordAdminPublicationDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DecisionInput.parse(input))
  .handler(async ({ data: input, context }) => {
    if (!(await assertAdminOrReviewer(context))) {
      throw new Error("forbidden: Akses tidak mencukupi untuk mengambil keputusan kurasi.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch subject
    const { data: subj, error: subjErr } = await supabaseAdmin
      .from("review_subjects")
      .select("id, kind, title, description, external_ref, submitted_by, current_status, metadata")
      .eq("id", input.subjectId)
      .single();

    if (subjErr || !subj) {
      throw new Error("Data submission publikasi tidak ditemukan.");
    }

    // 2. Fetch latest linked draft
    const { data: draft } = await supabaseAdmin
      .from("review_drafts")
      .select("id, title, payload, status")
      .eq("linked_subject_id", input.subjectId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = (draft?.payload as Record<string, unknown>) ?? {};
    const currentMeta = (subj.metadata as Record<string, unknown>) ?? {};

    const rationaleText =
      input.rationale?.trim() ||
      (input.decision === "return_for_revision"
        ? "Perlu perbaikan kelengkapan naskah publikasi atau dokumen terlampir."
        : input.decision === "approve"
          ? "Publikasi disetujui & ditayangkan ke publik di Knowledge Hub."
          : "Publikasi ditolak.");

    // Query previous decisions to chain supersedes if needed
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

    // Insert decision record
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
      throw new Error(decErr?.message || "Gagal mencatat keputusan evaluasi.");
    }

    const decisionId = decRecord.id;

    // Handle Return for Revision
    if (input.decision === "return_for_revision") {
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

      if (draft) {
        await supabaseAdmin
          .from("review_drafts")
          .update({
            status: "draft",
            updated_at: new Date().toISOString(),
          })
          .eq("id", draft.id);
      }

      return { success: true, decisionId, decision: input.decision };
    }

    // Handle Reject
    if (input.decision === "reject") {
      await supabaseAdmin
        .from("review_subjects")
        .update({
          current_status: "rejected",
          metadata: {
            ...currentMeta,
            review_status: "rejected",
            last_decision: "reject",
            last_rationale: rationaleText,
          } as never,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.subjectId);

      await supabaseAdmin
        .from("knowledge_resources")
        .update({
          current_status: "archived",
          visibility: "private",
          updated_at: new Date().toISOString(),
        })
        .eq("source_submission_id", input.subjectId);

      const { clearKnowledgeHubCache } = await import("@/lib/knowledge-hub/knowledge-hub.functions");
      clearKnowledgeHubCache();

      return { success: true, decisionId, decision: input.decision };
    }

    // Handle Approve & Publish
    if (input.decision === "approve") {
      await supabaseAdmin
        .from("review_subjects")
        .update({
          current_status: "approved",
          metadata: {
            ...currentMeta,
            review_status: "approved",
            last_decision: "approve",
            last_rationale: rationaleText,
            approved_at: new Date().toISOString(),
          } as never,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.subjectId);

      // Check if already in knowledge_resources
      const { data: existingKr } = await supabaseAdmin
        .from("knowledge_resources")
        .select("id")
        .eq("source_submission_id", input.subjectId)
        .maybeSingle();

      const rawType = String(payload.type ?? "Research Report");
      const mappedType: ResourceType = typeMap[rawType] ?? "technical_report";
      const fileData = payload.file as { name?: string; size?: number; storagePath?: string; type?: string } | undefined;
      const filePath = fileData?.storagePath || (typeof payload.uploadedFilePath === "string" ? payload.uploadedFilePath : undefined);

      const topics = payload.topicCategory ? [String(payload.topicCategory)] : payload.topic ? [String(payload.topic)] : [];
      const keywords = Array.isArray(payload.keywords)
        ? (payload.keywords as string[])
        : payload.keywords
          ? String(payload.keywords).split(",").map((s) => s.trim())
          : [];
      const coverage = payload.geographicCoverage ? [String(payload.geographicCoverage)] : payload.coverage ? [String(payload.coverage)] : [];

      const rawExtUrl = typeof payload.externalUrl === "string" ? payload.externalUrl.trim() : "";
      const validExternalUrl = rawExtUrl && /^https?:\/\/\S+/i.test(rawExtUrl) ? rawExtUrl : null;

      const rawThumbUrl = typeof payload.thumbnailUrl === "string" ? payload.thumbnailUrl.trim() : "";
      const validThumbnailUrl = rawThumbUrl && /^https?:\/\/\S+/i.test(rawThumbUrl) ? rawThumbUrl : null;

      const coverPayload = payload.coverFile as { name?: string; size?: number; storagePath?: string } | undefined;
      const coverAttachedPath = coverPayload?.storagePath || (typeof payload.coverFilePath === "string" ? payload.coverFilePath : undefined);

      let resolvedThumbnailUrl: string | null = null;
      if (coverAttachedPath) {
        resolvedThumbnailUrl = await publishResourceCover(
          input.subjectId,
          coverAttachedPath,
          coverPayload?.name || (typeof payload.coverFileName === "string" ? payload.coverFileName : undefined)
        );
      }
      if (!resolvedThumbnailUrl) {
        resolvedThumbnailUrl = validThumbnailUrl;
      }

      const resourceMetadata: Record<string, unknown> = {
        ...payload,
        coverFilePath: coverAttachedPath,
        coverFile: coverPayload,
        externalUrl: validExternalUrl,
        thumbnailUrl: resolvedThumbnailUrl,
        author_name: payload.author,
        contributor_name: payload.author,
        institution: payload.institution,
        country: payload.country,
        attached_resources: filePath
          ? [
              {
                fileName: fileData?.name || payload.fileName || "document.pdf",
                fileSize: fileData?.size || Number(payload.fileSize) || 0,
                filePath,
                fileType: (fileData?.name || String(payload.fileName || "")).toLowerCase().endsWith(".pdf")
                  ? "application/pdf"
                  : "application/octet-stream",
              },
            ]
          : [],
      };

      let relatedExpertIds: string[] = [];
      if (subj.submitted_by) {
        const { data: expertMatch } = await supabaseAdmin
          .from("experts")
          .select("id")
          .or(`created_by.eq.${subj.submitted_by},original_contributor_id.eq.${subj.submitted_by}`)
          .eq("current_status", "published")
          .limit(1)
          .maybeSingle();
        if (expertMatch?.id) {
          relatedExpertIds = [expertMatch.id];
        }
      }

      const resolvedTitle = (typeof payload.title === "string" && payload.title) || subj.title || "Untitled Resource";
      const resolvedSummary = (typeof payload.description === "string" && payload.description) || (typeof payload.abstract === "string" && payload.abstract) || "BARUNA public knowledge resource.";
      const resolvedAbstract = (typeof payload.abstract === "string" && payload.abstract) || (typeof payload.description === "string" && payload.description) || "BARUNA public knowledge resource.";
      const resolvedLanguage = typeof payload.language === "string" ? payload.language : "Indonesian";
      const resolvedYear = Number(payload.year) || new Date().getFullYear();
      const resolvedPublisher = typeof payload.institution === "string" ? payload.institution : "BARUNA Contributor";

      if (existingKr) {
        const { error: updateErr } = await supabaseAdmin
          .from("knowledge_resources")
          .update({
            current_status: "published",
            visibility: "public",
            verification_status: "governance_verified",
            approved_by: context.userId,
            published_by: context.userId,
            approval_date: new Date().toISOString(),
            publication_date: new Date().toISOString(),
            audit_ref: decisionId,
            resource_type: mappedType,
            title: resolvedTitle,
            summary: resolvedSummary,
            abstract: resolvedAbstract,
            language: resolvedLanguage,
            publication_year: resolvedYear,
            publisher: resolvedPublisher,
            external_url: validExternalUrl,
            thumbnail_url: resolvedThumbnailUrl,
            topics,
            keywords,
            geographic_focus: coverage,
            ...(relatedExpertIds.length > 0 ? { related_expert_ids: relatedExpertIds } : {}),
            metadata: resourceMetadata as never,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingKr.id);

        if (updateErr) {
          console.error("[recordAdminPublicationDecision] update knowledge_resources error:", updateErr);
          if (updateErr.code === "23505" || updateErr.message?.includes("ux_kr_extern_url_active")) {
            throw new Error("Gagal memperbarui: Tautan eksternal / repositori sudah digunakan oleh publikasi aktif lain.");
          }
          throw new Error(`Gagal memperbarui publikasi ke katalog Knowledge Hub: ${updateErr.message}`);
        }
      } else {
        const { error: insertErr } = await supabaseAdmin.from("knowledge_resources").insert({
          source_type: "external_submission",
          source_submission_id: input.subjectId,
          created_by: subj.submitted_by || context.userId,
          original_contributor_id: subj.submitted_by || context.userId,
          approved_by: context.userId,
          published_by: context.userId,
          approval_date: new Date().toISOString(),
          publication_date: new Date().toISOString(),
          verification_status: "governance_verified",
          visibility: "public",
          current_status: "published",
          audit_ref: decisionId,
          resource_type: mappedType,
          title: resolvedTitle,
          summary: resolvedSummary,
          abstract: resolvedAbstract,
          language: resolvedLanguage,
          publication_year: resolvedYear,
          publisher: resolvedPublisher,
          external_url: validExternalUrl,
          thumbnail_url: resolvedThumbnailUrl,
          topics,
          keywords,
          geographic_focus: coverage,
          ...(relatedExpertIds.length > 0 ? { related_expert_ids: relatedExpertIds } : {}),
          metadata: resourceMetadata as never,
        });

        if (insertErr) {
          console.error("[recordAdminPublicationDecision] insert knowledge_resources error:", insertErr);
          if (insertErr.code === "23505" || insertErr.message?.includes("ux_kr_extern_url_active")) {
            throw new Error("Gagal mempublikasikan: Tautan eksternal / repositori sudah digunakan oleh publikasi aktif lain.");
          }
          throw new Error(`Gagal mempublikasikan ke katalog Knowledge Hub: ${insertErr.message}`);
        }
      }

      // Ensure draft status is canonical ('submitted') if exists
      if (draft) {
        await supabaseAdmin
          .from("review_drafts")
          .update({
            status: "submitted",
            updated_at: new Date().toISOString(),
          })
          .eq("id", draft.id);
      }

      const { clearKnowledgeHubCache } = await import("@/lib/knowledge-hub/knowledge-hub.functions");
      clearKnowledgeHubCache();

      return { success: true, decisionId, decision: input.decision };
    }

    return { success: true, decisionId, decision: input.decision };
  });

