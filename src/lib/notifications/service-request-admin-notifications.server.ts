// Penugasan Expert (Slide 38): bell notifications for BARUNA admins. Requesters and
// experts already hear about admin actions (notifications.functions.ts); this is the
// other direction, so an admin knows when a request needs them without watching the
// console: a new request, a requester answering the admin's question, an expert
// accepting or declining, a requester cancelling. Built from the append-only event
// log, so nothing extra is stored.
import type { InAppNotification } from "./notifications.functions";

type RawNotif = InAppNotification & { subjectId: string };
type Copy = { type: InAppNotification["type"]; title: string; body: string };
type Ev = { id: string; request_id: string; actor_id: string | null; actor_role: string; action: string; to_status: string | null; message: string | null; created_at: string };

/** Statuses a requester's answer goes back to when the ADMIN asked (not the expert). */
const ADMIN_STAGES = new Set(["submitted", "under_review", "expert_matching"]);

function copyFor(ev: Ev): Copy | null {
  if (ev.actor_role === "requester") {
    if (ev.action === "submit") return { type: "revision_requested", title: "Permintaan expert baru", body: "Periksa kelengkapannya, lalu cocokkan dan tugaskan expert." };
    if (ev.action === "reply" && ev.to_status && ADMIN_STAGES.has(ev.to_status)) {
      return { type: "revision_requested", title: "Pemohon menjawab pertanyaan Anda", body: "Lanjutkan pemeriksaan atau tugaskan expert." };
    }
    if (ev.action === "cancel") return { type: "info", title: "Pemohon membatalkan permintaan", body: "Permintaan ditutup oleh pemohon; tidak perlu tindakan." };
  }
  if (ev.actor_role === "expert") {
    if (ev.action === "accept") return { type: "approved", title: "Expert menerima penugasan", body: "Tandai terjadwal setelah jadwal disepakati, lalu selesaikan untuk mencatat riwayat fasilitasi." };
    if (ev.action === "decline") return { type: "revision_requested", title: "Expert menolak penugasan", body: "Permintaan kembali ke Pencocokan: tugaskan expert lain atau tolak dengan alasan." };
  }
  return null;
}

export async function buildServiceRequestAdminNotifications(userId: string): Promise<RawNotif[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: events } = await supabaseAdmin
    .from("expert_service_request_events")
    .select("id, request_id, actor_id, actor_role, action, to_status, message, created_at")
    .in("actor_role", ["requester", "expert"])
    .in("action", ["submit", "reply", "cancel", "accept", "decline"])
    .order("created_at", { ascending: false })
    .limit(100);
  const relevant = ((events ?? []) as Ev[]).filter((e) => e.actor_id !== userId && copyFor(e));
  if (!relevant.length) return [];

  const ids = [...new Set(relevant.map((e) => e.request_id))];
  const { data: requests } = await supabaseAdmin
    .from("expert_service_requests")
    .select("id, request_number, requester_id, payload")
    .in("id", ids);
  const byId = new Map((requests ?? []).map((r) => [r.id, r]));

  const out: RawNotif[] = [];
  for (const ev of relevant) {
    const req = byId.get(ev.request_id);
    // Requests the admin made themselves are handled by another admin (cannot_process_own_request).
    if (!req || req.requester_id === userId) continue;
    const copy = copyFor(ev)!;
    const values = ((req.payload as { values?: Record<string, string> } | null)?.values ?? {});
    const topic = values.eventName || values.trainingTitle || values.subjectArea || values.objective || values.technicalIssue || "";
    const message = ev.message?.trim();
    out.push({
      id: `sre-adm-${ev.id}`,
      subjectId: `sr-adm-${ev.request_id}`,
      type: copy.type,
      title: `${copy.title} (${req.request_number})`,
      body: [topic ? `“${topic}”.` : "", copy.body, message ? `Pesan: ${message}` : ""].filter(Boolean).join(" "),
      subjectKind: "service_request",
      subjectTitle: req.request_number,
      targetUrl: "/admin/service-requests",
      createdAt: ev.created_at,
      actorName: ev.actor_role === "expert" ? "Expert" : "Pemohon",
    });
  }
  return out;
}
