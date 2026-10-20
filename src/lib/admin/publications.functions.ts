import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  groupForType,
  type PolicyBriefStructure,
  type CaseStudyStructure,
  type InfographicStructure,
  type ToolkitStructure,
} from "@/lib/resources";
import { getYouTubeThumbnailUrl } from "@/lib/knowledge-hub/video-utils";

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
  submitterName: string | null;
  submitterEmail: string | null;
  submitterRole: string | null;
  title: string;
  type: string;
  typeGroup: string;
  topic: string | null;
  authorName: string;
  authorEmail: string | null;
  authorInstitution: string | null;
  authorCountry: string | null;
  status: "pending" | "under_review" | "approved" | "rejected" | "revision_requested" | "resubmitted" | "archived";
  statusLabel: string;
  isResubmitted?: boolean;
  resubmittedAt?: string | null;
  archivedReason?: string | null;
  archivedAt?: string | null;
  abstract: string | null;
  coverage: string | null;
  year: number | null;
  language: string | null;
  license: string | null;
  accessType: string | null;
  keywords: string[];
  duration?: string | null;
  speaker?: string | null;
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
  policyBriefStructure?: Partial<PolicyBriefStructure> | null;
  caseStudyStructure?: Partial<CaseStudyStructure> | null;
  infographicStructure?: Partial<InfographicStructure> | null;
  toolkitStructure?: Partial<ToolkitStructure> | null;
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
  archived: number;
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

    // 2. Fetch linked review_drafts (ordered ascending so the latest non-withdrawn draft wins in the Map)
    const { data: drafts } = await supabaseAdmin
      .from("review_drafts")
      .select("id, title, payload, status, linked_subject_id, submitter_id, created_at, updated_at")
      .eq("subject_kind", "knowledge_resource")
      .neq("status", "withdrawn")
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
          .select("id, source_submission_id, current_status, created_by, original_contributor_id")
          .in("source_submission_id", subjectIds)
      : { data: [] };

    const publishedBySubjId = new Map((publishedKrs ?? []).map((k) => [k.source_submission_id, k]));

    // 5. Fetch submitter profiles, participant_biodata, roles, and auth user emails
    const submitterIdsSet = new Set<string>();
    for (const subj of subjects ?? []) {
      const draft = draftBySubjectId.get(subj.id);
      const payload = (draft?.payload as Record<string, unknown>) ?? {};
      const published = publishedBySubjId.get(subj.id);
      const uid =
        subj.submitted_by ||
        draft?.submitter_id ||
        (typeof payload.original_contributor_id === "string" ? payload.original_contributor_id : null) ||
        published?.original_contributor_id ||
        published?.created_by ||
        null;
      if (uid) submitterIdsSet.add(uid);
    }
    const submitterIds = [...submitterIdsSet];

    const { data: profiles } = submitterIds.length > 0
      ? await supabaseAdmin
          .from("profiles")
          .select("id, display_name, organization, job_title, email")
          .in("id", submitterIds)
      : { data: [] };

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const biodataById = new Map<string, { nama?: string | null; instansi_unit_kerja?: string | null }>();
    if (submitterIds.length > 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: biodataRows } = await (supabaseAdmin as any)
          .from("participant_biodata")
          .select("user_id, nama, instansi_unit_kerja")
          .in("user_id", submitterIds);
        for (const row of biodataRows ?? []) {
          if (row.user_id) biodataById.set(row.user_id, row);
        }
      } catch {
        // Ignore if participant_biodata table is not migrated yet
      }
    }

    const rolesByUserId = new Map<string, Set<string>>();
    if (submitterIds.length > 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [{ data: rbacRows }, { data: legacyRoleRows }] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabaseAdmin as any)
            .from("rbac_user_roles")
            .select("user_id, rbac_roles(code)")
            .in("user_id", submitterIds)
            .eq("status", "active"),
          supabaseAdmin
            .from("user_roles")
            .select("user_id, role")
            .in("user_id", submitterIds),
        ]);
        for (const r of rbacRows ?? []) {
          const code = r.rbac_roles?.code;
          if (r.user_id && code) {
            if (!rolesByUserId.has(r.user_id)) rolesByUserId.set(r.user_id, new Set());
            rolesByUserId.get(r.user_id)!.add(String(code));
          }
        }
        for (const r of legacyRoleRows ?? []) {
          if (r.user_id && r.role) {
            if (!rolesByUserId.has(r.user_id)) rolesByUserId.set(r.user_id, new Set());
            rolesByUserId.get(r.user_id)!.add(String(r.role));
          }
        }
      } catch {
        // Ignore role lookup error
      }
    }

    const authUserById = new Map<
      string,
      { email?: string | null; user_metadata?: Record<string, unknown> }
    >();
    if (submitterIds.length > 0) {
      // Only query auth.admin for submitters whose contact email or profile is not resolved
      // to eliminate N+1 roundtrips and avoid HTTP 429 rate limits under high submission volume.
      const unresolvedSubmitterIds = submitterIds.filter((uid) => {
        const p = profileById.get(uid);
        const b = biodataById.get(uid);
        const hasEmail = Boolean(p?.email);
        const hasName = Boolean(p?.display_name || b?.nama);
        return !hasEmail || !hasName;
      });

      if (unresolvedSubmitterIds.length > 0) {
        const CHUNK_SIZE = 5;
        for (let i = 0; i < unresolvedSubmitterIds.length; i += CHUNK_SIZE) {
          const chunk = unresolvedSubmitterIds.slice(i, i + CHUNK_SIZE);
          await Promise.all(
            chunk.map(async (uid) => {
              try {
                const { data: uRes } = await supabaseAdmin.auth.admin.getUserById(uid);
                if (uRes?.user) {
                  authUserById.set(uid, {
                    email: uRes.user.email ?? null,
                    user_metadata: (uRes.user.user_metadata as Record<string, unknown>) ?? {},
                  });
                }
              } catch {
                // Ignore individual auth user lookup failure
              }
            }),
          );
        }
      }
    }

    // 6. Batch-generate signed URLs for all attached files and covers in 1 storage call (avoids N+1 sequential calls)
    const storagePathsSet = new Set<string>();
    for (const subj of subjects ?? []) {
      const draft = draftBySubjectId.get(subj.id);
      const payload = (draft?.payload as Record<string, unknown>) ?? {};
      const filePayload = payload.file as { storagePath?: string } | undefined;
      const attachedPath =
        filePayload?.storagePath ||
        (typeof payload.uploadedFilePath === "string" ? payload.uploadedFilePath : undefined);
      if (attachedPath) storagePathsSet.add(attachedPath);

      const coverPayload = payload.coverFile as { storagePath?: string } | undefined;
      const coverAttachedPath =
        coverPayload?.storagePath ||
        (typeof payload.coverFilePath === "string" ? payload.coverFilePath : undefined);
      if (coverAttachedPath) storagePathsSet.add(coverAttachedPath);
    }

    const signedUrlByPath = new Map<string, string>();
    const allStoragePaths = [...storagePathsSet];
    if (allStoragePaths.length > 0) {
      try {
        const { data: batchSigned } = await supabaseAdmin.storage
          .from("knowledge-resource-submissions")
          .createSignedUrls(allStoragePaths, 3600);
        for (const entry of batchSigned ?? []) {
          if (entry.path && entry.signedUrl) {
            signedUrlByPath.set(entry.path, entry.signedUrl);
          }
        }
      } catch {
        // Fallback ignored if bucket is empty or unreachable
      }
    }

    const items: AdminPublicationItem[] = [];

    for (const subj of subjects ?? []) {
      const draft = draftBySubjectId.get(subj.id);
      const subjMeta = (subj.metadata as Record<string, unknown>) ?? {};
      const payload = (draft?.payload as Record<string, unknown>) ?? {};
      const published = publishedBySubjId.get(subj.id);
      const effectiveSubmitterId =
        subj.submitted_by ||
        draft?.submitter_id ||
        (typeof payload.original_contributor_id === "string" ? payload.original_contributor_id : null) ||
        published?.original_contributor_id ||
        published?.created_by ||
        null;
      const profile = effectiveSubmitterId ? profileById.get(effectiveSubmitterId) : undefined;
      const biodata = effectiveSubmitterId ? biodataById.get(effectiveSubmitterId) : undefined;
      const authUser = effectiveSubmitterId ? authUserById.get(effectiveSubmitterId) : undefined;
      const userMeta = authUser?.user_metadata ?? {};
      const metaBiodata = (userMeta.participant_biodata as Record<string, unknown>) ?? {};
      const roleSet = effectiveSubmitterId ? (rolesByUserId.get(effectiveSubmitterId) ?? new Set<string>()) : new Set<string>();
      if (typeof userMeta.role === "string") roleSet.add(userMeta.role);

      const submitterEmail =
        (typeof profile?.email === "string" && profile.email.trim() ? profile.email.trim() : null) ||
        authUser?.email ||
        (typeof subjMeta.author_email === "string" && subjMeta.author_email) ||
        (typeof payload.email === "string" && payload.email) ||
        null;

      const submitterName =
        (typeof biodata?.nama === "string" && biodata.nama.trim()) ||
        (typeof metaBiodata.nama === "string" && metaBiodata.nama.trim()) ||
        (typeof profile?.display_name === "string" && profile.display_name.trim()) ||
        (typeof userMeta.display_name === "string" && userMeta.display_name.trim()) ||
        (typeof userMeta.full_name === "string" && userMeta.full_name.trim()) ||
        (typeof userMeta.name === "string" && userMeta.name.trim()) ||
        (submitterEmail ? submitterEmail.split("@")[0] : null);

      let submitterRole: string | null = null;
      if (roleSet.has("super_admin") || roleSet.has("admin")) {
        submitterRole = "Administrator";
      } else if (roleSet.has("expert") || roleSet.has("trainer")) {
        submitterRole = "Trainer / Pakar";
      } else if (roleSet.has("participant") || biodata?.nama || metaBiodata.nama) {
        submitterRole = "Peserta Pelatihan (Participant)";
      } else if (effectiveSubmitterId) {
        submitterRole = "Pengguna Terdaftar (Registered User)";
      }

      const subjDecisions = decisionsBySubject.get(subj.id) ?? [];
      const latestDec = subjDecisions[0];

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

      const isArchived =
        subj.current_status === "withdrawn" ||
        subj.current_status === "archived" ||
        subjMeta.review_status === "archived" ||
        subjMeta.last_decision === "archive" ||
        (published?.current_status === "archived" &&
          subj.current_status === "approved" &&
          subjMeta.review_status !== "revision_requested" &&
          subjMeta.review_status !== "resubmitted" &&
          subjMeta.review_status !== "rejected");

      if (isArchived) {
        status = "archived";
        statusLabel = "Diarsipkan (Tarik Tayang)";
      } else if (subj.current_status === "approved" || subjMeta.review_status === "approved" || published?.current_status === "published") {
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
      const downloadUrl = attachedPath ? (signedUrlByPath.get(attachedPath) ?? null) : null;

      const coverPayload = payload.coverFile as { name?: string; size?: number; storagePath?: string } | undefined;
      const coverAttachedPath = coverPayload?.storagePath || (typeof payload.coverFilePath === "string" ? payload.coverFilePath : undefined);
      const coverDownloadUrl = coverAttachedPath ? (signedUrlByPath.get(coverAttachedPath) ?? null) : null;

      const keywordsList = Array.isArray(payload.keywords)
        ? (payload.keywords as string[])
        : payload.keywords
          ? String(payload.keywords).split(",").map((s) => s.trim())
          : [];

      const archivedReason =
        isArchived
          ? (typeof subjMeta.archived_reason === "string" && subjMeta.archived_reason) ||
            (typeof subjMeta.last_rationale === "string" && subjMeta.last_rationale) ||
            null
          : null;
      const archivedAt =
        isArchived && typeof subjMeta.archived_at === "string" ? subjMeta.archived_at : null;

      const baseHistory = (subjDecisions ?? []).map((d) => ({
        id: d.id,
        decision: d.decision,
        rationale: d.rationale,
        decidedBy: d.decided_by,
        createdAt: d.created_at,
      }));
      const decisionsHistory =
        isArchived && archivedAt
          ? [
              {
                id: `archive-${subj.id}`,
                decision: "archive",
                rationale: archivedReason,
                decidedBy: typeof subjMeta.archived_by === "string" ? subjMeta.archived_by : null,
                createdAt: archivedAt,
              },
              ...baseHistory,
            ]
          : baseHistory;

      items.push({
        subjectId: subj.id,
        draftId: draft?.id ?? null,
        submitterId: effectiveSubmitterId,
        submitterName,
        submitterEmail,
        submitterRole,
        title: (typeof payload.title === "string" && payload.title) || subj.title || "Tanpa Judul",
        type: rawType,
        typeGroup: groupForType(rawType),
        topic: typeof payload.topicCategory === "string" ? payload.topicCategory : typeof payload.topic === "string" ? payload.topic : null,
        authorName: (typeof payload.author === "string" && payload.author) || submitterName || profile?.display_name || "Kontributor",
        authorEmail: (typeof payload.email === "string" && payload.email) || submitterEmail || null,
        authorInstitution: (typeof payload.institution === "string" && payload.institution) || biodata?.instansi_unit_kerja || profile?.organization || null,
        authorCountry: typeof payload.country === "string" ? payload.country : "Indonesia",
        status,
        statusLabel,
        isResubmitted: Boolean(isResubmitted),
        resubmittedAt,
        archivedReason,
        archivedAt,
        abstract: (typeof payload.abstract === "string" && payload.abstract) || (typeof payload.description === "string" && payload.description) || null,
        coverage: typeof payload.geographicCoverage === "string" ? payload.geographicCoverage : typeof payload.coverage === "string" ? payload.coverage : null,
        year: Number(payload.year) || null,
        language: typeof payload.language === "string" ? payload.language : "Indonesian",
        license: typeof payload.license === "string" ? payload.license : "CC BY-NC 4.0",
        accessType: typeof payload.accessType === "string" ? payload.accessType : "open",
        keywords: keywordsList,
        duration: typeof payload.duration === "string" && payload.duration.trim() ? payload.duration.trim() : null,
        speaker: typeof payload.speaker === "string" && payload.speaker.trim() ? payload.speaker.trim() : null,
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
        lastRevisionRationale:
          archivedReason ||
          latestDec?.rationale ||
          (typeof subjMeta.last_rationale === "string" ? subjMeta.last_rationale : null),
        practiceStructure:
          payload.practiceStructure && typeof payload.practiceStructure === "object" && !Array.isArray(payload.practiceStructure)
            ? (payload.practiceStructure as AdminPublicationItem["practiceStructure"])
            : null,
        policyBriefStructure:
          payload.policyBriefStructure && typeof payload.policyBriefStructure === "object" && !Array.isArray(payload.policyBriefStructure)
            ? (payload.policyBriefStructure as AdminPublicationItem["policyBriefStructure"])
            : null,
        caseStudyStructure:
          payload.caseStudyStructure && typeof payload.caseStudyStructure === "object" && !Array.isArray(payload.caseStudyStructure)
            ? (payload.caseStudyStructure as AdminPublicationItem["caseStudyStructure"])
            : null,
        infographicStructure:
          payload.infographicStructure && typeof payload.infographicStructure === "object" && !Array.isArray(payload.infographicStructure)
            ? (payload.infographicStructure as AdminPublicationItem["infographicStructure"])
            : null,
        toolkitStructure:
          payload.toolkitStructure && typeof payload.toolkitStructure === "object" && !Array.isArray(payload.toolkitStructure)
            ? (payload.toolkitStructure as AdminPublicationItem["toolkitStructure"])
            : null,
        createdAt: subj.created_at,
        updatedAt: subj.updated_at,
        isPublished: published?.current_status === "published" && !isArchived,
        publishedResourceId: published?.id ?? null,
        decisionsHistory,
      });
    }

    const stats: AdminPublicationStats = {
      total: items.length,
      pending: items.filter((i) => i.status === "pending" || i.status === "under_review" || i.status === "resubmitted").length,
      revision: items.filter((i) => i.status === "revision_requested").length,
      approved: items.filter((i) => i.status === "approved").length,
      rejected: items.filter((i) => i.status === "rejected").length,
      archived: items.filter((i) => i.status === "archived").length,
    };

    return { items, stats };
  });

