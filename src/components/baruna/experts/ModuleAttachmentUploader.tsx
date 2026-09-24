import { useRef, useState } from "react";
import { CheckCircle2, Eye, FileUp, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  MODULE_ATTACHMENTS_BUCKET,
  type ModuleAttachment,
  type ModuleAttachmentDefinition,
} from "@/lib/experts/module-attachments";

function safeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ModuleAttachmentUploader({
  definition,
  value,
  onChange,
}: {
  definition: ModuleAttachmentDefinition;
  value?: ModuleAttachment;
  onChange: (attachment: ModuleAttachment | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "removing">("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = status !== "idle";

  async function selectFile(file?: File) {
    if (!file) return;
    setError(null);
    if (!definition.allowedTypes.includes(file.type)) {
      setError(`Unsupported file type for ${definition.label}.`);
      return;
    }
    if (file.size > definition.maxBytes) {
      setError(`File must be ${formatBytes(definition.maxBytes)} or smaller.`);
      return;
    }

    setStatus("uploading");
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      setError("Your session has expired. Please sign in again.");
      setStatus("idle");
      return;
    }
    const objectPath = `users/${auth.user.id}/modules/${crypto.randomUUID()}-${definition.key}-${safeFilename(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(MODULE_ATTACHMENTS_BUCKET)
      .upload(objectPath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setError(uploadError.message);
      setStatus("idle");
      return;
    }

    if (value?.path) await supabase.storage.from(MODULE_ATTACHMENTS_BUCKET).remove([value.path]);
    onChange({
      category: definition.key,
      bucket: MODULE_ATTACHMENTS_BUCKET,
      path: objectPath,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
    });
    setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove() {
    if (!value) return;
    setStatus("removing");
    setError(null);
    const { error: removeError } = await supabase.storage.from(MODULE_ATTACHMENTS_BUCKET).remove([value.path]);
    if (removeError) setError(removeError.message);
    else onChange(undefined);
    setStatus("idle");
  }

  async function preview() {
    if (!value) return;
    setError(null);
    const { data, error: signedError } = await supabase.storage.from(MODULE_ATTACHMENTS_BUCKET).createSignedUrl(value.path, 300);
    if (signedError) setError(signedError.message);
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <li className="rounded-lg border border-dashed border-border p-3">
      <input
        ref={inputRef}
        type="file"
        accept={definition.accept}
        className="sr-only"
        disabled={busy}
        onChange={(event) => void selectFile(event.target.files?.[0])}
      />
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-foreground/70">{definition.label}</p>
          {value && (
            <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-eco-community">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{value.name}</span>
              <span className="shrink-0 font-normal text-muted-foreground">({formatBytes(value.size)})</span>
            </p>
          )}
          {status === "uploading" && <p className="mt-1 text-xs font-semibold text-marine">Uploading securely…</p>}
          {status === "removing" && <p className="mt-1 text-xs text-muted-foreground">Removing file…</p>}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex shrink-0 items-center gap-1 text-[0.65rem] font-bold text-marine hover:text-navy disabled:opacity-50"
        >
          {status === "uploading" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : value ? <RefreshCw className="h-3.5 w-3.5" /> : <FileUp className="h-3.5 w-3.5" />}
          {value ? "REPLACE" : "UPLOAD"}
        </button>
        {value && (
          <button type="button" disabled={busy} onClick={() => void preview()} className="inline-flex items-center gap-1 text-[0.65rem] font-bold text-navy hover:text-marine disabled:opacity-50">
            <Eye className="h-3.5 w-3.5" /> PREVIEW
          </button>
        )}
        {value && (
          <button type="button" disabled={busy} onClick={() => void remove()} aria-label={`Remove ${value.name}`} className="text-destructive hover:text-destructive/70 disabled:opacity-50">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </li>
  );
}
