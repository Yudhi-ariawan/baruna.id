import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Download,
  Eye,
  ExternalLink,
  User,
  Building2,
  Globe2,
  Calendar,
  ShieldCheck,
  Clock,
  History,
  RotateCcw,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { BestPracticeStructurePreview } from "@/components/baruna/knowledge/BestPracticeStructureFields";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DocumentViewerModal } from "@/components/baruna/DocumentViewerModal";
import {
  recordAdminPublicationDecision,
  type AdminPublicationItem,
} from "@/lib/admin/publications.functions";

interface Props {
  item: AdminPublicationItem | null;
  isOpen: boolean;
  onClose: () => void;
  onDecisionSuccess?: () => void;
}

function formatBytes(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function AdminPublicationDetailModal({
  item,
  isOpen,
  onClose,
  onDecisionSuccess,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const recordDecision = useServerFn(recordAdminPublicationDecision);

  const [activeTab, setActiveTab] = useState<"detail" | "history">("detail");
  const [docViewerOpen, setDocViewerOpen] = useState(false);
  const [decisionMode, setDecisionMode] = useState<"none" | "approve" | "return_for_revision" | "reject">("none");
  const [rationale, setRationale] = useState("");

  const mutation = useMutation({
    mutationFn: async (vars: { decision: "approve" | "return_for_revision" | "reject"; rationale?: string }) => {
      if (!item) throw new Error("Item tidak ditemukan.");
      return recordDecision({
        data: {
          subjectId: item.subjectId,
          decision: vars.decision,
          rationale: vars.rationale,
        },
      });
    },
    onSuccess: (_, vars) => {
      if (vars.decision === "approve") {
        toast.success("Publikasi berhasil disetujui & ditayangkan di Knowledge Hub!");
      } else if (vars.decision === "return_for_revision") {
        toast.info("Catatan revisi berhasil dikirim ke kontributor.");
      } else {
        toast.success("Publikasi telah ditolak.");
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "publications"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-hub"] });
      void router.invalidate();
      setDecisionMode("none");
      setRationale("");
      onClose();
      onDecisionSuccess?.();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal memproses keputusan.");
    },
  });

  if (!item) return null;

  const handleActionClick = (mode: "approve" | "return_for_revision" | "reject") => {
    setDecisionMode(mode);
    setRationale(
      mode === "return_for_revision"
        ? "Mohon lengkapi naskah publikasi atau perbarui berkas dokumen pendukung."
        : mode === "reject"
          ? "Materi belum memenuhi standar kurasi Knowledge Hub BARUNA."
          : "",
    );
  };

  const handleConfirmDecision = () => {
    if (decisionMode === "none") return;
    mutation.mutate({
      decision: decisionMode,
      rationale: rationale.trim() || undefined,
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="border-b border-border p-6 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-marine text-marine font-semibold">
                {item.type}
              </Badge>
              <Badge
                className={
                  item.status === "approved"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : item.status === "revision_requested"
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : item.status === "rejected"
                        ? "bg-red-100 text-red-800 border-red-200"
                        : item.status === "resubmitted"
                          ? "bg-indigo-100 text-indigo-800 border-indigo-200 font-bold"
                          : "bg-blue-100 text-blue-800 border-blue-200"
                }
              >
                {item.status === "resubmitted" ? (
                  <span className="flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" />
                    {item.statusLabel}
                  </span>
                ) : (
                  item.statusLabel
                )}
              </Badge>
              {item.isPublished && (
                <Badge className="bg-marine text-white">Tayang Publik</Badge>
              )}
            </div>
            <DialogTitle className="mt-2 text-xl font-bold text-navy font-display leading-snug">
              {item.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
              <span>Diajukan pada: {formatDate(item.createdAt)}</span>
              <span>·</span>
              <span>Diperbarui: {formatDate(item.updatedAt)}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Subheader Tabs */}
          <div className="flex border-b border-border px-6">
            <button
              onClick={() => setActiveTab("detail")}
              className={`border-b-2 py-3 text-xs font-bold transition-colors ${
                activeTab === "detail"
                  ? "border-navy text-navy"
                  : "border-transparent text-muted-foreground hover:text-navy"
              }`}
            >
              Detail Naskah & Dokumen
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`ml-6 border-b-2 py-3 text-xs font-bold transition-colors ${
                activeTab === "history"
                  ? "border-navy text-navy"
                  : "border-transparent text-muted-foreground hover:text-navy"
              }`}
            >
              Riwayat Putusan ({item.decisionsHistory?.length || 0})
            </button>
          </div>

          <div className="p-6 space-y-6">
            {activeTab === "detail" ? (
              <>
                {/* Resubmitted Notification Alert */}
                {item.isResubmitted && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/90 p-4 text-xs text-indigo-950 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-100 text-indigo-700">
                        <RotateCcw className="h-4 w-4" />
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold text-sm text-indigo-900">
                            Revisi Telah Diajukan Ulang oleh Kontributor
                          </p>
                          {item.resubmittedAt && (
                            <span className="text-[11px] font-medium text-indigo-700">
                              {formatDate(item.resubmittedAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-indigo-800 leading-relaxed">
                          Kontributor/Trainer telah memperbarui naskah atau dokumen terlampir sesuai catatan revisi sebelumnya. Silakan tinjau kembali berkas dan informasi publikasi ini untuk memberikan keputusan persetujuan.
                        </p>
                        {item.lastRevisionRationale && (
                          <div className="mt-2 rounded-lg bg-white/90 border border-indigo-200/80 p-3 text-[11px] text-slate-700">
                            <span className="font-bold text-slate-900 block mb-0.5">
                              Catatan Revisi dari Admin Sebelumnya:
                            </span>
                            <p className="italic text-slate-700 leading-relaxed">
                              "{item.lastRevisionRationale}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {/* Contributor Info Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <h4 className="text-xs font-bold text-navy uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-marine" /> Profil Kontributor / Penulis
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Nama Penulis:</span>
                      <span className="font-semibold text-navy">{item.authorName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Institusi / Organisasi:</span>
                      <span className="font-semibold text-navy">{item.authorInstitution || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Negara:</span>
                      <span className="font-medium text-navy">{item.authorCountry || "Indonesia"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Tahun / Bahasa:</span>
                      <span className="font-medium text-navy">
                        {item.year || "—"} · {item.language || "Indonesian"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Abstract / Summary */}
                <div>
                  <h4 className="text-xs font-bold text-navy uppercase tracking-wider mb-2">
                    Abstrak / Deskripsi
                  </h4>
                  <div className="rounded-xl border border-border bg-white p-4 text-xs leading-relaxed text-foreground/90 whitespace-pre-line">
                    {item.abstract || "Tidak ada abstrak atau deskripsi yang disertakan."}
                  </div>
                </div>

                {/* Best Practice Structure (if applicable) */}
                {item.practiceStructure && (
                  <BestPracticeStructurePreview value={item.practiceStructure} />
                )}

                {/* Metadata Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-navy uppercase tracking-wider">Topik & Wilayah</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {item.topic && (
                        <Badge variant="secondary" className="text-xs">
                          {item.topic}
                        </Badge>
                      )}
                      {item.coverage && (
                        <Badge variant="outline" className="text-xs border-slate-300">
                          {item.coverage}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-navy uppercase tracking-wider">Lisensi & Akses</h4>
                    <p className="text-xs text-muted-foreground">
                      Lisensi: <strong className="text-navy">{item.license || "CC BY-NC 4.0"}</strong> · Akses:{" "}
                      <strong className="text-navy">{item.accessType || "Open Access"}</strong>
                    </p>
                  </div>
                </div>

                {/* Keywords */}
                {item.keywords.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-navy uppercase tracking-wider mb-2">Kata Kunci</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {item.keywords.map((kw, i) => (
                        <span
                          key={i}
                          className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700"
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attached File / Document */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-xs font-bold text-navy uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-marine" /> Dokumen Terlampir
                  </h4>

                  {item.fileInfo ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-marine/10 text-marine">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-navy">{item.fileInfo.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatBytes(item.fileInfo.size)} · Siap untuk ditinjau
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.fileInfo.downloadUrl ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDocViewerOpen(true)}
                              className="text-xs gap-1.5 font-semibold text-navy hover:bg-slate-100"
                            >
                              <Eye className="h-3.5 w-3.5 text-marine" />
                              Preview Dokumen
                            </Button>
                            <a
                              href={item.fileInfo.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-100 transition"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Unduh File
                            </a>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">URL berkas tidak tersedia</span>
                        )}
                      </div>
                    </div>
                  ) : item.externalUrl ? (
                    <div className="rounded-xl border border-border p-3 text-xs flex items-center justify-between">
                      <span className="text-muted-foreground truncate">Tautan Eksternal: {item.externalUrl}</span>
                      <a
                        href={item.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-marine hover:underline inline-flex items-center gap-1 font-semibold shrink-0"
                      >
                        Buka Tautan <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Tidak ada berkas yang diunggah.</p>
                  )}
                </div>

                {/* Banner / Cover Image */}
                {item.coverInfo && (
                  <div className="border-t border-border pt-4">
                    <h4 className="text-xs font-bold text-navy uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <ImageIcon className="h-4 w-4 text-marine" /> Foto Sampul / Banner
                    </h4>
                    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs space-y-3">
                      {item.coverInfo.downloadUrl ? (
                        <div className="relative h-44 w-full overflow-hidden rounded-lg bg-slate-900/10 border border-slate-200">
                          <img
                            src={item.coverInfo.downloadUrl}
                            alt="Cover Banner"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                        <span className="font-semibold text-navy truncate">{item.coverInfo.name}</span>
                        <span>{formatBytes(item.coverInfo.size)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Revision Rationale (if revision requested) */}
                {item.lastRevisionRationale && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                    <strong className="block font-bold mb-1 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-amber-600" /> Catatan Revisi Terakhir:
                    </strong>
                    <p>{item.lastRevisionRationale}</p>
                  </div>
                )}
              </>
            ) : (
              /* History Tab */
              <div className="space-y-3">
                {item.decisionsHistory && item.decisionsHistory.length > 0 ? (
                  item.decisionsHistory.map((h) => (
                    <div key={h.id} className="rounded-xl border border-border p-3 text-xs bg-white space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={
                            h.decision === "approve"
                              ? "text-emerald-700 border-emerald-300"
                              : h.decision === "return_for_revision"
                                ? "text-amber-700 border-amber-300"
                                : "text-red-700 border-red-300"
                          }
                        >
                          {h.decision === "approve"
                            ? "Disetujui"
                            : h.decision === "return_for_revision"
                              ? "Diminta Revisi"
                              : "Ditolak"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">{formatDate(h.createdAt)}</span>
                      </div>
                      {h.rationale && <p className="text-foreground/80 mt-1">{h.rationale}</p>}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    Belum ada riwayat keputusan kurasi untuk submisi ini.
                  </div>
                )}
              </div>
            )}

            {/* Decision Input Drawer (if active) */}
            {decisionMode !== "none" && (
              <div
                className={`rounded-xl border p-4 text-xs space-y-3 animate-in fade-in ${
                  decisionMode === "approve"
                    ? "border-emerald-200 bg-emerald-50/60"
                    : decisionMode === "return_for_revision"
                      ? "border-amber-200 bg-amber-50/60"
                      : "border-red-200 bg-red-50/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-navy flex items-center gap-1.5">
                    {decisionMode === "approve" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    {decisionMode === "return_for_revision" && <AlertCircle className="h-4 w-4 text-amber-600" />}
                    {decisionMode === "reject" && <XCircle className="h-4 w-4 text-red-600" />}
                    Konfirmasi Keputusan:{" "}
                    {decisionMode === "approve"
                      ? "Setujui & Publikasikan"
                      : decisionMode === "return_for_revision"
                        ? "Minta Revisi"
                        : "Tolak Publikasi"}
                  </h5>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDecisionMode("none")}
                    className="h-6 text-xs text-muted-foreground hover:text-navy"
                  >
                    Batal
                  </Button>
                </div>

                <p className="text-muted-foreground">
                  {decisionMode === "approve"
                    ? "Publikasi ini akan langsung berstatus 'Published' dan tayang di katalog Knowledge Hub publik."
                    : decisionMode === "return_for_revision"
                      ? "Kontributor akan menerima instruksi revisi dan dapat mengedit kembali draf serta mengunggah revisi."
                      : "Publikasi ini akan ditolak dari katalog BARUNA."}
                </p>

                <div>
                  <label className="block font-semibold text-navy mb-1">
                    {decisionMode === "return_for_revision"
                      ? "Catatan / Instruksi Revisi (Wajib Diisi):"
                      : "Catatan Evaluasi (Opsional):"}
                  </label>
                  <Textarea
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    placeholder={
                      decisionMode === "return_for_revision"
                        ? "Tuliskan poin-poin yang perlu diperbaiki kontributor..."
                        : "Tuliskan catatan pertimbangan..."
                    }
                    className="text-xs bg-white"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setDecisionMode("none")} className="text-xs">
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    disabled={mutation.isPending || (decisionMode === "return_for_revision" && !rationale.trim())}
                    onClick={handleConfirmDecision}
                    className={
                      decisionMode === "approve"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                        : decisionMode === "return_for_revision"
                          ? "bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                          : "bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                    }
                  >
                    {mutation.isPending ? "Memproses…" : "Simpan Keputusan"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border p-4 px-6 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <Button size="sm" variant="ghost" onClick={onClose} className="text-xs text-muted-foreground">
              Tutup
            </Button>

            {decisionMode === "none" && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleActionClick("return_for_revision")}
                  className="text-xs font-semibold text-amber-700 border-amber-300 hover:bg-amber-50"
                >
                  <AlertCircle className="h-3.5 w-3.5 mr-1" />
                  Minta Revisi
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleActionClick("reject")}
                  className="text-xs font-semibold text-red-700 border-red-300 hover:bg-red-50"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Tolak
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleActionClick("approve")}
                  className="text-xs font-bold bg-marine hover:bg-navy text-white shadow-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Setujui & Publikasikan
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embedded Document Viewer Modal for Reading PDF / Documents */}
      {item.fileInfo?.downloadUrl && (
        <DocumentViewerModal
          isOpen={docViewerOpen}
          onClose={() => setDocViewerOpen(false)}
          url={item.fileInfo.downloadUrl}
          name={item.fileInfo.name}
          category={item.type}
        />
      )}
    </>
  );
}