const DecisionInput = z.object({
  subjectId: z.string().uuid(),
  decision: z.enum(["approve", "return_for_revision", "reject", "archive", "restore"]),
  rationale: z.string().max(5000).optional(),
  /** review_subjects.updated_at the admin was looking at (stops double clicks / two admins). */
  expectedUpdatedAt: z.string().max(64).optional(),
});

const KR_DECISION_ERRORS: Record<string, string> = {
  stale_subject: "Pengajuan ini baru saja diperbarui (oleh kurator lain atau kontributor). Muat ulang data lalu coba lagi.",
  self_decision_forbidden: "Anda tidak dapat memutuskan publikasi yang Anda ajukan sendiri.",
  archived_restore_first: "Publikasi berstatus arsip. Pulihkan terlebih dahulu sebelum mencatat keputusan baru.",
  not_archived: "Publikasi ini tidak sedang diarsipkan.",
  already_approved: "Publikasi ini sudah disetujui dan tayang.",
  awaiting_applicant_revision: "Kontributor sedang merevisi publikasi ini. Tunggu sampai revisi dikirim ulang.",
  already_rejected: "Publikasi ini sudah berstatus ditolak.",
  rejected_is_final: "Publikasi yang sudah ditolak tidak dapat dikembalikan untuk revisi.",
  already_awaiting_revision: "Publikasi ini sudah menunggu revisi dari kontributor.",
  subject_not_found: "Data submission publikasi tidak ditemukan.",
  resource_title_required: "Judul publikasi kosong; publikasi tidak dapat ditayangkan.",
  invalid_resource_type: "Jenis publikasi tidak dikenali katalog Knowledge Hub.",
  rationale_too_long: "Catatan keputusan terlalu panjang.",
  forbidden: "forbidden: hanya Approver atau Administrator yang dapat memutuskan, mengarsipkan, atau memulihkan publikasi.",
  "unsafe_url": "Tautan eksternal atau thumbnail tidak valid (harus diawali http:// atau https://).",
  ux_kr_extern_url_active: "Tautan eksternal / repositori sudah digunakan oleh publikasi aktif lain.",
  ux_kr_doi_active: "DOI sudah digunakan oleh publikasi aktif lain.",
  ux_kr_isbn_active: "ISBN sudah digunakan oleh publikasi aktif lain.",
};

