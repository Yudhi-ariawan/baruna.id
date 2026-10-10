import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  PlayCircle,
  Sparkles,
  AlertCircle,
  Award,
  Download,
  ShieldCheck,
  RotateCcw,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyCourseEnrollmentStatus,
  submitCourseEnrollmentApplication,
} from "@/lib/learning/enrollment-application.functions";
import { enrollShortCourse, useShortCourses } from "@/lib/shortCourses";
import { useLanguage } from "@/lib/i18n";

interface CourseEnrollmentActionProps {
  courseId: string;
  courseTitle: string;
  hours: number;
  instructorName: string;
  category?: string;
  done?: boolean;
  onDownloadCertificate?: () => void;
  variant?: "aside" | "hero_banner";
}

export function CourseEnrollmentAction({
  courseId,
  courseTitle,
  hours,
  instructorName,
  category = "Fisheries Management",
  done = false,
  onDownloadCertificate,
  variant = "aside",
}: CourseEnrollmentActionProps) {
  const { isId } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [needBiodataDialogOpen, setNeedBiodataDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const { get } = useShortCourses();
  const localEnrollment = get(courseId);

  const getStatusFn = useServerFn(getMyCourseEnrollmentStatus);
  const submitFn = useServerFn(submitCourseEnrollmentApplication);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
      setAuthChecked(true);
    });
  }, []);

  const { data: serverStatus, isLoading, refetch } = useQuery({
    queryKey: ["course-enrollment-status", courseId, userId],
    queryFn: () => getStatusFn({ data: { courseId } }),
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      return submitFn({
        data: {
          courseId,
          courseTitle,
          notes: notes.trim() || undefined,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(res.message);
      setApplyDialogOpen(false);
      setNotes("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["course-enrollment-status", courseId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal mengajukan pendaftaran pelatihan.");
    },
  });

  const status = serverStatus?.status || (localEnrollment ? "approved" : "none");
  const isApproved = status === "approved" || Boolean(localEnrollment) || done;
  const isPending = status === "pending";
  const isRejected = status === "rejected";

  // Sync to local shortCourses if approved on server
  useEffect(() => {
    if (serverStatus?.status === "approved" && !localEnrollment) {
      enrollShortCourse(courseId, {
        title: courseTitle,
        hours,
        instructor: instructorName,
        category,
      });
    }
  }, [serverStatus, localEnrollment, courseId, courseTitle, hours, instructorName, category]);

  const handleStartApply = () => {
    if (!userId) {
      toast.info(isId ? "Silakan masuk atau buat akun terlebih dahulu untuk mendaftar pelatihan." : "Please sign in or create an account before enrolling in a course.");
      navigate({
        to: "/auth",
        search: { redirect: window.location.pathname },
      });
      return;
    }

    if (isLoading) {
      toast.info(isId ? "Sedang memverifikasi status akun Anda..." : "Verifying your account status...");
      return;
    }

    // Wajib memiliki role participant (telah melengkapi formulir biodata peserta) sebelum dapat enroll
    if (!serverStatus?.hasParticipantRole) {
      setNeedBiodataDialogOpen(true);
      return;
    }

    setApplyDialogOpen(true);
  };

  // ─────────────────────────────────────────────────────────────
  // HERO BANNER VARIANT (HORIZONTALLY ALIGNED)
  // ─────────────────────────────────────────────────────────────
  if (variant === "hero_banner") {
    if (done) {
      return (
        <div className="flex items-center gap-2">
          <Link
            to="/academy/learn/$id"
            params={{ id: courseId }}
            className="inline-flex items-center gap-2 rounded-xl bg-marine px-4 py-2 text-xs font-bold text-white hover:bg-marine/90 transition shadow-xs"
          >
            <PlayCircle className="h-4 w-4" /> {isId ? "Tinjau di Ruang Belajar" : "Review in Learning Room"}
          </Link>
        </div>
      );
    }

    if (isApproved) {
      return (
        <div className="flex items-center gap-2">
          <Link
            to="/academy/learn/$id"
            params={{ id: courseId }}
            className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-2.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-xs"
          >
            <PlayCircle className="h-4 w-4" /> {isId ? "Lanjutkan Belajar di Ruang Belajar →" : "Continue Learning in Learning Room →"}
          </Link>
        </div>
      );
    }

    if (isPending) {
      return (
        <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800">
          <Clock className="h-4 w-4 animate-pulse text-amber-600" />
          {isId ? "Menunggu Persetujuan Admin (Pending Review)" : "Awaiting Administrator Approval (Pending Review)"}
        </div>
      );
    }

    if (isRejected) {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={handleStartApply}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" /> {isId ? "Ajukan Ulang Pendaftaran" : "Reapply for Enrollment"}
          </button>
        </div>
      );
    }

    return (
      <>
        <button
          onClick={handleStartApply}
          className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-2.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-xs cursor-pointer"
        >
          {serverStatus && !serverStatus.hasParticipantRole
            ? (isId ? "Daftar Pelatihan (Lengkapi Biodata)" : "Enroll in Course (Fill Participant Form)")
            : (isId ? "Daftar Pelatihan (Ajukan Kepesertaan)" : "Enroll in Course (Apply for Access)")} <ArrowRight className="h-4 w-4" />
        </button>

        {applyDialogOpen && renderApplyModal()}
        {needBiodataDialogOpen && renderNeedBiodataModal()}
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // ASIDE VARIANT (CARD IN SIDEBAR)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Status Badges */}
      {done ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
          <p className="flex items-center gap-1.5 font-bold text-emerald-800">
            <Award className="h-4 w-4 text-emerald-600" /> {isId ? "Modul Telah Selesai" : "Course Completed"}
          </p>
          <p className="mt-1 text-[0.75rem] text-emerald-700">
            {isId
              ? "Selamat! Anda telah menyelesaikan seluruh materi dan kuis kelulusan modul ini."
              : "Congratulations! You have completed all course materials and the completion quiz."}
          </p>
          {onDownloadCertificate && (
            <button
              onClick={onDownloadCertificate}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
            >
              <Download className="h-3.5 w-3.5" /> {isId ? "Unduh Sertifikat (PDF)" : "Download Certificate (PDF)"}
            </button>
          )}
        </div>
      ) : isPending ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <Clock className="h-4 w-4 shrink-0 text-amber-600 animate-pulse" />
            <span>{isId ? "Menunggu Persetujuan Admin" : "Awaiting Administrator Approval"}</span>
          </div>
          <p className="text-[0.75rem] text-amber-700/90 leading-relaxed">
            {isId
              ? "Permohonan kepesertaan Anda telah masuk ke antrean verifikasi (PB-ACA-03). Ruang belajar akan otomatis terbuka setelah disetujui Administrator."
              : "Your enrollment application is in the verification queue (PB-ACA-03). The learning room will open automatically after administrator approval."}
          </p>
          <div className="flex items-center gap-1.5 text-[0.7rem] font-semibold text-amber-800 bg-white/80 rounded-lg p-2 border border-amber-200">
            <Lock className="h-3.5 w-3.5 text-amber-600" />
            {isId ? "Akses Ruang Belajar Terkunci Sementara" : "Learning Room Access Temporarily Locked"}
          </div>
        </div>
      ) : isRejected ? (
        <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-xs text-red-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{isId ? "Pendaftaran Belum Disetujui" : "Enrollment Not Approved"}</span>
          </div>
          {serverStatus?.decisionNotes && (
            <p className="text-[0.75rem] text-red-700 bg-white/80 rounded-lg p-2 border border-red-200 italic">
              "{serverStatus.decisionNotes}"
            </p>
          )}
          <p className="text-[0.7rem] text-red-700/90">
            {isId
              ? "Anda dapat memperbarui informasi dan mengajukan permohonan kepesertaan kembali."
              : "You may update your information and submit a new enrollment application."}
          </p>
        </div>
      ) : isApproved ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-semibold text-emerald-800">
            {isId ? "Status: Terdaftar Resmi (Peserta Aktif)" : "Status: Officially Enrolled (Active Participant)"}
          </span>
        </div>
      ) : null}

      {/* Primary Action Button */}
      {isApproved ? (
        <Link
          to="/academy/learn/$id"
          params={{ id: courseId }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-marine py-3 text-sm font-bold text-white shadow-sm hover:bg-marine/90 transition"
        >
          <PlayCircle className="h-4 w-4" />
          {done
            ? (isId ? "Tinjau di Ruang Belajar" : "Review in Learning Room")
            : (isId ? "Lanjutkan Belajar →" : "Continue Learning →")}
        </Link>
      ) : isPending ? (
        <button
          disabled
          className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-100/60 py-3 text-xs font-bold text-amber-800 opacity-80"
        >
          <Lock className="h-4 w-4" /> {isId ? "Ruang Belajar Menunggu ACC Admin" : "Learning Room Awaiting Administrator Approval"}
        </button>
      ) : isRejected ? (
        <button
          onClick={handleStartApply}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-red-700 transition cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" /> {isId ? "Ajukan Ulang Pendaftaran" : "Reapply for Enrollment"}
        </button>
      ) : (
        <div className="space-y-2">
          {userId && serverStatus && !serverStatus.hasParticipantRole && (
            <div className="rounded-xl border border-amber-200/90 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>{isId ? "Prasyarat: Isi Formulir Peserta" : "Prerequisite: Fill Participant Form"}</span>
              </div>
              <p className="text-[0.72rem] text-amber-800/90 leading-relaxed">
                {isId
                  ? "Akun Anda saat ini berstatus Registered User. Anda wajib melengkapi Formulir Biodata Peserta sebelum dapat mendaftar pelatihan ini."
                  : "Your account is currently a Registered User. You must complete the Participant Biodata Form before enrolling in this course."}
              </p>
              <button
                type="button"
                onClick={() => setNeedBiodataDialogOpen(true)}
                className="inline-flex items-center gap-1 text-[0.72rem] font-bold text-marine hover:underline cursor-pointer"
              >
                {isId ? "Buka Formulir Peserta →" : "Open Participant Form →"}
              </button>
            </div>
          )}

          <button
            onClick={handleStartApply}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-marine py-3 text-sm font-bold text-white shadow-sm hover:bg-marine/90 transition cursor-pointer"
          >
            {serverStatus && !serverStatus.hasParticipantRole
              ? (isId ? "Daftar Pelatihan (Lengkapi Biodata)" : "Enroll in Course (Fill Participant Form)")
              : (isId ? "Daftar Pelatihan (Ajukan Akses)" : "Enroll in Course (Apply for Access)")} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Apply Modal Dialog */}
      {applyDialogOpen && renderApplyModal()}
      {needBiodataDialogOpen && renderNeedBiodataModal()}
    </div>
  );

  function renderNeedBiodataModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 animate-in fade-in-50 zoom-in-95">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-navy">
                  Lengkapi Formulir Peserta Terlebih Dahulu
                </h3>
                <p className="text-[0.7rem] text-muted-foreground">
                  Prasyarat Pendaftaran Pelatihan (SOP PB-ACA-03)
                </p>
              </div>
            </div>
            <button
              onClick={() => setNeedBiodataDialogOpen(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 space-y-2">
            <p className="font-bold flex items-center gap-1.5 text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              Peran Akun Saat Ini: Registered User
            </p>
            <p className="text-[0.75rem] text-amber-800/90 leading-relaxed">
              Sebelum dapat mengajukan pendaftaran pelatihan ini ke Administrator, Anda wajib melengkapi <strong>Formulir Biodata Peserta Resmi</strong> (NIP, instansi, jabatan, dan golongan).
            </p>
          </div>

          <div className="rounded-xl bg-muted/40 p-3.5 text-xs space-y-2 text-foreground/80">
            <p className="font-semibold text-navy">Mengapa Anda Wajib Mengisi Formulir Peserta?</p>
            <ul className="space-y-1.5 text-[0.75rem] list-disc list-inside text-muted-foreground">
              <li>Mengubah peran akun Anda secara resmi menjadi <strong>Participant (Peserta Pelatihan)</strong>.</li>
              <li>Data NIP, jabatan, dan instansi otomatis tercetak pada <strong>Sertifikat STTP Resmi</strong> kelulusan Anda.</li>
              <li>Memenuhi syarat administrasi verifikasi kuota peserta pelatihan Kementerian Kelautan dan Perikanan (KKP).</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setNeedBiodataDialogOpen(false)}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                setNeedBiodataDialogOpen(false);
                navigate({
                  to: "/academy/daftar-peserta",
                  search: { redirect: window.location.pathname },
                });
              }}
              className="flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2 text-xs font-bold text-white hover:bg-navy transition shadow-xs cursor-pointer"
            >
              Isi Formulir Peserta Sekarang <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderApplyModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 animate-in fade-in-50 zoom-in-95">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-marine/10 text-marine">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-navy">
                  Ajukan Pendaftaran Pelatihan
                </h3>
                <p className="text-[0.7rem] text-muted-foreground">
                  Prosedur PB-ACA-03: Registrasi Kepesertaan &amp; Verifikasi Admin
                </p>
              </div>
            </div>
            <button
              onClick={() => setApplyDialogOpen(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1">
            <p className="text-[0.65rem] font-bold uppercase text-muted-foreground">Pelatihan</p>
            <p className="font-bold text-navy text-sm">{courseTitle}</p>
            <p className="text-muted-foreground text-[0.75rem]">
              {isId ? `Durasi: ${hours} Jam Belajar (JP) • Pengajar: ${instructorName}` : `Duration: ${hours} Learning Hours • Instructor: ${instructorName}`}
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-marine" /> Alur Kepesertaan Resmi (PB-ACA-03):
            </p>
            <p className="text-[0.75rem] text-blue-800 leading-relaxed">
              Data profil Anda telah terverifikasi sebagai <strong>Participant (Peserta Resmi)</strong>. Permohonan pendaftaran kelas ini akan ditinjau oleh Administrator BARUNA untuk alokasi kuota. Setelah disetujui (ACC), akses ke ruang belajar akan otomatis terbuka penuh.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-navy">
              Catatan atau Motivasi Mengikuti Pelatihan (Opsional):
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Pegawai instansi kelautan / Mahasiswa perikanan yang membutuhkan kompetensi ini..."
              className="w-full rounded-xl border border-border p-2.5 text-xs focus:border-marine focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setApplyDialogOpen(false)}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
              className="flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2 text-xs font-bold text-white hover:bg-marine/90 transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitMutation.isPending ? "Mengirim..." : "Kirim Pengajuan Pendaftaran"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
