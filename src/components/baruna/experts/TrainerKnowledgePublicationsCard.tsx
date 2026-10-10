import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileEdit,
  FileText,
  Plus,
  RotateCcw,
  ScrollText,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listMyKnowledgeContributions, type KnowledgeContributionItem } from "@/lib/knowledge-hub/contribution.functions";

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function resolvePublicationStatus(item: KnowledgeContributionItem) {
  switch (item.status) {
    case "published":
      return {
        label: "Disetujui & Tayang",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
        icon: CheckCircle2,
      };
    case "approved":
      return {
        label: "Disetujui",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
        icon: CheckCircle2,
      };
    case "revision_requested":
      return {
        label: "Perlu Revisi",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
        icon: RotateCcw,
      };
    case "rejected":
      return {
        label: "Ditolak",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
        icon: XCircle,
      };
    case "under_review":
    case "submitted":
      return {
        label: "Dalam Peninjauan",
        badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
        icon: Clock,
      };
    default:
      return {
        label: "Draf",
        badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
        icon: FileEdit,
      };
  }
}

export function TrainerKnowledgePublicationsCard() {
  const fetchContributions = useServerFn(listMyKnowledgeContributions);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["knowledge-hub", "my-contributions"],
    queryFn: () => fetchContributions(),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-soft">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold text-navy flex items-center gap-2">
            <ScrollText className="h-4.5 w-4.5 text-sky-600" /> Publikasi, Best Practice &amp; Dokumen Pengetahuan Saya
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Karya ilmiah, laporan riset, praktik terbaik (best practice), studi kasus, dan naskah publikasi Anda di Knowledge Hub.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <Link
            to="/knowledge-hub/submit-resource"
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-sky-700 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Submit Publikasi
          </Link>
          <Link
            to="/knowledge-hub/submit-resource"
            search={{ type: "Best Practice" }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition"
          >
            <Sparkles className="h-3.5 w-3.5" /> Submit Best Practice
          </Link>
          <Link
            to="/knowledge-hub/my-contributions"
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-muted transition"
          >
            Lihat Semua ({items.length})
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          Memuat daftar publikasi Anda…
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-semibold text-navy">Belum ada publikasi yang diajukan</p>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-sm mx-auto">
            Sebagai Trainer resmi BARUNA, Anda dapat membagikan karya riset, artikel jurnal, atau best practice dari institusi Anda ke Knowledge Hub.
          </p>
          <Link
            to="/knowledge-hub/submit-resource"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition shadow-xs"
          >
            Unggah Publikasi Pertama <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-border/60">
          {items.slice(0, 5).map((item) => {
            const statusInfo = resolvePublicationStatus(item);
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={item.id}
                className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-sm font-bold text-navy truncate">
                      {item.title}
                    </h3>
                    <Badge
                      className={`flex items-center gap-1 text-[11px] font-medium py-0.5 px-2 ${statusInfo.badgeClass}`}
                    >
                      <StatusIcon className="h-3 w-3" /> {statusInfo.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sky-700">{item.type}</span>
                    <span>•</span>
                    <span>Diperbarui {formatDate(item.updatedAt)}</span>
                    {item.fileInfo?.name && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[160px]">📎 {item.fileInfo.name}</span>
                      </>
                    )}
                  </p>
                  {item.reviewNote && (item.status === "revision_requested" || item.status === "rejected") && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 rounded px-2 py-1 border border-amber-200 mt-1">
                      Catatan Verifikator: {item.reviewNote}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                  {item.status === "published" || item.status === "approved" ? (
                    item.resourceId ? (
                      <Link
                        to="/knowledge-hub/resource/$id"
                        params={{ id: item.resourceId }}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-100 transition"
                      >
                        Lihat di Katalog <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <Link
                        to="/knowledge-hub"
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-100 transition"
                      >
                        Lihat di Katalog <ExternalLink className="h-3 w-3" />
                      </Link>
                    )
                  ) : item.status === "revision_requested" ? (
                    <Link
                      to="/knowledge-hub/submit-resource"
                      search={{ edit: item.draftId }}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-amber-700 transition"
                    >
                      <FileEdit className="h-3 w-3" /> Perbaiki Naskah
                    </Link>
                  ) : item.status === "draft" ? (
                    <Link
                      to="/knowledge-hub/submit-resource"
                      search={{ edit: item.draftId }}
                      className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-sky-700 transition"
                    >
                      <FileEdit className="h-3 w-3" /> Lanjutkan Draf
                    </Link>
                  ) : (
                    <Link
                      to="/knowledge-hub/my-contributions"
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-navy hover:bg-slate-100 transition"
                    >
                      Detail Status <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
