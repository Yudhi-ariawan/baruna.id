import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  Bell,
  CheckCheck,
  CheckCircle2,
  RotateCcw,
  XCircle,
  ArrowRight,
  Info,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { Badge } from "@/components/ui/badge";
import {
  listMyNotifications,
  markNotificationsAsRead,
} from "@/lib/notifications/notifications.functions";
import {
  markLocalNotificationsRead,
  useReadNotificationIds,
} from "@/lib/notifications/readState";
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

type NotificationFilter = "all" | "unread";

function NotificationsPage() {
  const { language } = useLanguage();
  const isId = language === "id";
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const getNotifs = useServerFn(listMyNotifications);
  const markReadServerFn = useServerFn(markNotificationsAsRead);
  const readIds = useReadNotificationIds();

  const query = useQuery({
    queryKey: ["notifications", "my"],
    queryFn: () => getNotifs(),
    retry: false,
  });

  const realNotifs = useMemo(
    () =>
      (query.data ?? []).map((n) => ({
        ...n,
        effectiveRead: Boolean(n.isRead || readIds.includes(n.id)),
      })),
    [query.data, readIds],
  );

  const unreadNotifs = useMemo(
    () => realNotifs.filter((n) => !n.effectiveRead),
    [realNotifs],
  );

  const displayedNotifs = useMemo(
    () => (filter === "unread" ? unreadNotifs : realNotifs),
    [filter, realNotifs, unreadNotifs],
  );

  const handleMarkAsRead = (ids: string[]) => {
    if (!ids.length) return;
    markLocalNotificationsRead(ids);
    void markReadServerFn({ data: { notificationIds: ids } })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      })
      .catch(() => {});
  };

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
              {
                label: isId ? "Semua Notifikasi" : "All Notifications",
                count: realNotifs.length,
                active: filter === "all",
                onClick: () => setFilter("all"),
              },
              {
                label: isId ? "Belum Dibaca" : "Unread",
                count: unreadNotifs.length,
                active: filter === "unread",
                onClick: () => setFilter("unread"),
              },
            ],
          },
          {
            label: isId ? "Pintasan" : "Shortcuts",
            items: [
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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-3xl font-extrabold text-navy">
                {isId ? "Pemberitahuan" : "Notifications"}
              </h1>
              {unreadNotifs.length > 0 ? (
                <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-extrabold text-white">
                  {unreadNotifs.length} {isId ? "Baru" : "Unread"}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isId
                ? "Status evaluasi berkas, keputusan verifikator, dan aktivitas penting di BARUNA."
                : "Document evaluation status, verifier decisions, and important activities in BARUNA."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filter === "all"
                    ? "bg-marine text-white"
                    : "text-foreground/70 hover:text-navy"
                }`}
              >
                {isId ? "Semua" : "All"} ({realNotifs.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filter === "unread"
                    ? "bg-marine text-white"
                    : "text-foreground/70 hover:text-navy"
                }`}
              >
                {isId ? "Belum Dibaca" : "Unread"} ({unreadNotifs.length})
              </button>
            </div>

            {unreadNotifs.length > 0 ? (
              <button
                type="button"
                onClick={() => handleMarkAsRead(unreadNotifs.map((n) => n.id))}
                className="inline-flex items-center gap-1.5 rounded-xl border border-marine/30 bg-marine/10 px-3.5 py-2 text-xs font-bold text-marine transition hover:bg-marine hover:text-white cursor-pointer"
              >
                <CheckCheck className="h-4 w-4" />
                {isId ? "Tandai Semua Sudah Dibaca" : "Mark All as Read"}
              </button>
            ) : null}
          </div>
        </div>

        {/* Real Dynamic Notifications from Governance & Review Decisions */}
        {displayedNotifs.length > 0 ? (
          <div className="space-y-3.5">
            {displayedNotifs.map((n) => {
              const isRevision = n.type === "revision_requested";
              const isApproved = n.type === "approved";
              const isRejected = n.type === "rejected";
              const isArchived = n.type === "archived";
              const isInfo = n.type === "info";
              const isRead = n.effectiveRead;

              return (
                <div
                  key={n.id}
                  className={`rounded-2xl border p-5 transition-all shadow-xs ${
                    isRead
                      ? "border-border/70 bg-card/60 opacity-85"
                      : isRevision
                        ? "border-amber-300 bg-amber-50/80 ring-1 ring-amber-300/60"
                        : isApproved
                          ? "border-emerald-300 bg-emerald-50/80 ring-1 ring-emerald-300/60"
                          : isArchived
                            ? "border-slate-300 bg-slate-100/80 ring-1 ring-slate-300/60"
                            : isRejected
                              ? "border-rose-300 bg-rose-50/80 ring-1 ring-rose-300/60"
                              : isInfo
                                ? "border-sky-300 bg-sky-50/80 ring-1 ring-sky-300/60"
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
                              : isArchived
                                ? "bg-slate-200 text-slate-800"
                                : isInfo
                                  ? "bg-sky-200/80 text-sky-800"
                                  : "bg-rose-200/80 text-rose-800"
                        }`}
                      >
                        {isRevision ? (
                          <RotateCcw className="h-5 w-5 text-amber-700" />
                        ) : isApproved ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                        ) : isArchived ? (
                          <Archive className="h-5 w-5 text-slate-700" />
                        ) : isInfo ? (
                          <Info className="h-5 w-5 text-sky-700" />
                        ) : (
                          <XCircle className="h-5 w-5 text-rose-700" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!isRead ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-marine px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                              {isId ? "Baru" : "New"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              <CheckCheck className="h-3 w-3" />
                              {isId ? "Sudah Dibaca" : "Read"}
                            </span>
                          )}
                          <Badge
                            className={`text-[10px] font-bold uppercase tracking-wider py-0 px-2 ${
                              isRevision
                                ? "bg-amber-200 text-amber-900 border-amber-300"
                                : isApproved
                                  ? "bg-emerald-200 text-emerald-900 border-emerald-300"
                                  : isArchived
                                    ? "bg-slate-200 text-slate-900 border-slate-300"
                                    : "bg-rose-200 text-rose-900 border-rose-300"
                            }`}
                          >
                            {isRevision
                              ? (isId ? "Perlu Tindakan / Revisi" : "Action / Revision Required")
                              : isApproved
                                ? (isId ? "Disetujui" : "Approved")
                                : isArchived
                                  ? (isId ? "Diarsipkan / Tarik Tayang" : "Archived / Unpublished")
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
                                : isArchived
                                  ? "bg-white/90 border border-slate-300 text-slate-800"
                                  : "bg-white/80 border border-rose-200 text-rose-950"
                          }`}
                        >
                          <span className="font-bold text-[11px] uppercase tracking-wider block mb-1">
                            {isRevision
                              ? (isId ? "Catatan Verifikator / Alasan Revisi:" : "Reviewer Notes / Revision Reason:")
                              : isArchived
                                ? (isId ? "Catatan Administrator / Alasan Pengarsipan:" : "Administrator Note / Archive Reason:")
                                : (isId ? "Keterangan:" : "Details:")}
                          </span>
                          <p className="italic">&quot;{n.body}&quot;</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
                      {!isRead ? (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead([n.id])}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-marine hover:text-marine cursor-pointer"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          {isId ? "Tandai Dibaca" : "Mark Read"}
                        </button>
                      ) : null}
                      <Link
                        to={n.targetUrl}
                        onClick={() => handleMarkAsRead([n.id])}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition ${
                          isRevision
                            ? "bg-amber-600 hover:bg-amber-700"
                            : isApproved
                              ? "bg-emerald-600 hover:bg-emerald-700"
                              : isArchived
                                ? "bg-slate-700 hover:bg-slate-800"
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
              {filter === "unread"
                ? (isId ? "Semua Notifikasi Sudah Dibaca" : "All Notifications Read")
                : (isId ? "Tidak Ada Pemberitahuan Baru" : "No New Notifications")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              {filter === "unread"
                ? (isId
                    ? "Tidak ada notifikasi yang belum dibaca. Klik tab 'Semua' untuk melihat riwayat notifikasi Anda."
                    : "You have no unread notifications. Switch to 'All' to view your notification history.")
                : (isId
                    ? "Semua pengajuan dan aktivitas akun Anda dalam kondisi terkini."
                    : "All your submissions and account activities are up to date.")}
            </p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
