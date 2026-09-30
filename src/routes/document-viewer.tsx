import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Download,
  ExternalLink,
  FileText,
  FileQuestion,
  Image as ImageIcon,
  Presentation,
  RotateCw,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getDocumentPreviewKind,
  resolveFileContentType,
  triggerFileDownload,
  type DocumentPreviewKind,
} from "@/lib/storage/mime";

export const Route = createFileRoute("/document-viewer")({
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search.url === "string" ? search.url : "",
    name: typeof search.name === "string" ? search.name : "Dokumen",
    category: typeof search.category === "string" ? search.category : "Dokumen",
  }),
  head: () => ({
    meta: [
      { title: "Pratinjau Dokumen — BARUNA Viewer" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DocumentViewerPage,
});

function DocumentViewerPage() {
  const { url, name, category } = Route.useSearch();
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isBlobLoading, setIsBlobLoading] = useState(false);

  useEffect(() => {
    if (name) {
      document.title = `${name} — BARUNA Viewer`;
    }
  }, [name]);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [officeEngine, setOfficeEngine] = useState<"google" | "office">("google");

  const kind: DocumentPreviewKind = getDocumentPreviewKind(name);
  const mimeType = resolveFileContentType(name);

  useEffect(() => {
    let active = true;
    if (!url) return;

    let createdBlobUrl: string | null = null;
    if (kind === "pdf" || kind === "image") {
      setIsBlobLoading(true);
      fetch(url)
        .then(async (res) => {
          if (!res.ok) throw new Error("Gagal mengunduh blob berkas.");
          const raw = await res.blob();
          if (!active) return;
          const typed = new Blob([raw], { type: mimeType });
          const obj = URL.createObjectURL(typed);
          createdBlobUrl = obj;
          setBlobUrl(obj);
        })
        .catch(() => {
          if (active) setBlobUrl(url);
        })
        .finally(() => {
          if (active) setIsBlobLoading(false);
        });
    } else {
      setBlobUrl(url);
    }

    return () => {
      active = false;
      if (createdBlobUrl && createdBlobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [url, kind, mimeType]);

  const activeUrl = blobUrl || url;

  const handleDownload = () => {
    triggerFileDownload(url, name);
  };

  if (!url) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <FileQuestion className="h-16 w-16 text-slate-500 mb-4" />
        <h1 className="text-xl font-bold">Dokumen Tidak Ditemukan</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-md">
          Tautan berkas dokumen tidak valid atau telah kedaluwarsa. Silakan buka kembali melalui
          portal administrasi BARUNA.
        </p>
        <Button
          onClick={() => window.close()}
          variant="outline"
          className="mt-6 border-slate-700 text-slate-200"
        >
          Tutup Tab Ini
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Header Navbar */}
      <header className="h-14 px-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.close()}
            className="text-slate-300 hover:text-white hover:bg-slate-800 gap-1.5 text-xs h-8 -ml-2"
            title="Tutup tab"
          >
            <ArrowLeft className="h-4 w-4" /> Tutup
          </Button>

          <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />

          {kind === "pdf" ? (
            <FileText className="h-5 w-5 text-rose-400 shrink-0" />
          ) : kind === "image" ? (
            <ImageIcon className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : kind === "office" ? (
            <Presentation className="h-5 w-5 text-amber-400 shrink-0" />
          ) : (
            <FileQuestion className="h-5 w-5 text-blue-400 shrink-0" />
          )}

          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white truncate max-w-md sm:max-w-xl">
              {name}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Badge className="bg-slate-800 text-slate-200 border-slate-700 text-[10px] uppercase font-bold py-0 px-1.5">
                {category}
              </Badge>
              <span>{mimeType}</span>
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {kind === "image" && (
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 mr-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-200 hover:bg-slate-700 hover:text-white"
                onClick={() => setZoom((z) => Math.max(z - 25, 25))}
                title="Perkecil"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] font-mono text-slate-300 w-10 text-center">{zoom}%</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-200 hover:bg-slate-700 hover:text-white"
                onClick={() => setZoom((z) => Math.min(z + 25, 300))}
                title="Perbesar"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-200 hover:bg-slate-700 hover:text-white"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                title="Putar 90 Derajat"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <Button
            size="sm"
            onClick={handleDownload}
            className="h-8 text-xs bg-marine hover:bg-marine/90 text-white gap-1.5 font-semibold shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Unduh Dokumen Asli</span>
          </Button>
        </div>
      </header>

      {/* Main Preview Area */}
      <main className="flex-1 w-full h-full relative overflow-hidden bg-slate-950 flex items-center justify-center">
        {isBlobLoading ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin text-marine" />
            <p className="text-sm font-medium">Memuat dan mendekode dokumen...</p>
          </div>
        ) : (
          <>
            {/* PDF View */}
            {kind === "pdf" && (
              <iframe
                src={`${activeUrl}#toolbar=1&navpanes=1`}
                title={name}
                className="w-full h-full border-0 bg-slate-900"
              />
            )}

            {/* Image View */}
            {kind === "image" && (
              <div className="w-full h-full overflow-auto flex items-center justify-center p-6">
                <img
                  src={activeUrl}
                  alt={name}
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transition: "transform 0.15s ease-out",
                  }}
                  className="max-h-[85vh] max-w-[90vw] object-contain rounded shadow-2xl select-none"
                />
              </div>
            )}

            {/* Office View */}
            {kind === "office" && (
              <div className="p-10 text-center max-w-lg bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl mx-auto my-auto">
                <div className="h-16 w-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
                  <Presentation className="h-8 w-8" />
                </div>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 uppercase text-[10px] font-bold px-2.5 py-0.5 mb-2">
                  Dokumen Microsoft Office
                </Badge>
                <h3 className="text-base font-bold text-white max-w-md mx-auto truncate" title={name}>
                  {name}
                </h3>
                <p className="text-xs text-slate-400 mt-2 mb-6 leading-relaxed max-w-sm mx-auto">
                  Berkas format Office ({mimeType.split("/").pop()}) paling optimal dibuka langsung menggunakan software desktop seperti Microsoft PowerPoint atau Word. Klik tombol di bawah untuk mengunduh berkas.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button
                    onClick={handleDownload}
                    className="w-full sm:w-auto bg-marine hover:bg-marine/90 text-white font-semibold text-xs gap-2 h-9 px-4 shadow-sm"
                  >
                    <Download className="h-4 w-4" /> Unduh Dokumen Sekarang
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                    className="w-full sm:w-auto border-slate-700 hover:bg-slate-800 text-slate-200 text-xs gap-2 h-9 px-4"
                  >
                    <ExternalLink className="h-4 w-4" /> Buka Tautan Asli
                  </Button>
                </div>
              </div>
            )}

            {/* Media Views */}
            {kind === "video" && (
              <div className="max-w-4xl p-6">
                <video src={activeUrl} controls className="max-h-[80vh] rounded-xl shadow-2xl" />
              </div>
            )}

            {kind === "audio" && (
              <div className="p-8 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl max-w-md w-full text-center">
                <h3 className="font-semibold text-white mb-4">{name}</h3>
                <audio src={activeUrl} controls className="w-full" />
              </div>
            )}

            {kind === "text" && (
              <iframe src={activeUrl} title={name} className="w-full h-full border-0 bg-white" />
            )}

            {/* Generic / Archive Fallback */}
            {(kind === "generic" || kind === "archive") && (
              <div className="p-10 text-center max-w-md bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl">
                <FileQuestion className="h-16 w-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white">{name}</h3>
                <p className="text-xs text-slate-400 mt-2 mb-6 leading-relaxed">
                  Berkas dengan format {mimeType} ini tidak mendukung pratinjau inline di peramban.
                  Klik tombol di bawah untuk mengunduh dan membukanya di komputer Anda.
                </p>
                <Button
                  onClick={handleDownload}
                  className="bg-marine hover:bg-marine/90 text-white font-semibold gap-2"
                >
                  <Download className="h-4 w-4" /> Unduh Dokumen Sekarang
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

