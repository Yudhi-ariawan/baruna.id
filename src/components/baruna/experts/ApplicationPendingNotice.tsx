import { Link } from "@tanstack/react-router";
import { Clock3, ArrowRight, FileCheck, Layers, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { ExpertApplicationStatus } from "@/lib/experts/application.types";

type ApplicationPendingNoticeProps = {
  application: ExpertApplicationStatus;
};

export function ApplicationPendingNotice({ application }: ApplicationPendingNoticeProps) {
  const { language } = useLanguage();
  const isId = language === "id";

  const formattedDate = application.createdAt
    ? new Date(application.createdAt).toLocaleDateString(isId ? "id-ID" : "en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";

  const statusLabel =
    application.reviewStatus === "under_review"
      ? isId
        ? "Sedang Ditinjau Tim Verifikator"
        : "Under Review by Verification Team"
      : application.reviewStatus === "decision_pending"
        ? isId
          ? "Menunggu Keputusan Akhir"
          : "Decision Pending"
        : isId
          ? "Menunggu Peninjauan Admin"
          : "Pending Verification";

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-linear-to-br from-blue-500/20 via-marine/15 to-blue-500/10 text-marine shadow-soft ring-1 ring-blue-500/25">
        <Clock3 className="h-10 w-10 text-marine" />
        <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
          <FileCheck className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
        <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
        {statusLabel}
      </div>

      <h1 className="mt-4 font-display text-2xl font-extrabold text-navy sm:text-3xl">
        {isId
          ? "Pendaftaran Expert Anda Sedang Ditinjau"
          : "Your Expert Application is Under Review"}
      </h1>

      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
        {isId ? (
          <>
            Pengajuan pendaftaran expert Anda telah berhasil dikirim dan tersimpan dengan aman di
            sistem tata kelola BARUNA. Saat ini verifikator kami sedang memeriksa dokumen &
            kualifikasi Anda. Anda tidak perlu mengirimkan formulir ulang.
          </>
        ) : (
          <>
            Your expert application has been successfully submitted and stored securely in BARUNA's
            governance system. Our verification board is currently reviewing your credentials. You
            do not need to submit another application.
          </>
        )}
      </p>

      {/* Detail Ringkasan Pengajuan */}
      <div className="mx-auto mt-6 max-w-md rounded-2xl border border-border bg-card p-4 text-left shadow-2xs">
        <div className="flex items-center justify-between border-b border-border pb-2.5 text-xs">
          <span className="text-muted-foreground">{isId ? "Judul Pengajuan" : "Submission Title"}</span>
          <span className="font-semibold text-navy truncate max-w-[220px]">
            {application.title || "Marine Expert Application"}
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-border py-2.5 text-xs">
          <span className="text-muted-foreground">{isId ? "Tanggal Dikirim" : "Date Submitted"}</span>
          <span className="font-semibold text-foreground">{formattedDate}</span>
        </div>
        <div className="flex items-center justify-between pt-2.5 text-xs">
          <span className="text-muted-foreground">{isId ? "Status Saat Ini" : "Current Status"}</span>
          <span className="font-bold text-marine">{statusLabel}</span>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/experts/profile"
          className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-white shadow-soft transition-all hover:bg-navy hover:shadow-hover"
        >
          <Layers className="h-4 w-4" />
          {isId ? "Pantau Status Pengajuan Saya" : "Track My Application Status"}
          <ArrowRight className="h-4 w-4" />
        </Link>

        <Link
          to="/experts"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy transition-all hover:bg-muted hover:shadow-2xs"
        >
          <ArrowLeft className="h-4 w-4" />
          {isId ? "Kembali ke Direktori" : "Back to Experts"}
        </Link>
      </div>
    </div>
  );
}

