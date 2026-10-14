import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

export function SubmitSuccess({
  isId,
  submitted,
  isRevision,
}: {
  isId: boolean;
  submitted: boolean;
  isRevision: boolean;
}) {
  return (
    <div className="rounded-2xl border border-eco-community/30 bg-eco-community/5 p-8 text-center shadow-soft">
      <CheckCircle2 className="mx-auto h-12 w-12 text-eco-community" />
      <h2 className="mt-4 font-display text-2xl font-bold text-navy">
        {submitted
          ? isRevision
            ? isId
              ? "Revisi Modul Berhasil Dikirimkan!"
              : "Module Revision Submitted Successfully!"
            : isId
              ? "Modul Berhasil Diajukan!"
              : "Module Submitted for Review!"
          : isId
            ? "Draf Modul Berhasil Disimpan!"
            : "Module Draft Saved!"}
      </h2>
      <p className="mt-2 text-sm text-foreground/75 max-w-lg mx-auto leading-relaxed">
        {submitted
          ? isId
            ? "Pengajuan modul Anda telah masuk ke dalam antrean verifikasi Admin dan Tim Governance BARUNA. Anda dapat memantau perkembangannya melalui halaman Review Status."
            : "Your training module has entered the BARUNA review pipeline. Track its verification progress under Review Status."
          : isId
            ? "Draf modul Anda tersimpan aman dan dapat dilanjutkan pengisiannya kapan saja."
            : "Your draft is saved securely and can be continued anytime."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/experts/portal/review-status"
          className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-semibold text-white hover:bg-navy/90 transition shadow-xs"
        >
          {isId ? "Lihat Status Review Modul" : "View Review Status"}
        </Link>
        <Link
          to="/experts/portal"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-5 py-2.5 text-xs font-semibold text-navy hover:bg-muted transition"
        >
          {isId ? "Kembali ke Dashboard Trainer" : "Back to Trainer Portal"}
        </Link>
      </div>
    </div>
  );
}
