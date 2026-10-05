import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const [{ MASTER_MODULES }, { instructors }] = await Promise.all([
  vite.ssrLoadModule("/src/data/masterModules.ts"),
  vite.ssrLoadModule("/src/data/instructors.ts"),
]);
await vite.close();

const [{ data: experts, error: expertError }, { data: existingModules, error: moduleError }] = await Promise.all([
  supabase.from("experts_directory_v").select("id,slug,display_name,institution"),
  supabase.from("module_registry").select("id,title,metadata"),
]);
if (expertError || moduleError) throw expertError ?? moduleError;
const { data: expertLinks, error: linkError } = await supabase.from("experts").select("id,original_contributor_id").in("id", experts.map((expert) => expert.id));
if (linkError) throw linkError;
const results = [];
for (const master of MASTER_MODULES) {
  const expert = experts.find((candidate) => candidate.slug === master.instructorSlug);
  const instructor = instructors.find((candidate) => candidate.slug === master.instructorSlug);
  const ownerId = expertLinks.find((link) => link.id === expert?.id)?.original_contributor_id;
  if (!expert || !ownerId) throw new Error(`Missing expert linkage for ${master.instructorSlug}`);

  await supabase.from("expert_trainer_status").update({
    trainer_status: "active",
    effective_from: new Date().toISOString(),
    expires_at: null,
    rationale: "Official BARUNA/BPPP curriculum module ownership",
  }).eq("expert_id", expert.id);

  const existing = existingModules.find((module) => module.metadata?.module_code === master.khCode);
  const moduleId = existing?.id ?? crypto.randomUUID();
  const coverUrl = `https://baruna.id/learning-modules/${master.lmsId}.jpg`;
  const metadata = {
    module_code: master.khCode,
    short_course_id: master.code,
    lms_id: master.lmsId,
    level: master.level,
    pathways: master.pathways,
    category: master.khCategory,
    subcategory: master.subCategory,
    version_label: master.version,
    cover_image_url: coverUrl,
    document_completion_status: "ready_for_expert_completion",
    migrated_from: "src/data/masterModules.ts",
    attached_resources: [],
  };
  const modulePayload = {
    id: moduleId,
    source_type: "admin_direct",
    original_contributor_id: ownerId,
    created_by: ownerId,
    verification_status: "unverified",
    visibility: "private",
    current_status: "draft",
    module_type: "technical",
    title: master.title,
    summary: master.summary,
    language: master.language,
    target_participants: "Fisheries practitioners, trainers, extension officers, and learners",
    estimated_learning_hours: master.hours,
    learning_objectives: master.objectives,
    content_outline: { topic: master.subCategory, competency: master.category },
    assessment_approach: { method: "Module assessment and practical exercise", passing_score: 70 },
    author_expert_id: expert.id,
    legacy_master_module_ref: master.code,
    metadata,
  };
  const { error: registryError } = await supabase.from("module_registry").upsert(modulePayload, { onConflict: "id" });
  if (registryError) throw registryError;

  const { error: resourceError } = await supabase.from("knowledge_resources").upsert({
    id: moduleId,
    source_type: "admin_direct",
    original_contributor_id: ownerId,
    created_by: ownerId,
    verification_status: "unverified",
    visibility: "private",
    current_status: "draft",
    resource_type: "module",
    title: master.title,
    summary: master.summary,
    abstract: `${master.summary} Learning objectives: ${master.objectives.join("; ")}.`,
    language: master.language,
    publication_year: new Date().getUTCFullYear(),
    publisher: expert.institution ?? instructor?.organization ?? "BARUNA Network",
    thumbnail_url: coverUrl,
    topics: [master.khCategory, master.subCategory, ...master.pathways],
    keywords: [master.khCode, master.code, master.level, "Learning Module", "Self-Paced"],
    related_expert_ids: [expert.id],
    related_module_refs: [moduleId],
    metadata: { ...metadata, module_registry_id: moduleId },
  }, { onConflict: "id" });
  if (resourceError) throw resourceError;

  const { data: author } = await supabase.from("knowledge_resource_authors").select("id").eq("resource_id", moduleId).eq("expert_id", expert.id).maybeSingle();
  const authorPayload = { resource_id: moduleId, expert_id: expert.id, display_name: expert.display_name, affiliation: expert.institution, role: "Author and Instructor", is_corresponding: true, display_order: 0 };
  const authorQuery = author
    ? supabase.from("knowledge_resource_authors").update(authorPayload).eq("id", author.id)
    : supabase.from("knowledge_resource_authors").insert(authorPayload);
  const { error: authorError } = await authorQuery;
  if (authorError) throw authorError;

  const { data: draft } = await supabase.from("review_drafts").select("id").eq("submitter_id", ownerId).eq("subject_kind", "module").eq("external_ref", `canonical:${moduleId}`).maybeSingle();
  const draftPayload = {
    title: master.title,
    module_type: "technical",
    summary: master.summary,
    language: master.language,
    estimated_learning_hours: master.hours,
    target_participants: modulePayload.target_participants,
    learning_objectives: master.objectives,
    competency_outcomes: `Able to apply ${master.subCategory.toLowerCase()} practices according to the module objectives.`,
    content_outline: modulePayload.content_outline,
    assessment_approach: modulePayload.assessment_approach,
    author_expert_id: expert.id,
    canonical_module_id: moduleId,
    metadata,
    documents: [],
  };
  const draftQuery = draft
    ? supabase.from("review_drafts").update({ title: master.title, description: "Official curriculum record ready for document completion", payload: draftPayload }).eq("id", draft.id)
    : supabase.from("review_drafts").insert({ submitter_id: ownerId, subject_kind: "module", status: "draft", title: master.title, description: "Official curriculum record ready for document completion", external_ref: `canonical:${moduleId}`, payload: draftPayload }).select("id").single();
  const { data: savedDraft, error: draftError } = await draftQuery;
  if (draftError) throw draftError;

  results.push({ title: master.title, owner: expert.display_name, emailSlug: expert.slug, moduleId, draftId: draft?.id ?? savedDraft?.id, status: "draft", completion: "ready_for_expert_completion" });
}

console.log(JSON.stringify(results, null, 2));
