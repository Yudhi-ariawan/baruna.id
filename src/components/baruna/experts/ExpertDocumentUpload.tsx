import { useRef, useState } from "react";
import { ExternalLink, FileText, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  EXPERT_APPLICATION_BUCKET,
  type ExpertApplicationDocument,
} from "@/lib/experts/application.types";
import { formatBytes } from "@/lib/experts";
import { getUploadSizeError } from "@/lib/storage/upload-limits";

export const EXPERT_APPLICATION_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp";

/** One document slot of the Join-as-Expert form (CV, photo, certifications, supporting). */
export function ExpertDocumentUpload({
  label,
  file,
  stored,
  onFile,
  onRemoveStored,
  accept = EXPERT_APPLICATION_ACCEPT,
  helperText,
}: {
  label: string;
  file: File | null;
  stored: ExpertApplicationDocument | null;
  onFile: (file: File | null) => void;
  onRemoveStored?: () => void;
  accept?: string;
  helperText?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  const handle = (f: File | null) => {
    if (!f) return;
    const sizeError = getUploadSizeError(f);
    if (sizeError) {
      setErr(sizeError);
      return;
    }
    if (
      accept.includes("image") &&
      !accept.includes(".pdf") &&
      !f.type.startsWith("image/") &&
      !/\.(jpg|jpeg|png|webp)$/i.test(f.name)
    ) {
      setErr("Harap pilih berkas gambar (JPG, PNG, atau WebP).");
      return;
    }
    setErr(null);
    onFile(f);
  };

  const handleOpenStored = async () => {
    if (!stored?.path) return;
    try {
      const { data, error } = await supabase.storage
        .from(EXPERT_APPLICATION_BUCKET)
        .createSignedUrl(stored.path, 3600);
      if (error || !data?.signedUrl) {
        setErr("Gagal membuat tautan akses berkas.");
        return;
      }
      const viewerUrl = `/document-viewer?url=${encodeURIComponent(data.signedUrl)}&title=${encodeURIComponent(stored.name)}`;
      window.open(viewerUrl, "_blank", "noopener,noreferrer");
    } catch {
      setErr("Gagal membuka dokumen.");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
      <div className="mb-2 flex items-center justify-between">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</label>
        {file ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Berkas Baru / Pengganti
          </span>
        ) : stored ? (
          <span className="rounded-full bg-eco-community/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-eco-community">
            Berkas Tersimpan
          </span>
        ) : null}
      </div>

      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50/50 p-2.5">
          <FileText className="h-5 w-5 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-navy">{file.name}</p>
            <p className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => onFile(null)}
            title="Batal ganti berkas"
            className="grid h-7 w-7 place-items-center rounded-full border border-border bg-white text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : stored ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-lg border border-eco-community/30 bg-eco-community/5 p-2.5">
            <FileText className="h-5 w-5 shrink-0 text-eco-community" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-navy">{stored.name}</p>
              <p className="text-[11px] text-muted-foreground">{formatBytes(stored.size)}</p>
            </div>
            {onRemoveStored && (
              <button
                type="button"
                onClick={onRemoveStored}
                title="Hapus berkas tersimpan"
                className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenStored}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-marine transition-colors hover:bg-muted"
            >
              <ExternalLink className="h-3 w-3" /> Buka di Tab
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-500/20"
            >
              <Upload className="h-3 w-3" /> Ganti Berkas
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-3 py-3 text-sm font-semibold text-marine transition-colors hover:border-marine/50 hover:bg-muted"
        >
          <Upload className="h-4 w-4" /> Unggah {label}
        </button>
      )}

      {helperText && !file && !stored && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{helperText}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0] ?? null)}
      />
      {err && <p className="mt-1 text-xs font-medium text-destructive">{err}</p>}
    </div>
  );
}
