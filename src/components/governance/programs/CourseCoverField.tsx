// Cover image of a Master Course draft. Uploading stores the file and puts its
// path in the draft; it is shown publicly only after the draft is approved.
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { uploadProgramCover } from "@/lib/academy/program-cover.functions";
import { PROGRAM_COVER_ACCEPT, PROGRAM_COVER_MAX_BYTES, programCoverUrl } from "@/lib/academy/program-cover";

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Berkas tidak bisa dibaca."));
    reader.readAsDataURL(file);
  });
}

type Props = { draftId: string; value: string | null | undefined; onChange: (path: string | null) => void; disabled: boolean };

export function CourseCoverField({ draftId, value, onChange, disabled }: Props) {
  const upload = useServerFn(uploadProgramCover);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = programCoverUrl(value);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    // Quick checks for a clear message; the server checks the real bytes again.
    if (file.size > PROGRAM_COVER_MAX_BYTES) return setError("Ukuran gambar maksimal 2 MB.");
    if (file.type && !ALLOWED.includes(file.type)) return setError("Gambar harus berformat PNG, JPG, atau WebP.");
    setBusy(true);
    try {
      const { path } = await upload({ data: { draftId, dataBase64: await toBase64(file) } });
      onChange(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="sm:col-span-2">
      <p className="block text-xs font-semibold text-navy">Gambar sampul (opsional)</p>
      <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-slate-50 sm:w-64">
          {url ? (
            <img src={url} alt="Sampul course" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-xs text-muted-foreground">Belum ada gambar (memakai gambar bawaan)</div>
          )}
        </div>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>PNG, JPG, atau WebP, maksimal 2 MB. Disarankan rasio 16:9 (mis. 1280×720). Tampil di katalog setelah draf disetujui.</p>
          {!disabled ? (
            <div className="flex flex-wrap gap-2">
              <input ref={inputRef} type="file" accept={PROGRAM_COVER_ACCEPT} className="hidden"
                onChange={(e) => void pick(e.target.files?.[0])} />
              <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-lg border border-marine px-3 py-1.5 font-semibold text-marine hover:bg-marine/5 disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                {busy ? "Mengunggah…" : url ? "Ganti gambar" : "Unggah gambar"}
              </button>
              {url ? (
                <button type="button" disabled={busy} onClick={() => onChange(null)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 disabled:opacity-50">
                  <Trash2 className="h-3.5 w-3.5" /> Hapus gambar
                </button>
              ) : null}
            </div>
          ) : null}
          {error ? <p className="text-red-700">{error}</p> : null}
          {value && !disabled ? <p>Klik <strong>Simpan draf</strong> agar gambar tersimpan di draf.</p> : null}
        </div>
      </div>
    </div>
  );
}
