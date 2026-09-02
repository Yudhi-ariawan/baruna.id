import { useRef, useState } from "react";
import { Upload, FileCheck2, Check, X, AlertCircle } from "lucide-react";
import { formatBytes, type DocumentMeta, type DocField } from "@/lib/application";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function extOk(file: File, accept: string): boolean {
  const exts = accept
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (exts.length === 0) return true;
  const name = file.name.toLowerCase();
  return exts.some((e) => name.endsWith(e));
}

/**
 * Reusable BARUNA document upload row with drag & drop, simulated upload
 * progress, file validation, an "Uploaded" status badge, and replace/remove
 * actions. Used by the enrollment Documents step and post-course assignments.
 */
export function DocumentUploadRow({
  field,
  meta,
  onChange,
  uploadedLabel = "Uploaded",
}: {
  field: DocField;
  meta: DocumentMeta | null;
  onChange: (file: File | null) => void;
  uploadedLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File | null) => {
    if (!file) return;
    setError(null);
    if (!extOk(file, field.accept)) {
      setError(`Invalid file type. Accepted: ${field.hint}.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is too large (max 10 MB).");
      return;
    }
    // Simulate an upload with a progress indicator.
    setProgress(0);
    let pct = 0;
    const timer = setInterval(() => {
      pct += Math.random() * 22 + 10;
      if (pct >= 100) {
        clearInterval(timer);
        setProgress(100);
        setTimeout(() => {
          setProgress(null);
          onChange(file);
        }, 250);
      } else {
        setProgress(Math.round(pct));
      }
    }, 120);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0] ?? null);
  };

  const uploading = progress !== null;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex flex-col gap-3 rounded-xl border bg-background p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
        dragging ? "border-marine bg-marine/5 ring-2 ring-marine/20" : error ? "border-destructive/50" : "border-border"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
            meta ? "bg-marine/10 text-marine" : "bg-muted text-muted-foreground"
          }`}
        >
          {meta ? <FileCheck2 className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy">{field.label}</p>
          {meta ? (
            <p className="truncate text-xs text-marine">
              {meta.name} · {formatBytes(meta.size)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Drag &amp; drop or click to upload · {field.hint}
            </p>
          )}
          {error && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
          {uploading && (
            <div className="mt-2 w-40 max-w-full">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-marine transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-[0.65rem] font-semibold text-muted-foreground">Uploading… {progress}%</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {meta && !uploading && (
          <span className="inline-flex items-center gap-1 rounded-md bg-marine/10 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-marine">
            <Check className="h-3 w-3" /> {uploadedLabel}
          </span>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-marine bg-card px-3.5 py-2 text-xs font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {meta ? "Replace" : "Upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={field.accept}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        {meta && !uploading && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              onChange(null);
            }}
            aria-label={`Remove ${field.label}`}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
