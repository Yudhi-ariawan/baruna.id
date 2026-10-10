import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { groupForType, type AccessLevel } from "@/lib/resources";

const SubmissionInput = z.object({
  draftId: z.string().uuid().optional(),
  submit: z.boolean(),
  form: z.record(z.unknown()),
});
const UploadInput = z.object({ fileName: z.string().min(1).max(240), mimeType: z.string().min(1).max(160), size: z.number().int().positive().max(52_428_800) });

type ResourceType = Database["public"]["Enums"]["resource_type_v1"];
const typeMap: Record<string, ResourceType> = {
  "Training Module": "module", "Presentation Slides": "training_material",
  "Technical Guideline": "guideline", "SOP / Manual": "guideline", Handbook: "book",
  "E-Book": "book", "Research Report": "technical_report", "Journal Article": "journal_article",
  "Policy Brief": "policy_brief", "Case Study": "case_study", "Best Practice": "best_practice",
  "Webinar Recording": "webinar_recording", Video: "video", Podcast: "podcast",
  Infographic: "infographic", "Photo Documentation": "poster", "Monitoring Template": "tool",
  "Assessment Tool": "tool", "Data Collection Form": "tool", Checklist: "tool", "Spreadsheet Tool": "tool",
};

export type KnowledgeContributorBootstrap = {
  userId: string;
  expertId: string | null;
  isTrainer: boolean;
  author: string;
  institution: string;
  country: string;
  expertiseAreas: string[];
  email: string;
};

export const getKnowledgeContributorBootstrap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KnowledgeContributorBootstrap> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile, error: profileError }, { data: expertLink, error: linkError }, identity] = await Promise.all([
      supabaseAdmin.from("profiles").select("display_name,organization,job_title,phone").eq("id", context.userId).single(),
      supabaseAdmin
        .from("experts")
        .select("id")
        .or(`original_contributor_id.eq.${context.userId},created_by.eq.${context.userId}`)
        .order("current_status", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(context.userId),
    ]);
    if (profileError || !profile) throw new Error("profile_not_found");
    if (linkError) throw new Error(linkError.message);
    const { data: expert, error: expertError } = expertLink
      ? await supabaseAdmin.from("experts_directory_v").select("id,display_name,institution,institution_role,country,expertise_areas").eq("id", expertLink.id).maybeSingle()
      : { data: null, error: null };
    if (expertError) throw new Error(expertError.message);

    const isTrainer = Boolean(expert);

    return {
      userId: context.userId,
      expertId: expert?.id ?? null,
      isTrainer,
      author: expert?.display_name ?? profile.display_name ?? (identity.data.user?.user_metadata?.full_name as string) ?? "",
      institution: expert?.institution ?? profile.organization ?? "",
      country: expert?.country ?? "Indonesia",
      expertiseAreas: expert?.expertise_areas ?? [],
      email: identity.data.user?.email ?? "",
    };
  });

export const saveKnowledgeResourceDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SubmissionInput.parse(input))
  .handler(async ({ context, data }) => {
    const form = data.form as Record<string, unknown>;
    const title = String(form.title ?? "").trim();
    if (!title) throw new Error("title_required");
    const resourceType = typeMap[String(form.type ?? "")] ?? "training_material";
    let draftId = data.draftId;
    if (!draftId) {
      const created = await context.supabase.rpc("kr_draft_create", {
        _title: title, _resource_type: resourceType, _source_type: "external_submission",
      });
      if (created.error) throw new Error(created.error.message);
      draftId = created.data;
    }
    const { data: expertLink } = await context.supabase
      .from("experts")
      .select("id")
      .or(`original_contributor_id.eq.${context.userId},created_by.eq.${context.userId}`)
      .order("current_status", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: expert } = expertLink
      ? await context.supabase.from("experts_directory_v").select("id,display_name,institution,country,expertise_areas").eq("id", expertLink.id).maybeSingle()
      : { data: null };

    // Enforce trainer requirement strictly on Training Modules
    if (resourceType === "module" && !expert) {
      throw new Error("Trainer / Expert role is required to submit Learning Modules.");
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name,organization")
      .eq("id", context.userId)
      .maybeSingle();

    const authorName = expert?.display_name ?? String(form.author ?? profile?.display_name ?? "BARUNA Contributor");
    const institution = expert?.institution ?? String(form.institution ?? profile?.organization ?? "");
    const country = expert?.country ?? String(form.country ?? "Indonesia");

    const patch: Json = {
      ...form,
      title,
      resource_type: resourceType,
      author_expert_id: expert?.id ?? null,
      author_name: authorName,
      institution,
      country,
      expertise_areas: expert?.expertise_areas ?? (form.keywords ? String(form.keywords).split(",").map((s) => s.trim()) : []),
      original_contributor_id: context.userId,
    } as Json;
    const updated = await context.supabase.rpc("kr_draft_update", { _draft_id: draftId, _patch: patch });
    if (updated.error) throw new Error(updated.error.message);
    if (data.submit) {
      const submitted = await context.supabase.rpc("kr_draft_submit", { _draft_id: draftId });
      if (submitted.error) throw new Error(submitted.error.message);

      // Update linked subject to resubmitted if previously revised
      const { data: dRow } = await context.supabase
        .from("review_drafts")
        .select("linked_subject_id")
        .eq("id", draftId)
        .single();

      if (dRow?.linked_subject_id) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: subj } = await supabaseAdmin
          .from("review_subjects")
          .select("current_status, metadata")
          .eq("id", dRow.linked_subject_id)
          .single();

        const sm = (subj?.metadata as Record<string, unknown>) ?? {};
        const wasRevised = sm.review_status === "revision_requested" || typeof sm.last_rationale === "string";

        await supabaseAdmin
          .from("review_subjects")
          .update({
            current_status: "pending",
            metadata: {
              ...sm,
              review_status: wasRevised ? "resubmitted" : "pending",
              resubmitted_at: wasRevised ? new Date().toISOString() : undefined,
            } as never,
            updated_at: new Date().toISOString(),
          })
          .eq("id", dRow.linked_subject_id);
      }
    }
    return { draftId, status: data.submit ? "submitted" : "draft" };
  });

