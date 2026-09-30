import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  HelpCircle,
  Info,
  Layers,
  ListChecks,
  Play,
  PlayCircle,
  Presentation,
  RotateCcw,
  Sparkles,
  Trophy,
  User,
  Video,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { Toaster } from "@/components/baruna/Toaster";
import { barunaToast } from "@/lib/downloads";
import { downloadCertificatePdf } from "@/lib/certificate";
import {
  useShortCourses,
  enrollShortCourse,
  completeShortCourse,
  updateShortCourseSteps,
} from "@/lib/shortCourses";
import type { PublishedModuleDetail } from "@/lib/learning/learning.functions";

function getDynamicModuleSlides(module: PublishedModuleDetail) {
  const slides = [];

  // Slide 1: Pendahuluan & Ringkasan Modul
  slides.push({
    title: `1. ${module.title}`,
    subtitle: `Disusun oleh ${module.trainer.name} • ${module.hours} Jam Belajar (JP)`,
    bullets: [
      `Gambaran Umum: ${module.summary || "Pelatihan terstruktur berbasis kompetensi BARUNA Academy."}`,
      `Bidang Kajian / Topik: ${module.topic || "Pengembangan Kapasitas & Standar Profesional"}`,
      `Bidang Kompetensi: ${module.competency || "Penerapan metodologi, instrumen, dan standar terapan"}`,
      `Bahasa Pengantar: ${module.language || "Bahasa Indonesia"}`,
    ],
    badge: "Ringkasan Modul",
  });

  // Slide 2: Target Peserta & Prasyarat
  slides.push({
    title: "2. Target Peserta & Prasyarat",
    subtitle: "Kualifikasi dan sasaran peserta pelatihan",
    bullets: [
      `Profil Target Peserta: ${module.targetParticipants || "Praktisi, akademisi, peneliti, dan profesional terkait."}`,
      `Format Pembelajaran: Pembelajaran Mandiri Interaktif (Self-Paced Learning).`,
      `Standar Kelulusan: Wajib membaca modul, menelaah materi slide, dan lulus kuis (Passing Grade: ${module.passingScore}%).`,
    ],
    badge: "Sasaran Pembelajaran",
  });

  // Slide 3: Tujuan Pembelajaran (Learning Objectives)
  const objBullets =
    module.learningObjectives.length > 0
      ? module.learningObjectives.map((obj, i) => `${i + 1}. ${obj}`)
      : [
          "1. Memahami fondasi konseptual dan kerangka kerja modul.",
          "2. Menguasai implementasi teknis dan instrumen pendukung.",
          "3. Mampu menganalisis dan memecahkan studi kasus riil.",
        ];
  slides.push({
    title: "3. Tujuan & Sasaran Pembelajaran",
    subtitle: "Kompetensi spesifik yang ditargetkan dalam materi ini",
    bullets: objBullets,
    badge: "Tujuan Pembelajaran",
  });

  // Slide 4: Capaian Hasil Kompetensi (Competency Outcomes)
  slides.push({
    title: "4. Capaian Hasil Kompetensi (Outcomes)",
    subtitle: "Keluaran terukur dan aplikasi praktis hasil pelatihan",
    bullets: [
      `Capaian Akhir: ${module.competencyOutcomes || "Peserta mampu mengaplikasikan pengetahuan dan keterampilan yang dipelajari secara mandiri dan profesional."}`,
      `Metode Evaluasi: ${module.assessmentMethod || "Kuis Pemahaman & Evaluasi Mandiri"}`,
      `Akreditasi Digital: Sertifikat kompetensi resmi diterbitkan otomatis setelah verifikasi kelulusan kuis.`,
    ],
    badge: "Hasil Kompetensi",
  });

  // Slide 5: Panduan Belajar & Evaluasi Kuis
  slides.push({
    title: "5. Panduan Belajar & Evaluasi Akhir",
    subtitle: "Persiapan pengerjaan Kuis Kelulusan untuk klaim Sertifikat",
    bullets: [
      "Pelajari naskah modul komprehensif pada bagian dokumen di bawah untuk pendalaman materi.",
      "Lanjutkan ke Tab 3 (Slide PPT) untuk menelaah slide presentasi visual dari instruktur.",
      `Kerjakan Kuis Kelulusan pada Tab 4 untuk menguji pemahaman Anda dan meraih nilai minimal ${module.passingScore}%.`,
    ],
    badge: "Panduan Belajar",
  });

  return slides;
}

