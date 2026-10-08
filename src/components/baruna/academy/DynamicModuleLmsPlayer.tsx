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
import {
  downloadCertificatePdf,
  openCertificatePdf,
  formatTodayIndonesian,
  formatTanggalIndo,
  numberToIndonesianWords,
  type CertificateData,
} from "@/lib/certificate";
import { getMyParticipantBiodata } from "@/lib/academy/participant-biodata.functions";
import { useQuery } from "@tanstack/react-query";
import {
  useShortCourses,
  enrollShortCourse,
  completeShortCourse,
  updateShortCourseSteps,
} from "@/lib/shortCourses";
import type { PublishedModuleDetail } from "@/lib/learning/learning.functions";

function getDynamicModuleSlides(module: PublishedModuleDetail) {
  const slides = [];

  // Slide 1: Pendahuluan & Module Summary
  slides.push({
    title: `1. ${module.title}`,
    subtitle: `Prepared by ${module.trainer.name} • ${module.hours} learning hours (JP)`,
    bullets: [
      `Gambaran Umum: ${module.summary || "Pelatihan terstruktur berbasis kompetensi BARUNA Academy."}`,
      `Bidang Kajian / Topik: ${module.topic || "Pengembangan Kapasitas & Standar Profesional"}`,
      `Competency Area: ${module.competency || "Application of practical methodologies, tools, and standards"}`,
      `Language: ${module.language || "Indonesian"}`,
    ],
    badge: "Module Summary",
  });

  // Slide 2: Target Peserta & Prasyarat
  slides.push({
    title: "2. Target Participants & Prerequisites",
    subtitle: "Participant qualifications and target audience",
    bullets: [
      `Target Participant Profile: ${module.targetParticipants || "Practitioners, academics, researchers, and related professionals."}`,
      `Format Pembelajaran: Pembelajaran Mandiri Interaktif (Self-Paced Learning).`,
      `Standar Kelulusan: Wajib membaca modul, menelaah materi slide, dan lulus kuis (Passing Grade: ${module.passingScore}%).`,
    ],
    badge: "Learning Goals",
  });

  // Slide 3: Learning Objectives (Learning Objectives)
  const objBullets =
    module.learningObjectives.length > 0
      ? module.learningObjectives.map((obj, i) => `${i + 1}. ${obj}`)
      : [
          "1. Understand the module’s conceptual foundation and framework.",
          "2. Master technical implementation and supporting tools.",
          "3. Analyze and solve real-world case studies.",
        ];
  slides.push({
    title: "3. Learning Goals & Objectives",
    subtitle: "Specific competencies targeted by this material",
    bullets: objBullets,
    badge: "Learning Objectives",
  });

  // Slide 4: Capaian Hasil Kompetensi (Competency Outcomes)
  slides.push({
    title: "4. Competency Outcomes",
    subtitle: "Measurable outcomes and practical application of the training",
    bullets: [
      `Expected Outcome: ${module.competencyOutcomes || "Participants can independently and professionally apply the knowledge and skills learned."}`,
      `Assessment Method: ${module.assessmentMethod || "Knowledge Quiz & Self-Assessment"}`,
      `Digital Credential: An official competency certificate is automatically issued after the assessment result is verified.`,
    ],
    badge: "Hasil Kompetensi",
  });

  // Slide 5: Learning Guide & Evaluasi Kuis
  slides.push({
    title: "5. Learning Guide & Final Assessment",
    subtitle: "Preparation for the assessment quiz and certificate eligibility",
    bullets: [
      "Study the comprehensive module document below for deeper understanding.",
      "Continue to Tab 3 (Presentation Slides) to review the trainer’s visual materials.",
      `Complete the Assessment Quiz in Tab 4 to test your understanding and achieve a minimum score of ${module.passingScore}%.`,
    ],
    badge: "Learning Guide",
  });

  return slides;
}

