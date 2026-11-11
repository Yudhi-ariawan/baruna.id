// Learners hear when a module they are studying is updated (Slide 13: automatic
// notification on status changes; PB-ACA-01 versioning).
//
// Recipients: approved enrollment for the module, enrolled before the new version
// went live, and NOT yet passed (passing is recorded by the server, completion_source
// 'server_quiz'). Whether learners who already passed must retake the quiz is a
// mentor decision (MENUNGGU_ARAHAN_MENTOR item 9), so they are not notified yet.
import type { InAppNotification } from "./notifications.functions";
import { enrollmentKind, enrollmentLearnUrl, enrollmentPageUrl } from "@/lib/learning/enrollment-target";
import { resolveOfferingIds } from "@/lib/learning/offering-ids.server";

type RawNotif = InAppNotification & { subjectId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ENROLLMENT_EVENTS = {
  course_enrollment_approved: "approved",
  course_enrollment_rejected: "rejected",
  course_enrollment_revision_requested: "revision_requested",
} as const;

/**
 * Decisions on the user's enrolment applications (PB-ACA-03, Slide 22; Slide 13:
 * every status change notifies). Read from the audit trail, so every decision stays
 * in the history: a revision request is still listed after the later approval.
 */
export async function buildEnrollmentDecisionNotifications(userId: string): Promise<RawNotif[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("admin_audit_log")
    .select("id, event_type, entity_id, after_data, created_at")
    .eq("target_user_id", userId)
    .eq("entity_type", "course_enrollment")
    .in("event_type", Object.keys(ENROLLMENT_EVENTS))
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  type Row = { id: string; event_type: keyof typeof ENROLLMENT_EVENTS; entity_id: string | null; after_data: Record<string, unknown> | null; created_at: string };
  const rows = ((data ?? []) as Row[]).filter((r) => r.entity_id);

  // Offering code, or (older applications) offering title -> its code.
  const offerings = await resolveOfferingIds(db, rows.map((r) => r.entity_id as string));
  const offeringIds = new Set(offerings.keys());

  return rows.map((r) => {
    const courseId = r.entity_id as string;
    const status = ENROLLMENT_EVENTS[r.event_type];
    const kind = enrollmentKind(courseId, offeringIds);
    // Links use the offering code even when the application named the title.
    const target = offerings.get(courseId) ?? courseId;
    const title = String(r.after_data?.course_title ?? "").trim() || "Pelatihan BARUNA";
    const note = String(r.after_data?.decision_notes ?? "").trim();
    const what = kind === "offering" ? "course" : kind === "program" ? "program" : "modul";
    const content =
      status === "approved"
        ? {
            title: `Pendaftaran disetujui: "${title}"`,
            body: `${note ? `${note} ` : ""}Anda sudah terdaftar. Silakan mulai belajar di halaman ${what}.`,
            url: enrollmentLearnUrl(target, kind),
          }
        : status === "revision_requested"
          ? {
              title: `Admin meminta perbaikan pendaftaran: "${title}"`,
              body: `${note || "Pendaftaran Anda perlu diperbaiki."} Perbaiki lalu kirim ulang di halaman ${what}.`,
              url: enrollmentPageUrl(target, kind),
            }
          : {
              title: `Pendaftaran belum disetujui: "${title}"`,
              body: note || "Admin belum menyetujui pendaftaran Anda. Anda dapat mengajukan lagi.",
              url: enrollmentPageUrl(target, kind),
            };
    return {
      id: `enrollment-${r.id}`,
      subjectId: `enrollment-${courseId}`,
      type: status,
      title: content.title,
      body: content.body,
      subjectKind: kind === "module" ? ("module" as const) : ("other" as const),
      subjectTitle: title,
      targetUrl: content.url,
      createdAt: r.created_at,
      actorName: "BARUNA Academy",
    };
  });
}

/** Completion decisions (Slide 27: every stage produces a notification). */
export async function buildCompletionNotifications(userId: string): Promise<RawNotif[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("course_completions")
    .select("id, status, decided_at, decided_by, decision_note, certificate_held_reason, course_offerings(offering_code, offering_title, master_courses(title))")
    .eq("user_id", userId)
    .in("status", ["approved", "remedial"])
    .not("decided_by", "is", null)
    .order("decided_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  type Row = {
    id: string; status: string; decided_at: string; decision_note: string | null; certificate_held_reason: string | null;
    course_offerings: { offering_code: string; offering_title: string; master_courses: { title: string } | null } | null;
  };
  return ((data ?? []) as Row[]).map((c) => {
    const title = c.course_offerings?.master_courses?.title ?? c.course_offerings?.offering_title ?? "Course";
    const approved = c.status === "approved";
    return {
      id: `completion-${c.id}-${c.status}-${c.decided_at}`,
      subjectId: `completion-${c.id}`,
      type: approved ? ("approved" as const) : ("revision_requested" as const),
      title: approved ? `Anda lulus: "${title}"` : `Perlu tindak lanjut: "${title}"`,
      body: approved
        ? c.certificate_held_reason
          ? "Kelulusan Anda telah disetujui. Sertifikat course ini berbayar, dan pembayaran belum tersedia."
          : "Kelulusan Anda telah disetujui. Sertifikat sudah tersedia di halaman course dan My Learning."
        : c.decision_note ?? "Reviewer meminta tindak lanjut sebelum kelulusan Anda disetujui.",
      subjectKind: "other" as const,
      subjectTitle: title,
      targetUrl: c.course_offerings ? `/academy/course/${c.course_offerings.offering_code}` : "/academy/learn",
      createdAt: c.decided_at,
      actorName: "BARUNA Academy",
    };
  });
}

export async function buildModuleUpdateNotifications(userId: string): Promise<RawNotif[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  const { data: apps, error: appErr } = await db
    .from("course_enrollment_applications")
    .select("course_id, created_at, decision_at")
    .eq("user_id", userId)
    .eq("status", "approved")
    .limit(500);
  if (appErr) throw new Error(appErr.message);
  // Database modules are enrolled by their module_registry id.
  const enrolledSince = new Map<string, string>();
  for (const a of (apps ?? []) as Array<{ course_id: string; created_at: string; decision_at: string | null }>) {
    if (UUID.test(a.course_id)) enrolledSince.set(a.course_id, a.decision_at ?? a.created_at);
  }
  const moduleIds = [...enrolledSince.keys()];
  if (moduleIds.length === 0) return [];

  const [passedRes, modulesRes, versionsRes] = await Promise.all([
    db.from("self_paced_enrollments")
      .select("code")
      .eq("user_id", userId)
      .in("code", moduleIds)
      .eq("completed", true)
      .eq("completion_source", "server_quiz"),
    db.from("module_registry")
      .select("id, title")
      .in("id", moduleIds)
      .eq("current_status", "published")
      .eq("visibility", "public"),
    db.from("module_registry_versions")
      .select("id, module_id, version, created_at")
      .in("module_id", moduleIds)
      .gte("version", 2)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  for (const res of [passedRes, modulesRes, versionsRes]) if (res.error) throw new Error(res.error.message);

  const passed = new Set(((passedRes.data ?? []) as Array<{ code: string }>).map((r) => r.code));
  const titleOf = new Map(((modulesRes.data ?? []) as Array<{ id: string; title: string }>).map((m) => [m.id, m.title]));

  const raw: RawNotif[] = [];
  for (const v of (versionsRes.data ?? []) as Array<{ id: string; module_id: string; version: number; created_at: string }>) {
    const title = titleOf.get(v.module_id);
    const since = enrolledSince.get(v.module_id);
    if (!title || !since || passed.has(v.module_id) || v.created_at <= since) continue;
    raw.push({
      id: `module-update-${v.id}`,
      subjectId: `module-${v.module_id}`,
      type: "info",
      title: `Modul diperbarui ke versi ${v.version}: "${title}"`,
      body: "Materi modul yang sedang Anda pelajari telah diperbarui dan disetujui verifikator. Progres Anda tetap tersimpan; silakan tinjau materi terbaru sebelum mengerjakan kuis.",
      subjectKind: "module",
      subjectTitle: title,
      targetUrl: `/academy/learn/${v.module_id}`,
      createdAt: v.created_at,
      actorName: "BARUNA Academy",
    });
  }
  return raw;
}
