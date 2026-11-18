// Small inputs shared by the CMS editors: a text field marked data-field (so the
// error summary can jump to it), an Indonesian/English pair, and the image upload.
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { FieldError } from "@/components/baruna/forms/FieldError";
import { fieldErrorCls } from "@/components/baruna/forms/field-errors";
import { uploadCmsImage } from "@/lib/cms/cms.functions";
import { cmsImageUrl } from "@/lib/cms/cms-types";

const INPUT = "mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm disabled:bg-muted/40";

type TextProps = {
  label: string; value: string | undefined; onChange: (v: string) => void; field: string; error?: string;
  disabled?: boolean; multiline?: boolean; rows?: number; maxLength?: number; placeholder?: string; hint?: string; required?: boolean;
};

export function CmsText({ label, value, onChange, field, error, disabled, multiline, rows = 3, maxLength, placeholder, hint, required }: TextProps) {
  return (
    <label className="block text-xs font-semibold text-navy" data-field={field}>
      {label} {required ? <span className="text-red-600">*</span> : null}
      {multiline ? (
        <textarea value={value ?? ""} rows={rows} maxLength={maxLength} disabled={disabled} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} className={INPUT + fieldErrorCls(error)} />
      ) : (
        <input value={value ?? ""} maxLength={maxLength} disabled={disabled} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} className={INPUT + fieldErrorCls(error)} />
      )}
      {hint && !error ? <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{hint}</span> : null}
      <FieldError msg={error} />
    </label>
  );
}

/** Indonesian (required or not) + English (optional, falls back to Indonesian). */
export function CmsBilingual(props: {
  label: string; idValue: string | undefined; enValue: string | undefined; onId: (v: string) => void; onEn: (v: string) => void;
  field: string; errors: Record<string, string>; disabled?: boolean; multiline?: boolean; rows?: number; maxLength?: number; required?: boolean;
}) {
  const { label, field, errors } = props;
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      <CmsText label={`${label} (Indonesia)`} value={props.idValue} onChange={props.onId} field={`${field}_id`} error={errors[`${field}_id`]}
        disabled={props.disabled} multiline={props.multiline} rows={props.rows} maxLength={props.maxLength} required={props.required} />
      <CmsText label={`${label} (Inggris, opsional)`} value={props.enValue} onChange={props.onEn} field={`${field}_en`} error={errors[`${field}_en`]}
        disabled={props.disabled} multiline={props.multiline} rows={props.rows} maxLength={props.maxLength} hint="Kosong = memakai versi Indonesia." />
    </div>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Berkas tidak bisa dibaca."));
    reader.readAsDataURL(file);
  });
}

/** Image of a block: uploaded by the server into the CMS folder; the draft keeps only the path. */
export function CmsImage({ draftId, value, onChange, field, error, disabled }: {
  draftId: string; value: string | null | undefined; onChange: (path: string | null) => void; field: string; error?: string; disabled?: boolean;
}) {
  const upload = useServerFn(uploadCmsImage);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const url = cmsImageUrl(value);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setMsg(null);
    if (file.size > 2 * 1024 * 1024) return setMsg("Ukuran gambar maksimal 2 MB.");
    if (file.type && !["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setMsg("Gambar harus PNG, JPG, atau WebP.");
    setBusy(true);
    try {
      onChange((await upload({ data: { draftId, dataBase64: await toBase64(file) } })).path);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="text-xs font-semibold text-navy" data-field={field}>
      Gambar (opsional, PNG/JPG/WebP ≤2 MB)
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {url ? <img src={url} alt="" className="h-14 w-24 rounded-md border border-border object-cover" /> : null}
        {!disabled ? (
          <>
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} {url ? "Ganti" : "Unggah"}
            </button>
            {url ? (
              <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted">
                <Trash2 className="h-3.5 w-3.5" /> Hapus
              </button>
            ) : null}
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
          </>
        ) : null}
      </div>
      <FieldError msg={msg ?? error} />
    </div>
  );
}

/** Small move/remove buttons for list items. */
export function RowTools({ onUp, onDown, onRemove, disabled }: { onUp?: () => void; onDown?: () => void; onRemove: () => void; disabled?: boolean }) {
  if (disabled) return null;
  const cls = "rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold hover:bg-muted disabled:opacity-40";
  return (
    <span className="flex shrink-0 gap-1">
      <button type="button" className={cls} disabled={!onUp} onClick={onUp} aria-label="Naik">↑</button>
      <button type="button" className={cls} disabled={!onDown} onClick={onDown} aria-label="Turun">↓</button>
      <button type="button" className={cls + " text-red-700"} onClick={onRemove}>Hapus</button>
    </span>
  );
}
