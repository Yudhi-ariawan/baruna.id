import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Plus,
  FileText,
  Eye,
  Pencil,
  RotateCcw,
  Globe,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import { useHomeExperience } from "@/components/baruna/home-experience";
import {
  listMyKnowledgeContributions,
  type KnowledgeContributionItem,
} from "@/lib/knowledge-hub/contribution.functions";
import { formatDate, formatBytes } from "@/lib/resources";

export const Route = createFileRoute("/knowledge-hub_/my-contributions")({
  head: () => ({
    meta: [
      { title: "My Contributions — Knowledge Hub — BARUNA" },
      {
        name: "description",
        content: "Track all the resources you have submitted to the BARUNA Knowledge Hub.",
      },
    ],
    links: [{ rel: "canonical", href: "/knowledge-hub/my-contributions" }],
  }),
  component: MyContributionsPage,
});

function StatusBadge({ status, label }: { status: KnowledgeContributionItem["status"]; label: string }) {
  if (status === "published" || status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" /> {label}
      </span>
    );
  }
  if (status === "revision_requested") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
        <AlertTriangle className="h-3.5 w-3.5" /> {label}
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-red-100 text-red-800 border border-red-200">
        <AlertTriangle className="h-3.5 w-3.5" /> {label}
      </span>
    );
  }
  if (status === "under_review" || status === "submitted") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
        <Clock className="h-3.5 w-3.5" /> {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
      <FileText className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

function Pipeline({ status }: { status: KnowledgeContributionItem["status"] }) {
  const steps = ["Submitted", "Under Review", "Published"];
  let activeIndex = 0;
  if (status === "under_review") activeIndex = 1;
  if (status === "approved" || status === "published") activeIndex = 2;
  if (status === "revision_requested") activeIndex = 1;

  return (
    <div className="mt-3 flex items-center gap-1">
      {steps.map((stage, i) => {
        const reached = i <= activeIndex;
        return (
          <div key={stage} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <span className={`h-2.5 w-2.5 rounded-full ${reached ? "bg-marine" : "bg-muted"}`} />
            </div>
            {i < steps.length - 1 && (
              <span className={`h-px flex-1 ${i < activeIndex ? "bg-marine" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ContributionCard({ r }: { r: KnowledgeContributionItem }) {
  const editId = r.draftId || r.id;
  const isPublished = r.status === "published" || r.status === "approved";
  const isRevision = r.status === "revision_requested";

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-wide text-marine">{r.type}</span>
            {r.topicCategory && (
              <span className="text-[0.65rem] text-muted-foreground">· {r.topicCategory}</span>
            )}
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-navy">{r.title || "Untitled resource"}</h3>
          {r.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>}
        </div>
        <StatusBadge status={r.status} label={r.statusLabel} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {r.institution && <span>{r.institution}</span>}
        {r.country && <span>· {r.country}</span>}
        {r.fileInfo && <span>· {r.fileInfo.name} ({formatBytes(r.fileInfo.size || 0)})</span>}
        <span>· Diperbarui {formatDate(r.updatedAt)}</span>
      </div>

      {r.status !== "draft" && <Pipeline status={r.status} />}

      {isRevision && r.reviewNote && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
          <strong className="block font-bold mb-1 flex items-center gap-1.5 text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Catatan Kurator / Administrator:
          </strong>
          <p className="leading-relaxed">{r.reviewNote}</p>
        </div>
      )}

      {r.isResubmitted && r.status === "under_review" && (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/80 p-3 text-xs text-indigo-900">
          <strong className="block font-bold mb-1 flex items-center gap-1.5 text-indigo-800">
            <RotateCcw className="h-3.5 w-3.5 text-indigo-600" /> Revisi Telah Dikirim:
          </strong>
          <p className="leading-relaxed">
            Perubahan Anda telah dikirimkan kembali ke kurator dan saat ini sedang menunggu peninjauan ulang oleh admin.
          </p>
          {r.reviewNote && (
            <p className="mt-1.5 text-[11px] text-indigo-700/90 italic">
              Catatan revisi sebelumnya: "{r.reviewNote}"
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        {isPublished ? (
          r.resourceId ? (
            <Link
              to="/knowledge-hub/resource/$id"
              params={{ id: r.resourceId }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-muted"
            >
              <Eye className="h-3.5 w-3.5 text-marine" /> Lihat di Katalog Publik
            </Link>
          ) : (
            <Link
              to="/knowledge-hub/$type"
              params={{
                type:
                  r.type === "Best Practice" || r.type === "best_practice"
                    ? "best-practices"
                    : r.type === "Case Study" || r.type === "case_study"
                      ? "case-studies"
                      : r.type === "Policy Brief" || r.type === "policy_brief"
                        ? "policy-briefs"
                        : "publications",
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-muted"
            >
              <Eye className="h-3.5 w-3.5 text-marine" /> Lihat di Katalog Publik
            </Link>
          )
        ) : (
          <Link
            to="/knowledge-hub/submit-resource"
            search={{ edit: editId }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              isRevision
                ? "bg-marine text-white hover:bg-navy shadow-2xs font-bold"
                : "border border-border text-navy hover:bg-muted"
            }`}
          >
            {isRevision ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" /> Perbaiki & Ajukan Ulang
              </>
            ) : r.status === "draft" ? (
              <>
                <Pencil className="h-3.5 w-3.5" /> Lanjutkan Isi Draf
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" /> Lihat Rincian Pengajuan
              </>
            )}
          </Link>
        )}
      </div>
    </article>
  );
}

function MyContributionsPage() {
  const { authState, viewer } = useHomeExperience();
  const fetchContributions = useServerFn(listMyKnowledgeContributions);

  const query = useQuery({
    queryKey: ["knowledge-hub", "my-contributions", viewer?.id],
    queryFn: () => fetchContributions(),
    enabled: authState === "authenticated",
  });

  const contributions = query.data ?? [];

  const counts = {
    total: contributions.length,
    published: contributions.filter((r) => r.status === "published" || r.status === "approved").length,
    review: contributions.filter((r) => r.status === "under_review" || r.status === "submitted" || r.status === "revision_requested").length,
    drafts: contributions.filter((r) => r.status === "draft").length,
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          to="/knowledge-hub"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine transition-colors hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> Knowledge Hub
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">My Contributions</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Lacak seluruh publikasi, modul, laporan, dan dokumen pengetahuan yang Anda ajukan ke Knowledge Hub beserta status kurasinya.
            </p>
          </div>
          <Link
            to="/knowledge-hub/submit-resource"
            className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy shadow-xs"
          >
            <Plus className="h-4 w-4" /> Submit Resource
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Kontribusi", value: counts.total },
            { label: "Tayang / Published", value: counts.published },
            { label: "Dalam Peninjauan", value: counts.review },
            { label: "Draf", value: counts.drafts },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center shadow-soft">
              <p className="font-display text-2xl font-extrabold text-navy">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {query.isLoading ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center text-xs text-muted-foreground">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-marine mb-2" />
              Memuat data kontribusi Anda dari sistem...
            </div>
          ) : contributions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <Globe className="mx-auto h-8 w-8 text-marine" />
              <p className="mt-3 font-display text-lg font-bold text-navy">Belum ada kontribusi tersimpan</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Bagikan artikel riset, pedoman teknis, best practice, atau video pertama Anda ke jaringan BARUNA.
              </p>
              <Link
                to="/knowledge-hub/submit-resource"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
              >
                <Plus className="h-4 w-4" /> Submit a Resource
              </Link>
            </div>
          ) : (
            contributions.map((r) => <ContributionCard key={r.id} r={r} />)
          )}
        </div>
      </main>
    </div>
  );
}