function toFriendlyKrDecisionError(message: string | undefined | null): string {
  if (!message) return "Gagal memproses keputusan publikasi.";
  if (message.includes("Could not find the function") || message.includes("schema cache")) {
    return "Keputusan publikasi membutuhkan migrasi database 20261020060000. Jalankan supabase/check_migrations.sql.";
  }
  for (const [code, friendly] of Object.entries(KR_DECISION_ERRORS)) {
    if (message.includes(code)) return friendly;
  }
  return message;
}

/**
 * Catalog values for an approved submission, computed from the submitter's draft
 * exactly as before. The database (public.admin_kr_decide) writes them together
 * with the decision in one transaction. The uploaded cover is returned separately:
 * copying it to the public bucket is a storage operation and runs after commit.
 */
function buildCatalogValues(payload: Record<string, unknown>, fallbackTitle: string) {
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

  const attachedFileName = String(fileData?.name || payload.fileName || "document.pdf");
  const attachedLower = attachedFileName.toLowerCase();
  const isAttachedImage =
    /\.(jpg|jpeg|png|webp)$/i.test(attachedLower) || Boolean(fileData?.type && fileData.type.startsWith("image/"));
  const coverPayload = payload.coverFile as { name?: string; size?: number; storagePath?: string } | undefined;
  const coverAttachedPath =
    coverPayload?.storagePath ||
    (typeof payload.coverFilePath === "string" ? payload.coverFilePath : undefined) ||
    (isAttachedImage && filePath ? filePath : undefined);
  const coverName =
    coverPayload?.name || (typeof payload.coverFileName === "string" ? payload.coverFileName : attachedFileName);
  const thumbnailUrl = validThumbnailUrl || getYouTubeThumbnailUrl(validExternalUrl);

  const resolvedFileType = attachedLower.endsWith(".pdf")
    ? "application/pdf"
    : attachedLower.endsWith(".png")
      ? "image/png"
      : attachedLower.endsWith(".jpg") || attachedLower.endsWith(".jpeg")
        ? "image/jpeg"
        : attachedLower.endsWith(".webp")
          ? "image/webp"
          : attachedLower.endsWith(".mp4")
            ? "video/mp4"
            : attachedLower.endsWith(".webm")
              ? "video/webm"
              : attachedLower.endsWith(".mp3")
                ? "audio/mpeg"
                : attachedLower.endsWith(".wav")
                  ? "audio/wav"
                  : attachedLower.endsWith(".m4a")
                    ? "audio/mp4"
                    : fileData?.type || "application/octet-stream";

  const metadata: Record<string, unknown> = {
    ...payload,
    coverFilePath: coverAttachedPath,
    coverFile: coverPayload,
    externalUrl: validExternalUrl,
    thumbnailUrl,
    author_name: payload.author,
    contributor_name: payload.author,
    institution: payload.institution,
    country: payload.country,
    duration: typeof payload.duration === "string" && payload.duration.trim() ? payload.duration.trim() : undefined,
    speaker:
      (typeof payload.speaker === "string" && payload.speaker.trim()) ||
      (typeof payload.author === "string" && payload.author.trim()) ||
      undefined,
    videoKind: rawType,
    attached_resources: filePath
      ? [{ fileName: attachedFileName, fileSize: fileData?.size || Number(payload.fileSize) || 0, filePath, fileType: resolvedFileType }]
      : [],
  };

  const resource = {
    resource_type: mappedType,
    title: (typeof payload.title === "string" && payload.title) || fallbackTitle || "Untitled Resource",
    summary:
      (typeof payload.description === "string" && payload.description) ||
      (typeof payload.abstract === "string" && payload.abstract) ||
      "BARUNA public knowledge resource.",
    abstract:
      (typeof payload.abstract === "string" && payload.abstract) ||
      (typeof payload.description === "string" && payload.description) ||
      "BARUNA public knowledge resource.",
    language: typeof payload.language === "string" ? payload.language : "Indonesian",
    publication_year: String(Number(payload.year) || new Date().getFullYear()),
    publisher: typeof payload.institution === "string" ? payload.institution : "BARUNA Contributor",
    external_url: validExternalUrl,
    thumbnail_url: thumbnailUrl,
    topics,
    keywords,
    geographic_focus: coverage,
    metadata,
    author_name:
      (typeof payload.author === "string" && payload.author.trim()) ||
      (typeof payload.author_name === "string" && payload.author_name.trim()) ||
      "BARUNA Contributor",
    author_affiliation: (typeof payload.institution === "string" && payload.institution.trim()) || null,
    author_role: ["video", "webinar_recording", "podcast"].includes(mappedType) ? "Speaker / Contributor" : "Author",
  };
  return { resource, cover: coverAttachedPath ? { path: coverAttachedPath, name: coverName } : null };
}

