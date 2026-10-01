import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  CheckCircle2,
  GraduationCap,
  Award,
  MessagesSquare,
  CalendarDays,
  Users,
  FileEdit,
  RotateCcw,
  XCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { Badge } from "@/components/ui/badge";
import { listMyNotifications } from "@/lib/notifications/notifications.functions";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — BARUNA" },
      { name: "description", content: "Notifications, activity, and verification status in BARUNA." },
    ],
  }),
  component: NotificationsPage,
});

function formatRelativeTime(dateStr: string, isId: boolean) {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return isId ? "Baru saja" : "Just now";
    if (diffMins < 60) return isId ? `${diffMins} menit lalu` : `${diffMins}m ago`;
    if (diffHours < 24) return isId ? `${diffHours} jam lalu` : `${diffHours}h ago`;
    if (diffDays === 1) return isId ? "Kemarin" : "Yesterday";
    if (diffDays < 7) return isId ? `${diffDays} hari lalu` : `${diffDays}d ago`;
    return new Intl.DateTimeFormat(isId ? "id-ID" : "en-US", { dateStyle: "medium" }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function NotificationsPage() {
  const { language, t } = useLanguage();
  const isId = language === "id";

  const getNotifs = useServerFn(listMyNotifications);
  const query = useQuery({
    queryKey: ["notifications", "my"],
    queryFn: () => getNotifs(),
    retry: false,
  });

  const realNotifs = query.data ?? [];

  return (
    <PageShell
      sidebar={{
        icon: Bell,
        title: isId ? "Notifikasi" : "Notifications",
        subtitle: isId ? "Aktivitas dan status pengajuan Anda." : "Your submissions and activity status.",
        sections: [
          {
            label: isId ? "Saring" : "Filter",
            items: [
              { label: isId ? "Semua Notifikasi" : "All Notifications", active: true },
              { label: isId ? "Pembelajaran" : "Learning", to: "/academy/learn" },
              { label: isId ? "Acara" : "Events", to: "/events" },
              { label: isId ? "Pakar" : "Experts", to: "/experts" },
            ],
          },
        ],
      }}
      cta={{
        icon: Bell,
        title: isId ? "Pengaturan notifikasi" : "Notification settings",
        description: isId ? "Atur preferensi pemberitahuan akun Anda." : "Manage your notification preferences.",
        button: isId ? "Ke Pengaturan" : "Go to Settings",
        href: "/account/profile",
      }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">
            {isId ? "Pemberitahuan" : "Notifications"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isId
              ? "Status evaluasi berkas, keputusan verifikator, dan aktivitas penting di BARUNA."
              : "Document evaluation status, verifier decisions, and important activities in BARUNA."}
          </p>
        </div>

        {/* Real Dynamic Notifications from Governance & Review Decisions */}
        {realNotifs.length > 0 ? (
          <div className="space-y-3.5">
            {realNotifs.map((n) => {
              const isRevision = n.type === "revision_requested";
              const isApproved = n.type === "approved";
              const isRejected = n.type === "rejected";

              return (
                <div
                  key={n.id}
                  className={`rounded-2xl border p-5 transition-all shadow-xs ${
                    isRevision
                      ? "border-amber-300 bg-amber-50/80"
                      : isApproved
                        ? "border-emerald-300 bg-emerald-50/80"
                        : isRejected
                          ? "border-rose-300 bg-rose-50/80"
                          : "border-border bg-card"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <span
                        className={`rounded-xl p-2.5 shrink-0 mt-0.5 ${
                          isRevision
                            ? "bg-amber-200/80 text-amber-800"
                            : isApproved
                              ? "bg-emerald-200/80 text-emerald-800"
                              : "bg-rose-200/80 text-rose-800"
                        }`}
                      >
                        {isRevision ? (
                          <RotateCcw className="h-5 w-5 text-amber-700" />
                        ) : isApproved ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                        ) : (
                          <XCircle className="h-5 w-5 text-rose-700" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={`text-[10px] font-bold uppercase tracking-wider py-0 px-2 ${
                              isRevision
                                ? "bg-amber-200 text-amber-900 border-amber-300"
                                : isApproved
                                  ? "bg-emerald-200 text-emerald-900 border-emerald-300"
                                  : "bg-rose-200 text-rose-900 border-rose-300"
                            }`}
                          >
                            {isRevision
                              ? (isId ? "Perlu Tindakan / Revisi" : "Action / Revision Required")
                              : isApproved
                                ? (isId ? "Disetujui" : "Approved")
                                : (isId ? "Ditolak" : "Rejected")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(n.createdAt, isId)}
                          </span>
                        </div>

                        <h3 className="font-display text-base font-bold text-navy mt-1.5">
                          {n.title}
                        </h3>

                        <div
                          className={`mt-2 rounded-xl p-3.5 text-xs leading-relaxed ${
                            isRevision
                              ? "bg-white/90 border border-amber-200 text-slate-800"
                              : isApproved
                                ? "bg-white/80 border border-emerald-200 text-emerald-950"
                                : "bg-white/80 border border-rose-200 text-rose-950"
                          }`}
                        >
                          <span className="font-bold text-[11px] uppercase tracking-wider block mb-1">
                            {isRevision
                              ? (isId ? "Catatan Verifikator / Alasan Revisi:" : "Reviewer Notes / Revision Reason:")
                              : (isId ? "Keterangan:" : "Details:")}
                          </span>
                          <p className="italic">&quot;{n.body}&quot;</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="shrink-0 self-start sm:self-center">
                      <Link
                        to={n.targetUrl}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition ${
                          isRevision
                            ? "bg-amber-600 hover:bg-amber-700"
                            : isApproved
                              ? "bg-emerald-600 hover:bg-emerald-700"
                              : "bg-navy hover:bg-navy/90"
                        }`}
                      >
                        {isRevision ? (
                          <>
                            <RotateCcw className="h-3.5 w-3.5" /> {isId ? "Ganti Berkas & Kirim Ulang" : "Update Files & Resubmit"}
                          </>
                        ) : (
                          <>
                            {isId ? "Buka Detail" : "View Details"} <ArrowRight className="h-3.5 w-3.5" />
                          </>
                        )}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600/70" />
            <h3 className="mt-3 font-display text-base font-bold text-navy">
              {isId ? "Tidak Ada Pemberitahuan Baru" : "No New Notifications"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              {isId
                ? "Semua pengajuan dan aktivitas akun Anda dalam kondisi terkini."
                : "All your submissions and account activities are up to date."}
            </p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
