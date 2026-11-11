// "Minta Perbaikan" for applications without documents (Full Training programs, PB-ACA-03,
// Slide 22): shows the administrator's note and lets the participant answer and send
// the application again. course_enrollment_apply accepts a resubmission from
// revision_requested and puts it back to pending. Used on the Full Training
// application page and on the dashboard, which reads from the server, so it works
// from any device (the Full Training form itself lives in one browser).
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RotateCcw, Send } from "lucide-react";
import { submitCourseEnrollmentApplication } from "@/lib/learning/enrollment-application.functions";

type Props = {
  courseId: string;
  courseTitle: string;
  decisionNotes: string | null | undefined;
  /** Prefill: the notes the participant sent last time (from the server). */
  previousNotes?: string | null;
  isId?: boolean;
  onDone?: () => void;
};

export function RevisionResubmitBox({ courseId, courseTitle, decisionNotes, previousNotes, isId = true, onDone }: Props) {
  const qc = useQueryClient();
  const submitFn = useServerFn(submitCourseEnrollmentApplication);
  const [notes, setNotes] = useState(previousNotes ?? "");
  const send = useMutation({
    mutationFn: () => submitFn({ data: { courseId, courseTitle, notes: notes.trim() || undefined } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["course-enrollment-status"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["learning"] });
      onDone?.();
    },
  });

  if (send.isSuccess) {
    return (
      <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
        {isId ? "Terkirim ulang. Pengajuan kembali menunggu persetujuan admin." : "Sent again. The application is back with the administrator."}
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-orange-300 bg-orange-50/70 p-3 text-xs text-orange-950">
      <p className="flex items-center gap-1.5 font-bold"><RotateCcw className="h-3.5 w-3.5" /> {isId ? "Admin meminta perbaikan" : "The administrator asked for a revision"}</p>
      {decisionNotes ? <p className="rounded-lg border border-orange-200 bg-white/80 p-2 italic">"{decisionNotes}"</p> : null}
      <label className="block font-semibold">
        {isId ? "Tanggapan atau perbaikan Anda untuk admin" : "Your answer or correction for the administrator"}
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3}
          className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-2 py-1.5 font-normal text-foreground" />
      </label>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-orange-900/70">{notes.length}/1000</span>
        <button type="button" onClick={() => { if (!send.isPending) send.mutate(); }} disabled={send.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-3 py-1.5 font-semibold text-white hover:bg-marine/90 disabled:opacity-60">
          {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {isId ? "Kirim ulang" : "Send again"}
        </button>
      </div>
      {send.isError ? <p className="text-red-700">{send.error instanceof Error ? send.error.message : String(send.error)}</p> : null}
    </div>
  );
}
