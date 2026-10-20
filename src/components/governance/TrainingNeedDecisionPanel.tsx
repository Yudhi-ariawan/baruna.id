import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { recordFinalDecision } from "@/lib/governance/governance.functions";

// Database messages of finalize_decision / return_for_revision, in plain words.
const DECISION_ERRORS: Array<[RegExp, string]> = [
  [/recommendations_incomplete/, "Rekomendasi reviewer belum lengkap. Tugaskan reviewer dan tunggu rekomendasinya."],
  [/non_approval_recommendation_present/, "Ada rekomendasi yang tidak menyetujui; pengajuan tidak bisa disetujui."],
  [/subject_not_ready_for_decision/, "Pengajuan belum siap diputuskan (rekomendasi belum masuk)."],
  [/reviewer_cannot_approve_same_subject/, "Anda meninjau pengajuan ini, jadi tidak boleh sekaligus memutuskannya."],
  [/self_approval_forbidden|self_decision_forbidden/, "Anda tidak dapat memutuskan pengajuan Anda sendiri."],
  [/rationale_required/, "Alasan keputusan wajib diisi."],
  [/forbidden/, "Hanya Approver atau Administrator yang dapat memutuskan."],
];

function friendly(message: string): string {
  for (const [pattern, text] of DECISION_ERRORS) if (pattern.test(message)) return text;
  return message;
}

/** Final decision on a Request a Training submission (approver/admin only; the server checks again). */
export function TrainingNeedDecisionPanel({ subjectId, onDecided }: { subjectId: string; onDecided: () => void }) {
  const decideFn = useServerFn(recordFinalDecision);
  const [rationale, setRationale] = useState("");
  const mutation = useMutation({
    mutationFn: (decision: "approve" | "reject" | "return_for_revision") =>
      decideFn({ data: { subjectId, decision, rationale } }),
    onSuccess: () => {
      setRationale("");
      onDecided();
    },
  });
  const disabled = mutation.isPending || rationale.trim().length === 0;

  return (
    <div className="space-y-3">
      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        rows={3}
        maxLength={5000}
        placeholder="Alasan keputusan (wajib, tercatat di jejak audit)"
        className="w-full rounded-lg border border-border p-2 text-sm focus:border-marine focus:outline-none"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => mutation.mutate("approve")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Setujui
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => mutation.mutate("return_for_revision")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Kembalikan untuk Revisi
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => mutation.mutate("reject")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
        >
          <XCircle className="h-3.5 w-3.5" /> Tolak
        </button>
      </div>
      {mutation.error ? <p className="text-xs text-destructive">{friendly((mutation.error as Error).message)}</p> : null}
    </div>
  );
}
