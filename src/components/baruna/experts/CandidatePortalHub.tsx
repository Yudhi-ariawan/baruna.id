import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  CheckCircle2,
  RotateCcw,
  XCircle,
  FileText,
  ExternalLink,
  ShieldCheck,
  User,
  Layers,
  BookOpen,
  GraduationCap,
  Award,
  Sparkles,
  FilePenLine,
  ChevronRight,
  HelpCircle,
  Building,
  Mail,
  Phone,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { listMyExpertApplications } from "@/lib/experts/application.functions";
import type { ExpertApplicationStatus, ExpertApplicationDocument } from "@/lib/experts/application.types";
import { useLanguage } from "@/lib/i18n";

export function CandidatePortalHub({ userDisplayName }: { userDisplayName?: string }) {
  const { language } = useLanguage();
  const isId = language === "id";

  const listFn = useServerFn(listMyExpertApplications);
  const {
    data: applications = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["experts", "my-candidate-applications"],
    queryFn: () => listFn(),
    staleTime: 1000 * 30, // 30 seconds
  });

  const latestApp: ExpertApplicationStatus | null = applications[0] ?? null;

  const openDocInTab = async (doc: ExpertApplicationDocument) => {
    if (!doc.path) return;
    try {
      const { data, error: err } = await supabase.storage
        .from("expert-applications")
        .createSignedUrl(doc.path, 3600);
      if (err || !data?.signedUrl) {
        alert("Gagal membuat tautan akses berkas.");
        return;
      }
      const viewerUrl = `/document-viewer?url=${encodeURIComponent(data.signedUrl)}&title=${encodeURIComponent(doc.name || "Berkas")}`;
      window.open(viewerUrl, "_blank", "noopener,noreferrer");
    } catch {
      alert("Tidak dapat mengakses berkas.");
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-muted-foreground sm:px-6">
        <Clock3 className="mx-auto h-8 w-8 animate-spin text-marine" />
        <p className="mt-3">Memeriksa status pengajuan expert Anda…</p>
      </div>
    );
  }

  // JIKA PENGGUNA BELUM PERNAH MENDAFTAR (Zero Application)
  if (!latestApp) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link
          to="/experts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-marine hover:text-navy"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {isId ? "Kembali ke Direktori Experts" : "Back to Experts"}
        </Link>

        <div className="mt-6 rounded-3xl border border-border bg-card p-8 sm:p-10 shadow-soft text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-marine/10 text-marine">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h1 className="mt-5 font-display text-2xl sm:text-3xl font-extrabold text-navy">
            {isId ? "Bergabung sebagai Expert & Trainer BARUNA" : "Become a BARUNA Expert & Trainer"}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {isId
              ? "Portal Trainer BARUNA adalah ruang kerja khusus bagi pakar dan instruktur terverifikasi untuk merancang silabus kursus, mengajar peserta pelatihan, dan mengelola portofolio profesional maritim."
              : "The BARUNA Trainer Portal is an exclusive workspace for verified marine instructors to design course syllabi, teach cohorts, and manage their professional facilitation portfolio."}
          </p>

          <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
            <div className="rounded-xl border border-border/80 bg-slate-50/60 p-4">
              <div className="flex items-center gap-2 text-marine font-bold text-xs uppercase tracking-wide">
                <BookOpen className="h-4 w-4" /> 1. Ajukan Modul
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Rancang silabus kursus resmi yang terakreditasi di BARUNA Academy.
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-slate-50/60 p-4">
              <div className="flex items-center gap-2 text-marine font-bold text-xs uppercase tracking-wide">
                <ShieldCheck className="h-4 w-4" /> 2. Rekam Jejak
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Akumulasi jam mengajar dan evaluasi kepuasan peserta secara transparan.
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-slate-50/60 p-4">
              <div className="flex items-center gap-2 text-marine font-bold text-xs uppercase tracking-wide">
                <Award className="h-4 w-4" /> 3. Pengakuan
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Raih sertifikasi jenjang Trainer Recognition (Certified, Senior, Master).
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/experts/join"
              className="inline-flex items-center gap-2 rounded-xl bg-marine px-6 py-3 text-sm font-semibold text-white shadow-soft transition-all hover:bg-navy hover:shadow-hover cursor-pointer"
            >
              <FilePenLine className="h-4 w-4" />
              {isId ? "Mulai Pendaftaran Expert Sekarang" : "Apply as an Expert Now"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // JIKA PENGGUNA SUDAH MEMILIKI PENGAJUAN
  const isRevision = latestApp.reviewStatus === "revision_requested";
  const isRejected = latestApp.reviewStatus === "rejected";
  const isApproved =
    latestApp.reviewStatus === "approved" || latestApp.draftStatus === "approved";
  const isPending = !isRevision && !isRejected && !isApproved;

  const docs = latestApp.payload.documents ?? [];
  const expertise = latestApp.payload.expertise ?? [];
  const roles = latestApp.payload.roles ?? [];
  const rawPayload = latestApp.payload as Record<string, unknown>;

  const applicantName =
    (typeof rawPayload.fullName === "string" && rawPayload.fullName) ||
    (typeof rawPayload.display_name === "string" && rawPayload.display_name) ||
    latestApp.title ||
    userDisplayName ||
    "Calon Expert";

  const applicantInstitution =
    typeof rawPayload.institution === "string" ? rawPayload.institution : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/experts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-marine hover:text-navy"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {isId ? "Kembali ke Direktori Experts" : "Back to Experts"}
        </Link>
        <span className="text-[11px] font-mono text-muted-foreground">
          Ref: {latestApp.subjectId?.slice(0, 8) || latestApp.draftId?.slice(0, 8)}
        </span>
      </div>

      {/* Main Header */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-marine/10 px-2.5 py-0.5 text-xs font-bold text-marine">
              <ShieldCheck className="h-3 w-3" /> Pusat Calon Expert
            </span>
          </div>
          <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-extrabold text-navy">
            Status Pengajuan &amp; Verifikasi Expert
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isId
              ? "Pantau status pengajuan Anda dari proses registrasi, verifikasi tata kelola, hingga aktivasi portal."
              : "Track your expert application lifecycle from registration to governance review and portal activation."}
          </p>
        </div>

        {/* Action Button on top */}
        {isRevision && (
          <Link
            to="/experts/join"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-all hover:bg-amber-700 hover:shadow-hover cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            {isId ? "Lengkapi Berkas Revisi" : "Update Revised Documents"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* STEPPER TIMELINE PROSES BISNIS (Slide 36 PB-EXP-01) */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Alur Verifikasi Tata Kelola (PB-EXP-01 &amp; PB-EXP-02)
        </p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {/* Step 1: Pendaftaran */}
          <div className="flex flex-col items-center">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-700 font-bold border border-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <span className="mt-1.5 font-bold text-navy text-[11px] sm:text-xs">
              1. Pendaftaran Berkas
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold">Terkirim</span>
          </div>

          {/* Step 2: Verifikasi & Kurasi */}
          <div className="flex flex-col items-center">
            <div
              className={`grid h-8 w-8 place-items-center rounded-full font-bold border ${
                isApproved
                  ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                  : isRevision
                  ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse"
                  : "bg-blue-100 text-blue-700 border-blue-300"
              }`}
            >
              {isApproved ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : isRevision ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <Clock3 className="h-4 w-4" />
              )}
            </div>
            <span className="mt-1.5 font-bold text-navy text-[11px] sm:text-xs">
              2. Kurasi &amp; Verifikasi
            </span>
            <span
              className={`text-[10px] font-semibold ${
                isApproved
                  ? "text-emerald-700"
                  : isRevision
                  ? "text-amber-700"
                  : "text-blue-700"
              }`}
            >
              {isApproved ? "Lulus" : isRevision ? "Perlu Revisi" : "Sedang Berjalan"}
            </span>
          </div>

          {/* Step 3: Aktivasi & Tayang */}
          <div className="flex flex-col items-center">
            <div
              className={`grid h-8 w-8 place-items-center rounded-full font-bold border ${
                isApproved
                  ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                  : "bg-slate-100 text-slate-400 border-slate-200"
              }`}
            >
              {isApproved ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Award className="h-4 w-4" />
              )}
            </div>
            <span
              className={`mt-1.5 font-bold text-[11px] sm:text-xs ${
                isApproved ? "text-navy" : "text-muted-foreground"
              }`}
            >
              3. Akses Portal Trainer
            </span>
            <span className="text-[10px] text-muted-foreground">
              {isApproved ? "Aktif" : "Menunggu"}
            </span>
          </div>
        </div>
      </div>

      {/* STATUS BANNER KONDISIONAL */}
      <div className="mt-6 space-y-4">
        {/* KONDISI 1: PERLU REVISI (REVISION REQUESTED) */}
        {isRevision && (
          <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/95 p-6 shadow-sm">
            <div className="flex items-start gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-200 text-amber-900 mt-0.5">
                <RotateCcw className="h-5 w-5 text-amber-800" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-200 text-amber-900 border-amber-300 font-bold uppercase tracking-wider text-[10px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-700 animate-ping mr-1" />
                    Tindakan Diperlukan
                  </Badge>
                  <span className="text-xs text-amber-900/80">
                    Diperbarui {new Date(latestApp.updatedAt).toLocaleDateString(isId ? "id-ID" : "en-US", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>

                <h2 className="mt-2 font-display text-lg font-bold text-navy">
                  Pengajuan Expert Anda Memerlukan Perbaikan Dokumen
                </h2>

                <p className="mt-1 text-xs text-amber-950/90 leading-relaxed">
                  Tim verifikator BARUNA telah meninjau pengajuan Anda dan meminta perbaikan berkas sebelum pengajuan dapat disetujui.
                </p>

                {/* Kotak Catatan Verifikator yang Sangat Jelas */}
                <div className="mt-3.5 rounded-xl border border-amber-300 bg-white p-4 shadow-2xs">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                    Catatan &amp; Arahan Revisi dari Verifikator Admin:
                  </p>
                  <p className="mt-1.5 text-sm italic font-medium text-slate-900 bg-amber-50/50 p-2.5 rounded-lg border border-amber-200">
                    &quot;{latestApp.latestDecision?.rationale || "Mohon periksa dan perbarui berkas dokumen persyaratan Anda."}&quot;
                  </p>
                </div>

                {/* Tombol Perbaikan Langsung */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    to="/experts/join"
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-soft transition-all hover:bg-amber-700 hover:shadow-hover cursor-pointer"
                  >
                    <FilePenLine className="h-4 w-4" />
                    Perbaiki Berkas &amp; Kirim Ulang Revisi
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    Semua data Anda sebelumnya tetap tersimpan, Anda cukup mengunggah berkas pengganti.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KONDISI 2: SEDANG DITINJAU (PENDING) */}
        {isPending && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6 shadow-2xs">
            <div className="flex items-start gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700 mt-0.5">
                <Clock3 className="h-5 w-5 text-blue-600" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-bold uppercase tracking-wider text-[10px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse mr-1" />
                    Menunggu Verifikasi
                  </Badge>
                  <span className="text-xs text-blue-900/80">
                    Dikirim {new Date(latestApp.createdAt).toLocaleDateString(isId ? "id-ID" : "en-US", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>

                <h2 className="mt-2 font-display text-lg font-bold text-navy">
                  Pendaftaran Calon Expert Sedang Ditinjau
                </h2>

                <p className="mt-1 text-xs text-blue-950/80 leading-relaxed">
                  Pengajuan pendaftaran expert Anda telah tersimpan dengan aman di sistem tata kelola BARUNA. Tim verifikator sedang memeriksa keabsahan bukti kompetensi dan kurasi keahlian maritim Anda. Anda tidak perlu mengirimkan formulir baru.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* KONDISI 3: PENOLAKAN (REJECTED) */}
        {isRejected && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 shadow-2xs">
            <div className="flex items-start gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700 mt-0.5">
                <XCircle className="h-5 w-5 text-rose-600" />
              </span>
              <div className="flex-1 min-w-0">
                <Badge className="bg-rose-100 text-rose-800 border-rose-200 font-bold uppercase tracking-wider text-[10px]">
                  Pengajuan Ditolak
                </Badge>
                <h2 className="mt-2 font-display text-lg font-bold text-navy">
                  Pengajuan Belum Memenuhi Kriteria Kualifikasi
                </h2>
                {latestApp.latestDecision?.rationale && (
                  <p className="mt-2 text-xs italic text-rose-900 bg-white/80 p-3 rounded-lg border border-rose-200">
                    &quot;{latestApp.latestDecision.rationale}&quot;
                  </p>
                )}
                <div className="mt-4">
                  <Link
                    to="/experts/join"
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800"
                  >
                    Daftar Ulang sebagai Expert
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KARTU RINCIAN DATA PENGAJUAN & DOKUMEN TERLAMPIR */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-marine">
                Data Ringkasan Calon Expert
              </p>
              <h3 className="mt-0.5 font-display text-lg font-bold text-navy">
                {applicantName}
              </h3>
              {applicantInstitution && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Building className="h-3 w-3" /> {applicantInstitution}
                </p>
              )}
            </div>
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block">Status Aplikasi</span>
              <span className="inline-block mt-1 font-semibold text-xs text-navy capitalize">
                {latestApp.reviewStatus?.replaceAll("_", " ") || "Pending"}
              </span>
            </div>
          </div>

          {/* Bidang Keahlian & Peran */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Bidang Keahlian yang Diajukan:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {expertise.length > 0 ? (
                  expertise.map((e) => (
                    <span
                      key={e}
                      className="rounded-lg bg-marine/10 px-2.5 py-1 text-xs font-medium text-marine"
                    >
                      {e}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic">Belum ada keahlian dipilih</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Peran Fasilitasi:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {roles.length > 0 ? (
                  roles.map((r) => (
                    <span
                      key={r}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-navy capitalize"
                    >
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic">Belum ada peran dipilih</span>
                )}
              </div>
            </div>
          </div>

          {/* Daftar Berkas Dokumen Terlampir */}
          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Berkas Dokumen Terlampir ({docs.length} Berkas):
              </p>
              <span className="text-[11px] text-muted-foreground italic">
                Klik berkas untuk meninjau pratinjau
              </span>
            </div>

            {docs.length > 0 ? (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {docs.map((doc, idx) => (
                  <div
                    key={doc.path || idx}
                    className="flex items-center justify-between rounded-xl border border-border/80 bg-slate-50/70 p-3 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <FileText className="h-4 w-4 shrink-0 text-marine" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-navy truncate">
                          {doc.name || `Berkas ${doc.category}`}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {doc.category.replaceAll("_", " ")}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openDocInTab(doc)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-marine hover:text-navy cursor-pointer shrink-0"
                    >
                      Buka <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Tidak ada dokumen terlampir pada pengajuan ini.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

