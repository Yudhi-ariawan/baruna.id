import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { MODULE_CATEGORY_LABELS, primaryModuleCategory } from "@/lib/academy/module-categories";

const COVER_BUCKET = "knowledge-module-covers";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function moduleCodeForId(moduleId: string): string {
  return `BARUNA-MOD-${moduleId.slice(0, 8).toUpperCase()}`;
}

async function publishCover(moduleId: string, metadata: Record<string, unknown>): Promise<string | null> {
  const attachments = Array.isArray(metadata.attached_resources)
    ? (metadata.attached_resources as Array<Record<string, unknown>>)
    : Array.isArray(metadata.documents)
      ? (metadata.documents as Array<Record<string, unknown>>)
      : [];
  const cover = attachments.find((item) => {
    const type = String(item.type ?? item.category ?? "").toLowerCase();
    const name = String(item.name ?? item.fileName ?? "").toLowerCase();
    return (
      type.includes("cover") ||
      (type.includes("image") && /\.(jpg|jpeg|png|webp)$/i.test(name))
    );
  });

  let sourcePath = typeof cover?.path === "string" ? cover.path.trim() : null;
  let explicitBucket = typeof cover?.bucket === "string" ? cover.bucket.trim() : null;

  if (!sourcePath && typeof metadata.cover_image_url === "string" && metadata.cover_image_url.trim()) {
    sourcePath = metadata.cover_image_url.trim();
  }

  if (!sourcePath) return null;

  // Extract bucket & object path if a Supabase Storage URL was stored
  if (sourcePath.includes("/storage/v1/object/public/")) {
    const parts = sourcePath.split("/storage/v1/object/public/")[1];
    if (parts) {
      const slashIdx = parts.indexOf("/");
      if (slashIdx !== -1) {
        explicitBucket = parts.slice(0, slashIdx);
        sourcePath = parts.slice(slashIdx + 1);
      }
    }
  }

  if (sourcePath.startsWith("http") && !sourcePath.includes("supabase.co/storage/")) {
    return sourcePath;
  }

  const candidateBuckets = Array.from(
    new Set([explicitBucket, "module-attachments", "expert-applications"].filter(Boolean) as string[]),
  );

  let blob: Blob | null = null;
  for (const bucketName of candidateBuckets) {
    const { data, error } = await supabaseAdmin.storage.from(bucketName).download(sourcePath);
    if (!error && data) {
      blob = data;
      break;
    }
  }

  if (!blob) {
    return sourcePath.startsWith("http") && sourcePath.includes(`/${COVER_BUCKET}/`) ? sourcePath : null;
  }

  const buckets = await supabaseAdmin.storage.listBuckets();
  if (!buckets.data?.some((bucket) => bucket.id === COVER_BUCKET)) {
    const created = await supabaseAdmin.storage.createBucket(COVER_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (created.error) throw new Error(created.error.message);
  }
  const extension =
    String(cover?.fileName ?? cover?.name ?? sourcePath ?? "cover.jpg")
      .split("?")[0]
      .split(".")
      .pop()
      ?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
  const destination = `modules/${moduleId}/cover.${safeExt}`;
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
  const outline = record(module.content_outline);
  const categorySlug = primaryModuleCategory({
    title: module.title,
    summary: module.summary,
    topic: typeof outline.topic === "string" ? outline.topic : "",
    competency: typeof outline.competency === "string" ? outline.competency : "",
    metadata,
  });
  const coverUrl = await publishCover(module.id, metadata);

  let resolvedAuthorName = typeof metadata.author_name === "string" ? metadata.author_name : undefined;
  let resolvedInstitution = typeof metadata.institution === "string" ? metadata.institution : undefined;

  if (module.author_expert_id) {
    const { data: exp } = await supabaseAdmin
      .from("experts_directory_v")
      .select("display_name,institution")
      .eq("id", module.author_expert_id)
      .maybeSingle();
    if (exp?.display_name) resolvedAuthorName = exp.display_name;
    if (exp?.institution) resolvedInstitution = exp.institution;
  }

  if ((!resolvedAuthorName || !resolvedInstitution) && module.original_contributor_id) {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("display_name,organization")
      .eq("id", module.original_contributor_id)
      .maybeSingle();
    if (!resolvedAuthorName && prof?.display_name) resolvedAuthorName = prof.display_name;
    if (!resolvedInstitution && prof?.organization) resolvedInstitution = prof.organization;
  }

  if (!resolvedAuthorName && typeof metadata.copyright_holder === "string" && metadata.copyright_holder.trim()) {
    resolvedAuthorName = metadata.copyright_holder.trim();
  }

  const projectedMetadata = {
    ...metadata,
    module_registry_id: module.id,
    short_course_id: module.id,
    module_code: typeof metadata.module_code === "string" && metadata.module_code.trim()
      ? metadata.module_code.trim()
      : moduleCodeForId(module.id),
    estimated_learning_hours: module.estimated_learning_hours,
    cover_image_url: coverUrl,
    category_slug: categorySlug,
    category_label: MODULE_CATEGORY_LABELS[categorySlug],
    ...(resolvedAuthorName ? { author_name: resolvedAuthorName } : {}),
    ...(resolvedInstitution ? { institution: resolvedInstitution } : {}),
  };
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
    publisher: resolvedInstitution || "BARUNA Network",
    thumbnail_url: coverUrl,
    topics: Object.values(outline).filter((item): item is string => typeof item === "string"),
    keywords: ["Learning Module", "Self-Paced", module.title],
    related_expert_ids: module.author_expert_id ? [module.author_expert_id] : [],
    related_module_refs: [module.id],
    metadata: projectedMetadata,
  }, { onConflict: "id" });
  if (resourceError) throw new Error(resourceError.message);

  if (module.author_expert_id) {
    const { data: expert } = await supabaseAdmin.from("experts_directory_v").select("display_name,institution").eq("id", module.author_expert_id).maybeSingle();
    const { data: author } = await supabaseAdmin.from("knowledge_resource_authors").select("id").eq("resource_id", module.id).eq("expert_id", module.author_expert_id).maybeSingle();
    const values = { resource_id: module.id, expert_id: module.author_expert_id, display_name: expert?.display_name ?? resolvedAuthorName ?? "BARUNA Expert", affiliation: expert?.institution ?? resolvedInstitution ?? null, role: "Author and Instructor", is_corresponding: true, display_order: 0 };
    const query = author
      ? supabaseAdmin.from("knowledge_resource_authors").update(values).eq("id", author.id)
      : supabaseAdmin.from("knowledge_resource_authors").insert(values);
    const { error: authorError } = await query;
    if (authorError) throw new Error(authorError.message);
  }
  await supabaseAdmin.from("module_registry").update({ metadata: projectedMetadata }).eq("id", module.id);

  const { clearKnowledgeHubCache } = await import("@/lib/knowledge-hub/knowledge-hub.functions");
  clearKnowledgeHubCache();
}
