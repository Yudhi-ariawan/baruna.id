import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) throw new Error("Missing Supabase environment variables");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const stamp = Date.now();
const password = "TrainerTest!2026";
const users = {};
const createdExpertIds = [];

async function createUser(kind) {
  const email = `baruna.portal.${kind}.${stamp}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: `Portal ${kind}`, organization: "BARUNA QA", job_title: kind, phone: "+628000000000" } });
  if (error) throw error;
  users[kind] = { id: data.user.id, email };
  return data.user;
}

async function clientFor(email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function makeExpert(user, kind, active) {
  const { data: role, error: roleError } = await admin.from("rbac_roles").select("id").eq("code", "expert").single();
  if (roleError) throw roleError;
  const { error: assignmentError } = await admin.from("rbac_user_roles").update({ role_id: role.id, status: "active", is_primary: true, valid_from: new Date().toISOString(), reason: "trainer_portal_automated_test" }).eq("user_id", user.id).eq("is_primary", true);
  if (assignmentError) throw assignmentError;
  const { data: expert, error } = await admin.from("experts").insert({ source_type: "external_submission", original_contributor_id: user.id, created_by: user.id, display_name: `Portal ${kind}`, headline: active ? "Active Test Trainer" : "Test Expert", slug: `portal-${kind}-${stamp}`, verification_status: "governance_verified", visibility: "public", current_status: "published", publication_date: new Date().toISOString() }).select("id,slug").single();
  if (error) throw error;
  createdExpertIds.push(expert.id);
  if (active) {
    const { error: trainerError } = await admin.from("expert_trainer_status").insert({ expert_id: expert.id, trainer_status: "active", trainer_level: "certified", unique_graduated_participants: 42, granted_by: user.id, rationale: "Automated access test" });
    if (trainerError) throw trainerError;
    const { error: moduleError } = await admin.from("module_registry").insert({ source_type: "admin_entry", original_contributor_id: user.id, created_by: user.id, title: "Sustainable Coastal Training", summary: "Automated trainer portal fixture", author_expert_id: expert.id, estimated_learning_hours: 16, language: "English", verification_status: "governance_verified", visibility: "public", current_status: "published" });
    if (moduleError) throw moduleError;
    const { error: historyError } = await admin.from("expert_training_facilitation_history").insert({ expert_id: expert.id, activity_title: "Coastal Resilience Workshop", organizer: "BARUNA QA", role: "Lead Trainer", start_date: "2026-08-10", end_date: "2026-08-11", participant_count: 42, country: "Indonesia" });
    if (historyError) throw historyError;
  }
  return expert;
}

async function cleanup() {
  const userIds = Object.values(users).map((user) => user.id);
  if (userIds.length) await admin.from("expert_service_requests").delete().in("requester_id", userIds);
  if (userIds.length) await admin.from("module_registry").delete().in("created_by", userIds);
  if (createdExpertIds.length) await admin.from("experts").delete().in("id", createdExpertIds);
  if (userIds.length) {
    await admin.from("admin_audit_log").delete().in("actor_id", userIds);
    await admin.from("admin_audit_log").delete().in("target_user_id", userIds);
  }
  for (const user of Object.values(users)) {
    await admin.auth.admin.deleteUser(user.id);
  }
}

try {
  const regular = await createUser("regular");
  const nonTrainer = await createUser("nontrainer");
  const trainer = await createUser("trainer");
  await makeExpert(nonTrainer, "nontrainer", false);
  const trainerExpert = await makeExpert(trainer, "trainer", true);
  const regularClient = await clientFor(users.regular.email);
  const nonTrainerClient = await clientFor(users.nontrainer.email);
  const trainerClient = await clientFor(users.trainer.email);
  const regularAccess = await regularClient.rpc("trainer_portal_bootstrap");
  const nonTrainerAccess = await nonTrainerClient.rpc("trainer_portal_bootstrap");
  const trainerAccess = await trainerClient.rpc("trainer_portal_bootstrap");
  if (regularAccess.data?.access !== "registered_user") throw new Error("Regular-user guard failed");
  if (nonTrainerAccess.data?.access !== "expert_non_trainer") throw new Error("Non-trainer guard failed");
  if (trainerAccess.data?.access !== "active_trainer" || trainerAccess.data.modules?.length !== 1 || trainerAccess.data.history?.length !== 1) throw new Error("Active-trainer bootstrap failed");
  const request = await regularClient.rpc("expert_service_request_create", { _request_type: "trainer", _status: "submitted", _target_expert_slug: trainerExpert.slug, _payload: { values: { organization: "BARUNA QA", trainingTitle: "Field Training Request", country: "Indonesia", trainingDates: "October 2026", deliveryMode: "Onsite" }, files: {} } });
  if (request.error) throw request.error;
  const inbox = await trainerClient.rpc("trainer_service_requests");
  if (inbox.error || inbox.data?.length !== 1) throw inbox.error ?? new Error("Trainer inbox failed");
  const response = await trainerClient.rpc("trainer_service_request_respond", { _request_id: request.data.id, _action: "accept" });
  if (response.error || response.data?.status !== "confirmed") throw response.error ?? new Error("Trainer response failed");
  console.log(JSON.stringify({ ok: true, scenarios: { regular: regularAccess.data.access, nonTrainer: nonTrainerAccess.data.access, trainer: trainerAccess.data.access, requestStatus: response.data.status }, credentials: { regular: users.regular.email, nonTrainer: users.nontrainer.email, trainer: users.trainer.email, password }, ids: Object.values(users).map((user) => user.id) }));
  if (!process.argv.includes("--keep")) await cleanup();
} catch (error) {
  await cleanup();
  throw error;
}
