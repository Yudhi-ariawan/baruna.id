// Course page: apply for a Course Offering that requires approval (PB-ACA-03, Slide 22).
// Reuses the participant application path (course_enrollment_apply -> Persetujuan
// Peserta -> admin_course_enrollment_decide, which also enrols the participant).
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Loader2, Send, XCircle } from "lucide-react";
import {
  getMyCourseEnrollmentStatus,
  submitCourseEnrollmentApplication,
} from "@/lib/learning/enrollment-application.functions";

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });
const fmt = (d?: string | null) => (d ? dateFmt.format(new Date(d)) : "");

export function OfferingApplicationAction({ offeringCode, title }: { offeringCode: string; title: string }) {
  const qc = useQueryClient();
  const statusFn = useServerFn(getMyCourseEnrollmentStatus);
  const submitFn = useServerFn(submitCourseEnrollmentApplication);
  const statusQ = useQuery({
    queryKey: ["learning", "offering-application", offeringCode],
    queryFn: () => statusFn({ data: { courseId: offeringCode } }),
    staleTime: 15_000,
  });
  const submitM = useMutation({
    mutationFn: () => submitFn({ data: { courseId: offeringCode, courseTitle: title } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["learning"] }),
  });

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
    // The approval enrols the participant; the course page picks the enrolment up.
    return <div className="mt-3 rounded-xl bg-eco-community/15 px-3 py-2 text-xs font-semibold text-eco-community">Pendaftaran disetujui</div>;
  }

  return (
    <div className="mt-3 space-y-2">
      {s?.status === "rejected" ? (
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
        <button type="button" onClick={() => submitM.mutate()} disabled={submitM.isPending}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-marine px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-marine/90 disabled:opacity-60">
          {submitM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {s?.status === "rejected" ? "Ajukan lagi" : "Ajukan pendaftaran"}
        </button>
      )}
      {submitM.isError ? <p className="text-xs text-red-700">{submitM.error instanceof Error ? submitM.error.message : String(submitM.error)}</p> : null}
    </div>
  );
}
