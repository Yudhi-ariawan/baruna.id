import { Eye } from "lucide-react";

/** Shown instead of decision buttons to roles that may only read (Slide 16: reviewer, verifier). */
export function ReadOnlyReviewNotice() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
      <Eye className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
      <p>
        Akses baca: peran Anda meninjau dan memverifikasi pengajuan ini. Keputusan (setujui, minta revisi, tolak,
        arsipkan) diambil oleh Approver atau Administrator.
      </p>
    </div>
  );
}
