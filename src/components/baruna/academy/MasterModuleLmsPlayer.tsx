import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Layers,
  ListChecks,
  PlayCircle,
  Presentation,
  Sparkles,
  Trophy,
  User,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { Toaster } from "@/components/baruna/Toaster";
import { ModuleQuiz } from "@/components/baruna/academy/ModuleQuiz";
import { barunaToast } from "@/lib/downloads";
import { downloadCertificatePdf } from "@/lib/certificate";
import { masterByCode, MINUTES_PER_JP, type MasterModule } from "@/data/masterModules";
import { type LmsModule, type ResourceKind } from "@/data/lms";
import { hasQuizBank, QUIZ_PASS_PERCENT } from "@/data/quizzes";
import { instructorBySlug } from "@/data/instructors";
import {
  useApplication,
  getLms,
  getQuizRecord,
  isModuleCompleteInApp,
  updateLms,
  getOrCreateSelfPacedApp,
  SELF_PACED_APP_ID,
} from "@/lib/application";
import {
  useShortCourses,
  enrollShortCourse,
  completeShortCourse,
} from "@/lib/shortCourses";

const RESOURCE_ICONS: Record<ResourceKind, typeof PlayCircle> = {
  video: PlayCircle,
  pdf: FileText,
  ppt: Presentation,
  reading: BookOpen,
  quiz: ListChecks,
};
const RESOURCE_ORDER: ResourceKind[] = ["pdf", "ppt", "video", "reading", "quiz"];

