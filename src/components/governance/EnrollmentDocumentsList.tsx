// Documents attached to an enrolment application (PB-ACA-03), opened through a
// short-lived signed link; the database checks who may open each file.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { getEnrollmentDocumentUrl } from "@/lib/learning/enrollment-documents.functions";

export type EnrollmentDocument = { id: string; requirement: string; fileName: string; uploadedAt: string };

export function EnrollmentDocumentsList({ documents, required }: { documents: EnrollmentDocument[]; required?: string[] }) {
  const urlFn = useServerFn(getEnrollmentDocumentUrl);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const missing = (required ?? []).filter((r) => !documents.some((d) => d.requirement === r));
  if (documents.length === 0 && missing.length === 0) return null;

  const open = async (id: string) => {
    setError(null);
    setBusy(id);
    // Opened inside the click so the browser does not block the new tab.
    const win = window.open("", "_blank");
    try {
      const { url } = await urlFn({ data: { documentId: id } });
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (e) {
      win?.close();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  // Same order as the list of required documents; anything else after it.
  const rank = (r: string) => {
    const i = (required ?? []).indexOf(r);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const sorted = [...documents].sort((a, b) => rank(a.requirement) - rank(b.requirement));

  return (
    <div className="space-y-1.5">
      <p className="text-[0.65rem] font-bold uppercase text-muted-foreground">
        Dokumen persyaratan ({documents.length}{required?.length ? `/${required.length}` : ""})
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {sorted.map((d) => (
          <li key={d.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 text-[11px] leading-tight">
            <FileText className="h-3.5 w-3.5 shrink-0 text-marine" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-navy">{d.requirement}</span>
              <span className="block truncate text-muted-foreground" title={d.fileName}>{d.fileName}</span>
            </span>
            <button type="button" onClick={() => void open(d.id)} disabled={busy !== null} title={`Buka ${d.fileName}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-marine px-1.5 py-0.5 text-[11px] font-semibold text-marine disabled:opacity-50">
              {busy === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />} Buka
            </button>
          </li>
        ))}
        {missing.map((m) => (
          <li key={m} className="truncate rounded-lg border border-dashed border-amber-300 px-2 py-1 text-[11px] text-amber-800">{m}: belum diunggah</li>
        ))}
      </ul>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
