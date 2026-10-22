// Learners hear when a module they are studying is updated (Slide 13: automatic
// notification on status changes; PB-ACA-01 versioning).
//
// Recipients: approved enrollment for the module, enrolled before the new version
// went live, and NOT yet passed (passing is recorded by the server, completion_source
// 'server_quiz'). Whether learners who already passed must retake the quiz is a
// mentor decision (MENUNGGU_ARAHAN_MENTOR item 9), so they are not notified yet.
import type { InAppNotification } from "./notifications.functions";

type RawNotif = InAppNotification & { subjectId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
