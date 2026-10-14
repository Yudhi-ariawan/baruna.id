import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resolveFileContentType } from "@/lib/storage/mime";
import { submitTrainerApplication } from "@/lib/experts/trainer-application.functions";
import {
  TRAINER_APPLICATION_BUCKET,
  TRAINER_APPLICATION_FILE_ACCEPT,
  TRAINER_APPLICATION_FILE_EXTENSIONS,
  TRAINER_APPLICATION_MAX_BYTES,
  TRAINER_ROLES,
  TrainerApplicationSchema,
  trainerApplicationFilePrefix,
  type TrainerApplicationFile,
} from "@/lib/experts/trainer-application";

type Text = {
  trainingExperience: string;
  teachingEvidence: string;
  materialDevelopment: string;
  proposedModuleTopic: string;
  targetParticipants: string;
  instructionalHours: string;
  learningOutcomes: string;
  sampleMaterialUrl: string;
};

const DECLARATIONS = [
  ["originality", "The materials I submit are my original work or properly attributed."],
  ["copyright", "I hold, or have permission for, the copyright of all submitted materials."],
  ["conflictOfInterest", "I will disclose any conflict of interest related to my training activities."],
  ["codeOfConduct", "I agree to the BARUNA Trainer Code of Conduct."],
] as const;

type DeclarationKey = (typeof DECLARATIONS)[number][0];

export function TrainerApplicationForm({ onSubmitted }: { onSubmitted: () => Promise<void> }) {
  const submit = useServerFn(submitTrainerApplication);
  const [roles, setRoles] = useState<string[]>([]);
  const [text, setText] = useState<Text>({
    trainingExperience: "", teachingEvidence: "", materialDevelopment: "", proposedModuleTopic: "",
    targetParticipants: "", instructionalHours: "", learningOutcomes: "", sampleMaterialUrl: "",
  });
  const [file, setFile] = useState<TrainerApplicationFile | null>(null);
  const [declarations, setDeclarations] = useState<Record<DeclarationKey, boolean>>({
    originality: false, copyright: false, conflictOfInterest: false, codeOfConduct: false,
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const set = (key: keyof Text) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setText((t) => ({ ...t, [key]: e.target.value }));

  // Uploaded immediately to the applicant's private folder; a failed upload
  // stops here and never leaves a file name without content.
  const upload = async (f: File | null) => {
    if (!f || uploading) return;
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (!TRAINER_APPLICATION_FILE_EXTENSIONS.includes(ext)) {
      toast.error("Format harus PDF, DOC/DOCX, atau PPT/PPTX.");
      return;
    }
    if (f.size > TRAINER_APPLICATION_MAX_BYTES) {
      toast.error("Berkas terlalu besar (maksimal 10 MB). Gunakan tautan untuk berkas yang lebih besar.");
      return;
    }
    setUploading(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sesi login berakhir. Silakan masuk kembali.");
      const contentType = resolveFileContentType(f.name, f.type);
      const safeName = f.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
      const path = `${trainerApplicationFilePrefix(data.user.id)}${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from(TRAINER_APPLICATION_BUCKET).upload(path, f, { contentType, upsert: false });
      if (error) throw new Error(`Gagal mengunggah berkas: ${error.message}`);
      setFile({ name: f.name, size: f.size, type: contentType, path, bucket: TRAINER_APPLICATION_BUCKET });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal mengunggah berkas.");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current || uploading) return;
    const parsed = TrainerApplicationSchema.safeParse({
      proposedRoles: roles,
      ...text,
      instructionalHours: Number(text.instructionalHours || 0),
      sampleMaterial: file,
      declarations,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Lengkapi formulir terlebih dahulu.");
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      const result = await submit({ data: parsed.data });
      toast.success(result.duplicate ? "Anda sudah memiliki pengajuan yang sedang ditinjau." : "Pengajuan trainer terkirim.");
      await onSubmitted();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal mengirim pengajuan.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const area = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marine/30";
  const label = "block text-sm font-semibold text-navy";

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <fieldset>
        <legend className={label}>Proposed training role(s) *</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TRAINER_ROLES.map((role) => {
            const on = roles.includes(role);
            return (
              <button key={role} type="button" onClick={() => setRoles((r) => (on ? r.filter((x) => x !== role) : [...r, role]))} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? "border-marine bg-marine text-white" : "border-border text-navy hover:bg-muted"}`}>
                {role}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className={label}>Training experience * <span className="font-normal text-muted-foreground">(min. 50 characters)</span>
        <textarea rows={4} maxLength={4000} value={text.trainingExperience} onChange={set("trainingExperience")} className={area} placeholder="Trainings you have delivered: topic, audience, year, organizer…" />
      </label>
      <label className={label}>Evidence of teaching competence *
        <textarea rows={3} maxLength={4000} value={text.teachingEvidence} onChange={set("teachingEvidence")} className={area} placeholder="Certifications, evaluations, references, recordings…" />
      </label>
      <label className={label}>Experience developing learning materials & assessments
        <textarea rows={3} maxLength={4000} value={text.materialDevelopment} onChange={set("materialDevelopment")} className={area} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${label} sm:col-span-2`}>Proposed module topic *
          <input maxLength={240} value={text.proposedModuleTopic} onChange={set("proposedModuleTopic")} className={area} />
        </label>
        <label className={label}>Target participants *
          <input maxLength={500} value={text.targetParticipants} onChange={set("targetParticipants")} className={area} />
        </label>
        <label className={label}>Instructional hours *
          <input inputMode="numeric" maxLength={3} value={text.instructionalHours} onChange={(e) => setText((t) => ({ ...t, instructionalHours: e.target.value.replace(/[^0-9]/g, "") }))} className={area} />
        </label>
      </div>
      <label className={label}>Learning outcomes *
        <textarea rows={3} maxLength={4000} value={text.learningOutcomes} onChange={set("learningOutcomes")} className={area} />
      </label>

      <div className="space-y-2 rounded-xl border border-dashed border-border p-4">
        <p className={label}>Sample teaching material * <span className="font-normal text-muted-foreground">(file or link)</span></p>
        {file ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
            <span className="min-w-0 truncate">{file.name}</span>
            <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-destructive" aria-label="Remove file"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-marine hover:bg-muted">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload PDF / DOCX / PPTX (max 10 MB)"}
            <input type="file" accept={TRAINER_APPLICATION_FILE_ACCEPT} className="hidden" disabled={uploading} onChange={(e) => { void upload(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          </label>
        )}
        <input maxLength={500} value={text.sampleMaterialUrl} onChange={set("sampleMaterialUrl")} className={area} placeholder="https://… (presentation, video, or teaching demo link)" />
      </div>

      <fieldset className="space-y-2">
        <legend className={label}>Declarations *</legend>
        {DECLARATIONS.map(([key, textLabel]) => (
          <label key={key} className="flex items-start gap-2 text-sm text-foreground/80">
            <input type="checkbox" checked={declarations[key]} onChange={(e) => setDeclarations((d) => ({ ...d, [key]: e.target.checked }))} className="mt-1" />
            {textLabel}
          </label>
        ))}
      </fieldset>

      <button type="submit" disabled={submitting || uploading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-white hover:bg-navy disabled:opacity-60 sm:w-auto">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />} {submitting ? "Submitting…" : "Submit Trainer Application"}
      </button>
    </form>
  );
}
