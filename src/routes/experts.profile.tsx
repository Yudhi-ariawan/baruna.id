import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FilePenLine,
  UserPlus,
  RotateCcw,
  XCircle,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { listMyExpertApplications } from "@/lib/experts/application.functions";
import type { ExpertApplicationStatus } from "@/lib/experts/application.types";

export const Route = createFileRoute("/experts/profile")({
  head: () => ({
    meta: [
      { title: "My Expert Profile — BARUNA Experts" },
      { name: "description", content: "Track your BARUNA expert application and review status." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MyExpertProfilePage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Menunggu Verifikasi",
  pending: "Menunggu Verifikasi",
  under_review: "Sedang Ditinjau",
  decision_pending: "Menunggu Keputusan",
  revision_requested: "Perlu Revisi Dokumen",
  approved: "Disetujui",
  rejected: "Ditolak",
  withdrawn: "Ditarik",
};

function statusFor(application: ExpertApplicationStatus) {
  return STATUS_LABEL[application.reviewStatus ?? application.draftStatus] ?? "In Progress";
}

function MyExpertProfilePage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listMyExpertApplications);
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const authenticated = Boolean(data.user);
      setSignedIn(authenticated);
      setAuthReady(true);
      if (!authenticated) {
        navigate({
          to: "/auth",
          search: { mode: "signin", redirect: "/experts/profile" },
          replace: true,
        });
      }
    });
  }, [navigate]);

  const applications = useQuery({
    queryKey: ["experts", "my-applications"],
    queryFn: () => listFn(),
    enabled: signedIn,
    retry: false,
  });

  if (!authReady || (signedIn && applications.isLoading)) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-16 text-sm text-muted-foreground sm:px-6">
          Loading your expert application…
        </main>
      </div>
    );
  }
  if (!signedIn) return null;

  const rows = applications.data ?? [];
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          to="/experts"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> Experts
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">My Expert Profile</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Track your application from draft through governance review and approval.
            </p>
          </div>
          <Link
            to="/experts/join"
            className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground hover:bg-navy"
          >
            <UserPlus className="h-4 w-4" />{" "}
            {rows.some((row) => row.draftStatus === "draft") ? "Continue Draft" : "New Application"}
          </Link>
        </div>

        {applications.isError ? (
          <p className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {(applications.error as Error).message}
          </p>
        ) : rows.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <UserPlus className="mx-auto h-9 w-9 text-marine" />
            <h2 className="mt-4 font-display text-xl font-bold text-navy">
              No expert application yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Start an application to join BARUNA's curated marine and fisheries expert network.
            </p>
            <Link
              to="/experts/join"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-white"
            >
              Join as an Expert <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        ) : (
          <div className="mt-6 space-y-4">
            {rows.map((application) => {
              const status = statusFor(application);
              const isRevision = application.reviewStatus === "revision_requested";
              const isRejected = application.reviewStatus === "rejected";
              const isApproved =
                application.reviewStatus === "approved" ||
                application.draftStatus === "approved";
              const isDraft = application.draftStatus === "draft";

              const Icon = isApproved
                ? CheckCircle2
                : isRevision
                  ? RotateCcw
                  : isRejected
                    ? XCircle
                    : isDraft
                      ? FilePenLine
                      : Clock3;

              const badgeClass = isApproved
                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                : isRevision
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : isRejected
                    ? "bg-rose-100 text-rose-800 border-rose-300"
                    : isDraft
                      ? "bg-slate-100 text-slate-700 border-slate-300"
                      : "bg-blue-100 text-blue-800 border-blue-200";

              const cardBorder = isRevision
                ? "border-amber-300 bg-amber-50/15"
                : isRejected
                  ? "border-rose-200 bg-rose-50/10"
                  : "border-border bg-card";

              const docs = application.payload.documents ?? [];

              const openDocInTab = async (path?: string, name?: string) => {
                if (!path) return;
                try {
                  const { data, error } = await supabase.storage
                    .from("expert-applications")
                    .createSignedUrl(path, 3600);
                  if (error || !data?.signedUrl) {
                    alert("Gagal membuat tautan akses berkas.");
                    return;
                  }
                  const viewerUrl = `/document-viewer?url=${encodeURIComponent(data.signedUrl)}&title=${encodeURIComponent(name || "Berkas")}`;
                  window.open(viewerUrl, "_blank", "noopener,noreferrer");
                } catch {
                  alert("Tidak dapat mengakses berkas.");
                }
              };

              return (
                <article
                  key={application.draftId}
                  className={`rounded-2xl border p-6 shadow-soft transition-all ${cardBorder}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-marine">
                        Expert Application
                      </p>
                      <h2 className="mt-1 font-display text-lg font-bold text-navy">
                        {application.title}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Updated {new Date(application.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${badgeClass}`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {status}
                    </span>
                  </div>

                  {/* Rationale / Catatan Evaluasi jika Revisi atau Penolakan */}
                  {isRevision && (
                    <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50/90 p-4">
                      <div className="flex items-center gap-2 font-bold text-amber-900 text-xs">
                        <RotateCcw className="h-4 w-4 text-amber-700" />
                        Catatan Permintaan Revisi dari Verifikator Admin:
                      </div>
                      {application.latestDecision?.rationale ? (
                        <p className="mt-2 text-xs italic text-slate-800 bg-white/90 p-3 rounded-lg border border-amber-200">
                          &quot;{application.latestDecision.rationale}&quot;
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-amber-800">
                          Mohon periksa dan perbarui berkas dokumen pengajuan Anda.
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link
                          to="/experts/join"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition-colors"
                        >
                          <FilePenLine className="h-3.5 w-3.5" /> Ganti Berkas &amp; Kirim Ulang Revisi
                        </Link>
                      </div>
                    </div>
                  )}

                  {isRejected && application.latestDecision?.rationale && (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800">
                      <p className="font-bold text-rose-900">Alasan Penolakan:</p>
                      <p className="mt-1 italic">&quot;{application.latestDecision.rationale}&quot;</p>
                    </div>
                  )}

                  <div className="mt-5 grid gap-3 border-t border-border pt-5 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Expertise</p>
                      <p className="mt-1 font-semibold text-navy">
                        {application.payload.expertise?.length ?? 0} areas
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Documents</p>
                      <p className="mt-1 font-semibold text-navy">
                        {docs.length} secured files
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Review Reference</p>
                      <p className="mt-1 truncate font-mono text-xs text-navy">
                        {application.subjectId ?? "Not submitted"}
                      </p>
                    </div>
                  </div>

                  {/* Daftar Dokumen dengan Tombol Buka di Tab */}
                  {docs.length > 0 && (
                    <div className="mt-4 border-t border-border/60 pt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        Berkas Dokumen Terlampir:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {docs.map((d, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => openDocInTab(d.path, d.name)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-navy hover:border-marine hover:text-marine transition-colors"
                          >
                            <FileText className="h-3.5 w-3.5 text-marine" />
                            <span className="truncate max-w-[180px]">{d.name || d.category}</span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground ml-0.5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {application.draftStatus === "draft" && !isRevision && (
                    <Link
                      to="/experts/join"
                      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-marine hover:underline"
                    >
                      Continue editing <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
