// Course page: apply for a Course Offering that requires approval (PB-ACA-03, Slide 22).
// Reuses the participant application path (course_enrollment_apply -> Persetujuan
// Peserta -> admin_course_enrollment_decide, which also enrols the participant), with
// the offering's required documents and the "Minta Perbaikan" loop.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, FileText, Loader2, RotateCcw, Send, Upload, XCircle } from "lucide-react";
import {
  getMyCourseEnrollmentStatus,
  submitCourseEnrollmentApplication,
} from "@/lib/learning/enrollment-application.functions";
import { useEnrollmentDocumentUpload, type UploadedDocument } from "@/lib/learning/use-enrollment-document-upload";

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });
const fmt = (d?: string | null) => (d ? dateFmt.format(new Date(d)) : "");
type Uploaded = UploadedDocument;

export function OfferingApplicationAction({ offeringCode, title, requiredDocuments }: { offeringCode: string; title: string; requiredDocuments: string[] }) {
  const qc = useQueryClient();
  const statusFn = useServerFn(getMyCourseEnrollmentStatus);
  const submitFn = useServerFn(submitCourseEnrollmentApplication);
  const uploadDocument = useEnrollmentDocumentUpload(offeringCode);
  // Only used before migration 20261111010000: then an upload lives in this tab until sent.
  const [uploads, setUploads] = useState<Record<string, Uploaded>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const statusQ = useQuery({
    queryKey: ["learning", "offering-application", offeringCode],
    queryFn: () => statusFn({ data: { courseId: offeringCode } }),
    staleTime: 15_000,
  });
  const submitM = useMutation({
    mutationFn: () =>
      // The server adds the uploads recorded for this account (any device), read right before sending.
      submitFn({ data: { courseId: offeringCode, courseTitle: title, documents: Object.values(uploads), useUploadedDocuments: true } }),
    onSuccess: () => { setUploads({}); void qc.invalidateQueries({ queryKey: ["learning"] }); },
    onError: () => { void statusQ.refetch(); },
  });

  const pick = async (requirement: string, file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(requirement);
    try {
      // Recorded on the server so other devices of this account see it; kept in the tab only before the migration.
      const { path, supported } = await uploadDocument(requirement, file);
      if (supported) {
        setUploads((u) => { const next = { ...u }; delete next[requirement]; return next; });
        await statusQ.refetch();
      } else {
        setUploads((u) => ({ ...u, [requirement]: { requirement, path, fileName: file.name } }));
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(null);
    }
  };

  const s = statusQ.data;
  if (statusQ.isLoading) return <div className="mt-3 text-xs text-muted-foreground">Memeriksa pendaftaran…</div>;
  if (statusQ.isError) return <p className="mt-3 text-xs text-red-700">{statusQ.error instanceof Error ? statusQ.error.message : String(statusQ.error)}</p>;

  if (s?.status === "pending") {
    return (
      <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <div className="flex items-center gap-1.5 font-semibold"><Clock className="h-3.5 w-3.5" /> Menunggu persetujuan</div>
        <div className="mt-0.5">Diajukan {fmt(s.appliedAt)}. Anda akan terdaftar otomatis setelah disetujui admin.</div>
      </div>
    );
  }
  if (s?.status === "approved") {
    return <div className="mt-3 rounded-xl bg-eco-community/15 px-3 py-2 text-xs font-semibold text-eco-community">Pendaftaran disetujui</div>;
  }

  const existing = new Map((s?.documents ?? []).map((d) => [d.requirement, d.fileName]));
  const recorded = new Map((s?.uploads ?? []).map((u) => [u.requirement, u.fileName]));
  const missing = requiredDocuments.filter((r) => !uploads[r] && !recorded.has(r) && !existing.has(r));

  return (
    <div className="mt-3 space-y-2">
      {s?.status === "revision_requested" ? (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <div className="flex items-center gap-1.5 font-semibold"><RotateCcw className="h-3.5 w-3.5" /> Admin meminta perbaikan</div>
          {s.decisionNotes ? <div className="mt-0.5">{s.decisionNotes}</div> : null}
          <div className="mt-0.5 text-amber-900/70">Perbaiki atau ganti dokumen di bawah, lalu kirim ulang.</div>
        </div>
      ) : s?.status === "rejected" ? (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
          <div className="flex items-center gap-1.5 font-semibold"><XCircle className="h-3.5 w-3.5" /> Pengajuan belum disetujui</div>
          {s.decisionNotes ? <div className="mt-0.5">{s.decisionNotes}</div> : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Course ini membutuhkan persetujuan admin sebelum Anda bisa mulai belajar.</p>
      )}

      {s && !s.hasParticipantRole ? (
        <Link to="/academy/daftar-peserta" search={{ redirect: `/academy/course/${offeringCode}` }}
          className="block w-full rounded-xl border border-marine px-3 py-2 text-center text-sm font-semibold text-marine hover:bg-marine/5">
          Isi biodata peserta dulu
        </Link>
      ) : (
        <>
          {requiredDocuments.length > 0 ? (
            <div className="space-y-1.5 rounded-xl border border-border bg-background p-2.5 text-xs">
              <p className="font-semibold text-navy">Dokumen persyaratan (PDF, maks 10 MB)</p>
              {requiredDocuments.map((r) => {
                const fresh = uploads[r]?.fileName ?? recorded.get(r);
                const name = fresh ?? existing.get(r);
                return (
                  <label key={r} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {name ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      <span className="font-medium">{r}</span>
                      {name ? <span className="truncate text-muted-foreground">· {name}</span> : null}
                      {fresh ? <span className="shrink-0 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">belum dikirim</span> : null}
                    </span>
                    <span className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-marine px-2 py-0.5 font-semibold text-marine">
                      {uploading === r ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                      {name ? "Ganti" : "Unggah"}
                      <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={uploading !== null}
                        onChange={(e) => { void pick(r, e.target.files?.[0]); e.target.value = ""; }} />
                    </span>
                  </label>
                );
              })}
              {uploadError ? <p className="text-red-700">{uploadError}</p> : null}
            </div>
          ) : null}
          <button type="button" onClick={() => submitM.mutate()} disabled={submitM.isPending || uploading !== null || missing.length > 0}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-marine px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-marine/90 disabled:opacity-60">
            {submitM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {s?.status === "revision_requested" ? "Kirim ulang" : s?.status === "rejected" ? "Ajukan lagi" : "Ajukan pendaftaran"}
          </button>
          {missing.length > 0 ? <p className="text-xs text-muted-foreground">Unggah dulu: {missing.join(", ")}.</p> : null}
        </>
      )}
      {submitM.isError ? <p className="text-xs text-red-700">{submitM.error instanceof Error ? submitM.error.message : String(submitM.error)}</p> : null}
    </div>
  );
}
