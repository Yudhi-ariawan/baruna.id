import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, FileText, ShieldCheck, UserCheck } from "lucide-react";

export const Route = createFileRoute("/governance/decisions")({
  component: DecisionsPage,
});

function DecisionsPage() {
  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="h-5 w-5 text-marine" />
        <h2 className="text-lg font-bold text-navy">Keputusan Verifikasi Terpusat di Portal Admin</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Untuk menjaga integritas publikasi, sinkronisasi katalog Knowledge Hub, dan pembukaan kembali draf revisi, seluruh tindakan persetujuan (Approve), permintaan revisi (Revision), dan penolakan (Reject) kini dipusatkan di halaman Verifikasi Admin masing-masing modul:
      </p>
      <div className="grid gap-3 sm:grid-cols-3 pt-2">
        <Link
          to="/admin/experts"
          className="flex items-center justify-between rounded-xl border border-border bg-slate-50/70 p-4 text-sm font-semibold text-navy hover:border-marine hover:bg-white transition"
        >
          <span className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-marine" />
            Verifikasi Expert
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link
          to="/admin/modules"
          className="flex items-center justify-between rounded-xl border border-border bg-slate-50/70 p-4 text-sm font-semibold text-navy hover:border-marine hover:bg-white transition"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-marine" />
            Verifikasi Modul
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link
          to="/admin/publications"
          className="flex items-center justify-between rounded-xl border border-border bg-slate-50/70 p-4 text-sm font-semibold text-navy hover:border-marine hover:bg-white transition"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-marine" />
            Verifikasi Publikasi
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
