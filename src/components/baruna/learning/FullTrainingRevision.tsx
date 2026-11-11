// "Minta Perbaikan" for a Full Training application (PB-ACA-03, Slide 22;
// CATATAN_PERBAIKAN 2ax): shows the administrator's note, every required document with
// the file the committee has now, lets the participant replace any of them and send
// the application again. Everything is read from the server, so it works from any
// device. Before migration 20261111020000 the program has no server-side document
// list and the old notes-only box is shown instead.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, FileText, Loader2, RotateCcw, Send, Upload } from "lucide-react";
import {
  getMyCourseEnrollmentStatus,
  submitCourseEnrollmentApplication,
} from "@/lib/learning/enrollment-application.functions";
import { useEnrollmentDocumentUpload } from "@/lib/learning/use-enrollment-document-upload";
import { DOCUMENT_FIELDS } from "@/lib/application";
import { RevisionResubmitBox } from "@/components/baruna/learning/RevisionResubmitBox";

type Props = {
  courseId: string;
  courseTitle: string;
  /** Prefill when the server has no notes yet (the browser copy of the motivation). */
  fallbackNotes?: string | null;
  isId?: boolean;
  onDone?: () => void;
};

const acceptFor = (requirement: string) =>
  DOCUMENT_FIELDS.find((d) => d.label === requirement)?.accept ?? ".pdf,.jpg,.jpeg,.png";

export function FullTrainingRevision({ courseId, courseTitle, fallbackNotes, isId = true, onDone }: Props) {
  const qc = useQueryClient();
  const statusFn = useServerFn(getMyCourseEnrollmentStatus);
  const submitFn = useServerFn(submitCourseEnrollmentApplication);
  const uploadDocument = useEnrollmentDocumentUpload(courseId, { allowImages: true, english: !isId });
  const [notes, setNotes] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const statusQ = useQuery({
    queryKey: ["learning", "enrollment-status", courseId],
    queryFn: () => statusFn({ data: { courseId } }),
    staleTime: 15_000,
  });
  const send = useMutation({
    // The server sends the uploads recorded for this account (any device), read right before sending.
    mutationFn: (text: string) => submitFn({ data: { courseId, courseTitle, notes: text.trim() || undefined, useUploadedDocuments: true } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["course-enrollment-status"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["learning"] });
      onDone?.();
    },
    onError: () => { void statusQ.refetch(); },
  });

  const s = statusQ.data;
  if (statusQ.isLoading) return <p className="mt-2 text-xs text-muted-foreground">{isId ? "Memuat…" : "Loading…"}</p>;
  if (statusQ.isError) {
    return <p className="mt-2 text-xs text-red-700">{statusQ.error instanceof Error ? statusQ.error.message : String(statusQ.error)}</p>;
  }
  if (send.isSuccess) {
    return (
      <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
        {isId ? "Terkirim ulang. Pengajuan kembali menunggu persetujuan admin." : "Sent again. The application is back with the selection committee."}
      </p>
    );
  }
  if (!s || s.status !== "revision_requested") return null;
  const required = s.programDocuments;
  if (!required) {
    // Before migration 20261111020000: the form's files never reached the server.
    return (
      <RevisionResubmitBox courseId={courseId} courseTitle={courseTitle} decisionNotes={s.decisionNotes}
        previousNotes={s.notes ?? fallbackNotes} documentsStayLocal isId={isId} onDone={onDone} />
    );
  }

  const sent = new Map((s.documents ?? []).map((d) => [d.requirement, d.fileName]));
  const fresh = new Map((s.uploads ?? []).map((u) => [u.requirement, u.fileName]));
  const missing = required.filter((r) => !sent.has(r) && !fresh.has(r));
  const noteValue = notes ?? s.notes ?? fallbackNotes?.slice(0, 1000) ?? "";

  const pick = async (requirement: string, file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(requirement);
    try {
      const { supported } = await uploadDocument(requirement, file);
      if (!supported) throw new Error(isId ? "Pencatatan unggahan belum aktif. Hubungi pengelola sistem." : "Document upload is not available yet.");
      await statusQ.refetch();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="mt-2 space-y-2.5 rounded-xl border border-orange-300 bg-orange-50/70 p-3 text-xs text-orange-950">
      <p className="flex items-center gap-1.5 font-bold"><RotateCcw className="h-3.5 w-3.5" /> {isId ? "Admin meminta perbaikan" : "The selection committee asked for a revision"}</p>
      {s.decisionNotes ? <p className="rounded-lg border border-orange-200 bg-white/80 p-2 italic">"{s.decisionNotes}"</p> : null}

      <div className="space-y-1.5 rounded-lg border border-orange-200 bg-white/80 p-2.5">
        <p className="font-semibold text-navy">
          {isId ? "Dokumen persyaratan — ganti yang perlu diperbaiki (PDF maks 10 MB, JPG/PNG maks 2 MB)" : "Required documents — replace the ones that need fixing (PDF up to 10 MB, JPG/PNG up to 2 MB)"}
        </p>
        {required.map((r) => {
          const pending = fresh.get(r);
          const name = pending ?? sent.get(r);
          return (
            <label key={r} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                {name ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <span className="font-medium text-navy">{r}</span>
                {name ? <span className="truncate text-muted-foreground">· {name}</span> : <span className="text-orange-800">· {isId ? "belum ada" : "missing"}</span>}
                {pending ? <span className="shrink-0 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">{isId ? "baru, belum dikirim" : "new, not sent yet"}</span> : null}
              </span>
              <span className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-marine px-2 py-0.5 font-semibold text-marine">
                {uploading === r ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                {name ? (isId ? "Ganti" : "Replace") : (isId ? "Unggah" : "Upload")}
                <input type="file" accept={acceptFor(r)} className="hidden" disabled={uploading !== null || send.isPending}
                  onChange={(e) => { void pick(r, e.target.files?.[0]); e.target.value = ""; }} />
              </span>
            </label>
          );
        })}
        {uploadError ? <p className="text-red-700">{uploadError}</p> : null}
      </div>

      <label className="block font-semibold">
        {isId ? "Tanggapan atau perbaikan Anda untuk admin" : "Your answer or correction for the committee"}
        <textarea value={noteValue} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3}
          className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-2 py-1.5 font-normal text-foreground" />
      </label>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-orange-900/70">
          {missing.length > 0 ? `${isId ? "Unggah dulu" : "Upload first"}: ${missing.join(", ")}` : `${noteValue.length}/1000`}
        </span>
        <button type="button" onClick={() => { if (!send.isPending) send.mutate(noteValue); }}
          disabled={send.isPending || uploading !== null || missing.length > 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-3 py-1.5 font-semibold text-white hover:bg-marine/90 disabled:opacity-60">
          {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {isId ? "Kirim ulang" : "Send again"}
        </button>
      </div>
      {send.isError ? <p className="text-red-700">{send.error instanceof Error ? send.error.message : String(send.error)}</p> : null}
    </div>
  );
}