function getDynamicModuleQuiz(module: PublishedModuleDetail) {
  if (module.quizQuestions && module.quizQuestions.length > 0) {
    return module.quizQuestions.map((q, idx) => {
      const opts = Array.isArray(q.options) && q.options.length >= 2 ? q.options : ["Pilihan A", "Pilihan B"];
      const safeCorrect =
        typeof q.correctAnswer === "number" && q.correctAnswer >= 0 && q.correctAnswer < opts.length
          ? q.correctAnswer
          : 0;
      return {
        id: q.id ?? idx + 1,
        question: q.question,
        options: opts,
        correctAnswer: safeCorrect,
        explanation:
          q.explanation ||
          `Pilihan ${String.fromCharCode(65 + safeCorrect)} adalah jawaban yang tepat untuk pertanyaan ini.`,
      };
    });
  }

  const objectives =
    module.learningObjectives.length > 0
      ? module.learningObjectives
      : ["Mastery of core concepts and standardized implementation"];

  return [
    {
      id: 1,
      question: `Based on the module "${module.title}", what is the primary objective of this material?`,
      options: [
        objectives[0] || "Understand the module’s fundamental principles and framework comprehensively",
        "Menghafal teori tanpa melakukan implementasi lapangan",
        "Ignore applicable standards and regulations",
        "Delay evaluation and report preparation",
      ],
      correctAnswer: 0,
      explanation: `The primary learning objective of this module is: ${objectives[0] || "Understand the module’s fundamental principles and framework comprehensively"}.`,
    },
    {
      id: 2,
      question: `Bidang kajian atau topik utama yang dibahas secara mendalam dalam modul ini adalah...`,
      options: [
        module.topic || "Capacity Development & Sustainable Governance",
        "Pemberian subsidi tanpa evaluasi kinerja",
        "Eksploitasi sumber daya tanpa batas kuota",
        "Penutupan akses informasi bagi publik",
      ],
      correctAnswer: 0,
      explanation: `This module specifically covers: ${module.topic || "Capacity Development & Sustainable Governance"}.`,
    },
    {
      id: 3,
      question: `Berapa batas nilai minimum (Passing Grade) yang ditetapkan untuk dinyatakan lulus pada modul ini?`,
      options: [
        `${module.passingScore}% (Standar Kelulusan Kurikulum BARUNA)`,
        "40% (No passing requirement)",
        "50% (Basic score)",
        "100% (Harus sempurna tanpa salah)",
      ],
      correctAnswer: 0,
      explanation: `The official passing score for the module "${module.title}" is ${module.passingScore}%.`,
    },
    {
      id: 4,
      question: `Which competency outcome is expected after participants complete the learning activities?`,
      options: [
        module.competencyOutcomes || "Participants can apply technical skills and address professional challenges in their field",
        "Participants only read the material without understanding its application",
        "Participants are not permitted to apply the material learned",
        "Participants discontinue all capacity-development activities",
      ],
      correctAnswer: 0,
      explanation: `Module competency outcome: ${module.competencyOutcomes || "Able to apply technical skills in their field"}.`,
    },
    {
      id: 5,
      question: `How can participants earn the official digital certificate after completing all materials?`,
      options: [
        "Complete the video lecture, read the module material, review the presentation slides, and pass the assessment quiz",
        "Only open the main page without studying the material",
        "Request a certificate without completing the assessment quiz",
        "Menunggu proses manual selama 6 bulan",
      ],
      correctAnswer: 0,
      explanation: "The certificate is automatically issued and verified after all learning activities and the passing requirement are completed.",
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

  const { data: myBioRes } = useQuery({
    queryKey: ["my-participant-biodata"],
    queryFn: () => getMyParticipantBiodata(),
    staleTime: 30 * 1000,
  });

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
    barunaToast(nextState ? `Activity ${step.toUpperCase()} marked as completed!` : `${step.toUpperCase()} status updated.`);
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
    barunaToast(`Quiz score: ${score}%`);

    if (score >= module.passingScore) {
      completeShortCourse(module.id, score, "self-paced");
      setCompletedSteps((prev) => ({ ...prev, quiz: true, video: true, pdf: true, ppt: true }));
      barunaToast(`🎉 Congratulations! You passed with a score of ${score}% (Passing Grade: ${module.passingScore}%); your certificate is now available!`);
      setActiveTab("certificate");
    } else {
      barunaToast(`Your score is ${score}%. below the passing score of ${module.passingScore}%. Please try again.`);
    }
  };

  const handleRetakeQuiz = () => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
  };

  const getCertData = (): CertificateData => {
    const bio = myBioRes?.biodata;
    const certNumber = `B.589/BDA/RSDM.510/V/${new Date().getFullYear()}`;
    return {
      name: bio?.nama || myBioRes?.prefill.nama || "Peserta Pelatihan",
      country: "Indonesia",
      program: module.title,
      dates: formatTodayIndonesian(),
      certNo: certNumber,
      verifyUrl: `${typeof window !== "undefined" ? window.location.origin : "https://baruna.kkp.go.id"}/academy/certification?verify=${module.id}`,
      nip: bio?.nip || null,
      tempatLahir: bio?.tempatLahir || null,
      tanggalLahir: bio?.tanggalLahir || null,
      pangkatGolongan: bio?.pangkatGolongan || null,
      jabatan: bio?.jabatan || myBioRes?.prefill.jabatan || null,
      instansi: bio?.instansiUnitKerja || myBioRes?.prefill.instansi || null,
      workUnit: bio?.instansiUnitKerja || myBioRes?.prefill.instansi || null,
      photoUrl: bio?.fotoUrl || null,
      learningHours: module.hours || 8,
    };
  };

  const handleDownloadCertificate = () => {
    downloadCertificatePdf(getCertData());
    barunaToast("Completion certificate downloaded successfully!");
  };

  const handleOpenCertificate = () => {
    openCertificatePdf(getCertData());
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
              <CheckCircle2 className="h-3 w-3" /> COMPLETED 100%
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-marine/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-marine">
              <Sparkles className="h-3 w-3" /> Sedang Berjalan
            </span>
          )}
        </div>

        <h3 className="mt-3 font-display text-base font-bold text-navy">Learning Progress</h3>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{stepsDoneCount} of {totalSteps} Activities Completed</span>
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
              <Video className="h-3.5 w-3.5" /> 1. Video Lecture
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
              <FileText className="h-3.5 w-3.5" /> 2. Module Material
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
              <Presentation className="h-3.5 w-3.5" /> 3. Presentation Slides
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
              <ListChecks className="h-3.5 w-3.5" /> 4. Assessment Quiz
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
              <Award className="h-3.5 w-3.5" /> 5. Certificate
            </span>
            {done ? (
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Locked</span>
            )}
          </button>
        </div>

        <div className="mt-5 space-y-2.5">
          {done ? (
            <div className="rounded-xl border border-success/40 bg-success/5 p-3 text-xs text-success">
              <p className="flex items-center gap-1.5 font-bold">
                <Award className="h-4 w-4" /> Module Completed
              </p>
              <p className="mt-1 text-success/80">
                Passing score: <strong>{quizScore ?? 100}%</strong>. Official certificate has been issued.
              </p>
              <button
                onClick={handleDownloadCertificate}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
              >
                <Download className="h-3.5 w-3.5" /> Download Certificate (PDF)
              </button>
            </div>
          ) : (
            <Link
              to="/academy/learn"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 py-2 text-xs font-semibold text-foreground/80 hover:bg-muted"
            >
              ← Back to My Learning
            </Link>
          )}
          <Link
            to="/academy/self-paced/$code"
            params={{ code: module.id }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-muted-foreground hover:text-navy"
          >
            View Summary &amp; Syllabus
          </Link>
        </div>
      </div>

      {/* Trainer Profile Card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
          MODULE INSTRUCTOR
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
                  SELF-PACED LEARNING
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
                    <Clock className="h-3 w-3" /> LEARNING IN PROGRESS
                  </span>
                )}
              </div>
              <h1 className="mt-3 font-display text-2xl font-extrabold text-navy sm:text-3xl">
                {module.title}
              </h1>
              <p className="mt-2 text-xs text-muted-foreground">
                Prepared by <span className="font-semibold text-navy">{module.trainer.name}</span> • {module.hours} learning hours (JP) • Passing Grade {passingScore}%
              </p>
            </div>

            <Link
              to="/academy/self-paced/$code"
              params={{ code: module.id }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground/80 hover:bg-muted transition"
            >
              <BookOpen className="h-3.5 w-3.5" /> View Module Summary
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
              <span>1. Video Lecture</span>
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
              <span>2. Module Material</span>
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
              <span>3. Presentation Slides</span>
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
              <span>4. Assessment Quiz</span>
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
              <span>5. Certificate</span>
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
                    Main Learning Video
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
                  {completedSteps.video ? "Completed ✓" : "Mark as Watched"}
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
                          : `https://www.youtube.com/embed/${vidDoc.downloadUrl.split("v=")[1]?.split("&")[0] || (vidDoc.downloadUrl || "").split("/").pop()}`
                      }
                      title={module.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  ) : vidDoc.downloadUrl.includes("vimeo.com") ? (
                    <iframe
                      src={`https://player.vimeo.com/video/${(vidDoc.downloadUrl || "").split("/").pop()}`}
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
                    <p className="text-sm font-bold text-white">Playing the learning video...</p>
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
                      Introductory video duration: ~{module.hours * 30} Minutes • Self-Paced Learning Video
                    </p>
                    <button
                      onClick={() => setIsVideoPlaying(true)}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-xs font-semibold backdrop-blur transition"
                    >
                      <PlayCircle className="h-4 w-4" /> Watch Video
                    </button>
                  </div>
                )}
              </div>

              {/* Video Chapters Outline */}
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="font-display text-sm font-bold text-navy mb-3">
                  Video Syllabus &amp; Chapters
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
                      The material covers core concepts, real-world case studies, and assessment preparation.
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
                  Continue to Module Material <ArrowRight className="h-4 w-4" />
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
                    Learning Module &amp; Materials
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Official curriculum summary, syllabus, and complete module document.
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
                      <Download className="h-3.5 w-3.5" /> Download Document ({formatBytes(moduleDoc.size)})
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
                    {completedSteps.pdf ? "Completed ✓" : "Mark Module as Read"}
                  </button>
                </div>
              </div>

              {/* 1. RINGKASAN MODUL (INTERACTIVE OVERVIEW DECK) */}
              <div className="rounded-2xl border-2 border-slate-800 bg-slate-900 p-6 text-white shadow-lg min-h-[300px] flex flex-col justify-between mb-6">
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
                    <span className="rounded-full bg-marine/30 text-marine px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      {dynamicSlides[overviewSlide]?.badge || "Module Summary"}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Page {overviewSlide + 1} of {dynamicSlides.length}
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
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {dynamicSlides.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setOverviewSlide(idx)}
                        className={`h-2 rounded-full transition-all ${
                          overviewSlide === idx ? "w-6 bg-marine" : "w-2 bg-slate-700"
                        }`}
                        title={`Page ${idx + 1}`}
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
                      Verified Module Document
                    </span>
                    <h3 className="font-display text-base font-bold text-navy">
                      {moduleDoc?.name || `Module Document: ${module.title}.pdf`}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      File Size: {formatBytes(moduleDoc?.size ?? 0)} • Prepared by {module.trainer.name}
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
                            <Download className="h-3.5 w-3.5" /> Download Module Document (PDF)
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
                          Module document is ready for learning access
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Supplementary Attached Documents (Trainer Guide, Evaluation, etc.) */}
                {(trainerGuideDoc || evaluationDoc) && (
                  <div className="mt-6 pt-5 border-t border-border/80">
                    <h4 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <FileCheck className="h-4 w-4 text-marine" /> Supporting Module Files
                    </h4>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {trainerGuideDoc && (
                        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs font-bold text-navy truncate">{trainerGuideDoc.name}</p>
                            <p className="text-[11px] text-muted-foreground">Trainer Guide ({formatBytes(trainerGuideDoc.size)})</p>
                          </div>
                          {trainerGuideDoc.downloadUrl && (
                            <a
                              href={trainerGuideDoc.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 p-1.5 rounded-lg bg-muted hover:bg-marine hover:text-white text-muted-foreground transition"
                              title="Download Trainer Guide"
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
                            <p className="text-[11px] text-muted-foreground">Evaluation Form ({formatBytes(evaluationDoc.size)})</p>
                          </div>
                          {evaluationDoc.downloadUrl && (
                            <a
                              href={evaluationDoc.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 p-1.5 rounded-lg bg-muted hover:bg-marine hover:text-white text-muted-foreground transition"
                              title="Download Evaluation Form"
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
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Video
                </button>
                <button
                  onClick={() => {
                    handleToggleStep("pdf");
                    setActiveTab("ppt");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-xs"
                >
                  Continue to Presentation Slides <ArrowRight className="h-4 w-4" />
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
                    Presentation Slides &amp; Materials
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Trainer presentation slides for guided and independent study.
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
                      <Download className="h-3.5 w-3.5" /> Download Slides ({formatBytes(pptDoc.size)})
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
                    {completedSteps.ppt ? "Completed ✓" : "Mark Slides as Reviewed"}
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
                          Official Presentation Slides
                        </span>
                        <h3 className="font-display text-base font-bold text-navy">
                          {pptDoc.name || `Slides: ${module.title}.pptx`}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          File Size: {formatBytes(pptDoc.size)} • Prepared by {module.trainer.name}
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
                            <Download className="h-3.5 w-3.5" /> Download Slides
                          </a>
                          <a
                            href={pptDoc.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition shadow-2xs"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Open File
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
                      <Presentation className="h-4 w-4 text-marine" /> Interactive PDF Slide Viewer:
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
                        Presentation File Format (.PPTX)
                      </h4>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        The presentation file above is in Microsoft PowerPoint format (<code>.pptx</code>). It can be downloaded and opened with PowerPoint, Google Slides, or WPS Office.
                      </p>
                      {isPptVerySmall && (
                        <p className="mt-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                          ⚠️ <strong>Testing Note:</strong> The uploaded <code>{pptDoc?.name}</code> file is a 50 B mock/placeholder text file, so PowerPoint will not recognize it as a complete presentation. In production, upload a valid PPTX file or a PDF slide deck.
                        </p>
                      )}
                      <p className="mt-2 text-[11px] text-slate-500">
                        💡 <em>Trainer Tip:</em> To display slides directly in the learning space without requiring a download, trainers can export the presentation to <strong>PDF</strong> when submitting the module.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. KEY TAKEAWAYS / POIN KRUSIAL MATERI TAYANG */}
              <div className="mt-6 rounded-xl border border-border bg-card p-5">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-navy mb-3 flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-marine" /> Key Points Before Taking the Assessment
                </h4>
                <div className="grid gap-2.5 sm:grid-cols-2 text-xs text-muted-foreground">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
                    <span className="font-semibold text-navy block mb-1">1. Core Concept Mastery</span>
                    Review the definitions, operating principles, and reference standards presented in the module and learning video.
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
                    <span className="font-semibold text-navy block mb-1">2. Competency Outcomes</span>
                    Ensure all competency outcomes ({module.competencyOutcomes || "applied competency mastery"}) have been fully understood.
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
                    <span className="font-semibold text-navy block mb-1">3. Assessment &amp; Passing Score</span>
                    The assessment requires a minimum score of <strong>{passingScore}%</strong> to unlock the digital certificate.
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
                    <span className="font-semibold text-navy block mb-1">4. Retake Opportunities</span>
                    If you do not reach the passing score, you may review the module and retake the assessment at any time.
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => setActiveTab("pdf")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-navy"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Module Material
                </button>
                <button
                  onClick={() => {
                    handleToggleStep("ppt");
                    setActiveTab("quiz");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-xs"
                >
                  Continue to Assessment Quiz <ArrowRight className="h-4 w-4" />
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
                    Module Assessment Quiz
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
                      Your Score: {quizScore}% {quizScore >= passingScore ? "(PASSED)" : "(NOT PASSED)"}
                    </span>
                    <button
                      onClick={handleRetakeQuiz}
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      <RotateCcw className="h-3 w-3" /> Retake Quiz
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
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Presentation Slides
                </button>

                {!quizSubmitted ? (
                  <button
                    disabled={Object.keys(quizAnswers).length < dynamicQuizQuestions.length}
                    onClick={handleSubmitQuiz}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-6 py-2.5 text-xs font-bold text-white hover:bg-marine/90 disabled:opacity-50 disabled:pointer-events-none transition shadow-xs"
                  >
                    Submit Quiz Answers <CheckCircle2 className="h-4 w-4" />
                  </button>
                ) : quizScore !== null && quizScore >= passingScore ? (
                  <button
                    onClick={() => setActiveTab("certificate")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-amber-700 transition shadow-xs"
                  >
                    Open Certificate <Award className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleRetakeQuiz}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-6 py-2.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-xs"
                  >
                    <RotateCcw className="h-4 w-4" /> Retake Quiz
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
                    Congratulations on Completing the Module!
                  </h2>
                  <p className="mx-auto mt-1.5 max-w-lg text-xs text-muted-foreground leading-relaxed">
                    You have completed all learning activities and passed the module assessment. Your official certificate has been issued.
                  </p>

                  {/* Official KKP STTP Certificate Card */}
                  <div className="mx-auto mt-6 max-w-2xl rounded-2xl border-2 border-navy/20 bg-card p-6 sm:p-8 text-left shadow-card">
                    {/* Header: Title & Nomor Surat */}
                    <div className="text-center pb-4 border-b border-border">
                      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-700">
                        <Award className="h-7 w-7" />
                      </div>
                      <h3 className="font-display text-lg sm:text-xl font-extrabold uppercase tracking-wide text-navy">
                        SURAT TANDA TAMAT PELATIHAN
                      </h3>
                      <p className="mt-0.5 font-mono text-xs font-semibold text-muted-foreground">
                        Nomor : B.589/BDA/RSDM.510/V/2026
                      </p>
                      <p className="mt-3 text-[11px] leading-relaxed text-foreground/80 text-justify sm:text-center">
                        Pusat Pelatihan dan Penyuluhan Kelautan dan Perikanan berdasarkan Undang-undang Nomor 20 Tahun 2023 tentang Aparatur Sipil Negara, serta ketentuan pelaksanaannya menyatakan bahwa :
                      </p>
                    </div>

                    {/* Identitas Peserta: Foto di Kiri + 7 Kolom Identitas Resmi di Kanan */}
                    <div className="my-5 flex flex-col sm:flex-row items-start gap-4 sm:gap-6 rounded-xl border border-border/80 bg-muted/20 p-4">
                      {/* Pas Foto Resmi */}
                      <div className="shrink-0 mx-auto sm:mx-0 text-center">
                        <div className="relative h-36 w-28 overflow-hidden rounded border border-navy/30 bg-red-600 shadow-xs">
                          {myBioRes?.biodata?.fotoUrl ? (
                            <img
                              src={myBioRes.biodata.fotoUrl}
                              alt="Pas Foto Peserta"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-center text-white p-2">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider">Pas Foto</p>
                                <p className="text-[8px] opacity-80">3 x 4 Resmi</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="mt-1.5 inline-block text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          ✓ Pas foto resmi
                        </span>
                      </div>

                      {/* 7 Kolom Identitas Lengkap Sesuai Form */}
                      <div className="flex-1 w-full text-xs space-y-1.5">
                        <div className="grid grid-cols-12 gap-1 py-0.5">
                          <span className="col-span-5 sm:col-span-4 text-muted-foreground font-medium">Nama</span>
                          <span className="col-span-1 text-center text-muted-foreground">:</span>
                          <span className="col-span-6 sm:col-span-7 font-bold text-navy">
                            {myBioRes?.biodata?.nama || myBioRes?.prefill.nama || "Peserta Pelatihan"}
                          </span>
                        </div>
                        <div className="grid grid-cols-12 gap-1 py-0.5">
                          <span className="col-span-5 sm:col-span-4 text-muted-foreground font-medium">NIP</span>
                          <span className="col-span-1 text-center text-muted-foreground">:</span>
                          <span className="col-span-6 sm:col-span-7 font-mono font-medium text-foreground">
                            {myBioRes?.biodata?.nip || "-"}
                          </span>
                        </div>
                        <div className="grid grid-cols-12 gap-1 py-0.5">
                          <span className="col-span-5 sm:col-span-4 text-muted-foreground font-medium">Tempat Lahir</span>
                          <span className="col-span-1 text-center text-muted-foreground">:</span>
                          <span className="col-span-6 sm:col-span-7 text-foreground">
                            {myBioRes?.biodata?.tempatLahir || "-"}
                          </span>
                        </div>
                        <div className="grid grid-cols-12 gap-1 py-0.5">
                          <span className="col-span-5 sm:col-span-4 text-muted-foreground font-medium">Tanggal Lahir</span>
                          <span className="col-span-1 text-center text-muted-foreground">:</span>
                          <span className="col-span-6 sm:col-span-7 text-foreground">
                            {formatTanggalIndo(myBioRes?.biodata?.tanggalLahir) || "-"}
                          </span>
                        </div>
                        <div className="grid grid-cols-12 gap-1 py-0.5">
                          <span className="col-span-5 sm:col-span-4 text-muted-foreground font-medium">Pangkat/ Gol. Ruang</span>
                          <span className="col-span-1 text-center text-muted-foreground">:</span>
                          <span className="col-span-6 sm:col-span-7 text-foreground">
                            {myBioRes?.biodata?.pangkatGolongan || "-"}
                          </span>
                        </div>
                        <div className="grid grid-cols-12 gap-1 py-0.5">
                          <span className="col-span-5 sm:col-span-4 text-muted-foreground font-medium">Jabatan</span>
                          <span className="col-span-1 text-center text-muted-foreground">:</span>
                          <span className="col-span-6 sm:col-span-7 text-foreground">
                            {myBioRes?.biodata?.jabatan || myBioRes?.prefill.jabatan || "-"}
                          </span>
                        </div>
                        <div className="grid grid-cols-12 gap-1 py-0.5">
                          <span className="col-span-5 sm:col-span-4 text-muted-foreground font-medium">Instansi</span>
                          <span className="col-span-1 text-center text-muted-foreground">:</span>
                          <span className="col-span-6 sm:col-span-7 text-foreground">
                            {myBioRes?.biodata?.instansiUnitKerja || myBioRes?.prefill.instansi || "Kementerian Kelautan dan Perikanan"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pernyataan Kelulusan Pelatihan */}
                    <div className="my-4 text-center">
                      <p className="text-xs text-foreground/80">Telah mengikuti pengembangan kompetensi melalui pelatihan :</p>
                      <h4 className="mt-1 font-display text-base font-bold text-navy">{module.title}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        oleh Balai Diklat Aparatur Kementerian Kelautan dan Perikanan metode full e-learning meliputi {module.hours || 8} ({numberToIndonesianWords(module.hours || 8)}) jam pelajaran (JP).
                      </p>
                    </div>

                    {/* Footer: QR Code & Pengesahan Pejabat */}
                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border pt-4 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="h-16 w-16 rounded-lg border border-border bg-white p-1 shadow-2xs flex items-center justify-center text-center">
                          <span className="font-mono text-[9px] text-muted-foreground leading-tight">QR CODE<br/>VERIFIED<br/>OFFICIAL</span>
                        </div>
                        <div>
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Terverifikasi Resmi
                          </span>
                          <p className="font-mono text-[10px] text-muted-foreground">Nomor: B.589/BDA/RSDM.510/V/2026</p>
                        </div>
                      </div>

                      <div className="text-center sm:text-right">
                        <p className="text-[11px] text-muted-foreground">{formatTodayIndonesian()}</p>
                        <p className="font-semibold text-navy text-[11px]">Kepala Pusat Pelatihan Kelautan dan Perikanan</p>
                        <p className="mt-6 font-bold text-navy text-xs underline decoration-navy/40">Lilly Aprilya Pregiwati</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={handleDownloadCertificate}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                    >
                      <Download className="h-4 w-4" /> Download Official Certificate (PDF)
                    </button>
                    <button
                      onClick={handleOpenCertificate}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-600 bg-card px-5 py-3 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition"
                    >
                      <ExternalLink className="h-4 w-4" /> Preview / Buka di Tab Baru
                    </button>
                    <Link
                      to="/academy/learn"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-3 text-xs font-bold text-foreground hover:bg-muted transition"
                    >
                      Back to My Learning Dashboard
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground mb-4">
                    <Award className="h-7 w-7" />
                  </div>
                  <h2 className="font-display text-lg font-bold text-navy">
                    Certificate Not Yet Available
                  </h2>
                  <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                    Complete all learning activities (Video, Module Material, Presentation Slides) and achieve a minimum assessment score of <strong>{passingScore}%</strong> to issue your completion certificate.
                  </p>
                  <button
                    onClick={() => setActiveTab("quiz")}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-xs"
                  >
                    Open Assessment Quiz Now <ArrowRight className="h-4 w-4" />
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
