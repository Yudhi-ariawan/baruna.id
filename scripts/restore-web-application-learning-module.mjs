import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const moduleId = "01b19c79-d63a-4ad1-b585-3386820a0cba";

const { data: module, error } = await supabase.from("module_registry").select("*").eq("id", moduleId).single();
if (error || !module) throw error ?? new Error("module_not_found");
if (module.current_status !== "published" || module.visibility !== "public") {
  throw new Error("Refusing to project a module that is not published and public");
}

const cover = Array.isArray(module.metadata?.attached_resources)
  ? module.metadata.attached_resources.find((item) => item?.type === "Course cover image")
  : undefined;
const metadata = {
  ...(module.metadata ?? {}),
  short_course_id: module.id,
  module_registry_id: module.id,
  module_code: `BARUNA-MOD-${module.id.slice(0, 8).toUpperCase()}`,
  estimated_learning_hours: module.estimated_learning_hours,
  target_participants: module.target_participants,
  cover_storage_path: cover?.path ?? null,
};

const { error: resourceError } = await supabase.from("knowledge_resources").upsert({
  id: module.id,
  source_type: module.source_type,
  source_submission_id: module.source_submission_id,
  source_institution_id: module.source_institution_id,
  original_contributor_id: module.original_contributor_id,
  created_by: module.created_by,
  approved_by: module.approved_by,
  published_by: module.published_by,
  approval_date: module.approval_date,
  publication_date: module.publication_date,
  verification_status: module.verification_status,
  visibility: "public",
  current_status: "published",
  audit_ref: module.audit_ref,
  resource_type: "module",
  title: module.title,
  summary: module.summary,
  abstract: module.summary,
  language: module.language,
  publication_year: new Date(module.publication_date).getUTCFullYear(),
  publisher: "BARUNA Network",
  topics: Object.values(module.content_outline ?? {}).filter((value) => typeof value === "string"),
  keywords: ["Learning Module", "Self-Paced", "Web Application Development"],
  related_expert_ids: module.author_expert_id ? [module.author_expert_id] : [],
  related_module_refs: [module.id],
  metadata,
}, { onConflict: "id" });
if (resourceError) throw resourceError;

const { data: author } = await supabase.from("experts_directory_v").select("display_name,institution").eq("id", module.author_expert_id).single();
const { data: existingAuthor } = await supabase.from("knowledge_resource_authors").select("id").eq("resource_id", module.id).eq("expert_id", module.author_expert_id).maybeSingle();
const authorPayload = {
  resource_id: module.id,
  expert_id: module.author_expert_id,
  display_name: author?.display_name ?? "Achmad Suhermanto",
  affiliation: author?.institution ?? "Karawang Marine and Fisheries Polytechnic",
  role: "Author and Instructor",
  is_corresponding: true,
  display_order: 0,
};
const authorQuery = existingAuthor
  ? supabase.from("knowledge_resource_authors").update(authorPayload).eq("id", existingAuthor.id)
  : supabase.from("knowledge_resource_authors").insert(authorPayload);
const { error: authorError } = await authorQuery;
if (authorError) throw authorError;

console.log(JSON.stringify({ id: module.id, title: module.title, status: "published", visibility: "public", resourceType: "module", author: authorPayload.display_name }, null, 2));
