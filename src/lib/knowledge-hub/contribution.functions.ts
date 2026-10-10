import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { groupForType, type AccessLevel } from "@/lib/resources";
import { extractYouTubeVideoId, extractVimeoVideoId } from "@/lib/knowledge-hub/video-utils";

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

const reverseTypeMap: Record<string, string> = {
  module: "Training Module",
  training_material: "Presentation Slides",
  guideline: "Technical Guideline",
  book: "Handbook",
  technical_report: "Research Report",
  journal_article: "Journal Article",
  policy_brief: "Policy Brief",
  case_study: "Case Study",
  best_practice: "Best Practice",
  webinar_recording: "Webinar Recording",
  video: "Video",
  podcast: "Podcast",
  infographic: "Infographic",
  poster: "Photo Documentation",
  tool: "Monitoring Template",
  toolkit: "Monitoring Template",
};

function normalizeUiResourceType(raw: unknown): string {
  const str = String(raw ?? "").trim();
  if (!str) return "Research Report";
  if (typeMap[str]) return str;
  return reverseTypeMap[str] ?? str;
}

function normalizeExternalUrlForComparison(url: string): string {
  return url.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
}

export type KnowledgeContributorBootstrap = {
  userId: string;
  expertId: string | null;
  isTrainer: boolean;
  isParticipant: boolean;
  contributorRole: "trainer" | "participant" | "registered_user";
  contributorRoleLabel: string;
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
    const [
      { data: profileRow },
      { data: expertLink },
      identity,
      bioRowRes,
      roleAssignRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("display_name,organization,job_title,phone")
        .eq("id", context.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("experts")
        .select("id")
        .eq("current_status", "published")
        .or(`original_contributor_id.eq.${context.userId},created_by.eq.${context.userId}`)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(context.userId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any)
        .from("participant_biodata")
        .select("nama, instansi_unit_kerja")
        .eq("user_id", context.userId)
        .maybeSingle()
        .then(
          (res: { data?: { nama?: string; instansi_unit_kerja?: string } | null }) => res.data ?? null,
          () => null,
        ),
      supabaseAdmin
        .from("rbac_user_roles")
        .select("rbac_roles!inner(code)")
        .eq("user_id", context.userId)
        .eq("status", "active"),
    ]);

    const userMeta = (identity.data.user?.user_metadata as Record<string, unknown>) ?? {};
    const metaBiodata =
      userMeta.participant_biodata && typeof userMeta.participant_biodata === "object"
        ? (userMeta.participant_biodata as Record<string, unknown>)
        : null;
    const email = identity.data.user?.email ?? "";
    const fallbackDisplayName =
      (typeof bioRowRes?.nama === "string" && bioRowRes.nama.trim()) ||
      (typeof metaBiodata?.nama === "string" && metaBiodata.nama.trim()) ||
      (typeof userMeta.display_name === "string" && userMeta.display_name.trim()) ||
      (typeof userMeta.full_name === "string" && userMeta.full_name.trim()) ||
      email.split("@")[0] ||
      "Kontributor BARUNA";
    const fallbackOrganization =
      (typeof bioRowRes?.instansi_unit_kerja === "string" && bioRowRes.instansi_unit_kerja.trim()) ||
      (typeof metaBiodata?.instansiUnitKerja === "string" && metaBiodata.instansiUnitKerja.trim()) ||
      (typeof userMeta.organization === "string" && userMeta.organization.trim()) ||
      "";

    let profile = profileRow;
    if (!profile) {
      try {
        const { data: createdProfile } = await supabaseAdmin
          .from("profiles")
          .upsert(
            {
              id: context.userId,
              display_name: fallbackDisplayName,
              organization: fallbackOrganization || null,
            },
            { onConflict: "id" },
          )
          .select("display_name,organization,job_title,phone")
          .maybeSingle();
        profile = createdProfile ?? {
          display_name: fallbackDisplayName,
          organization: fallbackOrganization || null,
          job_title: null,
          phone: null,
        };
      } catch {
        profile = {
          display_name: fallbackDisplayName,
          organization: fallbackOrganization || null,
          job_title: null,
          phone: null,
        };
      }
    }

    const { data: expert } = expertLink
      ? await supabaseAdmin
          .from("experts_directory_v")
          .select("id,display_name,institution,institution_role,country,expertise_areas")
          .eq("id", expertLink.id)
          .maybeSingle()
      : { data: null };

    const activeRoleCodes = new Set(
      (roleAssignRes.data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => String(r.rbac_roles?.code ?? ""))
        .filter(Boolean),
    );

    const isTrainer = Boolean(expert) || activeRoleCodes.has("expert") || activeRoleCodes.has("trainer");
    const isParticipant =
      !isTrainer &&
      (activeRoleCodes.has("participant") ||
        activeRoleCodes.has("alumni") ||
        Boolean(bioRowRes?.nama) ||
        Boolean(metaBiodata?.nip) ||
        userMeta.role === "participant");

    const contributorRole: KnowledgeContributorBootstrap["contributorRole"] = isTrainer
      ? "trainer"
      : isParticipant
        ? "participant"
        : "registered_user";

    const contributorRoleLabel = isTrainer
      ? "Trainer / Pakar BARUNA"
      : isParticipant
        ? "Peserta Pelatihan (Participant)"
        : "Pengguna Terdaftar (Registered User)";

    const biodataName =
      (typeof bioRowRes?.nama === "string" && bioRowRes.nama.trim()) ||
      (typeof metaBiodata?.nama === "string" && metaBiodata.nama.trim()) ||
      "";
    const biodataOrganization =
      (typeof bioRowRes?.instansi_unit_kerja === "string" && bioRowRes.instansi_unit_kerja.trim()) ||
      (typeof metaBiodata?.instansiUnitKerja === "string" && metaBiodata.instansiUnitKerja.trim()) ||
      "";

    return {
      userId: context.userId,
      expertId: expert?.id ?? null,
      isTrainer,
      isParticipant,
      contributorRole,
      contributorRoleLabel,
      author:
        (expert?.display_name && expert.display_name.trim()) ||
        biodataName ||
        (profile?.display_name && profile.display_name.trim()) ||
        fallbackDisplayName,
      institution:
        (expert?.institution && expert.institution.trim()) ||
        biodataOrganization ||
        (profile?.organization && profile.organization.trim()) ||
        fallbackOrganization,
      country: expert?.country ?? "Indonesia",
      expertiseAreas: expert?.expertise_areas ?? [],
      email,
    };
  });

