import { RefreshCcw, RotateCcw } from "lucide-react";

export function RevisionAlert({
  isId,
  comment,
  trainerUpdate = false,
  updateNote,
}: {
  isId: boolean;
  comment?: string | null;
  /** An update of a live module opened by the trainer (no verifier request). */
  trainerUpdate?: boolean;
  updateNote?: string | null;
}) {
  if (trainerUpdate) {
    return (
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-5 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
          <RefreshCcw className="h-4 w-4 text-emerald-700" />
          {isId ? "Pembaruan Modul yang Sedang Tayang" : "Updating a Live Module"}
        </div>
        {updateNote && (
          <div className="mt-2.5 rounded-xl border border-emerald-200/80 bg-white/90 p-4 text-sm text-slate-800">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-1">
              {isId ? "Ringkasan perubahan:" : "Summary of changes:"}
            </span>
            <p className="text-slate-700 leading-relaxed">{updateNote}</p>
          </div>
        )}
        <p className="mt-3 text-xs text-emerald-900/90 leading-relaxed">
          {isId
            ? "Versi saat ini tetap tayang untuk peserta. Setelah Anda mengirim, pembaruan diverifikasi seperti pengajuan biasa dan menggantikan versi tayang bila disetujui. Bila ditolak, versi saat ini tetap tayang."
            : "The current version stays live for participants. Once you submit, the update is reviewed like any submission and replaces the live version if approved. If it is rejected, the current version stays live."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-5 shadow-sm">
      <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
        <RotateCcw className="h-4 w-4 text-amber-700" />
        {isId
          ? "Permintaan Revisi dari Verifikator / Admin"
          : "Revision Requested by Reviewer / Admin"}
      </div>
      {comment && (
        <div className="mt-2.5 rounded-xl border border-amber-200/80 bg-white/90 p-4 text-sm text-slate-800">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-1">
            {isId
              ? "Catatan Evaluasi / Rationale Verifikator:"
              : "Reviewer Notes & Feedback:"}
          </span>
          <p className="italic text-slate-700 leading-relaxed">
            &quot;{comment}&quot;
          </p>
        </div>
      )}
      <p className="mt-3 text-xs text-amber-800/90 leading-relaxed">
        {isId
          ? "Silakan lengkapi berkas atau perbaiki isian formulir di bawah ini. Pastikan seluruh catatan di atas telah terpenuhi sebelum menekan tombol Kirim Ulang Revisi Modul."
          : "Please update the required fields or files below. Ensure all feedback points are addressed before clicking Resubmit Module."}
      </p>
    </div>
  );
}