function getDynamicModuleQuiz(module: PublishedModuleDetail) {
  const objectives =
    module.learningObjectives.length > 0
      ? module.learningObjectives
      : ["Penguasaan konsep dasar dan implementasi terstandar"];

  return [
    {
      id: 1,
      question: `Berdasarkan modul "${module.title}", apa tujuan utama yang ingin dicapai melalui materi ini?`,
      options: [
        objectives[0] || "Memahami prinsip dasar dan kerangka kerja modul secara komprehensif",
        "Menghafal teori tanpa melakukan implementasi lapangan",
        "Mengabaikan standar dan regulasi yang berlaku",
        "Menunda pelaksanaan evaluasi dan penyusunan laporan",
      ],
      correctAnswer: 0,
      explanation: `Tujuan utama pembelajaran modul ini adalah: ${objectives[0] || "Memahami prinsip dasar dan kerangka kerja modul secara komprehensif"}.`,
    },
    {
      id: 2,
      question: `Bidang kajian atau topik utama yang dibahas secara mendalam dalam modul ini adalah...`,
      options: [
        module.topic || "Pengembangan Kapasitas & Tata Kelola Berkelanjutan",
        "Pemberian subsidi tanpa evaluasi kinerja",
        "Eksploitasi sumber daya tanpa batas kuota",
        "Penutupan akses informasi bagi publik",
      ],
      correctAnswer: 0,
      explanation: `Modul ini secara spesifik mengkaji bidang: ${module.topic || "Pengembangan Kapasitas & Tata Kelola Berkelanjutan"}.`,
    },
    {
      id: 3,
      question: `Berapa batas nilai minimum (Passing Grade) yang ditetapkan untuk dinyatakan lulus pada modul ini?`,
      options: [
        `${module.passingScore}% (Standar Kelulusan Kurikulum BARUNA)`,
        "40% (Tanpa kriteria kelulusan)",
        "50% (Nilai dasar)",
        "100% (Harus sempurna tanpa salah)",
      ],
      correctAnswer: 0,
      explanation: `Passing grade resmi untuk modul "${module.title}" adalah ${module.passingScore}%.`,
    },
    {
      id: 4,
      question: `Manakah capaian hasil kompetensi (outcomes) yang diharapkan setelah peserta menuntaskan pembelajaran?`,
      options: [
        module.competencyOutcomes || "Peserta mampu mengimplementasikan keterampilan teknis dan menyelesaikan tantangan profesional di bidangnya",
        "Peserta hanya membaca materi tanpa memahami penerapannya",
        "Peserta tidak diperkenankan menerapkan materi yang telah dipelajari",
        "Peserta menghentikan seluruh aktivitas peningkatan kapasitas",
      ],
      correctAnswer: 0,
      explanation: `Capaian kompetensi modul: ${module.competencyOutcomes || "Mampu mengimplementasikan keterampilan teknis di bidangnya"}.`,
    },
    {
      id: 5,
      question: `Bagaimana alur peserta untuk mendapatkan sertifikat digital resmi setelah mempelajari seluruh materi?`,
      options: [
        "Menyelesaikan materi video, membaca modul pembelajaran, menelaah slide PPT, dan lulus kuis evaluasi",
        "Hanya membuka halaman utama tanpa membaca materi",
        "Meminta sertifikat langsung tanpa mengikuti evaluasi kuis",
        "Menunggu proses manual selama 6 bulan",
      ],
      correctAnswer: 0,
      explanation: "Sertifikat diterbitkan secara otomatis dan terverifikasi setelah seluruh aktivitas pembelajaran diselesaikan dan kuis kelulusan terpenuhi.",
    },
  ];
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DynamicModuleLmsPlayer({ module }: { module: PublishedModuleDetail }) {
  const navigate = useNavigate();
  const { get, isCompleted } = useShortCourses();
  const enrollment = get(module.id);
  const done = isCompleted(module.id);

  const dynamicSlides = getDynamicModuleSlides(module);
  const dynamicQuizQuestions = getDynamicModuleQuiz(module);

  // LMS Tab State
  const [activeTab, setActiveTab] = useState<"video" | "pdf" | "ppt" | "quiz" | "certificate">("video");
  const [completedSteps, setCompletedSteps] = useState<{
    video: boolean;
    pdf: boolean;
    ppt: boolean;
    quiz: boolean;
  }>({
    video: enrollment?.completedSteps?.video ?? false,
    pdf: enrollment?.completedSteps?.pdf ?? false,
    ppt: enrollment?.completedSteps?.ppt ?? false,
    quiz: done || (enrollment?.completedSteps?.quiz ?? false),
  });

  // Video State
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Overview Deck State (in Tab 2 Modul)
  const [overviewSlide, setOverviewSlide] = useState(0);

  // Quiz State
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(done);
  const [quizScore, setQuizScore] = useState<number | null>(enrollment?.score ?? (done ? 100 : null));

  // Keep state synced with enrollment changes
  useEffect(() => {
    if (enrollment?.completedSteps) {
      setCompletedSteps({
        video: Boolean(enrollment.completedSteps.video),
        pdf: Boolean(enrollment.completedSteps.pdf),
        ppt: Boolean(enrollment.completedSteps.ppt),
        quiz: done || Boolean(enrollment.completedSteps.quiz),
      });
    }
  }, [enrollment?.completedSteps, done]);

  // Ensure user is enrolled when entering learning workspace
  useEffect(() => {
    if (!enrollment) {
      enrollShortCourse(module.id, {
        title: module.title,
        hours: module.hours,
        instructor: module.trainer.name,
        category: module.topic || "Fisheries Management",
      });
    }
  }, [enrollment, module]);

  const handleToggleStep = (step: "video" | "pdf" | "ppt") => {
    const nextState = !completedSteps[step];
    setCompletedSteps((prev) => ({ ...prev, [step]: nextState }));
    updateShortCourseSteps(module.id, { [step]: nextState });
    barunaToast(nextState ? `Aktivitas ${step.toUpperCase()} ditandai selesai!` : `Status ${step.toUpperCase()} diperbarui.`);
  };

  const handleSubmitQuiz = () => {
    let correct = 0;
    dynamicQuizQuestions.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correctAnswer) {
        correct++;
      }
    });

    const score = Math.round((correct / dynamicQuizQuestions.length) * 100);
    setQuizScore(score);
    setQuizSubmitted(true);
    barunaToast(`Nilai Kuis: ${score}%`);

    if (score >= module.passingScore) {
      completeShortCourse(module.id, score, "self-paced");
      setCompletedSteps((prev) => ({ ...prev, quiz: true, video: true, pdf: true, ppt: true }));
      barunaToast(`🎉 Selamat! Anda LULUS dengan nilai ${score}% (Passing Grade: ${module.passingScore}%). Sertifikat terbuka!`);
      setActiveTab("certificate");
    } else {
      barunaToast(`Nilai Anda ${score}%. Belum memenuhi passing grade ${module.passingScore}%. Silakan coba lagi.`);
    }
  };

  const handleRetakeQuiz = () => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
  };

  const handleDownloadCertificate = () => {
    downloadCertificatePdf({
      name: "Peserta BARUNA",
      country: "Indonesia",
      program: module.title,
      dates: new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
      certNo: `BARUNA-MOD-${module.id.slice(0, 8).toUpperCase()}-2026`,
      verifyUrl: `https://baruna.kkp.go.id/verify/${module.id}`,
    });
    barunaToast("Sertifikat kelulusan berhasil diunduh!");
  };

  const topic = module.topic;
  const passingScore = module.passingScore;

  // 1. Presentation Slides (PPTX or PDF Slide)
  const pptDoc = module.documents.find(
    (d) =>
      d.type === "Presentation slides (PDF or PPT)" ||
      d.type?.toLowerCase().includes("presentation") ||
      d.type?.toLowerCase().includes("slide") ||
      d.type?.toLowerCase().includes("tayang") ||
      d.name.toLowerCase().match(/\.(ppt|pptx)$/) ||
      d.fileType?.includes("presentation") ||
      d.fileType?.includes("powerpoint"),
  );

  // 2. Complete Module Document (PDF / DOCX / Naskah Modul)
  const moduleDoc =
    module.documents.find(
      (d) =>
        d.type === "Complete module document (PDF)" ||
        d.type?.toLowerCase().includes("complete module") ||
        d.type?.toLowerCase().includes("naskah") ||
        d.type?.toLowerCase().includes("handbook"),
    ) ||
    module.documents.find(
      (d) =>
        d !== pptDoc &&
        !d.type?.toLowerCase().includes("presentation") &&
        !d.type?.toLowerCase().includes("slide") &&
        !d.type?.toLowerCase().includes("trainer guide") &&
        !d.type?.toLowerCase().includes("evaluation") &&
        !d.type?.toLowerCase().includes("quiz") &&
        !d.type?.toLowerCase().includes("video") &&
        !d.type?.toLowerCase().includes("cover") &&
        (d.fileType?.includes("pdf") ||
          d.name.toLowerCase().endsWith(".pdf") ||
          d.name.toLowerCase().endsWith(".docx")),
    );

  // 3. Trainer Guide
  const trainerGuideDoc = module.documents.find(
    (d) =>
      d.type === "Trainer guide" ||
      d.type?.toLowerCase().includes("trainer guide") ||
      d.type?.toLowerCase().includes("panduan") ||
      d.name.toLowerCase().includes("trainer_guide"),
  );

  // 4. Evaluation Form
  const evaluationDoc = module.documents.find(
    (d) =>
      d.type === "Evaluation form" ||
      d.type?.toLowerCase().includes("evaluation") ||
      d.type?.toLowerCase().includes("evaluasi") ||
      d.name.toLowerCase().includes("evaluation"),
  );

  // 5. Video
  const vidDoc = module.documents.find(
    (d) =>
      d.type?.toLowerCase().includes("video") ||
      d.fileType?.includes("video") ||
      d.name.toLowerCase().match(/\.(mp4|webm|mov)$/) ||
      (d.downloadUrl &&
        (d.downloadUrl.includes("youtube.com") ||
          d.downloadUrl.includes("youtu.be") ||
          d.downloadUrl.includes("vimeo.com"))),
  );

  // Check if PPT is in PDF format for inline rendering
  const isPptInPdfFormat = Boolean(
    pptDoc?.downloadUrl &&
      (pptDoc.downloadUrl.toLowerCase().includes(".pdf") ||
        pptDoc.fileType?.includes("pdf") ||
        pptDoc.name.toLowerCase().endsWith(".pdf")),
  );

  // Check if PPT is a tiny placeholder file (e.g. 50 bytes)
  const isPptVerySmall = Boolean(pptDoc && pptDoc.size > 0 && pptDoc.size < 1024);

  const stepsDoneCount =
    (completedSteps.video ? 1 : 0) +
    (completedSteps.pdf ? 1 : 0) +
    (completedSteps.ppt ? 1 : 0) +
    (done || completedSteps.quiz ? 1 : 0);
  const totalSteps = 4;
  const progressPct = Math.min(100, Math.round((stepsDoneCount / totalSteps) * 100));

  const aside = (
    <div className="space-y-5">
      {/* Module Progress Card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[0.65rem] font-bold text-foreground/70">
            MOD-{module.id.slice(0, 8).toUpperCase()}
          </span>
          {done ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-success">
              <CheckCircle2 className="h-3 w-3" /> Selesai 100%
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-marine/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-marine">
              <Sparkles className="h-3 w-3" /> Sedang Berjalan
            </span>
          )}
        </div>

        <h3 className="mt-3 font-display text-base font-bold text-navy">Progres Ruang Belajar</h3>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{stepsDoneCount} dari {totalSteps} Aktivitas Selesai</span>
            <span className="font-bold text-marine">{progressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                done ? "bg-emerald-600" : "bg-marine"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Step List in Sidebar */}
        <div className="mt-4 space-y-1.5 text-xs">
          <button
            onClick={() => setActiveTab("video")}
            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
              activeTab === "video" ? "bg-marine/10 font-bold text-marine" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Video className="h-3.5 w-3.5" /> 1. Video Materi
            </span>
            {completedSteps.video ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Belum</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("pdf")}
            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
              activeTab === "pdf" ? "bg-marine/10 font-bold text-marine" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" /> 2. Modul
            </span>
            {completedSteps.pdf ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Belum</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("ppt")}
            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
              activeTab === "ppt" ? "bg-marine/10 font-bold text-marine" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Presentation className="h-3.5 w-3.5" /> 3. Slide PPT
            </span>
            {completedSteps.ppt ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Belum</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("quiz")}
            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
              activeTab === "quiz" ? "bg-marine/10 font-bold text-marine" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <ListChecks className="h-3.5 w-3.5" /> 4. Kuis Kelulusan
            </span>
            {done || completedSteps.quiz ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Min {passingScore}%</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("certificate")}
            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
              activeTab === "certificate" ? "bg-amber-500/10 font-bold text-amber-700 dark:text-amber-400" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Award className="h-3.5 w-3.5" /> 5. Sertifikat
            </span>
            {done ? (
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Terkunci</span>
            )}
          </button>
        </div>

        <div className="mt-5 space-y-2.5">
          {done ? (
            <div className="rounded-xl border border-success/40 bg-success/5 p-3 text-xs text-success">
              <p className="flex items-center gap-1.5 font-bold">
                <Award className="h-4 w-4" /> Modul Telah Selesai
              </p>
              <p className="mt-1 text-success/80">
                Nilai kelulusan: <strong>{quizScore ?? 100}%</strong>. Sertifikat resmi telah diterbitkan.
              </p>
              <button
                onClick={handleDownloadCertificate}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
              >
                <Download className="h-3.5 w-3.5" /> Unduh Sertifikat (PDF)
              </button>
            </div>
          ) : (
            <Link
              to="/academy/learn"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 py-2 text-xs font-semibold text-foreground/80 hover:bg-muted"
            >
              ← Kembali ke My Learning
            </Link>
          )}
          <Link
            to="/academy/self-paced/$code"
            params={{ code: module.id }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-muted-foreground hover:text-navy"
          >
            Lihat Ringkasan &amp; Silabus Modul
          </Link>
        </div>
      </div>

      {/* Trainer Profile Card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
          Instruktur Modul
        </span>
        <div className="mt-3 flex items-start gap-3">
          {module.trainer.avatarUrl ? (
            <img
              src={module.trainer.avatarUrl}
              alt={module.trainer.name}
              className="h-11 w-11 rounded-full object-cover ring-2 ring-marine/20"
            />
          ) : (
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-marine/15 font-display text-sm font-bold text-marine">
              {module.trainer.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="font-display text-sm font-bold text-navy truncate">{module.trainer.name}</h4>
              <BadgeCheck className="h-4 w-4 shrink-0 text-marine" />
            </div>
            {module.trainer.headline && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{module.trainer.headline}</p>
            )}
            {module.trainer.institution && (
              <p className="mt-1 flex items-center gap-1 text-[0.7rem] text-foreground/70">
                <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{module.trainer.institution}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <AcademyShell active="my-learning" aside={aside}>
      <Toaster />
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/academy/learn" className="font-medium text-foreground/70 hover:text-marine">My Learning</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy truncate max-w-xs">{module.title}</span>
        </nav>

        {/* LMS Header Banner */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-marine/10 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-marine">
                  Ruang Belajar Mandiri
                </span>
                <span className="rounded-md bg-muted px-2 py-1 font-mono text-[0.65rem] font-bold text-foreground/70">
                  MOD-{module.id.slice(0, 8).toUpperCase()}
                </span>
                {done ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-success">
                    <CheckCircle2 className="h-3 w-3" /> Selesai
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-blue-700">
                    <Clock className="h-3 w-3" /> Aktif Belajar
                  </span>
                )}
              </div>
              <h1 className="mt-3 font-display text-2xl font-extrabold text-navy sm:text-3xl">
                {module.title}
              </h1>
              <p className="mt-2 text-xs text-muted-foreground">
                Disusun oleh <span className="font-semibold text-navy">{module.trainer.name}</span> • {module.hours} Jam Belajar (JP) • Passing Grade {passingScore}%
              </p>
            </div>

            <Link
              to="/academy/self-paced/$code"
              params={{ code: module.id }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground/80 hover:bg-muted transition"
            >
              <BookOpen className="h-3.5 w-3.5" /> Lihat Ringkasan Modul
            </Link>
          </div>
        </div>

        {/* 5-TAB INTERACTIVE LMS PLAYER NAVIGATION */}
        <div className="rounded-2xl border border-border bg-card p-2 shadow-soft">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            <button
              onClick={() => setActiveTab("video")}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                activeTab === "video"
                  ? "bg-marine text-white shadow-xs"
                  : "bg-muted/40 text-foreground/80 hover:bg-muted"
              }`}
            >
              <Video className="h-4 w-4 shrink-0" />
              <span>1. Video Materi</span>
              {completedSteps.video && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 ml-1" />}
            </button>

            <button
              onClick={() => setActiveTab("pdf")}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                activeTab === "pdf"
                  ? "bg-marine text-white shadow-xs"
                  : "bg-muted/40 text-foreground/80 hover:bg-muted"
              }`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span>2. Modul</span>
              {completedSteps.pdf && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 ml-1" />}
            </button>

            <button
              onClick={() => setActiveTab("ppt")}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                activeTab === "ppt"
                  ? "bg-marine text-white shadow-xs"
                  : "bg-muted/40 text-foreground/80 hover:bg-muted"
              }`}
            >
              <Presentation className="h-4 w-4 shrink-0" />
              <span>3. Slide PPT</span>
              {completedSteps.ppt && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 ml-1" />}
            </button>

            <button
              onClick={() => setActiveTab("quiz")}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                activeTab === "quiz"
                  ? "bg-marine text-white shadow-xs"
                  : "bg-muted/40 text-foreground/80 hover:bg-muted"
              }`}
            >
              <ListChecks className="h-4 w-4 shrink-0" />
              <span>4. Kuis Kelulusan</span>
              {(done || completedSteps.quiz) && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 ml-1" />}
            </button>

            <button
              onClick={() => setActiveTab("certificate")}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                activeTab === "certificate"
                  ? "bg-amber-600 text-white shadow-xs"
                  : done
                    ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
                    : "bg-muted/40 text-foreground/80 hover:bg-muted"
              }`}
            >
              <Award className="h-4 w-4 shrink-0" />
              <span>5. Sertifikat</span>
              {done && <Trophy className="h-3 w-3 text-amber-300 shrink-0 ml-1" />}
            </button>
          </div>
        </div>

        {/* TAB CONTENT: 1. VIDEO MATERI */}
        {activeTab === "video" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-navy">
                    Video Pembelajaran Utama
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Paparan materi interaktif oleh {module.trainer.name}.
                  </p>
                </div>
                <button
                  onClick={() => handleToggleStep("video")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    completedSteps.video
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                      : "bg-marine text-white hover:bg-marine/90"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {completedSteps.video ? "Selesai Ditonton ✓" : "Tandai Telah Menonton"}
                </button>
              </div>

              {/* Video Player Display */}
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex flex-col justify-center items-center">
                {vidDoc?.downloadUrl ? (
                  vidDoc.downloadUrl.includes("youtube.com") || vidDoc.downloadUrl.includes("youtu.be") ? (
                    <iframe
                      src={
                        vidDoc.downloadUrl.includes("embed")
                          ? vidDoc.downloadUrl
                          : `https://www.youtube.com/embed/${vidDoc.downloadUrl.split("v=")[1]?.split("&")[0] || vidDoc.downloadUrl.split("/").pop()}`
                      }
                      title={module.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  ) : vidDoc.downloadUrl.includes("vimeo.com") ? (
                    <iframe
                      src={`https://player.vimeo.com/video/${vidDoc.downloadUrl.split("/").pop()}`}
                      title={module.title}
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  ) : (
                    <video
                      src={vidDoc.downloadUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  )
                ) : isVideoPlaying ? (
                  <div className="p-8 text-center max-w-md">
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-marine/20 text-marine animate-pulse mb-4">
                      <Play className="h-8 w-8 ml-1" />
                    </div>
                    <p className="text-sm font-bold text-white">Memutar Materi Video Pembelajaran...</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Sesi 1: Introduksi Standar &amp; Terminologi Pembelajaran.
                    </p>
                    <button
                      onClick={() => setIsVideoPlaying(false)}
                      className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                    >
                      Jeda Pemutaran
                    </button>
                  </div>
                ) : (
                  <div className="p-8 text-center max-w-md">
                    <button
                      onClick={() => setIsVideoPlaying(true)}
                      className="group mx-auto grid h-20 w-20 place-items-center rounded-full bg-marine text-white shadow-xl hover:scale-105 transition-all mb-4"
                    >
                      <Play className="h-10 w-10 ml-1.5 group-hover:scale-110 transition-transform" />
                    </button>
                    <h3 className="text-base font-bold text-white">
                      {module.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Durasi Video Pengantar: ~{module.hours * 30} Menit • Video Edukasi Mandiri
                    </p>
                    <button
                      onClick={() => setIsVideoPlaying(true)}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-xs font-semibold backdrop-blur transition"
                    >
                      <PlayCircle className="h-4 w-4" /> Mulai Tonton Video
                    </button>
                  </div>
                )}
              </div>

              {/* Video Chapters Outline */}
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="font-display text-sm font-bold text-navy mb-3">
                  Silabus &amp; Bab Pembahasan Video
                </h3>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {module.learningObjectives.length > 0 ? (
                    module.learningObjectives.map((obj, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-3 rounded-xl border border-border/80 bg-muted/20 text-xs"
                      >
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-marine/10 text-marine font-bold text-[10px]">
                          {i + 1}
                        </span>
                        <span className="text-foreground/85 leading-relaxed">{obj}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-xl border border-border bg-muted/20 text-xs text-muted-foreground">
                      Materi mencakup pengenalan konsep, studi kasus riil, dan persiapan kuis kelulusan.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    handleToggleStep("video");
                    setActiveTab("pdf");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-xs"
                >
                  Lanjut ke Modul <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 2. MODUL (RINGKASAN & NASKAH LENGKAP) */}
        {activeTab === "pdf" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                  <h2 className="font-display text-lg font-bold text-navy">
                    Naskah &amp; Modul Pembelajaran
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ringkasan kurikulum, silabus, dan dokumen naskah modul lengkap resmi.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {moduleDoc?.downloadUrl && (
                    <a
                      href={moduleDoc.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-marine bg-card px-3.5 py-2 text-xs font-bold text-marine hover:bg-marine hover:text-white transition shadow-2xs"
                    >
                      <Download className="h-3.5 w-3.5" /> Unduh Dokumen ({formatBytes(moduleDoc.size)})
                    </a>
                  )}
                  <button
                    onClick={() => handleToggleStep("pdf")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                      completedSteps.pdf
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                        : "bg-marine text-white hover:bg-marine/90"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {completedSteps.pdf ? "Selesai Membaca ✓" : "Tandai Telah Membaca Modul"}
                  </button>
                </div>
              </div>

              {/* 1. RINGKASAN MODUL (INTERACTIVE OVERVIEW DECK) */}
              <div className="rounded-2xl border-2 border-slate-800 bg-slate-900 p-6 text-white shadow-lg min-h-[300px] flex flex-col justify-between mb-6">
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
                    <span className="rounded-full bg-marine/30 text-marine px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      {dynamicSlides[overviewSlide]?.badge || "Ringkasan Modul"}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Halaman {overviewSlide + 1} dari {dynamicSlides.length}
                    </span>
                  </div>

                  <h3 className="font-display text-lg font-bold text-white">
                    {dynamicSlides[overviewSlide]?.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {dynamicSlides[overviewSlide]?.subtitle}
                  </p>

                  <div className="mt-5 space-y-2.5">
                    {dynamicSlides[overviewSlide]?.bullets.map((b, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-slate-200">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-marine shrink-0" />
                        <span className="leading-relaxed">{b}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <button
                    disabled={overviewSlide === 0}
                    onClick={() => setOverviewSlide((prev) => Math.max(0, prev - 1))}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition"
                  >
                    <ChevronLeft className="h-4 w-4" /> Sebelumnya
                  </button>
                  <div className="flex items-center gap-1">
                    {dynamicSlides.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setOverviewSlide(idx)}
                        className={`h-2 rounded-full transition-all ${
                          overviewSlide === idx ? "w-6 bg-marine" : "w-2 bg-slate-700"
                        }`}
                        title={`Halaman ${idx + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    disabled={overviewSlide === dynamicSlides.length - 1}
                    onClick={() => setOverviewSlide((prev) => Math.min(dynamicSlides.length - 1, prev + 1))}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition"
                  >
                    Selanjutnya <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 2. DOKUMEN LENGKAP NASKAH MODUL (PDF) */}
              <div className="rounded-xl border border-border bg-muted/10 p-6">
                <div className="flex items-start gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-destructive/10 text-destructive">
                    <FileText className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="inline-block rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive uppercase tracking-wider mb-1">
                      Naskah Modul Terverifikasi
                    </span>
                    <h3 className="font-display text-base font-bold text-navy">
                      {moduleDoc?.name || `Naskah Modul: ${module.title}.pdf`}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Ukuran: {formatBytes(moduleDoc?.size ?? 0)} • Disusun oleh {module.trainer.name}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {moduleDoc?.downloadUrl ? (
                        <>
                          <a
                            href={moduleDoc.downloadUrl}
                            download={moduleDoc.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-navy/90 transition shadow-2xs"
                          >
                            <Download className="h-3.5 w-3.5" /> Unduh Naskah Modul (PDF)
                          </a>
                          <a
                            href={moduleDoc.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold text-navy hover:bg-muted transition shadow-2xs"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Buka di Tab Baru
                          </a>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-marine/10 text-marine px-3 py-1.5 text-xs font-medium">
                          Naskah modul siap diakses dalam pembelajaran
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Supplementary Attached Documents (Trainer Guide, Evaluation, etc.) */}
                {(trainerGuideDoc || evaluationDoc) && (
                  <div className="mt-6 pt-5 border-t border-border/80">
                    <h4 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <FileCheck className="h-4 w-4 text-marine" /> Berkas Pendukung Modul
                    </h4>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {trainerGuideDoc && (
                        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs font-bold text-navy truncate">{trainerGuideDoc.name}</p>
                            <p className="text-[11px] text-muted-foreground">Panduan Pengajar ({formatBytes(trainerGuideDoc.size)})</p>
                          </div>
                          {trainerGuideDoc.downloadUrl && (
                            <a
                              href={trainerGuideDoc.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 p-1.5 rounded-lg bg-muted hover:bg-marine hover:text-white text-muted-foreground transition"
                              title="Unduh Panduan Pengajar"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      )}
                      {evaluationDoc && (
                        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs font-bold text-navy truncate">{evaluationDoc.name}</p>
                            <p className="text-[11px] text-muted-foreground">Formulir Evaluasi ({formatBytes(evaluationDoc.size)})</p>
                          </div>
                          {evaluationDoc.downloadUrl && (
                            <a
                              href={evaluationDoc.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 p-1.5 rounded-lg bg-muted hover:bg-marine hover:text-white text-muted-foreground transition"
                              title="Unduh Formulir Evaluasi"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => setActiveTab("video")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-navy"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Video
                </button>
                <button
                  onClick={() => {
                    handleToggleStep("pdf");
                    setActiveTab("ppt");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-xs"
                >
                  Lanjut ke Slide PPT <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 3. SLIDE PPT (LEMBAR PEMBACA SLIDE & BERKAS PRESENTASI) */}
        {activeTab === "ppt" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                  <h2 className="font-display text-lg font-bold text-navy">
                    Slide Presentasi &amp; Materi Tayang
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Slide materi tayang instruktur untuk presentasi dan penelaahan mandiri.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {pptDoc?.downloadUrl && (
                    <a
                      href={pptDoc.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-600/30 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 transition shadow-2xs"
                    >
                      <Download className="h-3.5 w-3.5" /> Unduh Berkas Slide ({formatBytes(pptDoc.size)})
                    </a>
                  )}
                  <button
                    onClick={() => handleToggleStep("ppt")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                      completedSteps.ppt
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                        : "bg-marine text-white hover:bg-marine/90"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {completedSteps.ppt ? "Selesai Ditelaah ✓" : "Tandai Telah Menelaah Slide"}
                  </button>
                </div>
              </div>

              {/* 1. KARTU BERKAS PRESENTASI RESMI */}
              {pptDoc && (
                <div className="rounded-xl border border-amber-300/80 bg-amber-50/70 p-5 shadow-2xs mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-600/10 text-amber-700">
                        <Presentation className="h-6 w-6" />
                      </span>
                      <div>
                        <span className="inline-block rounded-md bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                          Berkas Slide Presentasi Resmi
                        </span>
                        <h3 className="font-display text-base font-bold text-navy">
                          {pptDoc.name || `Slide: ${module.title}.pptx`}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Ukuran Berkas: {formatBytes(pptDoc.size)} • Disusun oleh {module.trainer.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                      {pptDoc.downloadUrl && (
                        <>
                          <a
                            href={pptDoc.downloadUrl}
                            download={pptDoc.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-700 transition shadow-2xs"
                          >
                            <Download className="h-3.5 w-3.5" /> Unduh Berkas Slide
                          </a>
                          <a
                            href={pptDoc.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition shadow-2xs"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Buka Berkas
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. LEMBAR PEMBACA PDF SLIDE INTERAKTIF (IFRAME READER) */}
              {isPptInPdfFormat && pptDoc?.downloadUrl ? (
                <div className="overflow-hidden rounded-xl border border-border bg-white shadow-inner">
                  <div className="bg-muted/60 px-4 py-2 text-xs font-semibold text-navy flex items-center justify-between border-b border-border">
                    <span className="flex items-center gap-1.5">
                      <Presentation className="h-4 w-4 text-marine" /> Lembar Pembaca Slide PDF Interaktif:
                    </span>
                    <a
                      href={pptDoc.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-marine hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" /> Layar Penuh
                    </a>
                  </div>
                  <iframe
                    src={pptDoc.downloadUrl}
                    title={pptDoc.name}
                    className="w-full h-[650px] border-0 bg-slate-900"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-5">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Format Berkas Slide Presentasi (.PPTX)
                      </h4>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        Berkas presentasi di atas berformat Microsoft PowerPoint (<code>.pptx</code>). Berkas ini dapat langsung diunduh dan dibuka menggunakan aplikasi PowerPoint, Google Slides, atau WPS Office.
                      </p>
                      {isPptVerySmall && (
                        <p className="mt-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                          ⚠️ <strong>Catatan Pengujian:</strong> Berkas <code>{pptDoc?.name}</code> yang diunggah berukuran 50 B (file teks mock/placeholder), sehingga aplikasi PowerPoint akan mendeteksinya bukan sebagai slide utuh. Pada produksi nyata, pastikan mengunggah file PPTX asli atau file PDF slide.
                        </p>
                      )}
                      <p className="mt-2 text-[11px] text-slate-500">
                        💡 <em>Tips Instruktur:</em> Untuk menampilkan lembar slide langsung di layar ruang belajar tanpa perlu diunduh peserta, instruktur dapat mengekspor slide presentasi ke format <strong>PDF</strong> saat pengajuan modul.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. KEY TAKEAWAYS / POIN KRUSIAL MATERI TAYANG */}
              <div className="mt-6 rounded-xl border border-border bg-card p-5">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-navy mb-3 flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-marine" /> Poin Kunci Materi Tayang Sebelum Mengikuti Kuis
                </h4>
                <div className="grid gap-2.5 sm:grid-cols-2 text-xs text-muted-foreground">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
                    <span className="font-semibold text-navy block mb-1">1. Penguasaan Konsep Dasar</span>
                    Pahami definisi, prinsip kerja, dan standar acuan yang diuraikan dalam naskah modul dan video pembelajaran.
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
                    <span className="font-semibold text-navy block mb-1">2. Target Capaian Kompetensi</span>
                    Pastikan seluruh target capaian ({module.competencyOutcomes || "penguasaan kompetensi terapan"}) telah dipahami dengan baik.
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
                    <span className="font-semibold text-navy block mb-1">3. Evaluasi &amp; Passing Grade</span>
                    Kuis kelulusan mensyaratkan nilai minimal <strong>{passingScore}%</strong> untuk membuka sertifikat digital.
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
                    <span className="font-semibold text-navy block mb-1">4. Kesempatan Ulang Kuis</span>
                    Jika belum mencapai passing grade, Anda dapat meninjau kembali modul dan mengulang pengerjaan kuis kapan saja.
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => setActiveTab("pdf")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-navy"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Modul
                </button>
                <button
                  onClick={() => {
                    handleToggleStep("ppt");
                    setActiveTab("quiz");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-xs"
                >
                  Lanjut ke Kuis Kelulusan <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 4. KUIS KELULUSAN */}
        {activeTab === "quiz" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                  <h2 className="font-display text-lg font-bold text-navy">
                    Kuis Evaluasi &amp; Kelulusan Modul
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Passing Grade: <strong>{passingScore}%</strong> • {dynamicQuizQuestions.length} Soal Pilihan Ganda
                  </p>
                </div>
                {quizSubmitted && quizScore !== null && (
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
                        quizScore >= passingScore
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                          : "bg-destructive/10 text-destructive border border-destructive/30"
                      }`}
                    >
                      {quizScore >= passingScore ? <CheckCircle2 className="h-4 w-4" /> : null}
                      Nilai Anda: {quizScore}% {quizScore >= passingScore ? "(LULUS)" : "(BELUM LULUS)"}
                    </span>
                    <button
                      onClick={handleRetakeQuiz}
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      <RotateCcw className="h-3 w-3" /> Ulangi Kuis
                    </button>
                  </div>
                )}
              </div>

              {/* Questions List */}
              <div className="space-y-6">
                {dynamicQuizQuestions.map((q, qIndex) => {
                  const selectedAnswer = quizAnswers[qIndex];
                  const isCorrect = selectedAnswer === q.correctAnswer;

                  return (
                    <div
                      key={q.id}
                      className="rounded-xl border border-border bg-background p-5 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-marine/15 text-xs font-bold text-marine">
                          {qIndex + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-navy">{q.question}</p>
                          <div className="mt-3 space-y-2">
                            {q.options.map((opt, optIndex) => {
                              const isSelected = selectedAnswer === optIndex;
                              let optClasses = "border-border hover:bg-muted/40 text-foreground/80";

                              if (quizSubmitted) {
                                if (optIndex === q.correctAnswer) {
                                  optClasses = "border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold";
                                } else if (isSelected && !isCorrect) {
                                  optClasses = "border-destructive bg-destructive/10 text-destructive";
                                }
                              } else if (isSelected) {
                                optClasses = "border-marine bg-marine/10 text-navy font-semibold";
                              }

                              return (
                                <button
                                  key={optIndex}
                                  disabled={quizSubmitted}
                                  onClick={() => setQuizAnswers((prev) => ({ ...prev, [qIndex]: optIndex }))}
                                  className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left text-xs transition ${optClasses}`}
                                >
                                  <span className="font-bold text-muted-foreground uppercase">
                                    {String.fromCharCode(65 + optIndex)}.
                                  </span>
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                          </div>

                          {quizSubmitted && (
                            <div className="mt-3 rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                              <strong>Penjelasan:</strong> {q.explanation}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                <button
                  onClick={() => setActiveTab("ppt")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-navy"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Slide PPT
                </button>

                {!quizSubmitted ? (
                  <button
                    disabled={Object.keys(quizAnswers).length < dynamicQuizQuestions.length}
                    onClick={handleSubmitQuiz}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-6 py-2.5 text-xs font-bold text-white hover:bg-marine/90 disabled:opacity-50 disabled:pointer-events-none transition shadow-xs"
                  >
                    Kirim Jawaban Kuis <CheckCircle2 className="h-4 w-4" />
                  </button>
                ) : quizScore !== null && quizScore >= passingScore ? (
                  <button
                    onClick={() => setActiveTab("certificate")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-amber-700 transition shadow-xs"
                  >
                    Buka Sertifikat Kelulusan <Award className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleRetakeQuiz}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-6 py-2.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-xs"
                  >
                    <RotateCcw className="h-4 w-4" /> Coba Kuis Lagi
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 5. SERTIFIKAT KELULUSAN */}
        {activeTab === "certificate" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              {done ? (
                <div className="text-center py-4">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-500/10 text-amber-600 mb-4">
                    <Trophy className="h-9 w-9" />
                  </div>
                  <h2 className="font-display text-2xl font-extrabold text-navy">
                    Selamat Atas Kelulusan Anda!
                  </h2>
                  <p className="mx-auto mt-1.5 max-w-lg text-xs text-muted-foreground leading-relaxed">
                    Anda telah menyelesaikan seluruh aktivitas pembelajaran dan lulus kuis evaluasi modul ini. Sertifikat kelulusan resmi Anda telah diterbitkan.
                  </p>

                  {/* Certificate Mock Card */}
                  <div className="mx-auto mt-6 max-w-xl rounded-2xl border-2 border-amber-500/30 bg-gradient-to-b from-amber-500/5 via-card to-amber-500/10 p-6 text-left shadow-soft">
                    <div className="flex items-center justify-between border-b border-amber-500/20 pb-4">
                      <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                          BARUNA OFFICIAL CERTIFICATE OF COMPLETION
                        </span>
                        <p className="text-xs text-muted-foreground">Kementerian Kelautan dan Perikanan RI</p>
                      </div>
                      <Award className="h-8 w-8 text-amber-500" />
                    </div>

                    <div className="my-5">
                      <p className="text-[11px] text-muted-foreground">Diberikan kepada:</p>
                      <h3 className="font-display text-lg font-bold text-navy">Peserta Terverifikasi BARUNA</h3>
                      <p className="mt-2 text-xs text-foreground/80">
                        Atas keberhasilan menyelesaikan modul pelatihan mandiri:
                      </p>
                      <h4 className="mt-1 font-display text-sm font-bold text-marine">
                        {module.title}
                      </h4>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Instruktur: <span className="font-semibold text-navy">{module.trainer.name}</span> • Beban Belajar: {module.hours} JP
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/20 pt-4 text-[11px] text-muted-foreground">
                      <span>No. Sertifikat: <strong className="font-mono text-navy">BARUNA-MOD-{module.id.slice(0, 8).toUpperCase()}-2026</strong></span>
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Terverifikasi Resmi
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={handleDownloadCertificate}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                    >
                      <Download className="h-4 w-4" /> Unduh Sertifikat Resmi (PDF)
                    </button>
                    <Link
                      to="/academy/learn"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-3 text-xs font-bold text-foreground hover:bg-muted transition"
                    >
                      Kembali ke Dashboard My Learning
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground mb-4">
                    <Award className="h-7 w-7" />
                  </div>
                  <h2 className="font-display text-lg font-bold text-navy">
                    Sertifikat Belum Terbuka
                  </h2>
                  <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                    Selesaikan semua langkah materi pembelajaran (Video, Modul, Slide PPT) dan capai nilai kuis minimal <strong>{passingScore}%</strong> untuk menerbitkan sertifikat kelulusan.
                  </p>
                  <button
                    onClick={() => setActiveTab("quiz")}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-xs"
                  >
                    Buka Kuis Kelulusan Sekarang <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AcademyShell>
  );
}
