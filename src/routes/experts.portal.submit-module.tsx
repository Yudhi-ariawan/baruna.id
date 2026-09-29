import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { LEVEL_MODULE_LIMIT } from "@/lib/trainerModules";
import { useTrainerPortal } from "@/lib/experts/useTrainerPortal";
import { saveTrainerModuleSubmission } from "@/lib/experts/portal-services.functions";
import { supabase } from "@/integrations/supabase/client";
import { resolveFileContentType } from "@/lib/storage/mime";

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

function SubmitModulePage() {
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
      ? "Trainer profile unavailable."
      : !activeDraft && activeModules >= limit
        ? `Level limit reached (${limit} active modules).`
        : undefined,
  };

  const [submitted, setSubmitted] = useState(false);
  const [savedAsDraft, setSavedAsDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<"draft" | "submit">("submit");
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  // Newly picked local File objects
  const [attachedFiles, setAttachedFiles] = useState<Record<string, File>>({});

  // Pre-existing attached resources from draft metadata
  const [existingFiles, setExistingFiles] = useState<Record<string, ExistingResource>>({});

  // Initialize existing files when activeDraft loads
  useEffect(() => {
    if (activeDraft) {
      const rawAttached = Array.isArray(draftMeta.attached_resources)
        ? (draftMeta.attached_resources as ExistingResource[])
        : Array.isArray(draftPayload.documents)
          ? (draftPayload.documents as ExistingResource[])
          : [];

      const map: Record<string, ExistingResource> = {};
      rawAttached.forEach((res) => {
        if (res.type) {
          map[res.type] = res;
        }
      });
      setExistingFiles(map);
    }
  }, [activeDraft?.id]);

  const allDecls = DECLARATIONS.every((_, i) => checked[i]);

  const latestDecision = activeDraft?.reviewHistory?.[0];
  const isRevision =
    activeDraft?.reviewStatus === "revision_requested" ||
    latestDecision?.decision === "return_for_revision";

  return (
    <PageShell
      sidebar={{
        ...EXPERTS_SIDEBAR_META,
        title: "Trainer Portal",
        subtitle: isRevision ? "Perbaiki & revisi modul pelatihan." : "Submit a new training module.",
        sections: trainerPortalNav("/experts/portal/submit-module"),
      }}
      cta={{
        icon: FileEdit,
        title: "After submission",
        description:
          "Your module enters Administrative → Academic → QA → Digital Learning → Final Approval.",
        button: "View Review Status",
        href: "/experts/portal/review-status",
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">
              {isRevision ? "Revisi & Perbarui Modul" : "Submit a Training Module"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
              {isRevision
                ? "Perbaiki data silabus dan ganti/tambahkan berkas sesuai catatan verifikator sebelum mengirimkan ulang."
                : "Pengajuan Anda akan ditelaah oleh tim verifikator BARUNA. Modul yang disetujui akan dipublikasikan sebagai Self-Paced Course."}
            </p>
          </div>
          {draftId && (
            <Link
              to="/experts/portal/review-status"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy hover:bg-muted self-start"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Status Review
            </Link>
          )}
        </div>

        {/* Revision Alert Box */}
        {isRevision && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-5 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
              <RotateCcw className="h-4 w-4 text-amber-700" />
              Permintaan Revisi dari Verifikator / Admin
            </div>
            {latestDecision?.comment && (
              <div className="mt-2.5 rounded-xl border border-amber-200/80 bg-white/90 p-4 text-sm text-slate-800">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-1">
                  Catatan Evaluasi / Rationale Verifikator:
                </span>
                <p className="italic text-slate-700 leading-relaxed">
                  &quot;{latestDecision.comment}&quot;
                </p>
              </div>
            )}
            <p className="mt-3 text-xs text-amber-800/90 leading-relaxed">
              Silakan lengkapi berkas atau perbaiki isian formulir di bawah ini. Pastikan seluruh
              catatan di atas telah terpenuhi sebelum menekan tombol{" "}
              <strong>Kirim Ulang Revisi Modul</strong>.
            </p>
          </div>
        )}

        {!gate.allowed && (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-destructive">
              <AlertCircle className="h-4 w-4" /> Submission Blocked
            </p>
            <p className="mt-1 text-sm text-foreground/80">{gate.reason}</p>
          </div>
        )}

        {!isRevision && (
          <div className="rounded-2xl border border-marine/20 bg-marine/5 p-4 text-sm text-foreground/80">
            <p className="flex items-center gap-2 font-bold text-marine">
              <Info className="h-4 w-4" /> Level limit
            </p>
            <p className="mt-1">
              Your current level ({level}) allows up to <strong>{limit}</strong> active module
              {limit === 1 ? "" : "s"}. You currently have <strong>{activeModules}</strong>.
            </p>
          </div>
        )}

        {submitted || savedAsDraft ? (
          <div className="rounded-2xl border border-eco-community/30 bg-eco-community/5 p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-eco-community" />
            <h2 className="mt-4 font-display text-2xl font-bold text-navy">
              {submitted
                ? isRevision
                  ? "Revisi Modul Berhasil Dikirimkan!"
                  : "Modul Berhasil Diajukan!"
                : "Draft Modul Tersimpan!"}
            </h2>
            <p className="mt-2 text-sm text-foreground/75 max-w-lg mx-auto leading-relaxed">
              {submitted
                ? "Pengajuan modul Anda telah masuk ke dalam antrean verifikasi Admin dan Tim Governance BARUNA. Anda dapat memantau perkembangannya melalui halaman Review Status."
                : "Draf modul Anda tersimpan aman dan dapat dilanjutkan pengisiannya kapan saja."}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/experts/portal/review-status"
                className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-semibold text-white hover:bg-navy/90 transition shadow-sm"
              >
                Lihat Status Review Modul
              </Link>
              <Link
                to="/experts/portal"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-5 py-2.5 text-xs font-semibold text-navy hover:bg-muted transition"
              >
                Kembali ke Dashboard Trainer
              </Link>
            </div>
          </div>
        ) : (
          <form
            className="space-y-6"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!gate.allowed || (intent === "submit" && !allDecls)) return;
              setSaving(true);
              setError(null);

              const form = new FormData(e.currentTarget);
              const title = String(form.get("title") ?? "").trim();

              try {
                // 1. Upload newly selected files to Supabase Storage
                const { data: userRes } = await supabase.auth.getUser();
                const uid = userRes.user?.id;

                const uploadedResources: Array<{
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
                  setUploadProgress(`Mengunggah ${newEntries.length} berkas...`);
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
                          .from("expert-applications")
                          .upload(path, f, { contentType, upsert: true });

                        if (!upErr) {
                          storagePath = path;
                        }
                      } catch {
                        // Continue even if storage upload fails, preserve metadata
                      }
                    }

                    completedCount++;
                    setUploadProgress(`Mengunggah (${completedCount}/${newEntries.length}) berkas...`);

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

                uploadedResources.push(...newUploaded);
                setUploadProgress("Menyimpan modul ke sistem...");

                // 2. Prepare payload
                const objectivesRaw = String(form.get("objectives") ?? "");
                const learningObjectives = objectivesRaw
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean);

                const hours = Number(form.get("hours") ?? 0);
                const passingScore = Number(form.get("passingScore") ?? 70);

                await saveModule({
                  data: {
                    draftId: draftId || undefined,
                    title,
                    moduleType: "technical",
                    submit: intent === "submit",
                    payload: {
                      title,
                      module_type: "technical",
                      summary: String(form.get("summary") ?? ""),
                      language: String(form.get("language") ?? "English"),
                      estimated_learning_hours: hours,
                      target_participants: String(form.get("targetParticipants") ?? ""),
                      content_outline: {
                        topic: String(form.get("topic") ?? ""),
                        competency: String(form.get("competency") ?? ""),
                      },
                      learning_objectives: learningObjectives,
                      competency_outcomes: String(form.get("outcomes") ?? ""),
                      assessment_approach: {
                        method: String(form.get("assessment") ?? ""),
                        passing_score: passingScore,
                      },
                      metadata: {
                        level: String(form.get("level") ?? "Intermediate"),
                        delivery_format: String(form.get("deliveryFormat") ?? "Self-paced"),
                        copyright_holder: String(form.get("copyrightHolder") ?? ""),
                        licensing: String(form.get("licensing") ?? ""),
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

                if (intent === "submit") {
                  setSubmitted(true);
                } else {
                  setSavedAsDraft(true);
                }
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Unable to save module.");
              } finally {
                setSaving(false);
              }
            }}
          >
            <Section title="Informasi & Metadata Modul">
              <Grid>
                <Field label="Judul Modul Pelatihan" required>
                  <input
                    name="title"
                    className={inp}
                    required
                    defaultValue={String(draftPayload.title ?? activeDraft?.title ?? "")}
                    placeholder="Contoh: Marine Protected Area Management Fundamentals"
                  />
                </Field>
                <Field label="Topik / Bidang Kajian" required>
                  <input
                    name="topic"
                    className={inp}
                    required
                    defaultValue={String(draftOutline.topic ?? "")}
                    placeholder="Contoh: Konservasi Laut, Akuakultur, Kebijakan Maritim"
                  />
                </Field>
                <Field label="Bidang Kompetensi" required>
                  <input
                    name="competency"
                    className={inp}
                    required
                    defaultValue={String(draftOutline.competency ?? "")}
                    placeholder="Contoh: Manajemen Zonasi & Pemantauan Bioekologi"
                  />
                </Field>
                <Field label="Format Pembelajaran" required>
                  <select
                    name="deliveryFormat"
                    className={inp}
                    required
                    defaultValue={String(draftMeta.delivery_format ?? "Self-paced")}
                  >
                    <option value="Self-paced">Self-paced (Mandiri Online)</option>
                    <option value="Scheduled">Scheduled (Terkurasi / Terjadwal)</option>
                    <option value="Blended">Blended (Kombinasi Daring &amp; Tatap Muka)</option>
                  </select>
                </Field>
                <Field label="Estimasi Jam Pembelajaran (Jam)" required>
                  <input
                    name="hours"
                    type="number"
                    min={1}
                    className={inp}
                    required
                    defaultValue={Number(draftPayload.estimated_learning_hours ?? 8)}
                  />
                </Field>
                <Field label="Tingkat Kesulitan (Level)" required>
                  <select
                    name="level"
                    className={inp}
                    required
                    defaultValue={String(draftMeta.level ?? "Intermediate")}
                  >
                    <option value="Introductory">Introductory (Pemula)</option>
                    <option value="Intermediate">Intermediate (Menengah)</option>
                    <option value="Advanced">Advanced (Lanjutan)</option>
                  </select>
                </Field>
                <Field label="Bahasa Pengantar" required>
                  <input
                    name="language"
                    className={inp}
                    defaultValue={String(draftPayload.language ?? "Bahasa Indonesia")}
                    required
                  />
                </Field>
              </Grid>
              <Field label="Ringkasan Modul (Deskripsi Singkat)" required>
                <textarea
                  name="summary"
                  className={`${inp} min-h-[90px]`}
                  required
                  defaultValue={String(draftPayload.summary ?? "")}
                  placeholder="Jelaskan gambaran umum materi pelatihan, relevansi industri maritim, dan kompetensi yang akan dicapai..."
                />
              </Field>
            </Section>

            <Section title="Target Peserta & Prasyarat">
              <Field label="Profil Target Peserta" required>
                <input
                  name="targetParticipants"
                  className={inp}
                  required
                  defaultValue={String(draftPayload.target_participants ?? "")}
                  placeholder="Contoh: Peneliti kelautan, staf BKSDA, mahasiswa perikanan tingkat akhir, praktisi konservasi"
                />
              </Field>
            </Section>

            <Section title="Rancangan Pembelajaran & Evaluasi">
              <Field label="Tujuan Pembelajaran (Satu per baris)" required>
                <textarea
                  name="objectives"
                  className={`${inp} min-h-[90px]`}
                  required
                  defaultValue={
                    Array.isArray(draftPayload.learning_objectives)
                      ? (draftPayload.learning_objectives as string[]).join("\n")
                      : ""
                  }
                  placeholder="Contoh:&#10;1. Memahami prinsip penetapan batas kawasan konservasi laut&#10;2. Mampu menyusun indikator kesehatan terumbu karang&#10;3. Mengetahui regulasi perizinan zonasi pemanfaatan"
                />
              </Field>
              <Field label="Capaian Hasil Kompetensi (Expected Outcomes)" required>
                <textarea
                  name="outcomes"
                  className={`${inp} min-h-[80px]`}
                  required
                  defaultValue={String(draftPayload.competency_outcomes ?? "")}
                  placeholder="Peserta mampu merancang dokumen rencana pengelolaan kawasan konservasi perairan sesuai pedoman nasional..."
                />
              </Field>
              <Grid>
                <Field label="Metode Penilaian / Ujian" required>
                  <input
                    name="assessment"
                    className={inp}
                    required
                    defaultValue={String(draftAssessment.method ?? "Kuis Pilihan Ganda & Studi Kasus")}
                    placeholder="Contoh: Kuis Pilihan Ganda 20 Soal"
                  />
                </Field>
                <Field label="Nilai Kelulusan Minimum (Passing Score %)" required>
                  <input
                    name="passingScore"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={Number(draftAssessment.passing_score ?? 70)}
                    className={inp}
                    required
                  />
                </Field>
              </Grid>
            </Section>

            <Section title="Lampiran Berkas & Dokumen Modul">
              <p className="text-xs text-muted-foreground mb-3">
                Unggah berkas silabus modul, slide presentasi, panduan instruktur, dan instrumen
                kuis (PDF, PPT, DOCX, gambar/video). Maksimum 50 MB per berkas.
              </p>
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
                                    [Baru]
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
                              Ganti
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
            </Section>

            <Section title="Hak Cipta, Orisinalitas & Etika">
              <Grid>
                <Field label="Pemegang Hak Cipta (Copyright Holder)" required>
                  <input
                    name="copyrightHolder"
                    className={inp}
                    defaultValue={String(
                      draftMeta.copyright_holder ?? trainer?.fullName ?? "",
                    )}
                    required
                  />
                </Field>
                <Field label="Lisensi Penggunaan">
                  <input
                    name="licensing"
                    className={inp}
                    defaultValue={String(draftMeta.licensing ?? "CC BY-NC-SA 4.0")}
                    placeholder="e.g. CC BY-NC-SA 4.0"
                  />
                </Field>
              </Grid>
              <div className="space-y-3 rounded-xl border border-marine/20 bg-marine/5 p-4">
                <div className="flex items-center justify-between border-b border-marine/15 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-marine">
                    Pernyataan Etika &amp; Orisinalitas (Wajib)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !allDecls;
                      setChecked({ 0: next, 1: next, 2: next, 3: next });
                    }}
                    className="text-xs font-semibold text-marine hover:underline cursor-pointer"
                  >
                    {allDecls ? "Batal Pilih Semua" : "Pilih Semua (Select All)"}
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

            <div className="space-y-3">
              {!allDecls && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs font-medium text-amber-800 dark:text-amber-300">
                  <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    Centang 4 poin pernyataan etika di atas (atau klik <strong>Pilih Semua</strong>)
                    untuk mengaktifkan tombol pengajuan.
                  </span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  onClick={() => setIntent("submit")}
                  disabled={!gate.allowed || !allDecls || saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-marine px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  <Send className="h-4 w-4" />{" "}
                  {saving
                    ? uploadProgress || "Menyimpan & Mengunggah…"
                    : isRevision
                      ? "Kirim Ulang Revisi Modul"
                      : "Submit for Review"}
                </button>
                <button
                  type="submit"
                  onClick={() => setIntent("draft")}
                  disabled={!gate.allowed || saving}
                  className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-navy hover:bg-muted cursor-pointer"
                >
                  Simpan sebagai Draf
                </button>
              </div>
            </div>
            {error && (
              <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
            )}
          </form>
        )}
      </div>
    </PageShell>
  );
}

const inp =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-marine focus:ring-1 focus:ring-marine";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h3 className="font-display text-base font-bold text-navy">{title}</h3>
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
