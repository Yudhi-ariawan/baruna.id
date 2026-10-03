import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";

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

export const getKnowledgeContributorBootstrap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile, error: profileError }, { data: expertLink, error: linkError }, identity] = await Promise.all([
      supabaseAdmin.from("profiles").select("display_name,organization,job_title,phone").eq("id", context.userId).single(),
      supabaseAdmin.from("experts").select("id").eq("original_contributor_id", context.userId).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(context.userId),
    ]);
    if (profileError || !profile) throw new Error("profile_not_found");
    if (linkError) throw new Error(linkError.message);
    const { data: expert, error: expertError } = expertLink
      ? await supabaseAdmin.from("experts_directory_v").select("id,display_name,institution,institution_role,country,expertise_areas").eq("id", expertLink.id).single()
      : { data: null, error: null };
    if (expertError) throw new Error(expertError.message);
    if (!expert) throw new Error("Only verified BARUNA experts may submit resources.");
    return {
      userId: context.userId,
      expertId: expert.id,
      author: expert.display_name ?? profile.display_name ?? "",
      institution: expert.institution ?? profile.organization ?? "",
      country: expert.country ?? "Indonesia",
      expertiseAreas: expert.expertise_areas ?? [],
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
    const { data: expertLink } = await context.supabase.from("experts").select("id").eq("original_contributor_id", context.userId).single();
    const { data: expert } = expertLink
      ? await context.supabase.from("experts_directory_v").select("id,display_name,institution,country,expertise_areas").eq("id", expertLink.id).single()
      : { data: null };
    if (!expert) throw new Error("verified_expert_required");
    const patch: Json = {
      ...form,
      title,
      resource_type: resourceType,
      author_expert_id: expert.id,
      author_name: expert.display_name,
      institution: expert.institution,
      country: expert.country,
      expertise_areas: expert.expertise_areas,
      original_contributor_id: context.userId,
    } as Json;
    const updated = await context.supabase.rpc("kr_draft_update", { _draft_id: draftId, _patch: patch });
    if (updated.error) throw new Error(updated.error.message);
    if (data.submit) {
      const submitted = await context.supabase.rpc("kr_draft_submit", { _draft_id: draftId });
      if (submitted.error) throw new Error(submitted.error.message);
    }
    return { draftId, status: data.submit ? "submitted" : "draft" };
  });

export const createKnowledgeResourceUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UploadInput.parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: expert } = await supabaseAdmin.from("experts").select("id").eq("original_contributor_id", context.userId).maybeSingle();
    if (!expert) throw new Error("verified_expert_required");
    const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `users/${context.userId}/resources/${Date.now()}-${safeName}`;
    const { data: signed, error } = await supabaseAdmin.storage.from("knowledge-resource-submissions").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token };
  });
