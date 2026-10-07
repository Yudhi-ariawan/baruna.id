import { createClient } from "@supabase/supabase-js";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const codeFor = (id) => `BARUNA-MOD-${id.slice(0, 8).toUpperCase()}`;
const asRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

const { data: modules, error: moduleError } = await supabase
  .from("module_registry")
  .select("id,title,current_status,visibility,estimated_learning_hours,metadata");
if (moduleError) throw moduleError;

const moduleIds = (modules ?? []).map((module) => module.id);
const { data: resources, error: resourceError } = moduleIds.length
  ? await supabase
      .from("knowledge_resources")
      .select("id,title,current_status,visibility,metadata")
      .in("id", moduleIds)
  : { data: [], error: null };
if (resourceError) throw resourceError;

const resourceById = new Map((resources ?? []).map((resource) => [resource.id, resource]));
const report = [];

for (const module of modules ?? []) {
  const moduleMetadata = asRecord(module.metadata);
  const moduleCode = codeFor(module.id);
  const canonicalMetadata = {
    ...moduleMetadata,
    module_code: moduleCode,
    estimated_learning_hours: module.estimated_learning_hours,
  };

  const canonicalNeedsUpdate =
    moduleMetadata.module_code !== moduleCode ||
    moduleMetadata.estimated_learning_hours !== module.estimated_learning_hours;
  if (canonicalNeedsUpdate) {
    const { error } = await supabase
      .from("module_registry")
      .update({ metadata: canonicalMetadata })
      .eq("id", module.id);
    if (error) throw error;
  }

  const resource = resourceById.get(module.id);
  if (!resource) {
    report.push({ id: module.id, title: module.title, moduleCode, canonicalUpdated: canonicalNeedsUpdate, resource: "absent" });
    continue;
  }

  const resourceMetadata = asRecord(resource.metadata);
  const projectedMetadata = {
    ...resourceMetadata,
    module_registry_id: module.id,
    short_course_id: module.id,
    module_code: moduleCode,
    estimated_learning_hours: module.estimated_learning_hours,
  };
  const mustBePrivate = module.current_status === "archived" || module.visibility === "private";
  const resourceNeedsMetadata =
    resourceMetadata.module_code !== moduleCode ||
    resourceMetadata.estimated_learning_hours !== module.estimated_learning_hours ||
    resourceMetadata.module_registry_id !== module.id ||
    resourceMetadata.short_course_id !== module.id;
  const resourceNeedsStatus = mustBePrivate &&
    (resource.current_status !== "archived" || resource.visibility !== "private");

  if (resourceNeedsMetadata || resourceNeedsStatus) {
    const values = { metadata: projectedMetadata };
    if (mustBePrivate) {
      values.current_status = "archived";
      values.visibility = "private";
    }
    const { error } = await supabase.from("knowledge_resources").update(values).eq("id", module.id);
    if (error) throw error;
  }

  report.push({
    id: module.id,
    title: module.title,
    moduleCode,
    canonicalUpdated: canonicalNeedsUpdate,
    resourceMetadataUpdated: resourceNeedsMetadata,
    resourceStatusSynchronized: resourceNeedsStatus,
  });
}

console.log(JSON.stringify({ processed: report.length, changed: report.filter((row) => row.canonicalUpdated || row.resourceMetadataUpdated || row.resourceStatusSynchronized).length, rows: report }, null, 2));
