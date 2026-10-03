import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileEdit,
  CheckCircle2,
  AlertCircle,
  Send,
  Info,
  Upload,
  FileText,
  X,
  RotateCcw,
  Clock,
  ArrowLeft,
  ArrowRight,
  Video,
  GraduationCap,
  Layers,
  ShieldCheck,
  Check,
  Bookmark,
  Eye,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { LEVEL_MODULE_LIMIT } from "@/lib/trainerModules";
import { useTrainerPortal } from "@/lib/experts/useTrainerPortal";
import { saveTrainerModuleSubmission } from "@/lib/experts/portal-services.functions";
import { supabase } from "@/integrations/supabase/client";
import { resolveFileContentType } from "@/lib/storage/mime";
import { useLanguage } from "@/lib/i18n";

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

const RESOURCES = [
  "Complete module document (PDF)",
  "Presentation slides (PDF or PPT)",
  "Learning video (optional but strongly encouraged)",
  "Quiz / assessment with answer key",
  "Trainer guide",
  "Evaluation form",
  "Course cover image",
  "Practical exercise (if applicable)",
];

const DECLARATIONS = [
  "This is my own original work.",
  "I hold or have cleared all copyrights for included content.",
  "I have no undisclosed conflict of interest.",
  "I accept the BARUNA Code of Conduct and reviewer feedback process.",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ExistingResource = {
  type: string;
  name?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  path?: string;
  uploadedAt?: string;
};

const STEPS = [
  {
    n: 1,
    titleEn: "Info & Target",
    titleId: "Informasi & Target",
    descEn: "Basic module metadata",
    descId: "Metadata dasar modul",
    icon: FileText,
  },
  {
    n: 2,
    titleEn: "Syllabus & Evaluation",
    titleId: "Silabus & Evaluasi",
    descEn: "Objectives and passing score",
    descId: "Tujuan & passing score",
    icon: GraduationCap,
  },
  {
    n: 3,
    titleEn: "Files & Media",
    titleId: "Berkas & Media",
    descEn: "Videos, slides and documents",
    descId: "Video, slide, & dokumen",
    icon: Upload,
  },
  {
    n: 4,
    titleEn: "Ethics & Review",
    titleId: "Etika & Finalisasi",
    descEn: "Copyright, ethics & submit",
    descId: "Hak cipta, etika & kirim",
    icon: ShieldCheck,
  },
];

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

  // If draftId is provided, find the matching draft
  const activeDraft = draftId ? moduleDrafts.find((d) => d.id === draftId) : null;
  const draftPayload = (activeDraft?.payload as Record<string, unknown>) ?? {};
  const draftMeta = (draftPayload.metadata as Record<string, unknown>) ?? {};
  const draftOutline = (draftPayload.content_outline as Record<string, unknown>) ?? {};
  const draftAssessment = (draftPayload.assessment_approach as Record<string, unknown>) ?? {};

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
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  // Controlled Form Fields State for multi-step persistence
  const [formFields, setFormFields] = useState({
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

  // Populate from activeDraft on mount / change
  useEffect(() => {
    if (activeDraft) {
      setFormFields({
        title: String(draftPayload.title ?? activeDraft.title ?? ""),
        topic: String(draftOutline.topic ?? ""),
        competency: String(draftOutline.competency ?? ""),
        deliveryFormat: String(draftMeta.delivery_format ?? "Self-paced"),
        hours: Number(draftPayload.estimated_learning_hours ?? 8),
        level: String(draftMeta.level ?? "Intermediate"),
        language: String(draftPayload.language ?? "Bahasa Indonesia"),
        summary: String(draftPayload.summary ?? ""),
        targetParticipants: String(draftPayload.target_participants ?? ""),
        objectives: Array.isArray(draftPayload.learning_objectives)
          ? (draftPayload.learning_objectives as string[]).join("\n")
          : "",
        outcomes: String(draftPayload.competency_outcomes ?? ""),
        assessment: String(draftAssessment.method ?? "Kuis Pilihan Ganda & Studi Kasus"),
        passingScore: Number(draftAssessment.passing_score ?? 70),
        copyrightHolder: String(draftMeta.copyright_holder ?? trainer?.fullName ?? ""),
        licensing: String(draftMeta.licensing ?? "CC BY-NC-SA 4.0"),
      });

      const rawAttached = Array.isArray(draftMeta.attached_resources)
        ? (draftMeta.attached_resources as ExistingResource[])
        : Array.isArray(draftPayload.documents)
          ? (draftPayload.documents as ExistingResource[])
          : [];

      const map: Record<string, ExistingResource> = {};
      rawAttached.forEach((res) => {
        if (res.type) {
          map[res.type] = res;
          if (
            res.type.toLowerCase().includes("video") &&
            (res.path?.startsWith("http") || res.fileName?.startsWith("http"))
          ) {
            setVideoUrl(res.path || res.fileName || "");
          }
        }
      });
      setExistingFiles(map);

      if (typeof draftMeta.video_url === "string" && draftMeta.video_url) {
        setVideoUrl(draftMeta.video_url);
      }
    } else if (trainer?.fullName && !formFields.copyrightHolder) {
      setFormFields((prev) => ({
        ...prev,
        copyrightHolder: trainer.fullName,
      }));
    }
  }, [activeDraft?.id, trainer?.fullName]);

  const updateField = (key: keyof typeof formFields, val: any) => {
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

  const isStep2Valid = useMemo(() => {
    return Boolean(
      formFields.objectives.trim() &&
        formFields.outcomes.trim() &&
        formFields.assessment.trim() &&
        Number(formFields.passingScore) >= 0,
    );
  }, [formFields]);

  const totalFilesCount = Object.keys(attachedFiles).length + Object.keys(existingFiles).length;

  // Handle Save (Draft or Submit)
  const handleSave = async (submitIntent: boolean) => {
    if (!gate.allowed) return;
    if (submitIntent && (!isStep1Valid || !isStep2Valid || !allDecls)) {
      setError(
        isId
          ? "Harap lengkapi semua bidang wajib dan centang 4 poin pernyataan etika sebelum mengirimkan."
          : "Please complete all required fields and check the 4 ethics declarations before submitting.",
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 1. Upload newly selected files to Supabase Storage
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;

      let uploadedResources: Array<{
        type: string;
        name: string;
        fileName: string;
        fileSize: number;
        fileType: string;
        path?: string;
        uploadedAt: string;
      }> = [];

      // Keep existing attached files that weren't replaced
      for (const [type, ex] of Object.entries(existingFiles)) {
        if (!attachedFiles[type]) {
          uploadedResources.push({
            type,
            name: ex.fileName || ex.name || "Berkas",
            fileName: ex.fileName || ex.name || "Berkas",
            fileSize: ex.fileSize || 0,
            fileType: ex.fileType || "application/octet-stream",
            path: ex.path,
            uploadedAt: ex.uploadedAt || new Date().toISOString(),
          });
        }
      }

      // Upload new files concurrently
      const newEntries = Object.entries(attachedFiles);
      if (newEntries.length > 0) {
        setUploadProgress(
          isId ? `Mengunggah ${newEntries.length} berkas...` : `Uploading ${newEntries.length} files...`,
        );
      }

      let completedCount = 0;
      const newUploaded = await Promise.all(
        newEntries.map(async ([type, f]) => {
          let storagePath: string | undefined = undefined;
          const contentType = resolveFileContentType(f.name, f.type);
          if (uid) {
            try {
              const safeName = f.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
              const path = `users/${uid}/modules/${draftId || Date.now()}/${Date.now()}-${safeName}`;
              const { error: upErr } = await supabase.storage
                .from("module-attachments")
                .upload(path, f, { contentType, upsert: true });

              if (!upErr) {
                storagePath = path;
              }
            } catch {
              // Continue even if storage upload fails, preserve metadata
            }
          }

          completedCount++;
          setUploadProgress(
            isId
              ? `Mengunggah (${completedCount}/${newEntries.length}) berkas...`
              : `Uploading (${completedCount}/${newEntries.length}) files...`,
          );

          return {
            type,
            name: f.name,
            fileName: f.name,
            fileSize: f.size,
            fileType: contentType,
            path: storagePath,
            uploadedAt: new Date().toISOString(),
          };
        }),
      );

      // Always append newly uploaded files
      uploadedResources.push(...newUploaded);

      // If videoUrl is provided, add / update as a learning video resource
      if (videoUrl.trim()) {
        const nonVideoResources = uploadedResources.filter(
          (r) => !r.type.toLowerCase().includes("video"),
        );
        nonVideoResources.push({
          type: "Learning video (optional but strongly encouraged)",
          name: isId ? "Video Pembelajaran (Tautan Online)" : "Learning Video (Online URL)",
          fileName: videoUrl.trim(),
          fileSize: 0,
          fileType: "video/online-stream",
          path: videoUrl.trim(),
          uploadedAt: new Date().toISOString(),
        });
        uploadedResources = nonVideoResources;
      }

      setUploadProgress(isId ? "Menyimpan modul ke sistem..." : "Saving module to system...");

      // 2. Prepare payload
      const learningObjectives = formFields.objectives
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      // Find uploaded cover image to set explicit cover_image_url
      const coverRes = uploadedResources.find(
        (r) =>
          r.type.toLowerCase().includes("cover") ||
          r.type === "Course cover image" ||
          (r.type.toLowerCase().includes("image") && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(r.name || r.fileName || "")),
      );
      let coverImageUrl: string | undefined = undefined;
      if (coverRes?.path) {
        if (coverRes.path.startsWith("http")) {
          coverImageUrl = coverRes.path;
        } else {
          const { data: pub } = supabase.storage
            .from("module-attachments")
            .getPublicUrl(coverRes.path);
          if (pub?.publicUrl) {
            coverImageUrl = pub.publicUrl;
          }
        }
      }

      await saveModule({
        data: {
          draftId: draftId || undefined,
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
            },
            metadata: {
              level: formFields.level,
              delivery_format: formFields.deliveryFormat,
              copyright_holder: formFields.copyrightHolder.trim(),
              licensing: formFields.licensing.trim(),
              video_url: videoUrl.trim() || undefined,
              cover_image_url: coverImageUrl || undefined,
              attached_resources: uploadedResources,
            },
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
        {isRevision && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-5 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
              <RotateCcw className="h-4 w-4 text-amber-700" />
              {isId
                ? "Permintaan Revisi dari Verifikator / Admin"
                : "Revision Requested by Reviewer / Admin"}
            </div>
            {latestDecision?.comment && (
              <div className="mt-2.5 rounded-xl border border-amber-200/80 bg-white/90 p-4 text-sm text-slate-800">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-1">
                  {isId
                    ? "Catatan Evaluasi / Rationale Verifikator:"
                    : "Reviewer Notes & Feedback:"}
                </span>
                <p className="italic text-slate-700 leading-relaxed">
                  &quot;{latestDecision.comment}&quot;
                </p>
              </div>
            )}
            <p className="mt-3 text-xs text-amber-800/90 leading-relaxed">
              {isId
                ? "Silakan lengkapi berkas atau perbaiki isian formulir di bawah ini. Pastikan seluruh catatan di atas telah terpenuhi sebelum menekan tombol Kirim Ulang Revisi Modul."
                : "Please update the required fields or files below. Ensure all feedback points are addressed before clicking Resubmit Module."}
            </p>
          </div>
        )}

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
          <div className="rounded-2xl border border-eco-community/30 bg-eco-community/5 p-8 text-center shadow-soft">
            <CheckCircle2 className="mx-auto h-12 w-12 text-eco-community" />
            <h2 className="mt-4 font-display text-2xl font-bold text-navy">
              {submitted
                ? isRevision
                  ? isId
                    ? "Revisi Modul Berhasil Dikirimkan!"
                    : "Module Revision Submitted Successfully!"
                  : isId
                    ? "Modul Berhasil Diajukan!"
                    : "Module Submitted for Review!"
                : isId
                  ? "Draf Modul Berhasil Disimpan!"
                  : "Module Draft Saved!"}
            </h2>
            <p className="mt-2 text-sm text-foreground/75 max-w-lg mx-auto leading-relaxed">
              {submitted
                ? isId
                  ? "Pengajuan modul Anda telah masuk ke dalam antrean verifikasi Admin dan Tim Governance BARUNA. Anda dapat memantau perkembangannya melalui halaman Review Status."
                  : "Your training module has entered the BARUNA review pipeline. Track its verification progress under Review Status."
                : isId
                  ? "Draf modul Anda tersimpan aman dan dapat dilanjutkan pengisiannya kapan saja."
                  : "Your draft is saved securely and can be continued anytime."}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/experts/portal/review-status"
                className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-semibold text-white hover:bg-navy/90 transition shadow-xs"
              >
                {isId ? "Lihat Status Review Modul" : "View Review Status"}
              </Link>
              <Link
                to="/experts/portal"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-5 py-2.5 text-xs font-semibold text-navy hover:bg-muted transition"
              >
                {isId ? "Kembali ke Dashboard Trainer" : "Back to Trainer Portal"}
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Interactive Stepper Navigation Bar */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-soft">
              <div className="flex items-center justify-between mb-3 text-xs font-semibold text-muted-foreground">
                <span className="uppercase tracking-wider text-marine font-bold">
                  {isId ? `Langkah ${currentStep} dari ${STEPS.length}` : `Step ${currentStep} of ${STEPS.length}`}
                </span>
                <span>
                  {Math.round((currentStep / STEPS.length) * 100)}% {isId ? "Selesai" : "Completed"}
                </span>
              </div>

              {/* Step Progress Line */}
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-marine transition-all duration-300"
                  style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
                />
              </div>

              {/* Stepper Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {STEPS.map((s) => {
                  const active = s.n === currentStep;
                  const isDone = s.n < currentStep;
                  const Icon = s.icon;

                  return (
                    <button
                      key={s.n}
                      type="button"
                      onClick={() => {
                        // Allow navigating directly to visited steps
                        setCurrentStep(s.n);
                        setError(null);
                      }}
                      className={`flex items-start gap-2.5 rounded-xl p-3 text-left transition-all border cursor-pointer ${
                        active
                          ? "border-marine bg-marine/10 shadow-xs ring-1 ring-marine/30"
                          : isDone
                            ? "border-eco-community/40 bg-eco-community/5 hover:bg-eco-community/10"
                            : "border-transparent bg-muted/40 hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                          active
                            ? "bg-marine text-white shadow-xs"
                            : isDone
                              ? "bg-eco-community text-white"
                              : "bg-background text-muted-foreground border border-border"
                        }`}
                      >
                        {isDone ? <Check className="h-4 w-4" /> : s.n}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-bold truncate ${
                            active ? "text-navy" : isDone ? "text-navy" : "text-muted-foreground"
                          }`}
                        >
                          {isId ? s.titleId : s.titleEn}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate hidden sm:block">
                          {isId ? s.descId : s.descEn}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-medium text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: Informasi & Target Modul */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                <Section
                  title={isId ? "1. Informasi & Metadata Modul" : "1. Module Information & Metadata"}
                  subtitle={
                    isId
                      ? "Isi informasi dasar, topik bahasan, dan target pembelajaran modul."
                      : "Fill in the basic information, topic, and delivery format of your module."
                  }
                >
                  <Grid>
                    <Field label={isId ? "Judul Modul Pelatihan" : "Module Title"} required>
                      <input
                        value={formFields.title}
                        onChange={(e) => updateField("title", e.target.value)}
                        className={inp}
                        required
                        placeholder={
                          isId
                            ? "Contoh: Marine Protected Area Management Fundamentals"
                            : "e.g., Marine Protected Area Management Fundamentals"
                        }
                      />
                    </Field>
                    <Field label={isId ? "Topik / Bidang Kajian" : "Topic / Subject Area"} required>
                      <input
                        value={formFields.topic}
                        onChange={(e) => updateField("topic", e.target.value)}
                        className={inp}
                        required
                        placeholder={
                          isId
                            ? "Contoh: Konservasi Laut, Akuakultur, Kebijakan Maritim"
                            : "e.g., Marine Conservation, Aquaculture, Maritime Policy"
                        }
                      />
                    </Field>
                    <Field label={isId ? "Bidang Kompetensi" : "Competency Domain"} required>
                      <input
                        value={formFields.competency}
                        onChange={(e) => updateField("competency", e.target.value)}
                        className={inp}
                        required
                        placeholder={
                          isId
                            ? "Contoh: Manajemen Zonasi & Pemantauan Bioekologi"
                            : "e.g., Spatial Zoning & Bioecological Monitoring"
                        }
                      />
                    </Field>
                    <Field label={isId ? "Format Pembelajaran" : "Delivery Format"} required>
                      <select
                        value={formFields.deliveryFormat}
                        onChange={(e) => updateField("deliveryFormat", e.target.value)}
                        className={inp}
                        required
                      >
                        <option value="Self-paced">Self-paced (Mandiri Online)</option>
                        <option value="Scheduled">Scheduled (Terkurasi / Terjadwal)</option>
                        <option value="Blended">Blended (Kombinasi Daring &amp; Tatap Muka)</option>
                      </select>
                    </Field>
                    <Field
                      label={
                        isId
                          ? "Estimasi Jam Pembelajaran (Jam)"
                          : "Estimated Learning Hours"
                      }
                      required
                    >
                      <input
                        type="number"
                        min={1}
                        value={formFields.hours}
                        onChange={(e) => updateField("hours", Number(e.target.value))}
                        className={inp}
                        required
                      />
                    </Field>
                    <Field label={isId ? "Tingkat Kesulitan (Level)" : "Difficulty Level"} required>
                      <select
                        value={formFields.level}
                        onChange={(e) => updateField("level", e.target.value)}
                        className={inp}
                        required
                      >
                        <option value="Introductory">Introductory (Pemula)</option>
                        <option value="Intermediate">Intermediate (Menengah)</option>
                        <option value="Advanced">Advanced (Lanjutan)</option>
                      </select>
                    </Field>
                    <Field label={isId ? "Bahasa Pengantar" : "Instruction Language"} required>
                      <input
                        value={formFields.language}
                        onChange={(e) => updateField("language", e.target.value)}
                        className={inp}
                        required
                      />
                    </Field>
                    <Field label={isId ? "Profil Target Peserta" : "Target Audience Profile"} required>
                      <input
                        value={formFields.targetParticipants}
                        onChange={(e) => updateField("targetParticipants", e.target.value)}
                        className={inp}
                        required
                        placeholder={
                          isId
                            ? "Contoh: Peneliti kelautan, staf BKSDA, mahasiswa perikanan"
                            : "e.g., Marine researchers, conservation officers, students"
                        }
                      />
                    </Field>
                  </Grid>

                  <Field label={isId ? "Ringkasan Modul (Deskripsi Singkat)" : "Module Summary"} required>
                    <textarea
                      value={formFields.summary}
                      onChange={(e) => updateField("summary", e.target.value)}
                      className={`${inp} min-h-[95px]`}
                      required
                      placeholder={
                        isId
                          ? "Jelaskan gambaran umum materi pelatihan, relevansi industri maritim, dan kompetensi yang akan dicapai..."
                          : "Describe the overview of the training module, maritime industry relevance, and key learning goals..."
                      }
                    />
                  </Field>
                </Section>
              </div>
            )}

            {/* STEP 2: Silabus & Evaluasi */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                <Section
                  title={isId ? "2. Rancangan Pembelajaran & Evaluasi" : "2. Learning Design & Evaluation"}
                  subtitle={
                    isId
                      ? "Tentukan tujuan pembelajaran per baris, capaian kompetensi, serta metode evaluasi kelulusan."
                      : "Define learning objectives, expected outcomes, assessment methods, and passing criteria."
                  }
                >
                  <Field
                    label={isId ? "Tujuan Pembelajaran (Satu per baris)" : "Learning Objectives (One per line)"}
                    required
                  >
                    <textarea
                      value={formFields.objectives}
                      onChange={(e) => updateField("objectives", e.target.value)}
                      className={`${inp} min-h-[110px] font-mono text-xs`}
                      required
                      placeholder={
                        isId
                          ? "1. Memahami prinsip penetapan batas kawasan konservasi laut\n2. Mampu menyusun indikator kesehatan terumbu karang\n3. Mengetahui regulasi perizinan zonasi pemanfaatan"
                          : "1. Understand marine protected area zoning principles\n2. Analyze coral reef ecosystem health indicators\n3. Apply national fisheries compliance standards"
                      }
                    />
                  </Field>

                  <Field
                    label={
                      isId
                        ? "Capaian Hasil Kompetensi (Expected Outcomes)"
                        : "Expected Competency Outcomes"
                    }
                    required
                  >
                    <textarea
                      value={formFields.outcomes}
                      onChange={(e) => updateField("outcomes", e.target.value)}
                      className={`${inp} min-h-[90px]`}
                      required
                      placeholder={
                        isId
                          ? "Peserta mampu merancang dokumen rencana pengelolaan kawasan konservasi perairan sesuai pedoman nasional..."
                          : "Participants will be able to design a marine management document aligned with national guidelines..."
                      }
                    />
                  </Field>

                  <Grid>
                    <Field label={isId ? "Metode Penilaian / Ujian" : "Assessment Method"} required>
                      <input
                        value={formFields.assessment}
                        onChange={(e) => updateField("assessment", e.target.value)}
                        className={inp}
                        required
                        placeholder={
                          isId
                            ? "Contoh: Kuis Pilihan Ganda 20 Soal & Studi Kasus"
                            : "e.g., 20 Multiple Choice Questions & Case Study"
                        }
                      />
                    </Field>
                    <Field
                      label={
                        isId
                          ? "Nilai Kelulusan Minimum (Passing Score %)"
                          : "Minimum Passing Score (%)"
                      }
                      required
                    >
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={formFields.passingScore}
                        onChange={(e) => updateField("passingScore", Number(e.target.value))}
                        className={inp}
                        required
                      />
                    </Field>
                  </Grid>
                </Section>
              </div>
            )}

            {/* STEP 3: Berkas & Media */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                <Section
                  title={isId ? "3. Lampiran Berkas & Video Modul" : "3. Module Attachments & Media"}
                  subtitle={
                    isId
                      ? "Unggah berkas silabus modul, slide presentasi, panduan instruktur, dan tautan video pembelajaran online."
                      : "Upload syllabus documents, slides, instructor guides, and embed online video links."
                  }
                >
                  {/* Tautan Video Streaming (YouTube / Vimeo / Direct) */}
                  <div className="rounded-xl border border-marine/30 bg-marine/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <label className="text-xs font-bold text-navy flex items-center gap-1.5">
                        <Video className="h-4 w-4 text-marine" />{" "}
                        {isId
                          ? "Tautan / URL Video Pembelajaran (YouTube / Vimeo / Cloudflare)"
                          : "Online Video Embed URL (YouTube / Vimeo / Cloudflare)"}
                      </label>
                      <span className="rounded-full bg-marine/15 px-2 py-0.5 text-[10px] font-bold text-marine uppercase tracking-wider">
                        {isId ? "Sangat Direkomendasikan" : "Highly Recommended"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
                      {isId
                        ? "Tempelkan URL video YouTube atau Vimeo. Video akan otomatis tersemat di Ruang Belajar peserta tanpa membebani kuota server."
                        : "Paste a YouTube or Vimeo video link. Videos will automatically stream natively in the participant study room."}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=... atau https://youtu.be/..."
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:border-marine focus:outline-hidden"
                      />
                      {videoUrl && (
                        <button
                          type="button"
                          onClick={() => setVideoUrl("")}
                          className="shrink-0 rounded-lg border border-border bg-muted/50 px-2.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                          title="Hapus URL"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {videoUrl && (
                      <p className="mt-2 text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                        {isId
                          ? "Tautan video terkonfigurasi. Akan otomatis disematkan di Ruang Belajar."
                          : "Video link configured. Will be automatically embedded in the learning room."}
                      </p>
                    )}
                  </div>

                  {/* 8 Upload Boxes */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-navy">
                        {isId ? "Daftar Berkas Dokumen" : "Document Attachments"}
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        {totalFilesCount} {isId ? "berkas terlampir" : "files attached"}
                      </span>
                    </div>

                    <ul className="grid gap-3 sm:grid-cols-2">
                      {RESOURCES.map((r, idx) => {
                        const newFile = attachedFiles[r];
                        const existing = existingFiles[r];
                        const inputId = `resource-file-${idx}`;

                        const hasFile = Boolean(newFile || existing);
                        const fileName = newFile?.name || existing?.fileName || existing?.name || "";
                        const fileSize = newFile?.size || existing?.fileSize || 0;

                        return (
                          <li
                            key={r}
                            className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                              hasFile
                                ? "border-eco-community/40 bg-eco-community/5 shadow-2xs"
                                : "border-dashed border-border bg-card/60 hover:border-marine/50 hover:bg-muted/30"
                            }`}
                          >
                            <input
                              type="file"
                              id={inputId}
                              className="hidden"
                              onChange={(e) => {
                                const picked = e.target.files?.[0];
                                if (picked) {
                                  setAttachedFiles((prev) => ({ ...prev, [r]: picked }));
                                }
                                e.target.value = "";
                              }}
                            />
                            {hasFile ? (
                              <>
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <FileText className="h-5 w-5 shrink-0 text-eco-community" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-navy truncate">{r}</p>
                                    <p className="text-[0.7rem] text-eco-community font-medium truncate">
                                      {fileName} {fileSize > 0 ? `(${formatBytes(fileSize)})` : ""}
                                      {newFile && (
                                        <span className="ml-1 text-[0.65rem] font-bold text-marine">
                                          {isId ? "[Baru]" : "[New]"}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <label
                                    htmlFor={inputId}
                                    className="text-[0.65rem] font-semibold text-marine hover:underline cursor-pointer px-1 py-0.5"
                                    title="Ganti berkas"
                                  >
                                    {isId ? "Ganti" : "Replace"}
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAttachedFiles((prev) => {
                                        const next = { ...prev };
                                        delete next[r];
                                        return next;
                                      });
                                      setExistingFiles((prev) => {
                                        const next = { ...prev };
                                        delete next[r];
                                        return next;
                                      });
                                    }}
                                    aria-label={`Hapus ${fileName}`}
                                    title="Hapus berkas"
                                    className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive cursor-pointer transition-colors"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <label
                                htmlFor={inputId}
                                className="flex w-full items-center justify-between gap-2 cursor-pointer select-none group"
                              >
                                <span className="text-xs font-medium text-foreground/80 group-hover:text-marine transition-colors">
                                  {r}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-md bg-marine/10 px-2.5 py-1 text-[0.65rem] font-bold text-marine group-hover:bg-marine group-hover:text-white transition-all shrink-0">
                                  <Upload className="h-3 w-3" /> UPLOAD
                                </span>
                              </label>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </Section>
              </div>
            )}

            {/* STEP 4: Hak Cipta, Etika & Finalisasi */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                {/* Summary Card Preview */}
                <div className="rounded-2xl border border-marine/30 bg-marine/5 p-5 shadow-soft">
                  <div className="flex items-center gap-2 font-display text-sm font-bold text-navy mb-3">
                    <Eye className="h-4 w-4 text-marine" />
                    {isId ? "Ringkasan Pratinjau Modul" : "Module Summary Preview"}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-xl border border-border bg-card p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                        {isId ? "Judul Modul" : "Title"}
                      </span>
                      <p className="font-semibold text-navy truncate mt-0.5">
                        {formFields.title || "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                        {isId ? "Format & Jam" : "Format & Hours"}
                      </span>
                      <p className="font-semibold text-navy truncate mt-0.5">
                        {formFields.deliveryFormat} ({formFields.hours} Jam)
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                        {isId ? "Tingkat Kesulitan" : "Level"}
                      </span>
                      <p className="font-semibold text-navy truncate mt-0.5">
                        {formFields.level} ({formFields.language})
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                        {isId ? "Berkas / Media" : "Attached Files"}
                      </span>
                      <p className="font-semibold text-navy truncate mt-0.5">
                        {totalFilesCount} Berkas {videoUrl ? "+ 1 Video" : ""}
                      </p>
                    </div>
                  </div>
                </div>

                <Section
                  title={isId ? "4. Hak Cipta, Orisinalitas & Etika" : "4. Copyright, Ethics & Declarations"}
                  subtitle={
                    isId
                      ? "Lengkapi deklarasi kepemilikan karya dan setujui kode etik peninjauan modul BARUNA."
                      : "Complete copyright ownership details and accept the BARUNA trainer review code of conduct."
                  }
                >
                  <Grid>
                    <Field
                      label={isId ? "Pemegang Hak Cipta (Copyright Holder)" : "Copyright Holder"}
                      required
                    >
                      <input
                        value={formFields.copyrightHolder}
                        onChange={(e) => updateField("copyrightHolder", e.target.value)}
                        className={inp}
                        required
                      />
                    </Field>
                    <Field label={isId ? "Lisensi Penggunaan" : "Usage License"}>
                      <input
                        value={formFields.licensing}
                        onChange={(e) => updateField("licensing", e.target.value)}
                        className={inp}
                        placeholder="e.g. CC BY-NC-SA 4.0"
                      />
                    </Field>
                  </Grid>

                  <div className="space-y-3 rounded-xl border border-marine/20 bg-marine/5 p-4">
                    <div className="flex items-center justify-between border-b border-marine/15 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-marine">
                        {isId ? "Pernyataan Etika & Orisinalitas (Wajib)" : "Ethics & Originality Declarations (Required)"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !allDecls;
                          setChecked({ 0: next, 1: next, 2: next, 3: next });
                        }}
                        className="text-xs font-semibold text-marine hover:underline cursor-pointer"
                      >
                        {allDecls
                          ? isId
                            ? "Batal Pilih Semua"
                            : "Deselect All"
                          : isId
                            ? "Pilih Semua (Select All)"
                            : "Select All"}
                      </button>
                    </div>
                    {DECLARATIONS.map((d, i) => (
                      <label
                        key={i}
                        className="flex items-start gap-2 text-xs font-medium text-foreground/85 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-marine cursor-pointer"
                          checked={!!checked[i]}
                          onChange={(e) => setChecked({ ...checked, [i]: e.target.checked })}
                        />
                        {d}
                      </label>
                    ))}
                  </div>
                </Section>
              </div>
            )}

            {/* Stepper Action Bar (Back, Save Draft, Next / Submit) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep((s) => Math.max(1, s - 1));
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-navy hover:bg-muted transition shadow-2xs cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {isId ? "Kembali" : "Previous Step"}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Save Draft Button (always available at any step) */}
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={!gate.allowed || saving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-navy hover:bg-muted transition cursor-pointer shadow-2xs"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  {saving && uploadProgress?.includes("Menyimpan")
                    ? isId
                      ? "Menyimpan Draf..."
                      : "Saving Draft..."
                    : isId
                      ? "Simpan sebagai Draf"
                      : "Save Draft"}
                </button>

                {/* Next Step Button (Step 1, 2, 3) */}
                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => {
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
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-xs font-semibold text-white hover:bg-navy transition shadow-xs cursor-pointer"
                  >
                    {isId ? "Lanjut ke Langkah Berikutnya" : "Next Step"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  /* Submit for Review Button (Step 4) */
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={!gate.allowed || !allDecls || saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-marine px-6 py-2.5 text-xs font-semibold text-white hover:bg-navy transition shadow-xs disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                    {saving
                      ? uploadProgress || (isId ? "Menyimpan & Mengunggah…" : "Saving & Uploading…")
                      : isRevision
                        ? isId
                          ? "Kirim Ulang Revisi Modul"
                          : "Resubmit Module Revision"
                        : isId
                          ? "Kirim Modul untuk Ditinjau"
                          : "Submit for Review"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

const inp =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-marine focus:ring-1 focus:ring-marine";

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-soft">
      <h3 className="font-display text-base font-bold text-navy">{title}</h3>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
    </div>
  );
}
