import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { instructors } from "../src/data/instructors";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const actorId = process.env.EXPERTS_SEED_ACTOR_ID;

if (!supabaseUrl || !serviceRoleKey || !actorId) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and EXPERTS_SEED_ACTOR_ID are required.",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const trainerSeed = [
  { status: "active", level: "certified", participants: 30 },
  { status: "active", level: "advanced", participants: 100 },
  { status: "active", level: "senior", participants: 1_000 },
  { status: "active", level: "master", participants: 10_001 },
  { status: "active", level: "not_assigned", participants: 0 },
  { status: "active", level: "certified", participants: 30 },
  { status: "candidate", level: "not_assigned", participants: 0 },
  { status: "candidate", level: "not_assigned", participants: 0 },
  { status: "candidate", level: "not_assigned", participants: 0 },
  { status: "candidate", level: "not_assigned", participants: 0 },
] as const;

for (const [index, instructor] of instructors.entries()) {
  const photo = await readFile(instructor.photo);
  const storagePath = `experts/${instructor.slug}/profile.jpg`;
  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(storagePath, photo, { contentType: "image/jpeg", upsert: true });
  if (uploadError) throw uploadError;

  const avatarUrl = admin.storage.from("avatars").getPublicUrl(storagePath).data.publicUrl;
  const now = new Date().toISOString();
  const { data: existingExpert, error: expertReadError } = await admin
    .from("experts")
    .select("id")
    .eq("slug", instructor.slug)
    .maybeSingle();
  if (expertReadError) throw expertReadError;

  let expert = existingExpert;
  if (!expert) {
    const { data: insertedExpert, error: expertError } = await admin
      .from("experts")
      .insert({
        slug: instructor.slug,
        source_type: "admin_direct",
        created_by: actorId,
        original_contributor_id: actorId,
        approved_by: actorId,
        published_by: actorId,
        approval_date: now,
        publication_date: now,
        verification_status: "governance_verified",
        visibility: "public",
        current_status: "published",
        display_name: instructor.name,
        headline: instructor.position,
        bio: instructor.biography,
        country: "Indonesia",
        languages: ["Indonesian", "English"],
        expertise_areas: instructor.expertise,
        avatar_url: avatarUrl,
      })
      .select("id")
      .single();
    if (expertError) throw expertError;
    expert = insertedExpert;
  }

  const { data: employment, error: employmentReadError } = await admin
    .from("expert_employment")
    .select("id")
    .eq("expert_id", expert.id)
    .eq("is_current", true)
    .maybeSingle();
  if (employmentReadError) throw employmentReadError;

  const employmentPayload = {
    expert_id: expert.id,
    role: instructor.position,
    organization: instructor.organization,
    is_current: true,
    visibility: "public" as const,
  };
  const employmentWrite = employment
    ? await admin.from("expert_employment").update(employmentPayload).eq("id", employment.id)
    : await admin.from("expert_employment").insert(employmentPayload);
  if (employmentWrite.error) throw employmentWrite.error;

  const trainer = trainerSeed[index];
  const { count: trainerCount, error: trainerReadError } = await admin
    .from("expert_trainer_status")
    .select("id", { count: "exact", head: true })
    .eq("expert_id", expert.id);
  if (trainerReadError) throw trainerReadError;
  if (!trainerCount) {
    const { error } = await admin.from("expert_trainer_status").insert({
      expert_id: expert.id,
      trainer_status: trainer.status,
      trainer_level: trainer.level,
      unique_graduated_participants: trainer.participants,
      granted_by: actorId,
      rationale: "Initial canonical migration from verified BARUNA instructor records",
    });
    if (error) throw error;
  }

  const { error: availabilityError } = await admin.from("expert_availability").upsert({
    expert_id: expert.id,
    availability_status: index % 4 === 0 ? "limited" : "available",
    available_modes: ["Online", "Onsite"],
    visibility: "public",
  });
  if (availabilityError) throw availabilityError;

  console.log(`Seeded ${instructor.slug}`);
}

console.log(`Seeded ${instructors.length} public experts.`);
