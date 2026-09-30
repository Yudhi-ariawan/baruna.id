import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function slugifyExpertName(name: string): string {
  const base = (name || "expert")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "expert";
}

export async function publishApprovedExpert({
  subjectId,
  decisionId,
  decidedBy,
}: {
  subjectId: string;
  decisionId?: string | null;
  decidedBy?: string | null;
}): Promise<{ expertId: string; slug: string }> {
  // 1. Fetch review_subjects
  const { data: subject, error: sErr } = await supabaseAdmin
    .from("review_subjects")
    .select("id, title, submitted_by, current_status")
    .eq("id", subjectId)
    .single();

  if (sErr || !subject) {
    throw new Error(sErr?.message || "review_subject_not_found");
  }

  // 2. Fetch linked draft (or revision snapshot as fallback)
  const { data: draft } = await supabaseAdmin
    .from("review_drafts")
    .select("payload, title")
    .eq("linked_subject_id", subjectId)
    .maybeSingle();

  let payload = (draft?.payload as Record<string, unknown>) ?? {};
  if (!payload || Object.keys(payload).length === 0) {
    const { data: rev } = await supabaseAdmin
      .from("review_subject_revisions")
      .select("snapshot")
      .eq("subject_id", subjectId)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle();
    const snap = (rev?.snapshot as Record<string, unknown>) ?? {};
    payload = (snap.payload as Record<string, unknown>) ?? {};
  }

  const rawDisplayName =
    (typeof payload.fullName === "string" && payload.fullName) ||
    (typeof payload.display_name === "string" && payload.display_name) ||
    draft?.title ||
    subject.title ||
    "Marine Expert";
  const displayName = rawDisplayName.trim();

  // Determine unique slug
  let slug = slugifyExpertName(displayName);
  const { data: existingWithSlug } = await supabaseAdmin
    .from("experts")
    .select("id, source_submission_id")
    .eq("slug", slug)
    .maybeSingle();

  if (existingWithSlug && existingWithSlug.source_submission_id !== subjectId) {
    slug = `${slug}-${subjectId.slice(0, 8)}`;
  }

  // Resolve photo/avatar from uploaded documents if valid image
  let avatarUrl: string | null = null;
  const docs = Array.isArray(payload.documents)
    ? (payload.documents as Array<Record<string, unknown>>)
    : [];
  const photoDoc = docs.find((d) => d.category === "photo");
  if (photoDoc && typeof photoDoc.path === "string") {
    const docType = typeof photoDoc.type === "string" ? photoDoc.type : "";
    const docName = typeof photoDoc.name === "string" ? photoDoc.name.toLowerCase() : "";
    const isImage =
      docType.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(docName);
    if (isImage) {
      const { data: pubUrl } = supabaseAdmin.storage
        .from("expert-applications")
        .getPublicUrl(photoDoc.path);
      avatarUrl = pubUrl?.publicUrl || null;
    }
  }

  // Parse languages (support both string and array formats)
  let languages: string[] = [];
  if (Array.isArray(payload.languages)) {
    languages = (payload.languages as string[]).map(String);
  } else if (typeof payload.languages === "string" && payload.languages.trim()) {
    languages = payload.languages
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Parse expertise areas (support both expertise and expertise_areas keys)
  let expertiseAreas: string[] = [];
  if (Array.isArray(payload.expertise)) {
    expertiseAreas = (payload.expertise as string[]).map(String);
  } else if (Array.isArray(payload.expertise_areas)) {
    expertiseAreas = (payload.expertise_areas as string[]).map(String);
  }

  const headline =
    (typeof payload.title === "string" && payload.title.trim()) ||
    "Marine & Fisheries Expert";
  const bio =
    (typeof payload.biography === "string" && payload.biography.trim()) ||
    (typeof payload.bio === "string" && payload.bio.trim()) ||
    "";
  const country =
    (typeof payload.country === "string" && payload.country.trim()) || "Indonesia";
  const city = typeof payload.city === "string" ? payload.city.trim() : null;
  const personalUrl =
    typeof payload.website === "string" ? payload.website.trim() : null;

  // 3. Upsert into public.experts
  const { data: existingExpert } = await supabaseAdmin
    .from("experts")
    .select("id")
    .eq("source_submission_id", subjectId)
    .maybeSingle();

  const now = new Date().toISOString();
  let expertId: string;

  const expertData = {
    source_type: "external_submission" as const,
    source_submission_id: subjectId,
    original_contributor_id: subject.submitted_by,
    created_by: subject.submitted_by,
    approved_by: decidedBy || subject.submitted_by,
    published_by: decidedBy || subject.submitted_by,
    approval_date: now,
    publication_date: now,
    verification_status: "governance_verified" as const,
    visibility: "public" as const,
    current_status: "published" as const,
    audit_ref: decisionId || null,
    display_name: displayName,
    slug,
    headline,
    bio,
    country,
    city,
    languages,
    expertise_areas: expertiseAreas,
    avatar_url: avatarUrl,
    personal_url: personalUrl,
  };

  if (existingExpert) {
    const { data: updated, error: uErr } = await supabaseAdmin
      .from("experts")
      .update(expertData)
      .eq("id", existingExpert.id)
      .select("id")
      .single();
    if (uErr) throw new Error(uErr.message);
    expertId = updated.id;
  } else {
    const { data: inserted, error: iErr } = await supabaseAdmin
      .from("experts")
      .insert(expertData)
      .select("id")
      .single();
    if (iErr) throw new Error(iErr.message);
    expertId = inserted.id;
  }

  // 4. Upsert public.expert_employment (used for institution and role in directory view)
  const institution =
    typeof payload.institution === "string" ? payload.institution.trim() : "";
  if (institution || headline) {
    const { data: existingEmp } = await supabaseAdmin
      .from("expert_employment")
      .select("id")
      .eq("expert_id", expertId)
      .maybeSingle();

    const empData = {
      expert_id: expertId,
      organization: institution || "BARUNA Network",
      role: headline || "Expert",
      is_current: true,
      visibility: "public" as const,
    };

    if (existingEmp) {
      await supabaseAdmin.from("expert_employment").update(empData).eq("id", existingEmp.id);
    } else {
      await supabaseAdmin.from("expert_employment").insert(empData);
    }
  }

  // 5. Upsert public.expert_trainer_status (if roles include Trainer)
  const roles = Array.isArray(payload.roles) ? (payload.roles as string[]) : [];
  const isTrainer = roles.some((r) => String(r).toLowerCase().includes("trainer"));
  if (isTrainer) {
    const { data: existingTrainer } = await supabaseAdmin
      .from("expert_trainer_status")
      .select("id")
      .eq("expert_id", expertId)
      .maybeSingle();

    const trainerData = {
      expert_id: expertId,
      trainer_status: "active" as const,
      trainer_level: "certified" as const,
      unique_graduated_participants: 0,
      granted_by: decidedBy || null,
      granted_at: now,
      effective_from: now,
      version: 1,
    };

    if (existingTrainer) {
      await supabaseAdmin
        .from("expert_trainer_status")
        .update(trainerData)
        .eq("id", existingTrainer.id);
    } else {
      await supabaseAdmin.from("expert_trainer_status").insert(trainerData);
    }
  }

  // 6. Grant expert RBAC role to applicant
  if (subject.submitted_by) {
    const { data: expertRole } = await supabaseAdmin
      .from("rbac_roles")
      .select("id")
      .eq("code", "expert")
      .maybeSingle();

    if (expertRole) {
      const { data: existingRole } = await supabaseAdmin
        .from("rbac_user_roles")
        .select("id")
        .eq("user_id", subject.submitted_by)
        .eq("role_id", expertRole.id)
        .maybeSingle();

      if (!existingRole) {
        await supabaseAdmin.from("rbac_user_roles").insert({
          user_id: subject.submitted_by,
          role_id: expertRole.id,
          status: "active",
          is_primary: false,
          valid_from: now,
          granted_by: decidedBy || null,
          approved_by: decidedBy || null,
          approved_at: now,
          reason: "expert_application_approved",
        });
      } else {
        await supabaseAdmin
          .from("rbac_user_roles")
          .update({ status: "active", valid_until: null })
          .eq("id", existingRole.id);
      }
    }

    // Also update profiles organization, job_title, and phone
    await supabaseAdmin
      .from("profiles")
      .update({
        organization: institution || undefined,
        job_title: headline || undefined,
        phone: typeof payload.phone === "string" ? payload.phone : undefined,
      })
      .eq("id", subject.submitted_by);
  }

  return { expertId, slug };
}

export async function publishApprovedModule({
  subjectId,
  decisionId,
  decidedBy,
}: {
  subjectId: string;
  decisionId?: string | null;
  decidedBy?: string | null;
}): Promise<{ moduleId: string }> {
  // 1. Check existing module in module_registry
  const { data: existing } = await supabaseAdmin
    .from("module_registry")
    .select("id")
    .eq("source_submission_id", subjectId)
    .maybeSingle();

  if (existing) {
    return { moduleId: existing.id };
  }

  // 2. Fetch review subject and decision
  const { data: subject, error: sErr } = await supabaseAdmin
    .from("review_subjects")
    .select("id, title, submitted_by")
    .eq("id", subjectId)
    .single();

  if (sErr || !subject) {
    throw new Error(sErr?.message || "review_subject_not_found");
  }

  const { data: dec } = await supabaseAdmin
    .from("review_decisions")
    .select("id, decided_by, decided_at")
    .eq("subject_id", subjectId)
    .maybeSingle();

  // 3. Fetch draft payload or revision snapshot fallback
  const { data: draft } = await supabaseAdmin
    .from("review_drafts")
    .select("payload, title")
    .eq("linked_subject_id", subjectId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let payload = (draft?.payload as Record<string, unknown>) ?? {};
  if (!payload || Object.keys(payload).length === 0) {
    const { data: rev } = await supabaseAdmin
      .from("review_subject_revisions")
      .select("snapshot")
      .eq("subject_id", subjectId)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle();

    const snap = (rev?.snapshot as Record<string, unknown>) ?? {};
    payload = (snap.payload as Record<string, unknown>) ?? {};
  }

  // 4. Find expert record for author
  const { data: expert } = await supabaseAdmin
    .from("experts")
    .select("id")
    .eq("original_contributor_id", subject.submitted_by)
    .maybeSingle();

  const now = new Date().toISOString();
  const decisionRef = decisionId || dec?.id || null;
  const decidedByRef = decidedBy || dec?.decided_by || null;
  const decidedAtRef = dec?.decided_at || now;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: iErr } = await (supabaseAdmin as any)
    .from("module_registry")
    .insert({
      source_type: "external_submission",
      source_submission_id: subjectId,
      original_contributor_id: subject.submitted_by,
      created_by: subject.submitted_by,
      approved_by: decidedByRef,
      published_by: decidedByRef,
      approval_date: decidedAtRef,
      publication_date: now,
      verification_status: "governance_verified",
      visibility: "public",
      current_status: "published",
      audit_ref: decisionRef,
      title: (typeof payload.title === "string" && payload.title) || subject.title || "Untitled Module",
      summary: typeof payload.summary === "string" ? payload.summary : null,
      language: typeof payload.language === "string" ? payload.language : "English",
      module_type: typeof payload.module_type === "string" ? payload.module_type : "technical",
      target_participants: typeof payload.target_participants === "string" ? payload.target_participants : null,
      estimated_learning_hours: Number(payload.estimated_learning_hours || 0),
      learning_objectives: Array.isArray(payload.learning_objectives) ? (payload.learning_objectives as string[]) : [],
      content_outline: payload.content_outline || {},
      assessment_approach: payload.assessment_approach || {},
      author_expert_id: expert?.id || null,
      metadata: payload.metadata || {},
    })
    .select("id")
    .single();

  if (iErr || !inserted) {
    throw new Error(iErr?.message || "module_insert_failed");
  }

  return { moduleId: inserted.id };
}

