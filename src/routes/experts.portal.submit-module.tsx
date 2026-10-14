import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileEdit,
  AlertCircle,
  Info,
  ArrowLeft,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { LEVEL_MODULE_LIMIT } from "@/lib/trainerModules";
import { useTrainerPortal } from "@/lib/experts/useTrainerPortal";
import { saveTrainerModuleSubmission } from "@/lib/experts/portal-services.functions";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { parseModuleDraft } from "@/lib/experts/submit-module-draft";
import { uploadModuleAttachments, resolveCoverImageUrl } from "@/lib/experts/submit-module-upload";
import type { CustomQuizQuestion } from "@/lib/learning/learning.functions";
import {
  DECLARATIONS,
  STEPS,
  type ExistingResource,
  type ModuleFormFields,
} from "@/components/baruna/experts/submit-module/config";
import { RevisionAlert } from "@/components/baruna/experts/submit-module/RevisionAlert";
import { SubmitSuccess } from "@/components/baruna/experts/submit-module/SubmitSuccess";
import { StepActions } from "@/components/baruna/experts/submit-module/StepActions";
import { StepperNav } from "@/components/baruna/experts/submit-module/StepperNav";
import { StepInfo } from "@/components/baruna/experts/submit-module/StepInfo";
import { StepSyllabus } from "@/components/baruna/experts/submit-module/StepSyllabus";
import { StepFiles } from "@/components/baruna/experts/submit-module/StepFiles";
import { StepEthics } from "@/components/baruna/experts/submit-module/StepEthics";

export const Route = createFileRoute("/experts/portal/submit-module")({
  head: () => ({
    meta: [
      { title: "Submit Module — Trainer Portal" },
      {
        name: "description",
        content:
          "Submit a training module for BARUNA review and publication as a Self-Paced Course.",
      },
    ],
    links: [{ rel: "canonical", href: "/experts/portal/submit-module" }],
  }),
  component: SubmitModulePage,
});

