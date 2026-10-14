import { RotateCcw } from "lucide-react";

export function RevisionAlert({
  isId,
  comment,
}: {
  isId: boolean;
  comment?: string | null;
}) {
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
