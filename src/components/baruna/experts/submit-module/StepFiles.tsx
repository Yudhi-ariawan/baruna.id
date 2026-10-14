import { CheckCircle2, FileText, Upload, Video, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUploadSizeError } from "@/lib/storage/upload-limits";
import { MODULE_ATTACHMENTS_BUCKET } from "@/lib/experts/module-attachments";
import type { CustomQuizQuestion } from "@/lib/learning/learning.functions";
import { Section } from "./FormPrimitives";
import {
  RESOURCES,
  MODULE_ATTACHMENT_ACCEPT,
  MODULE_ATTACHMENT_EXTENSIONS,
  formatBytes,
  type ExistingResource,
} from "./config";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export function StepFiles({
  isId,
  attachedFiles,
  setAttachedFiles,
  existingFiles,
  setExistingFiles,
  videoUrl,
  setVideoUrl,
  totalFilesCount,
  quizQuestions,
  setError,
}: {
  isId: boolean;
  attachedFiles: Record<string, File>;
  setAttachedFiles: SetState<Record<string, File>>;
  existingFiles: Record<string, ExistingResource>;
  setExistingFiles: SetState<Record<string, ExistingResource>>;
  videoUrl: string;
  setVideoUrl: (v: string) => void;
  totalFilesCount: number;
  quizQuestions: CustomQuizQuestion[];
  setError: (msg: string | null) => void;
}) {
  return (
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
            <span className="text-xs font-semibold text-eco-community">
              {totalFilesCount} {isId ? "berkas terlampir" : "files attached"}
            </span>
          </div>

          {Object.keys(existingFiles).length > 0 && (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-[11px] text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                {isId
                  ? `Seluruh ${Object.keys(existingFiles).length} berkas yang telah Anda unggah sebelumnya tetap tersimpan aman. Anda hanya perlu menekan "Ganti" pada berkas yang ingin diperbarui, dan biarkan berkas lainnya tetap utuh.`
                  : `All ${Object.keys(existingFiles).length} previously uploaded files are safely preserved. You only need to click "Replace" on specific files you wish to update.`}
              </span>
            </div>
          )}

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
                    accept={MODULE_ATTACHMENT_ACCEPT}
                    onChange={(e) => {
                      const picked = e.target.files?.[0];
                      e.target.value = "";
                      if (!picked) return;
                      const ext = (picked.name.split(".").pop() || "").toLowerCase();
                      if (!MODULE_ATTACHMENT_EXTENSIONS.includes(ext)) {
                        setError(
                          isId
                            ? `Format "${picked.name}" tidak didukung. Gunakan PDF, DOC/DOCX, PPT/PPTX, JPG/PNG/WebP, atau MP4/WebM/MOV.`
                            : `"${picked.name}" is not a supported format. Use PDF, DOC/DOCX, PPT/PPTX, JPG/PNG/WebP, or MP4/WebM/MOV.`,
                        );
                        return;
                      }
                      const sizeError = getUploadSizeError(picked);
                      if (sizeError) {
                        setError(`${picked.name}: ${sizeError}`);
                        return;
                      }
                      setError(null);
                      setAttachedFiles((prev) => ({ ...prev, [r]: picked }));
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
                            {newFile ? (
                              <span className="ml-1 text-[0.65rem] font-bold text-marine">
                                {isId ? "[Baru]" : "[New]"}
                              </span>
                            ) : (
                              <span className="ml-1 text-[0.65rem] font-semibold text-emerald-700">
                                {isId ? "[Tersimpan]" : "[Saved]"}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!newFile && existing?.path && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!existing.path) return;
                              if (existing.path.startsWith("http")) {
                                window.open(existing.path, "_blank", "noopener,noreferrer");
                                return;
                              }
                              const primaryBucket =
                                existing.bucket ||
                                (existing.path.includes("/modules/")
                                  ? MODULE_ATTACHMENTS_BUCKET
                                  : "expert-applications");
                              const { data: s1 } = await supabase.storage
                                .from(primaryBucket)
                                .createSignedUrl(existing.path, 3600);
                              if (s1?.signedUrl) {
                                window.open(s1.signedUrl, "_blank", "noopener,noreferrer");
                                return;
                              }
                              const { data: s2 } = await supabase.storage
                                .from(
                                  primaryBucket === MODULE_ATTACHMENTS_BUCKET
                                    ? "expert-applications"
                                    : MODULE_ATTACHMENTS_BUCKET,
                                )
                                .createSignedUrl(existing.path, 3600);
                              if (s2?.signedUrl) {
                                window.open(s2.signedUrl, "_blank", "noopener,noreferrer");
                              }
                            }}
                            className="text-[0.65rem] font-semibold text-emerald-700 hover:underline cursor-pointer px-1 py-0.5"
                            title={isId ? "Lihat berkas yang sudah diunggah" : "View uploaded file"}
                          >
                            {isId ? "Lihat" : "View"}
                          </button>
                        )}
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
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium text-foreground/80 group-hover:text-marine transition-colors flex items-center gap-1.5">
                          <span>{r}</span>
                          {r.toLowerCase().includes("quiz") && quizQuestions.length > 0 && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              {isId ? `(${quizQuestions.length} Soal di Langkah 2)` : `(${quizQuestions.length} Qs in Step 2)`}
                            </span>
                          )}
                        </span>
                        {r.toLowerCase().includes("quiz") && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {quizQuestions.length > 0
                              ? (isId ? "Opsional (Soal kuis interaktif sudah dibuat di Langkah 2)" : "Optional (Interactive quiz created in Step 2)")
                              : (isId ? "Opsional / Berkas dokumen kuis fisik" : "Optional / Physical quiz document")}
                          </p>
                        )}
                      </div>
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
  );
}