export const createKnowledgeResourceUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UploadInput.parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `users/${context.userId}/resources/${Date.now()}-${safeName}`;
    let signedResult = await supabaseAdmin.storage.from("knowledge-resource-submissions").createSignedUploadUrl(path);
    if (signedResult.error && (signedResult.error.message?.includes("not exist") || (signedResult.error as { statusCode?: string }).statusCode === "404")) {
      await supabaseAdmin.storage.createBucket("knowledge-resource-submissions", { public: false, fileSizeLimit: 52428800 });
      signedResult = await supabaseAdmin.storage.from("knowledge-resource-submissions").createSignedUploadUrl(path);
    }
    if (signedResult.error || !signedResult.data) {
      throw new Error(signedResult.error?.message || "Failed to generate upload URL");
    }
    return { path, token: signedResult.data.token };
  });

export type KnowledgeContributionItem = {
  id: string;
  draftId?: string;
  resourceId?: string;
  title: string;
  type: string;
  typeGroup: string;
  status: "draft" | "submitted" | "under_review" | "approved" | "published" | "revision_requested" | "rejected";
  statusLabel: string;
  description?: string;
  topicCategory?: string;
  institution?: string;
  country?: string;
  createdAt: string;
  updatedAt: string;
  fileInfo?: { name: string; size?: number };
  reviewNote?: string;
  isResubmitted?: boolean;
};

export type SavedDraftDetail = {
  draftId: string;
  title: string;
  status: string;
  type: string;
  typeGroup: string;
  description: string;
  author: string;
  institution: string;
  country: string;
  year: string;
  language: string;
  keywords: string;
  topicCategory: string;
  externalUrl: string;
  accessLevel: AccessLevel;
  declaration: boolean;
  fileName?: string;
  fileSize?: number;
  filePath?: string;
};

export const getKnowledgeResourceDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ draftId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<SavedDraftDetail | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: draft, error } = await supabaseAdmin
      .from("review_drafts")
      .select("id, title, payload, status, linked_subject_id")
      .eq("id", data.draftId)
      .eq("submitter_id", context.userId)
      .maybeSingle();

    if (error || !draft) return null;
    const p = (draft.payload as Record<string, unknown>) ?? {};
    const fileObj = p.file as { name?: string; size?: number; storagePath?: string } | undefined;
    const { groupForType } = await import("@/lib/resources");
    const rawType = String(p.type || p.resource_type || "Research Report");

    return {
      draftId: draft.id,
      title: draft.title,
      status: draft.status,
      type: rawType,
      typeGroup: groupForType(rawType),
      description: String(p.description || p.abstract || ""),
      author: String(p.author || p.author_name || ""),
      institution: String(p.institution || ""),
      country: String(p.country || "Indonesia"),
      year: String(p.year || new Date().getFullYear()),
      language: String(p.language || "Indonesian"),
      keywords: Array.isArray(p.keywords) ? (p.keywords as string[]).join(", ") : String(p.keywords || ""),
      topicCategory: String(p.topicCategory || p.topic || "General"),
      externalUrl: String(p.externalUrl || ""),
      accessLevel: (p.accessLevel as AccessLevel) || "Open Access",
      declaration: Boolean(p.declaration),
      fileName: fileObj?.name || (typeof p.fileName === "string" ? p.fileName : undefined),
      fileSize: fileObj?.size || (typeof p.fileSize === "number" ? p.fileSize : undefined),
      filePath: fileObj?.storagePath || (typeof p.uploadedFilePath === "string" ? p.uploadedFilePath : undefined),
    };
  });