export function MasterModuleLmsPlayer({
  master,
  lms: lmsModule,
}: {
  master: MasterModule;
  lms: LmsModule | undefined;
}) {
  const navigate = useNavigate();
  const { get, isCompleted, priorLearning } = useShortCourses();
  const enrollment = get(master.code);
  const done = isCompleted(master.code);
  const priorFromTraining = priorLearning(master.code);
  const app = useApplication(SELF_PACED_APP_ID);
  const [quizOpen, setQuizOpen] = useState(false);

  useEffect(() => {
    if (!enrollment) {
      getOrCreateSelfPacedApp();
      enrollShortCourse(master.code, {
        title: master.title,
        hours: master.hours,
        instructor: master.instructorSlug,
        category: master.subCategory,
      });
    }
  }, [enrollment, master]);

  const instructor = instructorBySlug[master.instructorSlug];
  const quizRec = app && lmsModule ? getQuizRecord(app, lmsModule.id) : undefined;
  const moduleProgress = app && lmsModule ? getLms(app).modules[lmsModule.id] : undefined;
  const resourcesDone = moduleProgress
    ? RESOURCE_ORDER.filter((k) => moduleProgress[k]).length
    : 0;
  const isWorkspaceComplete = app && lmsModule
    ? isModuleCompleteInApp(app, lmsModule.id)
    : done;

  useEffect(() => {
    if (quizRec?.passed && !enrollment?.completed) {
      completeShortCourse(master.code, quizRec.bestScore, "self-paced");
    }
  }, [quizRec?.passed, quizRec?.bestScore, master.code, enrollment?.completed]);

  const toggleResource = (kind: ResourceKind) => {
    if (!app || !lmsModule) return;
    const lms = getLms(app);
    const mp = lms.modules[lmsModule.id] || {};
    updateLms(app.id, {
      ...lms,
      modules: { ...lms.modules, [lmsModule.id]: { ...mp, [kind]: !mp[kind] } },
    });
  };

  const handleDownloadCertificate = () => {
    downloadCertificatePdf({
      name: "Peserta BARUNA",
      country: "Indonesia",
      program: master.title,
      dates: new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
      certNo: `BARUNA-MOD-${master.code.replace(/[^A-Z0-9]/gi, "").toUpperCase()}-2026`,
      verifyUrl: `https://baruna.kkp.go.id/verify/${master.code}`,
    });
    barunaToast("Sertifikat kelulusan modul berhasil diunduh!");
  };

  const aside = (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[0.65rem] font-bold text-foreground/70">
            {master.code}
          </span>
          {isWorkspaceComplete && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-success">
              <CheckCircle2 className="h-3 w-3" /> Selesai 100%
            </span>
          )}
        </div>
        <h3 className="mt-3 font-display text-base font-bold text-navy">Informasi Modul</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Durasi</span>
            <span className="font-semibold text-navy">{master.hours} Jam ({master.jp} JP)</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Level</span>
            <span className="font-semibold text-navy">{master.level}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Instruktur</span>
            <span className="font-semibold text-navy">{instructor?.name ?? master.instructorSlug}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Sertifikat</span>
            <span className="font-semibold text-navy">Certificate of Completion</span>
          </li>
        </ul>

        {isWorkspaceComplete ? (
          <div className="mt-4 rounded-xl border border-success/40 bg-success/5 p-3 text-xs text-success">
            <p className="flex items-center gap-1.5 font-bold">
              <Award className="h-3.5 w-3.5" /> Modul Telah Selesai
            </p>
            <p className="mt-1 text-success/80">
              Sertifikat kelulusan tersedia. Kredit diakui di seluruh Program Pelatihan BARUNA.
            </p>
            <button
              onClick={handleDownloadCertificate}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
            >
              <Download className="h-3.5 w-3.5" /> Unduh Sertifikat (PDF)
            </button>
          </div>
        ) : null}

        <div className="mt-4 pt-3 border-t border-border flex flex-col gap-2">
          <Link
            to="/academy/learn"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 py-2 text-xs font-semibold text-foreground/80 hover:bg-muted"
          >
            ← Kembali ke My Learning
          </Link>
          <Link
            to="/academy/self-paced/$code"
            params={{ code: master.code }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-muted-foreground hover:text-navy"
          >
            Lihat Ringkasan &amp; Silabus
          </Link>
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
          <span className="font-semibold text-navy">{master.code} · {master.title}</span>
        </nav>

        {/* Header */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-marine/10 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-marine">
              Master Module · No. {master.no}
            </span>
            <span className="rounded-md bg-muted px-2 py-1 font-mono text-[0.65rem] font-bold text-foreground/70">
              {master.code}
            </span>
            {isWorkspaceComplete && (
              <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-success">
                <CheckCircle2 className="h-3 w-3" /> Completed
              </span>
            )}
            {priorFromTraining && !enrollment?.completed && (
              <span className="inline-flex items-center gap-1 rounded-md bg-marine/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-marine">
                <Award className="h-3 w-3" /> Completed via Full Training Program
              </span>
            )}
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-navy sm:text-3xl">{master.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{master.summary}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
              <Clock className="h-3.5 w-3.5" /> {master.hours}h · {master.jp} JP
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
              <Layers className="h-3.5 w-3.5" /> {master.subCategory}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
              <User className="h-3.5 w-3.5" /> {instructor?.name ?? master.instructorSlug}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
              <Sparkles className="h-3.5 w-3.5" /> {master.version}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-sm font-bold text-navy">Progres Pembelajaran</p>
              <p className="text-xs text-muted-foreground">
                {resourcesDone}/{RESOURCE_ORDER.length} langkah selesai
                {quizRec?.passed && ` · Nilai kuis terbaik: ${quizRec.bestScore}%`}
              </p>
            </div>
            {isWorkspaceComplete && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
                <Trophy className="h-3.5 w-3.5" /> Sertifikat Tersedia
              </span>
            )}
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                isWorkspaceComplete ? "bg-emerald-600" : "bg-marine"
              }`}
              style={{
                width: `${Math.round((resourcesDone / RESOURCE_ORDER.length) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Resources List */}
        {lmsModule && app && moduleProgress && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-base font-bold text-navy">Materi &amp; Asesmen Modul</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pelajari materi video, handbook modul, slide tayang, dan selesaikan kuis kelulusan.
            </p>
            <div className="mt-4 space-y-2.5">
              {RESOURCE_ORDER.map((kind) => {
                const res = lmsModule.resources[kind];
                const Icon = RESOURCE_ICONS[kind];
                const isDone = moduleProgress[kind];
                const bank = hasQuizBank(lmsModule.id);

                if (kind === "quiz") {
                  const attempts = quizRec?.attempts.length ?? 0;
                  const meta = bank
                    ? `${res.meta} · Passing mark ${QUIZ_PASS_PERCENT}%${
                        attempts ? ` · Best score ${quizRec?.bestScore ?? 0}%` : ""
                      }`
                    : `${res.meta} · Evaluasi mandiri`;
                  return (
                    <div
                      key={kind}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                            quizRec?.passed
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-navy">{res.title}</p>
                          <p className="text-[0.7rem] text-muted-foreground">{meta}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {quizRec?.passed && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[0.65rem] font-bold uppercase text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Lulus
                          </span>
                        )}
                        <button
                          onClick={() => setQuizOpen(true)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                            quizRec?.passed
                              ? "border-marine bg-card text-marine hover:bg-marine hover:text-white"
                              : "border-marine bg-marine text-white hover:bg-marine/90"
                          }`}
                        >
                          {!bank
                            ? "Lihat Kuis"
                            : quizRec?.passed
                              ? "Tinjau Kuis"
                              : attempts > 0
                                ? "Lanjutkan Kuis"
                                : "Kerjakan Kuis"}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={kind}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                          isDone ? "bg-marine/10 text-marine" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-navy">{res.title}</p>
                        <p className="text-[0.7rem] text-muted-foreground">{res.meta}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {res.url ? (
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-marine bg-card px-3 py-2 text-xs font-semibold text-marine hover:bg-marine hover:text-white"
                        >
                          {kind === "pdf" ? "Buka PDF" : "Buka"}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                          Tersedia di sesi
                        </span>
                      )}
                      <button
                        onClick={() => toggleResource(kind)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                          isDone
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-marine bg-card text-marine hover:bg-marine hover:text-white"
                        }`}
                      >
                        {isDone ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Selesai
                          </>
                        ) : (
                          "Tandai Selesai"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {quizOpen && lmsModule && app && (
        <ModuleQuiz
          app={app}
          module={lmsModule}
          onClose={() => setQuizOpen(false)}
        />
      )}
    </AcademyShell>
  );
}

