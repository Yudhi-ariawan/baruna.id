// ============================================================================
// Role request notifications (Slide 42, LS-01: "Notifikasi ke Pengguna") — server only.
// Derived on read from rbac_role_change_requests, like the other sources:
//   * the requester — when their request is approved (applied) or rejected;
//   * super admins (roles.manage) — each request waiting for a decision.
// Ids are stable per event, so read markers in notification_reads keep working.
// ============================================================================
import { roleName } from "@/lib/account/role-requests.shared";
import type { WorkflowNotif } from "./workflow-notifications.server";

type Row = {
  id: string;
  action: "grant" | "revoke";
  status: string;
  decision_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  target_user_id: string;
  rbac_roles: { code: string } | null;
};

export async function buildRoleRequestNotifications(userId: string): Promise<WorkflowNotif[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [mine, canDecide] = await Promise.all([
    supabaseAdmin
      .from("rbac_role_change_requests")
      .select("id, action, status, decision_note, reviewed_at, created_at, target_user_id, rbac_roles!inner(code)")
      .eq("target_user_id", userId)
      .in("status", ["applied", "rejected"])
      .order("reviewed_at", { ascending: false })
      .limit(20),
    supabaseAdmin.rpc("has_permission", { _user_id: userId, _permission: "roles.manage" }),
  ]);

  const out: WorkflowNotif[] = ((mine.data ?? []) as unknown as Row[]).map((r) => {
    const approved = r.status === "applied";
    const role = roleName(r.rbac_roles?.code ?? "");
    const removal = r.action === "revoke";
    return {
      id: `rr-${r.id}-${r.status}`,
      subjectId: `rr-${r.id}`,
      type: approved ? "approved" : "rejected",
      title: approved
        ? removal ? `Peran ${role} Anda telah dicabut` : `Permintaan peran ${role} disetujui`
        : `Permintaan peran ${role} ditolak`,
      body:
        r.decision_note?.trim() ||
        (approved
          ? removal ? "Sesuai permintaan Anda." : "Peran sudah aktif. Muat ulang halaman untuk melihat menu barunya."
          : "Permintaan Anda belum dapat disetujui."),
      subjectKind: "other",
      subjectTitle: `Permintaan peran ${role}`,
      targetUrl: approved && !removal ? "/governance" : "/account/profile",
      createdAt: r.reviewed_at ?? r.created_at,
      actorName: "Super Admin BARUNA",
    };
  });

  if (canDecide.data === true) {
    const { data: pending } = await supabaseAdmin
      .from("rbac_role_change_requests")
      .select("id, action, status, decision_note, reviewed_at, created_at, target_user_id, rbac_roles!inner(code)")
      .eq("status", "pending")
      .neq("target_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    const rows = (pending ?? []) as unknown as Row[];
    const ids = [...new Set(rows.map((r) => r.target_user_id))];
    const { data: names } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] as Array<{ id: string; display_name: string | null }> };
    const nameOf = new Map((names ?? []).map((p) => [p.id, p.display_name || "Pengguna"]));
    for (const r of rows) {
      const who = nameOf.get(r.target_user_id) ?? "Pengguna";
      out.push({
        id: `rr-${r.id}-pending-staff`,
        subjectId: `rr-staff-${r.id}`,
        type: "info",
        title: `${who} meminta peran ${roleName(r.rbac_roles?.code ?? "")}`,
        body: "Menunggu keputusan super admin di Portal Admin → Permintaan Akses.",
        subjectKind: "other",
        subjectTitle: "Permintaan Akses",
        targetUrl: "/admin/access-requests",
        createdAt: r.created_at,
        actorName: who,
      });
    }
  }
  return out;
}
