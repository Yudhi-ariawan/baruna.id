// Certificate tab before a certificate exists: what the participant still needs, or
// where the completion review stands (PB-ACA-05, Slide 24: the participant sees the
// status and downloads; the decision is taken in the console).
import { CheckCircle2, Clock, RotateCcw } from "lucide-react";
import { eligibilityReasonText } from "@/lib/learning/learning.functions";

type Eligibility = {
  eligible: boolean;
  reason?: string;
  completed?: number;
  required?: number;
  completion_status?: "pending_review" | "remedial" | "approved" | null;
  decision_note?: string | null;
  certificate_held_reason?: string | null;
};

export function CompletionStatusPanel({ data }: { data: Eligibility | undefined }) {
  const box = "rounded-xl border p-3 text-sm";
  if (!data) return <div className={`${box} border-border bg-background text-muted-foreground`}>Memeriksa status…</div>;
  if (!data.eligible) {
    return (
      <div className={`${box} border-border bg-background`}>
        <div className="font-semibold text-navy">Belum memenuhi syarat</div>
        <div className="mt-1 text-muted-foreground">
          {eligibilityReasonText(data.reason)}
          {data.reason === "modules_incomplete" && data.required ? ` (${data.completed ?? 0} dari ${data.required} modul)` : ""}
        </div>
      </div>
    );
  }
  if (data.completion_status === "approved") {
    return (
      <div className={`${box} border-emerald-200 bg-emerald-50`}>
        <div className="flex items-center gap-1.5 font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Anda dinyatakan lulus</div>
        {data.certificate_held_reason ? <div className="mt-1 text-emerald-900/80">{eligibilityReasonText(data.certificate_held_reason)}</div> : null}
      </div>
    );
  }
  if (data.completion_status === "remedial") {
    return (
      <div className={`${box} border-amber-200 bg-amber-50`}>
        <div className="flex items-center gap-1.5 font-semibold text-amber-900"><RotateCcw className="h-4 w-4" /> Perlu tindak lanjut</div>
        {data.decision_note ? <div className="mt-1 text-amber-900/90">{data.decision_note}</div> : null}
        <div className="mt-1 text-xs text-amber-900/70">Setelah ditindaklanjuti, Reviewer/Admin akan meninjau kembali kelulusan Anda.</div>
      </div>
    );
  }
  return (
    <div className={`${box} border-marine/30 bg-marine/5`}>
      <div className="flex items-center gap-1.5 font-semibold text-navy"><Clock className="h-4 w-4 text-marine" /> Menunggu persetujuan kelulusan</div>
      <div className="mt-1 text-muted-foreground">Anda sudah memenuhi syarat. Sertifikat tersedia di sini setelah disetujui Reviewer/Admin BARUNA.</div>
    </div>
  );
}
