import React, { useState, useEffect } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  FileQuestion,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  Maximize2,
  Minimize2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  X,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getDocumentPreviewKind,
  resolveFileContentType,
  triggerFileDownload,
  type DocumentPreviewKind,
} from "@/lib/storage/mime";

export interface DocumentViewerProps {
  url: string;
  name: string;
  category?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentViewerModal({
  url,
  name,
  category = "Dokumen",
  isOpen,
  onClose,
}: DocumentViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isBlobLoading, setIsBlobLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [officeViewerType, setOfficeViewerType] = useState<"google" | "office">("google");

  const kind: DocumentPreviewKind = getDocumentPreviewKind(name);
  const mimeType = resolveFileContentType(name);

  // For images and PDFs, fetch blob and re-type it to ensure no corrupted Content-Type from Storage
  useEffect(() => {
    let active = true;
    if (!isOpen || !url) {
      setBlobUrl(null);
      setLoadError(null);
      return;
    }

    setZoom(100);
    setRotation(0);
    setLoadError(null);

    let createdObjectUrl: string | null = null;
    if (kind === "pdf" || kind === "image") {
      setIsBlobLoading(true);
      fetch(url)
        .then(async (res) => {
          if (!res.ok) throw new Error("Gagal mengunduh berkas pratinjau.");
          const rawBlob = await res.blob();
          if (!active) return;
          // Re-wrap blob with strictly resolved mime type so Chrome/Edge displays it natively
          const typedBlob = new Blob([rawBlob], { type: mimeType });
          const objectUrl = URL.createObjectURL(typedBlob);
          createdObjectUrl = objectUrl;
          setBlobUrl(objectUrl);
        })
        .catch((err) => {
          if (active) {
            // Fallback to direct signed url if fetch fails (e.g. CORS)
            setBlobUrl(url);
            setLoadError(err instanceof Error ? err.message : "Tidak dapat memuat blob");
          }
        })
        .finally(() => {
          if (active) setIsBlobLoading(false);
        });
    } else {
      setBlobUrl(url);
      setIsBlobLoading(false);
    }

    return () => {
      active = false;
      if (createdObjectUrl && createdObjectUrl.startsWith("blob:")) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [isOpen, url, kind, mimeType]);

  const handleDownload = () => {
    triggerFileDownload(url, name);
  };

  const handleOpenNewTab = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const activeUrl = blobUrl || url;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-900 border-slate-700 text-slate-100">
        {/* Top Navigation & Controls */}
        <DialogHeader className="p-3.5 px-5 bg-slate-800/95 border-b border-slate-700 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
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
              <DialogTitle className="text-sm font-semibold text-white truncate max-w-md sm:max-w-lg">
                {name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge className="bg-slate-700 text-slate-200 border-slate-600 text-[10px] uppercase font-bold tracking-wider py-0 px-1.5">
                  {category}
                </Badge>
                <span className="text-[11px] text-slate-400">{mimeType}</span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {kind === "image" && (
              <div className="flex items-center gap-1 bg-slate-700/60 rounded-lg p-0.5 mr-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-slate-200 hover:bg-slate-600 hover:text-white"
                  onClick={() => setZoom((z) => Math.max(z - 25, 25))}
                  title="Perkecil"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] font-mono text-slate-300 w-10 text-center">
                  {zoom}%
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-slate-200 hover:bg-slate-600 hover:text-white"
                  onClick={() => setZoom((z) => Math.min(z + 25, 300))}
                  title="Perbesar"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-slate-200 hover:bg-slate-600 hover:text-white"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  title="Putar 90 Derajat"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenNewTab}
              className="h-8 text-xs bg-slate-700/50 hover:bg-slate-700 border-slate-600 text-slate-200 gap-1.5 font-medium"
              title="Buka di tab peramban penuh"
            >
              <ExternalLink className="h-3.5 w-3.5 text-marine-light" />
              <span className="hidden sm:inline">Buka Tab Penuh</span>
            </Button>

            <Button
              size="sm"
              variant="default"
              onClick={handleDownload}
              className="h-8 text-xs bg-marine hover:bg-marine/90 text-white gap-1.5 font-medium shadow-xs"
              title="Unduh file ke komputer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Unduh Berkas</span>
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700 ml-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Viewer Content Area */}
        <div className="flex-1 w-full h-full relative overflow-hidden bg-slate-950 flex items-center justify-center">
          {isBlobLoading ? (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <RefreshCw className="h-7 w-7 animate-spin text-marine" />
              <p className="text-xs">Menyiapkan pratinjau dokumen...</p>
            </div>
          ) : (
            <>
              {/* PDF Preview */}
              {kind === "pdf" && (
                <iframe
                  src={`${activeUrl}#toolbar=1&navpanes=1`}
                  title={name}
                  className="w-full h-full border-0 bg-slate-900"
                />
              )}

              {/* Image Preview */}
              {kind === "image" && (
                <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                  <img
                    src={activeUrl}
                    alt={name}
                    style={{
                      transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                      transition: "transform 0.15s ease-out",
                    }}
                    className="max-h-[80vh] max-w-[85vw] object-contain rounded shadow-2xl select-none"
                  />
                </div>
              )}

              {/* Office Document Preview (Word, PowerPoint, Excel) */}
              {kind === "office" && (
                <div className="p-8 text-center max-w-lg bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl mx-auto my-auto">
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
                    Berkas format Office ({mimeType.split("/").pop()}) paling optimal dibuka langsung menggunakan software desktop seperti Microsoft PowerPoint atau Word. Klik tombol di bawah untuk mengunduh dan memeriksa berkas.
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
                      <ExternalLink className="h-4 w-4" /> Buka Langsung di Tab
                    </Button>
                  </div>
                </div>
              )}

              {/* Video Preview */}
              {kind === "video" && (
                <div className="max-w-4xl p-6 flex flex-col items-center">
                  <video src={activeUrl} controls className="max-h-[70vh] rounded-lg shadow-xl" />
                </div>
              )}

              {/* Audio Preview */}
              {kind === "audio" && (
                <div className="p-8 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl max-w-md w-full text-center">
                  <h4 className="font-semibold text-white text-sm mb-3">{name}</h4>
                  <audio src={activeUrl} controls className="w-full" />
                </div>
              )}

              {/* Text / Code Preview */}
              {kind === "text" && (
                <iframe src={activeUrl} title={name} className="w-full h-full border-0 bg-white" />
              )}

              {/* Generic / Archive Fallback */}
              {(kind === "generic" || kind === "archive") && (
                <div className="p-8 text-center max-w-md bg-slate-900 rounded-2xl border border-slate-800 shadow-xl">
                  <FileQuestion className="h-12 w-12 text-slate-500 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-white">{name}</h4>
                  <p className="text-xs text-slate-400 mt-1 mb-5">
                    Format file ini ({mimeType}) tidak dapat dipratinjau langsung di peramban. Anda
                    dapat mengunduh berkas aslinya untuk dibuka di komputer.
                  </p>
                  <Button
                    onClick={handleDownload}
                    className="bg-marine hover:bg-marine/90 text-white text-xs font-semibold gap-2"
                  >
                    <Download className="h-4 w-4" /> Unduh Dokumen Sekarang
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