export const saveKnowledgeResourceDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SubmissionInput.parse(input))
  .handler(async ({ context, data }) => {
    const form = data.form as Record<string, unknown>;
    const rawTitle = String(form.title ?? "").trim();
    if (!rawTitle && data.submit) {
      throw new Error("Judul publikasi wajib diisi sebelum mengirim pengajuan.");
    }
    const title = rawTitle || (form.type ? `Draf Publikasi - ${form.type}` : "Draf Publikasi Baru");
    const resourceType = typeMap[String(form.type ?? "")] ?? "training_material";
    // Enforce canonical 7-document module submission pipeline for Learning Modules
    if (resourceType === "module") {
      throw new Error(
        "Pengajuan Learning Module wajib melalui Portal Pengajuan Modul Pembelajaran (/experts/portal/submit-module) agar kelengkapan 7 dokumen standar dan registrasi Academy terdata penuh.",
      );
    }

    let draftId = data.draftId;
    if (!draftId) {
      const created = await context.supabase.rpc("kr_draft_create", {
        _title: title, _resource_type: resourceType, _source_type: "external_submission",
      });
      if (created.error) throw new Error(created.error.message);
      draftId = created.data;
    } else {
      // Idempotency guard: if a fast double-click or network retry replays a submit
      // request for a draft that was just submitted, return success cleanly.
      const { data: existingDraft } = await context.supabase
        .from("review_drafts")
        .select("status, linked_subject_id")
        .eq("id", draftId)
        .maybeSingle();
      if (data.submit && existingDraft?.status === "submitted" && existingDraft.linked_subject_id) {
        return { draftId, status: "submitted" };
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: expertLink }, { data: profile }, biodata, identity] = await Promise.all([
      supabaseAdmin
        .from("experts")
        .select("id")
        .eq("current_status", "published")
        .or(`original_contributor_id.eq.${context.userId},created_by.eq.${context.userId}`)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("display_name,organization")
        .eq("id", context.userId)
        .maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any)
        .from("participant_biodata")
        .select("nama, instansi_unit_kerja")
        .eq("user_id", context.userId)
        .maybeSingle()
        .then(
          (res: { data?: { nama?: string; instansi_unit_kerja?: string } | null }) => res.data ?? null,
          () => null,
        ),
      supabaseAdmin.auth.admin.getUserById(context.userId),
    ]);

    const userMeta = (identity?.data?.user?.user_metadata as Record<string, unknown>) ?? {};
    const metaBiodata =
      userMeta.participant_biodata && typeof userMeta.participant_biodata === "object"
        ? (userMeta.participant_biodata as Record<string, unknown>)
        : null;

    const { data: expert } = expertLink
      ? await supabaseAdmin
          .from("experts_directory_v")
          .select("id,display_name,institution,country,expertise_areas")
          .eq("id", expertLink.id)
          .maybeSingle()
      : { data: null };

    const authorName =
      (typeof form.author === "string" && form.author.trim()) ||
      expert?.display_name ||
      biodata?.nama?.trim() ||
      (typeof metaBiodata?.nama === "string" && metaBiodata.nama.trim()) ||
      profile?.display_name ||
      "BARUNA Contributor";
    const institution =
      (typeof form.institution === "string" && form.institution.trim()) ||
      expert?.institution ||
      biodata?.instansi_unit_kerja?.trim() ||
      (typeof metaBiodata?.instansiUnitKerja === "string" && metaBiodata.instansiUnitKerja.trim()) ||
      profile?.organization ||
      "";
    const country =
      (typeof form.country === "string" && form.country.trim()) ||
      expert?.country ||
      "Indonesia";

    const rawExtUrl = typeof form.externalUrl === "string" ? form.externalUrl.trim() : "";
    const cleanExternalUrl = rawExtUrl && /^https?:\/\/\S+/i.test(rawExtUrl) ? rawExtUrl : undefined;

    const coverObj = form.coverFile as { name?: string; size?: number; storagePath?: string } | undefined;
    if (coverObj?.size && coverObj.size > 2 * 1024 * 1024) {
      throw new Error("Ukuran foto banner melebihi batas maksimal 2MB.");
    }

    const fileObj = form.file as { name?: string; size?: number; storagePath?: string; type?: string } | undefined;
    if (fileObj?.size) {
      const fileNameLower = (fileObj.name || "").toLowerCase();
      const isPdf = fileNameLower.endsWith(".pdf");
      const isPpt = fileNameLower.endsWith(".ppt") || fileNameLower.endsWith(".pptx");
      if (isPdf && fileObj.size > 10 * 1024 * 1024) {
        throw new Error("Ukuran file PDF melebihi batas maksimal 10MB.");
      }
      if (isPpt && fileObj.size > 25 * 1024 * 1024) {
        throw new Error("Ukuran file presentasi (PPT/PPTX) melebihi batas maksimal 25MB.");
      }
      if (fileObj.size > 50 * 1024 * 1024) {
        throw new Error("Ukuran file melebihi batas maksimal 50MB.");
      }
    }

    if (data.submit && !fileObj?.storagePath && !cleanExternalUrl) {
      throw new Error("Wajib menyertakan minimal salah satu: berkas dokumen atau tautan eksternal.");
    }

    // Check duplicate external URL if submitting (safe against SQL wildcard '_', self-revisions, and concurrent pending submissions)
    if (cleanExternalUrl && data.submit) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: currentDraftRow } = await supabaseAdmin
        .from("review_drafts")
        .select("linked_subject_id")
        .eq("id", draftId)
        .maybeSingle();

      const normTarget = normalizeExternalUrlForComparison(cleanExternalUrl);
      const targetYtId = extractYouTubeVideoId(cleanExternalUrl);
      const targetVimeoId = extractVimeoVideoId(cleanExternalUrl);

      const isMatchingExternalUrl = (candidateUrl: string | null | undefined): boolean => {
        if (!candidateUrl || !candidateUrl.trim()) return false;
        if (normalizeExternalUrlForComparison(candidateUrl) === normTarget) return true;
        if (targetYtId && extractYouTubeVideoId(candidateUrl) === targetYtId) return true;
        if (targetVimeoId && extractVimeoVideoId(candidateUrl) === targetVimeoId) return true;
        return false;
      };

      const { data: activeWithUrls } = await supabaseAdmin
        .from("knowledge_resources")
        .select("id, title, external_url, source_submission_id")
        .neq("current_status", "archived")
        .not("external_url", "is", null);

      const conflict = (activeWithUrls ?? []).find((row) => {
        if (currentDraftRow?.linked_subject_id && row.source_submission_id === currentDraftRow.linked_subject_id) {
          return false;
        }
        return isMatchingExternalUrl(row.external_url);
      });

      if (conflict) {
        throw new Error(
          `Tautan eksternal / video ini sudah terdaftar pada publikasi aktif lain di Knowledge Hub ("${conflict.title}").`,
        );
      }

      // Also check other active submitted drafts in the curation queue so two identical URLs don't collide at approval time
      const { data: submittedDrafts } = await supabaseAdmin
        .from("review_drafts")
        .select("id, title, payload, linked_subject_id")
        .eq("subject_kind", "knowledge_resource")
        .eq("status", "submitted")
        .neq("id", draftId);

      const candidatePendingDrafts = (submittedDrafts ?? []).filter((d) => {
        if (currentDraftRow?.linked_subject_id && d.linked_subject_id === currentDraftRow.linked_subject_id) {
          return false;
        }
        const p = (d.payload as Record<string, unknown>) ?? {};
        const dUrl = typeof p.externalUrl === "string" ? p.externalUrl : null;
        return isMatchingExternalUrl(dUrl);
      });

      if (candidatePendingDrafts.length > 0) {
        const pendingSubjectIds = candidatePendingDrafts
          .map((d) => d.linked_subject_id)
          .filter((id): id is string => Boolean(id));
        const { data: pendingSubjects } = pendingSubjectIds.length > 0
          ? await supabaseAdmin
              .from("review_subjects")
              .select("id, current_status, metadata")
              .in("id", pendingSubjectIds)
          : { data: [] };
        const activeQueueSubj = (pendingSubjects ?? []).find((s) => {
          const sm = (s.metadata as Record<string, unknown>) ?? {};
          return (
            s.current_status !== "rejected" &&
            s.current_status !== "withdrawn" &&
            sm.review_status !== "rejected" &&
            sm.review_status !== "archived"
          );
        });
        if (activeQueueSubj) {
          const matchingDraft = candidatePendingDrafts.find((d) => d.linked_subject_id === activeQueueSubj.id);
          throw new Error(
            `Tautan eksternal / video ini sedang dalam antrean kurasi pada pengajuan aktif lain ("${matchingDraft?.title || "Pengajuan Publikasi"}").`,
          );
        }
      }
    }

    const rawPractice =
      form.practiceStructure && typeof form.practiceStructure === "object" && !Array.isArray(form.practiceStructure)
        ? (form.practiceStructure as Record<string, unknown>)
        : null;
    const practiceStructure = rawPractice
      ? {
          challenge: String(rawPractice.challenge ?? "").trim(),
          context: String(rawPractice.context ?? "").trim(),
          intervention: String(rawPractice.intervention ?? "").trim(),
          steps: String(rawPractice.steps ?? "").trim(),
          stakeholders: String(rawPractice.stakeholders ?? "").trim(),
          results: String(rawPractice.results ?? "").trim(),
          lessons: String(rawPractice.lessons ?? "").trim(),
          replication: String(rawPractice.replication ?? "").trim(),
        }
      : null;

    if (data.submit && resourceType === "best_practice") {
      if (
        !practiceStructure?.challenge ||
        !practiceStructure?.context ||
        !practiceStructure?.intervention ||
        !practiceStructure?.steps ||
        !practiceStructure?.results ||
        !practiceStructure?.lessons
      ) {
        throw new Error(
          "Untuk tipe Best Practice, kolom Tantangan, Konteks Lokasi, Intervensi, Langkah Implementasi, Capaian Terukur, dan Pembelajaran Kunci wajib dilengkapi."
        );
      }
    }

    const patch: Json = {
      ...form,
      duration: typeof form.duration === "string" && form.duration.trim() ? form.duration.trim() : null,
      speaker: typeof form.speaker === "string" && form.speaker.trim() ? form.speaker.trim() : authorName,
      videoKind: typeof form.type === "string" ? form.type : null,
      coverFile: coverObj ?? null,
      coverFilePath: coverObj?.storagePath ?? null,
      file: fileObj ?? null,
      filePath: fileObj?.storagePath ?? null,
      uploadedFilePath: fileObj?.storagePath ?? null,
      externalUrl: cleanExternalUrl ?? null,
      practiceStructure,
      geographicCoverage:
        (typeof form.geographicCoverage === "string" && form.geographicCoverage.trim()) ||
        practiceStructure?.context ||
        null,
      title,
      resource_type: resourceType,
      author_expert_id: expert?.id ?? null,
      author_name: authorName,
      author: authorName,
      institution,
      country,
      expertise_areas: expert?.expertise_areas ?? (form.keywords ? String(form.keywords).split(",").map((s) => s.trim()) : []),
      original_contributor_id: context.userId,
      ...(data.submit ? { last_submitted_at: new Date().toISOString() } : {}),
    } as Json;
    const updated = await context.supabase.rpc("kr_draft_update", { _draft_id: draftId, _patch: patch });
    if (updated.error) {
      if (updated.error.message?.includes("draft_not_editable")) {
        throw new Error("Pengajuan ini sedang dalam proses kurasi dan tidak dapat diubah sebelum ada permintaan revisi dari kurator.");
      }
      throw new Error(updated.error.message);
    }
    if (data.submit) {
      const submitted = await context.supabase.rpc("kr_draft_submit", { _draft_id: draftId });
      if (submitted.error) {
        if (submitted.error.message?.includes("draft_not_editable")) {
          const { data: checkSubmitted } = await context.supabase
            .from("review_drafts")
            .select("status, linked_subject_id")
            .eq("id", draftId)
            .maybeSingle();
          if (checkSubmitted?.status === "submitted" && checkSubmitted.linked_subject_id) {
            return { draftId, status: "submitted" };
          }
        }
        throw new Error(submitted.error.message);
      }

      // Update linked subject to resubmitted if previously revised, and sync latest title
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
            title,
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
  status: "draft" | "submitted" | "under_review" | "approved" | "published" | "revision_requested" | "rejected" | "archived";
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
  duration?: string;
  speaker?: string;
  externalUrl: string;
  accessLevel: AccessLevel;
  declaration: boolean;
  practiceStructure?: {
    challenge: string;
    context: string;
    intervention: string;
    steps: string;
    stakeholders: string;
    results: string;
    lessons: string;
    replication: string;
  };
  fileName?: string;
  fileSize?: number;
  filePath?: string;
  coverFileName?: string;
  coverFileSize?: number;
  coverFilePath?: string;
  coverPreviewUrl?: string;
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
    const coverObj = p.coverFile as { name?: string; size?: number; storagePath?: string } | undefined;
    const rawPractice =
      p.practiceStructure && typeof p.practiceStructure === "object" && !Array.isArray(p.practiceStructure)
        ? (p.practiceStructure as Record<string, unknown>)
        : undefined;
    const { groupForType } = await import("@/lib/resources");
    const rawType = normalizeUiResourceType(p.type || p.resource_type || "Research Report");

    const coverPath = coverObj?.storagePath || (typeof p.coverFilePath === "string" ? p.coverFilePath : undefined);
    let coverPreviewUrl: string | undefined = undefined;
    if (coverPath) {
      try {
        const { data: signedCover } = await supabaseAdmin.storage
          .from("knowledge-resource-submissions")
          .createSignedUrl(coverPath, 3600);
        coverPreviewUrl = signedCover?.signedUrl ?? undefined;
      } catch {
        // ignore
      }
    }

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
      duration: typeof p.duration === "string" ? p.duration : "",
      speaker: typeof p.speaker === "string" ? p.speaker : "",
      externalUrl: String(p.externalUrl || ""),
      accessLevel: (p.accessLevel as AccessLevel) || "Open Access",
      declaration: Boolean(p.declaration),
      practiceStructure: rawPractice
        ? {
            challenge: String(rawPractice.challenge ?? ""),
            context: String(rawPractice.context ?? ""),
            intervention: String(rawPractice.intervention ?? ""),
            steps: String(rawPractice.steps ?? ""),
            stakeholders: String(rawPractice.stakeholders ?? ""),
            results: String(rawPractice.results ?? ""),
            lessons: String(rawPractice.lessons ?? ""),
            replication: String(rawPractice.replication ?? ""),
          }
        : undefined,
      fileName: fileObj?.name || (typeof p.fileName === "string" ? p.fileName : undefined),
      fileSize: fileObj?.size || (typeof p.fileSize === "number" ? p.fileSize : undefined),
      filePath: fileObj?.storagePath || (typeof p.uploadedFilePath === "string" ? p.uploadedFilePath : undefined),
      coverFileName: coverObj?.name || (typeof p.coverFileName === "string" ? p.coverFileName : (coverPath ? "banner-image.jpg" : undefined)),
      coverFileSize: coverObj?.size || (typeof p.coverFileSize === "number" ? p.coverFileSize : undefined),
      coverFilePath: coverPath,
      coverPreviewUrl,
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
      .select("id, title, resource_type, summary, abstract, topics, current_status, publication_date, source_submission_id, metadata, created_at, updated_at")
      .or(`original_contributor_id.eq.${context.userId},created_by.eq.${context.userId}`)
      .order("updated_at", { ascending: false });

    if (krsError) {
      console.warn("[listMyKnowledgeContributions] krs query error:", krsError);
    }

    const krBySubmissionId = new Map(
      (publishedKrs ?? [])
        .filter((k) => Boolean(k.source_submission_id))
        .map((k) => [k.source_submission_id as string, k]),
    );
    const krByLegacyTitle = new Map(
      (publishedKrs ?? [])
        .filter((k) => !k.source_submission_id)
        .map((k) => [k.title.trim().toLowerCase(), k]),
    );

    const { groupForType } = await import("@/lib/resources");

    const results: KnowledgeContributionItem[] = [];
    const seenTitles = new Set<string>();
    const seenKrIds = new Set<string>();
    const seenSubjectIds = new Set<string>();

    for (const d of drafts ?? []) {
      if (d.status === "withdrawn") continue;
      if (d.linked_subject_id) {
        if (seenSubjectIds.has(d.linked_subject_id)) continue;
        seenSubjectIds.add(d.linked_subject_id);
      }

      const payload = (d.payload as Record<string, unknown>) ?? {};
      const subject = d.linked_subject_id ? subjectMap.get(d.linked_subject_id) : undefined;
      const subMeta = (subject?.metadata as Record<string, unknown>) ?? {};
      const matchedKr = d.linked_subject_id
        ? krBySubmissionId.get(d.linked_subject_id)
        : d.status !== "draft"
          ? krByLegacyTitle.get(d.title.trim().toLowerCase())
          : undefined;
      if (matchedKr) {
        seenKrIds.add(matchedKr.id);
      }

      let status: KnowledgeContributionItem["status"] = "draft";
      let statusLabel = "Draf";

      const isArchived =
        subject?.current_status === "withdrawn" ||
        subject?.current_status === "archived" ||
        subMeta.review_status === "archived" ||
        matchedKr?.current_status === "archived";

      const isResubmitted =
        !isArchived &&
        d.status === "submitted" &&
        (subMeta.review_status === "resubmitted" ||
          subMeta.review_status === "revision_requested" ||
          typeof subMeta.last_rationale === "string");

      if (isArchived) {
        status = "archived";
        statusLabel = "Diarsipkan";
      } else if (subject?.current_status === "approved" || subMeta.review_status === "approved" || matchedKr?.current_status === "published") {
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
      } else if (d.status === "draft") {
        status = "draft";
        statusLabel = "Draf";
      } else {
        status = "under_review";
        statusLabel = "Dalam Peninjauan";
      }

      const rawType = normalizeUiResourceType(payload.type ?? payload.resource_type ?? "Research Report");
      const fileData = payload.file as { name?: string; size?: number } | undefined;
      const note =
        isArchived && typeof subMeta.archived_reason === "string"
          ? subMeta.archived_reason
          : typeof subMeta.last_rationale === "string"
            ? subMeta.last_rationale
            : typeof subMeta.review_note === "string"
              ? subMeta.review_note
              : undefined;

      results.push({
        id: d.id,
        draftId: d.id,
        resourceId: matchedKr?.id,
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
      if (seenKrIds.has(kr.id)) continue;
      if (!kr.source_submission_id && seenTitles.has(kr.title.trim().toLowerCase())) continue;
      const krMeta = (kr.metadata as Record<string, unknown>) ?? {};
      const rawType = normalizeUiResourceType(krMeta.type ?? krMeta.videoKind ?? kr.resource_type ?? "Journal Article");
      const isKrArchived = kr.current_status === "archived";
      results.push({
        id: kr.id,
        resourceId: kr.id,
        title: kr.title,
        type: rawType,
        typeGroup: groupForType(rawType),
        status: isKrArchived ? "archived" : kr.current_status === "published" ? "published" : "approved",
        statusLabel: isKrArchived ? "Diarsipkan" : kr.current_status === "published" ? "Tayang di Katalog" : "Disetujui",
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