export const listMyKnowledgeContributions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KnowledgeContributionItem[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Get user's review_drafts of subject_kind = 'knowledge_resource'
    const { data: drafts, error: draftsError } = await supabaseAdmin
      .from("review_drafts")
      .select("id, title, payload, status, linked_subject_id, created_at, updated_at")
      .eq("submitter_id", context.userId)
      .eq("subject_kind", "knowledge_resource")
      .order("updated_at", { ascending: false });

    if (draftsError) {
      console.warn("[listMyKnowledgeContributions] drafts query error:", draftsError);
    }

    // 2. If there are linked subjects, fetch their status & metadata
    const subjectIds = (drafts ?? [])
      .map((d) => d.linked_subject_id)
      .filter((id): id is string => Boolean(id));

    const { data: subjects } = subjectIds.length > 0
      ? await supabaseAdmin
          .from("review_subjects")
          .select("id, current_status, metadata")
          .in("id", subjectIds)
      : { data: [] };

    const subjectMap = new Map((subjects ?? []).map((s) => [s.id, s]));

    // 3. Get published/approved knowledge_resources created by this user
    const { data: publishedKrs, error: krsError } = await supabaseAdmin
      .from("knowledge_resources")
      .select("id, title, resource_type, summary, abstract, topics, current_status, publication_date, metadata, created_at, updated_at")
      .or(`original_contributor_id.eq.${context.userId},created_by.eq.${context.userId}`)
      .order("updated_at", { ascending: false });

    if (krsError) {
      console.warn("[listMyKnowledgeContributions] krs query error:", krsError);
    }

    const { groupForType } = await import("@/lib/resources");

    const results: KnowledgeContributionItem[] = [];
    const seenTitles = new Set<string>();

    for (const d of drafts ?? []) {
      const payload = (d.payload as Record<string, unknown>) ?? {};
      const subject = d.linked_subject_id ? subjectMap.get(d.linked_subject_id) : undefined;
      const subMeta = (subject?.metadata as Record<string, unknown>) ?? {};

      let status: KnowledgeContributionItem["status"] = "draft";
      let statusLabel = "Draf";

      const isResubmitted =
        subMeta.review_status === "resubmitted" ||
        (d.status === "submitted" && (subMeta.review_status === "revision_requested" || typeof subMeta.last_rationale === "string"));

      if (d.status === "draft") {
        status = "draft";
        statusLabel = "Draf";
      } else if (subject?.current_status === "approved" || subMeta.review_status === "approved") {
        status = "approved";
        statusLabel = "Disetujui & Tayang";
      } else if (subject?.current_status === "rejected" || subMeta.review_status === "rejected") {
        status = "rejected";
        statusLabel = "Ditolak";
      } else if (isResubmitted) {
        status = "under_review";
        statusLabel = "Revisi Terkirim (Dalam Peninjauan)";
      } else if (subject?.current_status === "revision_requested" || subMeta.review_status === "revision_requested") {
        status = "revision_requested";
        statusLabel = "Perlu Revisi";
      } else {
        status = "under_review";
        statusLabel = "Dalam Peninjauan";
      }

      const rawType = String(payload.type ?? payload.resource_type ?? "Research Report");
      const fileData = payload.file as { name?: string; size?: number } | undefined;
      const note = typeof subMeta.last_rationale === "string" ? subMeta.last_rationale : typeof subMeta.review_note === "string" ? subMeta.review_note : undefined;

      results.push({
        id: d.id,
        draftId: d.id,
        title: d.title,
        type: rawType,
        typeGroup: groupForType(rawType),
        status,
        statusLabel,
        description: typeof payload.description === "string" ? payload.description : typeof payload.abstract === "string" ? payload.abstract : undefined,
        topicCategory: typeof payload.topicCategory === "string" ? payload.topicCategory : typeof payload.topic === "string" ? payload.topic : undefined,
        institution: typeof payload.institution === "string" ? payload.institution : undefined,
        country: typeof payload.country === "string" ? payload.country : undefined,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
        fileInfo: fileData?.name || payload.fileName ? { name: fileData?.name || String(payload.fileName), size: fileData?.size || Number(payload.fileSize) || undefined } : undefined,
        reviewNote: note,
        isResubmitted: Boolean(isResubmitted),
      });
      seenTitles.add(d.title.trim().toLowerCase());
    }

    for (const kr of publishedKrs ?? []) {
      if (seenTitles.has(kr.title.trim().toLowerCase())) continue;
      const rawType = String(kr.resource_type ?? "Journal Article");
      const krMeta = (kr.metadata as Record<string, unknown>) ?? {};
      results.push({
        id: kr.id,
        resourceId: kr.id,
        title: kr.title,
        type: rawType,
        typeGroup: groupForType(rawType),
        status: kr.current_status === "published" ? "published" : "approved",
        statusLabel: kr.current_status === "published" ? "Tayang di Katalog" : "Disetujui",
        description: kr.summary || kr.abstract || undefined,
        topicCategory: kr.topics?.[0] || undefined,
        institution: typeof krMeta.institution === "string" ? krMeta.institution : undefined,
        country: typeof krMeta.country === "string" ? krMeta.country : undefined,
        createdAt: kr.created_at,
        updatedAt: kr.updated_at,
      });
    }

    return results;
  });
