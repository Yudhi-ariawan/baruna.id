import { supabaseAdmin } from "@/integrations/supabase/client.server";

const COVER_BUCKET = "knowledge-module-covers";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function publishCover(moduleId: string, metadata: Record<string, unknown>): Promise<string | null> {
  const attachments = Array.isArray(metadata.attached_resources)
    ? metadata.attached_resources as Array<Record<string, unknown>>
    : [];
  const cover = attachments.find((item) => String(item.type ?? "").toLowerCase().includes("cover"));
  const sourcePath = typeof cover?.path === "string" ? cover.path : null;
  if (!sourcePath || sourcePath.startsWith("http")) {
    return sourcePath ?? (typeof metadata.cover_image_url === "string" ? metadata.cover_image_url : null);
  }

  const { data: blob, error } = await supabaseAdmin.storage.from("module-attachments").download(sourcePath);
  if (error || !blob) return typeof metadata.cover_image_url === "string" ? metadata.cover_image_url : null;
  const buckets = await supabaseAdmin.storage.listBuckets();
  if (!buckets.data?.some((bucket) => bucket.id === COVER_BUCKET)) {
    const created = await supabaseAdmin.storage.createBucket(COVER_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (created.error) throw new Error(created.error.message);
  }
  const extension = String(cover?.fileName ?? cover?.name ?? "cover.jpg").split(".").pop()?.toLowerCase() || "jpg";
  const destination = `modules/${moduleId}/cover.${extension}`;
  const uploaded = await supabaseAdmin.storage.from(COVER_BUCKET).upload(destination, blob, {
    contentType: blob.type || String(cover?.fileType ?? "image/jpeg"),
    upsert: true,
  });
  if (uploaded.error) throw new Error(uploaded.error.message);
  return supabaseAdmin.storage.from(COVER_BUCKET).getPublicUrl(destination).data.publicUrl;
}

/** Project an approved canonical module into the curated public Knowledge Hub. */
export async function projectPublishedModuleToKnowledge(moduleId: string): Promise<void> {
  const { data: module, error } = await supabaseAdmin.from("module_registry").select("*").eq("id", moduleId).single();
  if (error || !module) throw new Error(error?.message ?? "module_not_found");
  if (module.current_status !== "published" || module.visibility !== "public") return;

  const metadata = record(module.metadata);
  const coverUrl = await publishCover(module.id, metadata);
  const projectedMetadata = { ...metadata, module_registry_id: module.id, short_course_id: module.id, cover_image_url: coverUrl };
  const { error: resourceError } = await supabaseAdmin.from("knowledge_resources").upsert({
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
    publication_year: module.publication_date ? new Date(module.publication_date).getUTCFullYear() : new Date().getUTCFullYear(),
    publisher: "BARUNA Network",
    thumbnail_url: coverUrl,
    topics: Object.values(record(module.content_outline)).filter((item): item is string => typeof item === "string"),
    keywords: ["Learning Module", "Self-Paced", module.title],
    related_expert_ids: module.author_expert_id ? [module.author_expert_id] : [],
    related_module_refs: [module.id],
    metadata: projectedMetadata,
  }, { onConflict: "id" });
  if (resourceError) throw new Error(resourceError.message);

  if (module.author_expert_id) {
    const { data: expert } = await supabaseAdmin.from("experts_directory_v").select("display_name,institution").eq("id", module.author_expert_id).single();
    const { data: author } = await supabaseAdmin.from("knowledge_resource_authors").select("id").eq("resource_id", module.id).eq("expert_id", module.author_expert_id).maybeSingle();
    const values = { resource_id: module.id, expert_id: module.author_expert_id, display_name: expert?.display_name ?? "BARUNA Expert", affiliation: expert?.institution ?? null, role: "Author and Instructor", is_corresponding: true, display_order: 0 };
    const query = author
      ? supabaseAdmin.from("knowledge_resource_authors").update(values).eq("id", author.id)
      : supabaseAdmin.from("knowledge_resource_authors").insert(values);
    const { error: authorError } = await query;
    if (authorError) throw new Error(authorError.message);
  }
  await supabaseAdmin.from("module_registry").update({ metadata: projectedMetadata }).eq("id", module.id);
}
