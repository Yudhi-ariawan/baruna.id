// "View / download" buttons for the temporary certificate sheet (CATATAN_PERBAIKAN 2ap).
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eye, Loader2 } from "lucide-react";
import { getMyCertificateSheet } from "@/lib/learning/certificate-sheet.functions";
import { downloadCertificateSheet, openCertificateSheet } from "@/lib/learning/certificateSheet";

export function CertificateSheetActions({ certificateNumber }: { certificateNumber: string }) {
  const load = useServerFn(getMyCertificateSheet);
  const [busy, setBusy] = useState<"view" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "view" | "download") => {
    setError(null);
    setBusy(kind);
    try {
      const get = () => load({ data: { certificateNumber } });
      if (kind === "view") await openCertificateSheet(get);
      else await downloadCertificateSheet(await get());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void run("view")} disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
          {busy === "view" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Lihat sertifikat
        </button>
        <button type="button" onClick={() => void run("download")} disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-marine px-3 py-1.5 text-xs font-semibold text-marine disabled:opacity-60">
          {busy === "download" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Unduh PDF
        </button>
      </div>
      <p className="text-[0.7rem] text-muted-foreground">
        Lembar sementara (CONTOH / BELUM RESMI): belum ditandatangani pejabat berwenang. Keaslian dipastikan lewat tautan verifikasi.
      </p>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
