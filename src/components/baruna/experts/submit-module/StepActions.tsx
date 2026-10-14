import { ArrowLeft, ArrowRight, Bookmark, Send } from "lucide-react";

export function StepActions({
  isId,
  currentStep,
  canSave,
  saving,
  uploadProgress,
  allDecls,
  isRevision,
  onBack,
  onNext,
  onSaveDraft,
  onSubmit,
}: {
  isId: boolean;
  currentStep: number;
  canSave: boolean;
  saving: boolean;
  uploadProgress: string | null;
  allDecls: boolean;
  isRevision: boolean;
  onBack: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
}) {
  return (
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div>
          {currentStep > 1 && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-navy hover:bg-muted transition shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              {isId ? "Kembali" : "Previous Step"}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Save Draft Button (always available at any step) */}
          <button
            type="button"
            onClick={() => onSaveDraft()}
            disabled={!canSave || saving}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-navy hover:bg-muted transition cursor-pointer shadow-2xs"
          >
            <Bookmark className="h-3.5 w-3.5" />
            {saving && uploadProgress?.includes("Menyimpan")
              ? isId
                ? "Menyimpan Draf..."
                : "Saving Draft..."
              : isId
                ? "Simpan sebagai Draf"
                : "Save Draft"}
          </button>

          {/* Next Step Button (Step 1, 2, 3) */}
          {currentStep < 4 ? (
            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-xs font-semibold text-white hover:bg-navy transition shadow-xs cursor-pointer"
            >
              {isId ? "Lanjut ke Langkah Berikutnya" : "Next Step"}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            /* Submit for Review Button (Step 4) */
            <button
              type="button"
              onClick={() => onSubmit()}
              disabled={!canSave || !allDecls || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-marine px-6 py-2.5 text-xs font-semibold text-white hover:bg-navy transition shadow-xs disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <Send className="h-4 w-4" />
              {saving
                ? uploadProgress || (isId ? "Menyimpan & Mengunggah…" : "Saving & Uploading…")
                : isRevision
                  ? isId
                    ? "Kirim Ulang Revisi Modul"
                    : "Resubmit Module Revision"
                  : isId
                    ? "Kirim Modul untuk Ditinjau"
                    : "Submit for Review"}
            </button>
          )}
        </div>
      </div>
  );
}