function SubmitModulePage() {
  const { language } = useLanguage();
  const isId = language === "id";

  const location = useLocation();
  const searchParams = new URLSearchParams(
    location.searchStr || (typeof window !== "undefined" ? window.location.search : ""),
  );
  const draftId =
    searchParams.get("draftId") ||
    ((location.search as Record<string, unknown>)?.draftId as string | undefined);

  const portal = useTrainerPortal();
  const trainer = portal.data?.trainer;
  const modules = portal.data?.modules ?? [];
  const moduleDrafts = portal.data?.moduleDrafts ?? [];

  // If draftId is provided, find the matching draft (including if draftId is an older superseded branch or subjectId)
  const activeDraft = draftId
    ? moduleDrafts.find(
        (d) =>
          d.id === draftId ||
          d.subjectId === draftId ||
          (Array.isArray(d.supersededDraftIds) && d.supersededDraftIds.includes(draftId)),
      ) ?? null
    : null;

  const saveModule = useServerFn(saveTrainerModuleSubmission);
  const queryClient = useQueryClient();
  const level = trainer?.level === "not_assigned" ? "none" : trainer?.level ?? "none";
  const activeModules = modules.filter((m) => ["approved", "published"].includes(m.status)).length;
  const limit = LEVEL_MODULE_LIMIT[level];

  // If revising an existing draft, bypass the active module limit
  const gate = {
    allowed: Boolean(trainer) && (activeDraft || activeModules < limit),
    reason: !trainer
      ? isId
        ? "Profil trainer belum tersedia."
        : "Trainer profile unavailable."
      : !activeDraft && activeModules >= limit
        ? isId
          ? `Batas level modul tercapai (${limit} modul aktif).`
          : `Level limit reached (${limit} active modules).`
        : undefined,
  };

  // Stepper state
  const [currentStep, setCurrentStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [savedAsDraft, setSavedAsDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  // Controlled Form Fields State for multi-step persistence
  const [formFields, setFormFields] = useState<ModuleFormFields>({
    title: "",
    topic: "",
    competency: "",
    deliveryFormat: "Self-paced",
    hours: 8,
    level: "Intermediate",
    language: "Bahasa Indonesia",
    summary: "",
    targetParticipants: "",
    objectives: "",
    outcomes: "",
    assessment: "Kuis Pilihan Ganda & Studi Kasus",
    passingScore: 70,
    copyrightHolder: "",
    licensing: "CC BY-NC-SA 4.0",
  });

  // Newly picked local File objects
  const [attachedFiles, setAttachedFiles] = useState<Record<string, File>>({});

  // Pre-existing attached resources from draft metadata
  const [existingFiles, setExistingFiles] = useState<Record<string, ExistingResource>>({});
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [quizQuestions, setQuizQuestions] = useState<CustomQuizQuestion[]>([]);

  // Populate from activeDraft on mount / change
  useEffect(() => {
    if (activeDraft) {
      const parsed = parseModuleDraft(activeDraft, trainer?.fullName);
      setFormFields(parsed.fields);
      if (parsed.quiz.length > 0) setQuizQuestions((prev) => (prev.length > 0 ? prev : parsed.quiz));
      setExistingFiles(parsed.existingFiles);
      if (parsed.videoUrl !== null) setVideoUrl(parsed.videoUrl);
    } else if (trainer?.fullName && !formFields.copyrightHolder) {
      setFormFields((prev) => ({
        ...prev,
        copyrightHolder: trainer.fullName,
      }));
    }
  }, [activeDraft?.id, trainer?.fullName]);

  const updateField = (key: keyof ModuleFormFields, val: string | number) => {
    setFormFields((prev) => ({ ...prev, [key]: val }));
  };

  const allDecls = DECLARATIONS.every((_, i) => checked[i]);

  const latestDecision = activeDraft?.reviewHistory?.[0];
  const isRevision =
    activeDraft?.reviewStatus === "revision_requested" ||
    latestDecision?.decision === "return_for_revision";

  // Step Validation checks
  const isStep1Valid = useMemo(() => {
    return Boolean(
      formFields.title.trim() &&
        formFields.topic.trim() &&
        formFields.competency.trim() &&
        formFields.summary.trim() &&
        formFields.targetParticipants.trim() &&
        Number(formFields.hours) > 0,
    );
  }, [formFields]);

  const isQuizValid = useMemo(() => {
    if (quizQuestions.length === 0) return true;
    return quizQuestions.every(
      (q) =>
        q.question.trim().length > 0 &&
        q.options.filter((o) => o.trim().length > 0).length >= 2,
    );
  }, [quizQuestions]);

  const isStep2Valid = useMemo(() => {
    return Boolean(
      formFields.objectives.trim() &&
        formFields.outcomes.trim() &&
        formFields.assessment.trim() &&
        Number(formFields.passingScore) >= 0 &&
        isQuizValid,
    );
  }, [formFields, isQuizValid]);

  const totalFilesCount = Object.keys(attachedFiles).length + Object.keys(existingFiles).length;

  const goNext = () => {
    if (currentStep === 1 && !isStep1Valid) {
      setError(
        isId
          ? "Harap lengkapi semua kolom wajib di Langkah 1 sebelum melanjutkan."
          : "Please fill out all required fields in Step 1.",
      );
      return;
    }
    if (currentStep === 2 && !isStep2Valid) {
      setError(
        isId
          ? "Harap lengkapi silabus & metode penilaian di Langkah 2 sebelum melanjutkan."
          : "Please complete syllabus & evaluation fields in Step 2.",
      );
      return;
    }
    setError(null);
    setCurrentStep((s) => Math.min(4, s + 1));
  };

  // Handle Save (Draft or Submit)
  const handleSave = async (submitIntent: boolean) => {
    if (!gate.allowed) return;
    if (saveLock.current) return;
    if (submitIntent && (!isStep1Valid || !isStep2Valid || !allDecls)) {
      if (!isQuizValid) {
        setError(
          isId
            ? "Terdapat butir soal kuis yang belum lengkap. Harap lengkapi teks pertanyaan dan minimal 2 pilihan jawaban, atau hapus soal tersebut."
            : "Incomplete quiz questions found. Please complete question text and at least 2 options, or remove the question.",
        );
      } else {
        setError(
          isId
            ? "Harap lengkapi semua bidang wajib dan centang 4 poin pernyataan etika sebelum mengirimkan."
            : "Please complete all required fields and check the 4 ethics declarations before submitting.",
        );
      }
      return;
    }

    saveLock.current = true;
    setSaving(true);
    setError(null);

    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uploadedResources = await uploadModuleAttachments({
        uid: userRes.user?.id,
        draftKey: activeDraft?.id || draftId || Date.now(),
        attachedFiles,
        existingFiles,
        videoUrl,
        isId,
        onProgress: setUploadProgress,
      });

      setUploadProgress(isId ? "Menyimpan modul ke sistem..." : "Saving module to system...");

      const learningObjectives = (formFields.objectives || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const coverImageUrl = resolveCoverImageUrl(uploadedResources);

      await saveModule({
        data: {
          draftId: activeDraft?.id || draftId || undefined,
          title: formFields.title.trim() || "Draft Module",
          moduleType: "technical",
          submit: submitIntent,
          payload: {
            title: formFields.title.trim(),
            module_type: "technical",
            summary: formFields.summary.trim(),
            language: formFields.language,
            estimated_learning_hours: Number(formFields.hours),
            target_participants: formFields.targetParticipants.trim(),
            content_outline: {
              topic: formFields.topic.trim(),
              competency: formFields.competency.trim(),
            },
            learning_objectives: learningObjectives,
            competency_outcomes: formFields.outcomes.trim(),
            assessment_approach: {
              method: formFields.assessment.trim(),
              passing_score: Number(formFields.passingScore),
              quiz_questions: quizQuestions,
            },
            attachments: uploadedResources,
            metadata: {
              level: formFields.level,
              delivery_format: formFields.deliveryFormat,
              copyright_holder: formFields.copyrightHolder.trim(),
              licensing: formFields.licensing.trim(),
              video_url: videoUrl.trim() || undefined,
              cover_image_url: coverImageUrl || undefined,
              attached_resources: uploadedResources,
              quiz_questions: quizQuestions,
            },
            quiz_questions: quizQuestions,
            // Also save as documents for cross-compatibility
            documents: uploadedResources,
          },
        },
      });

      await queryClient.invalidateQueries({
        queryKey: ["experts", "trainer-portal-dashboard"],
      });

      if (submitIntent) {
        setSubmitted(true);
      } else {
        setSavedAsDraft(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save module.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return (
    <PageShell
      sidebar={{
        ...EXPERTS_SIDEBAR_META,
        title: isId ? "Portal Trainer" : "Trainer Portal",
        subtitle: isRevision
          ? isId
            ? "Perbaiki & revisi modul pelatihan."
            : "Fix & revise training module."
          : isId
            ? "Ajukan modul pelatihan baru."
            : "Submit a new training module.",
        sections: trainerPortalNav("/experts/portal/submit-module"),
      }}
      cta={{
        icon: FileEdit,
        title: isId ? "Alur setelah pengajuan" : "After submission",
        description: isId
          ? "Modul Anda akan melalui Evaluasi Administrasi → Akademik → QA → Digital Learning → Persetujuan Akhir."
          : "Your module enters Administrative → Academic → QA → Digital Learning → Final Approval.",
        button: isId ? "Lihat Status Review" : "View Review Status",
        href: "/experts/portal/review-status",
      }}
    >
      <div className="space-y-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">
              {isRevision
                ? isId
                  ? "Revisi & Perbarui Modul"
                  : "Revise & Resubmit Module"
                : isId
                  ? "Ajukan Modul Pelatihan"
                  : "Submit a Training Module"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
              {isRevision
                ? isId
                  ? "Perbaiki data silabus dan ganti/tambahkan berkas sesuai catatan verifikator sebelum mengirimkan ulang."
                  : "Revise syllabus data and update attachments per verifier notes before resubmitting."
                : isId
                  ? "Pengajuan Anda akan ditelaah oleh tim verifikator BARUNA. Modul yang disetujui akan dipublikasikan sebagai Self-Paced Course."
                  : "Your submission will be reviewed by the BARUNA verification team and published upon approval."}
            </p>
          </div>
          {draftId && (
            <Link
              to="/experts/portal/review-status"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy hover:bg-muted self-start"
            >
              <ArrowLeft className="h-3.5 w-3.5" />{" "}
              {isId ? "Kembali ke Status Review" : "Back to Review Status"}
            </Link>
          )}
        </div>

        {/* Revision Alert Box */}
        {isRevision && <RevisionAlert isId={isId} comment={latestDecision?.comment} />}

        {/* Limit Warning */}
        {!gate.allowed && (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-destructive">
              <AlertCircle className="h-4 w-4" />{" "}
              {isId ? "Pengajuan Dinonaktifkan" : "Submission Blocked"}
            </p>
            <p className="mt-1 text-sm text-foreground/80">{gate.reason}</p>
          </div>
        )}

        {!isRevision && (
          <div className="rounded-2xl border border-marine/20 bg-marine/5 p-4 text-sm text-foreground/80">
            <p className="flex items-center gap-2 font-bold text-marine">
              <Info className="h-4 w-4" /> {isId ? "Batas Kapasitas Level" : "Level limit"}
            </p>
            <p className="mt-1">
              {isId
                ? `Tingkat level Anda (${level}) mengizinkan hingga ${limit} modul aktif. Saat ini Anda memiliki ${activeModules} modul.`
                : `Your current level (${level}) allows up to ${limit} active module${limit === 1 ? "" : "s"}. You currently have ${activeModules}.`}
            </p>
          </div>
        )}

        {/* Success Confirmation Screen */}
        {submitted || savedAsDraft ? (
          <SubmitSuccess isId={isId} submitted={submitted} isRevision={isRevision} />
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-soft">
              <div className="flex items-center justify-between mb-3 text-xs font-semibold text-muted-foreground">
                <span className="uppercase tracking-wider text-marine font-bold">
                  {isId ? `Langkah ${currentStep} dari ${STEPS.length}` : `Step ${currentStep} of ${STEPS.length}`}
                </span>
                <span>
                  {Math.round((currentStep / STEPS.length) * 100)}% {isId ? "Selesai" : "Completed"}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-marine transition-all duration-300"
                  style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
                />
              </div>
              <StepperNav
                isId={isId}
                currentStep={currentStep}
                onSelect={(n) => {
                  // Allow navigating directly to visited steps
                  setCurrentStep(n);
                  setError(null);
                }}
              />
            </div>

            {/* Error Message */}
            {/* Error Message */}
            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-medium text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                <StepInfo isId={isId} formFields={formFields} updateField={updateField} />
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                <StepSyllabus
                  isId={isId}
                  formFields={formFields}
                  updateField={updateField}
                  quizQuestions={quizQuestions}
                  setQuizQuestions={setQuizQuestions}
                />
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                <StepFiles
                  isId={isId}
                  attachedFiles={attachedFiles}
                  setAttachedFiles={setAttachedFiles}
                  existingFiles={existingFiles}
                  setExistingFiles={setExistingFiles}
                  videoUrl={videoUrl}
                  setVideoUrl={setVideoUrl}
                  totalFilesCount={totalFilesCount}
                  quizQuestions={quizQuestions}
                  setError={setError}
                />
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                <StepEthics
                  isId={isId}
                  formFields={formFields}
                  updateField={updateField}
                  totalFilesCount={totalFilesCount}
                  videoUrl={videoUrl}
                  checked={checked}
                  setChecked={setChecked}
                  allDecls={allDecls}
                />
              </div>
            )}

            <StepActions
              isId={isId}
              currentStep={currentStep}
              canSave={Boolean(gate.allowed)}
              saving={saving}
              uploadProgress={uploadProgress}
              allDecls={allDecls}
              isRevision={isRevision}
              onBack={() => {
                setCurrentStep((s) => Math.max(1, s - 1));
                setError(null);
              }}
              onNext={goNext}
              onSaveDraft={() => handleSave(false)}
              onSubmit={() => handleSave(true)}
            />
          </div>
        )}
      </div>
    </PageShell>
  );
}