/**
 * Decision, catalog publication, author record, draft status and audit entry run
 * in ONE database transaction (public.admin_kr_decide, migration 20261020060000):
 * a failure anywhere rolls everything back, the subject row is locked, and
 * `expectedUpdatedAt` stops a double click or a second admin from both winning.
 */
export const recordAdminPublicationDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => DecisionInput.parse(input))
  .handler(async ({ data: input, context }) => {
    if (!(await assertAdminOrReviewer(context))) {
      throw new Error("forbidden: Akses tidak mencukupi untuk mengambil keputusan kurasi.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let resource: ReturnType<typeof buildCatalogValues>["resource"] | null = null;
    let cover: ReturnType<typeof buildCatalogValues>["cover"] = null;
    if (input.decision === "approve") {
      const { data: subj, error: subjErr } = await supabaseAdmin
        .from("review_subjects")
        .select("id, title, submitted_by")
        .eq("id", input.subjectId)
        .eq("kind", "knowledge_resource")
        .maybeSingle();
      if (subjErr) throw new Error(subjErr.message);
      if (!subj) throw new Error("Data submission publikasi tidak ditemukan.");
      // Same rule as the database: only the submitter's own draft counts.
      const { data: draft, error: draftErr } = await supabaseAdmin
        .from("review_drafts")
        .select("title, payload")
        .eq("linked_subject_id", input.subjectId)
        .eq("submitter_id", subj.submitted_by)
        .neq("status", "withdrawn")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (draftErr) throw new Error(draftErr.message);
      const payload = (draft?.payload as Record<string, unknown>) ?? {};
      ({ resource, cover } = buildCatalogValues(payload, draft?.title || subj.title));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (context.supabase as any).rpc("admin_kr_decide", {
      _subject_id: input.subjectId,
      _decision: input.decision,
      _rationale: input.rationale?.trim() || null,
      _expected_updated_at: input.expectedUpdatedAt ?? null,
      _resource: resource,
    });
    if (error) throw new Error(toFriendlyKrDecisionError(error.message));
    const outcome = (result ?? {}) as { decisionId?: string | null; resourceId?: string | null; status?: string };

    // After commit: copy the uploaded cover to the public bucket. Cosmetic and
    // idempotent; on failure the resource keeps the thumbnail chosen above.
    if (input.decision === "approve" && cover && outcome.resourceId) {
      try {
        const coverUrl = await publishResourceCover(input.subjectId, cover.path, cover.name);
        if (coverUrl && resource) {
          const { error: coverErr } = await supabaseAdmin
            .from("knowledge_resources")
            .update({ thumbnail_url: coverUrl, metadata: { ...resource.metadata, thumbnailUrl: coverUrl } as never })
            .eq("id", outcome.resourceId);
          if (coverErr) console.error("[recordAdminPublicationDecision] cover update failed:", coverErr.message);
        }
      } catch (coverErr) {
        console.error("[recordAdminPublicationDecision] cover publish failed:", coverErr);
      }
    }

    const { clearKnowledgeHubCache } = await import("@/lib/knowledge-hub/knowledge-hub.functions");
    clearKnowledgeHubCache();

    return {
      success: true,
      decisionId: outcome.decisionId ?? `${input.decision}-${input.subjectId}`,
      decision: input.decision,
      status: outcome.status ?? null,
    };
  });