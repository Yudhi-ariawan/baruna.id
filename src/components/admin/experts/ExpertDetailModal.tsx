import { useState } from "react";
import { toast } from "sonner";
import {
  GraduationCap,
  Globe,
  Mail,
  Phone,
  ShieldCheck,
  FileText,
  ExternalLink,
  Eye,
  Download,
  AlertCircle,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  RotateCcw,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DocumentViewerModal } from "@/components/baruna/DocumentViewerModal";
import { triggerFileDownload } from "@/lib/storage/mime";
import type { AdminExpertDetail } from "@/lib/admin/experts.functions";
import { formatDate, formatBytes, getStatusBadge } from "./expertAdminUtils";

export interface ExpertDetailModalProps {
  subjectId: string;
  detail?: AdminExpertDetail | null;
  isLoading: boolean;
  onClose: () => void;
  onSuccess: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decisionFn: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  archiveFn: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unarchiveFn: any;
}

export function ExpertDetailModal({
  subjectId,
  detail,
  isLoading,
  onClose,
  onSuccess,
  decisionFn,
  archiveFn,
  unarchiveFn,
}: ExpertDetailModalProps) {
  const [rationale, setRationale] = useState("");
  const [rationaleError, setRationaleError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [submitting, setSubmitting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    name: string;
    category?: string;
  } | null>(null);

  const handleDecision = async (decision: "approve" | "return_for_revision" | "reject") => {
    setRationaleError(null);
    if ((decision === "return_for_revision" || decision === "reject") && !rationale.trim()) {
      const errMsg = "Wajib mengisi catatan evaluasi/alasan revisi agar calon expert mengetahui bagian yang perlu diperbaiki.";
      setRationaleError(errMsg);
      toast.error(errMsg);
      return;
    }

    const confirmMsg =
      decision === "approve"
        ? "Apakah Anda yakin ingin MENYETUJUI calon expert ini? Profil akan otomatis dipublikasikan ke Direktori Publik dan hak akses role expert akan diberikan."
        : decision === "return_for_revision"
          ? "Kembalikan berkas ini ke pemohon untuk perbaikan/revisi?"
          : "Apakah Anda yakin ingin MENOLAK pengajuan calon expert ini?";

    if (!window.confirm(confirmMsg)) return;

    try {
      setSubmitting(true);
      await decisionFn({
        data: {
          subjectId,
          decision,
          rationale: rationale.trim(),
        },
      });

      const label =
        decision === "approve"
          ? "Pengajuan disetujui & profil dipublikasikan!"
          : decision === "return_for_revision"
            ? "Permintaan revisi berhasil dikirim ke pendaftar."
            : "Pengajuan telah ditolak.";

      toast.success(label);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memproses keputusan verifikasi.";
      toast.error(msg);
      setRationaleError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    const reason = window.prompt(
      "Masukkan catatan/alasan pengarsipan pakar (opsional):",
      "Permintaan yang bersangkutan / Nonaktif sementara"
    );
    if (reason === null) return;

    try {
      setSubmitting(true);
      await archiveFn({
        data: {
          subjectId,
          rationale: reason.trim(),
        },
      });
      toast.success("Profil expert berhasil diarsipkan dan disembunyikan dari direktori publik.");
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengarsipkan expert.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnarchive = async () => {
    if (!window.confirm("Apakah Anda yakin ingin memulihkan pakar ini ke direktori publik?")) return;

    try {
      setSubmitting(true);
      await unarchiveFn({
        data: { subjectId },
      });
      toast.success("Profil expert berhasil dipulihkan dan kembali tayang di direktori publik.");
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memulihkan expert.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[96vw] sm:w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 md:p-8">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="rounded-xl bg-marine/10 p-2 text-marine shrink-0">
                <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <div>
                <DialogTitle className="text-base sm:text-xl font-bold text-navy leading-snug">
                  {isLoading ? "Memuat data kandidat..." : detail?.applicantName}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {detail?.jobTitle
                    ? `${detail.jobTitle} • ${detail.institution || "Independen"}`
                    : "Detail Pemeriksaan Calon Expert BARUNA"}
                </DialogDescription>
              </div>
            </div>
            {detail && <div>{getStatusBadge(detail.status)}</div>}
          </div>
        </DialogHeader>

        {isLoading || !detail ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-marine" />
            <p className="mt-2">Mengambil berkas dan kelengkapan kandidat...</p>
          </div>
        ) : (
          <>
            {detail?.status === "archived" && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 bg-slate-100 p-4 shadow-2xs">
                <div className="flex items-center gap-2.5 text-slate-800 text-xs sm:text-sm font-medium">
                  <Archive className="h-5 w-5 text-slate-600 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-900">Pakar Ini Sedang Diarsipkan (Hidden dari Publik)</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Profil ini tidak ditampilkan di direktori publik <em>Find Experts</em>. Seluruh riwayat modul dan sertifikat tetap aman.
                      {detail.archiveRationale && (
                        <span className="block italic mt-0.5 font-sans text-slate-700">Alasan: &quot;{detail.archiveRationale}&quot;</span>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={submitting}
                  onClick={handleUnarchive}
                  className="bg-navy hover:bg-navy/90 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <ArchiveRestore className="h-4 w-4" /> Pulihkan ke Direktori Publik
                </Button>
              </div>
            )}

            {detail?.status === "approved" && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Pengajuan Disetujui:</strong> Profil expert ini telah aktif dan dipublikasikan ke sistem.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={submitting}
                    onClick={handleArchive}
                    className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1"
                  >
                    <Archive className="h-3.5 w-3.5 text-slate-500" /> Arsipkan Pakar
                  </Button>
                  {detail.publishedSlug && (
                    <a
                      href={`/experts/${detail.publishedSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-700 transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Buka Profil Publik
                    </a>
                  )}
                </div>
              </div>
            )}

            {detail?.status === "resubmitted" && (
              <div className="mt-3 rounded-xl border border-sky-300 bg-sky-50/90 p-4 shadow-2xs">
                <div className="flex items-center gap-2 font-bold text-sky-950 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-200 text-sky-800 shrink-0">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </span>
                  Pengajuan Calon Expert Ini Sudah Direvisi
                  <Badge variant="outline" className="bg-sky-100 text-sky-800 border-sky-300 text-[10px] ml-auto">
                    Revisi Baru Siap Verifikasi
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs text-sky-900 leading-relaxed">
                  Calon expert telah memperbarui data dan mengunggah berkas perbaikan pada{" "}
                  <strong>{formatDate(detail.resubmittedAt || detail.updatedAt)}</strong>. Silakan periksa perubahan profil dan kelengkapan dokumen sebelum memberikan persetujuan (ACC).
                </p>
                {detail.lastRevisionRationale && (
                  <div className="mt-3 rounded-lg border border-sky-200 bg-white p-3 text-xs">
                    <span className="block font-semibold text-slate-800 text-[11px] uppercase tracking-wider mb-0.5">
                      Catatan Permintaan Revisi Sebelumnya (dari Verifikator):
                    </span>
                    <p className="italic text-slate-700">
                      &quot;{detail.lastRevisionRationale}&quot;
                    </p>
                  </div>
                )}
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-4 bg-slate-100 p-1 rounded-xl scrollbar-none whitespace-nowrap -mx-1 px-1 sm:mx-0 sm:px-1">
                <TabsTrigger value="profile" className="shrink-0 px-3 py-1.5 text-xs font-semibold">Biodata Diri</TabsTrigger>
                <TabsTrigger value="expertise" className="shrink-0 px-3 py-1.5 text-xs font-semibold">Keahlian &amp; Karir</TabsTrigger>
                <TabsTrigger value="documents" className="shrink-0 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5">
                  Lampiran Dokumen ({detail.documents.length})
                </TabsTrigger>
                <TabsTrigger value="decision" className="shrink-0 px-3 py-1.5 text-xs font-semibold text-marine">
                  Keputusan Verifikasi
                </TabsTrigger>
              </TabsList>

            {/* TAB 1: BIODATA */}
            <TabsContent value="profile" className="mt-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Nama Lengkap
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1">{detail.applicantName}</p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Jabatan / Gelar Profesional
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1">
                    {detail.jobTitle || "Tidak dicantumkan"}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Institusi / Lembaga / Afiliasi
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1">
                    {detail.institution || "Tidak dicantumkan"}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Negara Asal / Wilayah
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1 flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-marine" />
                    {detail.country || "Indonesia"}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Email Kontak
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1 flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-marine" />
                    {detail.email || "—"}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Nomor Telepon / WhatsApp
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1 flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-marine" />
                    {detail.phone || "—"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Ringkasan Profil / Biografi Singkat
                </span>
                <p className="text-sm text-foreground mt-2 whitespace-pre-line leading-relaxed">
                  {detail.biography || "Belum ada ringkasan biografi."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Pengalaman Kerja (Tahun)
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1">
                    {detail.yearsExperience ? `${detail.yearsExperience} Tahun` : "—"}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Bahasa yang Dikuasai
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1">
                    {detail.languages || "Bahasa Indonesia"}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: KEPARAKAN & KARIR */}
            <TabsContent value="expertise" className="mt-5 space-y-4">
              <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                <span className="text-xs font-semibold text-muted-foreground uppercase block mb-2">
                  Bidang Keahlian Utama
                </span>
                <div className="flex flex-wrap gap-2">
                  {detail.expertise.length > 0 ? (
                    detail.expertise.map((exp, idx) => (
                      <Badge
                        key={idx}
                        className="bg-marine/10 text-marine border-marine/20 px-3 py-1 text-xs font-medium"
                      >
                        {exp}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Tidak ada bidang keahlian dicantumkan.
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                <span className="text-xs font-semibold text-muted-foreground uppercase block mb-2">
                  Peran yang Diminati di BARUNA
                </span>
                <div className="flex flex-wrap gap-2">
                  {detail.roles.length > 0 ? (
                    detail.roles.map((r, idx) => (
                      <Badge
                        key={idx}
                        className="bg-navy/10 text-navy border-navy/20 px-3 py-1 text-xs font-medium"
                      >
                        {r}
                      </Badge>
                    ))
                  ) : (
                    <Badge className="bg-navy/10 text-navy border-navy/20">Trainer</Badge>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Proyek / Pengalaman Utama
                </span>
                <p className="text-sm text-foreground mt-2 whitespace-pre-line leading-relaxed">
                  {detail.keyProjects || "Tidak ada catatan proyek penting."}
                </p>
              </div>

              <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Publikasi Ilmiah / Riset / Buku Terkait
                </span>
                <p className="text-sm text-foreground mt-2 whitespace-pre-line leading-relaxed">
                  {detail.publications || "Tidak ada daftar publikasi."}
                </p>
              </div>
            </TabsContent>

            {/* TAB 3: DOKUMEN & BUKTI PENDUKUNG */}
            <TabsContent value="documents" className="mt-5 space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                <div>
                  <strong>Verifikasi Kelengkapan Bukti (PB-EXP-01):</strong>
                  <p className="mt-0.5 text-blue-800">
                    Periksa keabsahan CV, Sertifikat Kompetensi, atau Portofolio yang diunggah
                    pemohon. Klik tombol buka/unduh untuk memverifikasi keaslian dokumen di tab baru.
                  </p>
                </div>
              </div>

              {detail.documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Tidak ada lampiran berkas yang diunggah.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {detail.documents.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col justify-between rounded-xl border border-border bg-white p-4 shadow-2xs hover:border-marine/40 transition"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                            {doc.category}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatBytes(doc.size)}
                          </span>
                        </div>
                        <h4 className="mt-2 font-medium text-navy text-sm break-all line-clamp-2">
                          {doc.name}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Diunggah: {formatDate(doc.uploadedAt)}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2">
                        {doc.downloadUrl ? (
                          <>
                            <a
                              href={doc.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-marine/10 py-2 px-3 text-xs font-semibold text-marine hover:bg-marine hover:text-white transition"
                              title="Buka berkas langsung di tab peramban baru"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Buka di Tab
                            </a>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPreviewDoc({
                                  url: doc.downloadUrl!,
                                  name: doc.name,
                                  category: doc.category,
                                })
                              }
                              className="h-8 text-xs font-semibold border-border hover:bg-slate-100 text-navy gap-1"
                              title="Pratinjau cepat di dalam dialog"
                            >
                              <Eye className="h-3.5 w-3.5 text-marine" /> Pratinjau
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => triggerFileDownload(doc.downloadUrl!, doc.name)}
                              className="h-8 w-8 text-muted-foreground hover:text-navy hover:bg-slate-100"
                              title="Unduh langsung file asli"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Berkas tidak dapat diakses
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 4: KEPUTUSAN VERIFIKASI */}
            <TabsContent value="decision" className="mt-5 space-y-5">
              {detail.decisionsHistory && detail.decisionsHistory.length > 0 && (
                <div className="rounded-xl border border-border bg-slate-50 p-4">
                  <h4 className="text-xs font-bold text-navy uppercase tracking-wider mb-2">
                    Riwayat Keputusan Sebelumnya
                  </h4>
                  <div className="space-y-2">
                    {detail.decisionsHistory.map((hist) => (
                      <div
                        key={hist.id}
                        className="rounded-lg border border-border bg-white p-3 text-xs"
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className="capitalize">{hist.decision.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground">
                            {formatDate(hist.createdAt)}
                          </span>
                        </div>
                        {hist.rationale && (
                          <p className="mt-1 text-slate-600 italic">
                            &quot;{hist.rationale}&quot;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-white p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                    Catatan Evaluasi / Pertimbangan Admin (Rationale)
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Tuliskan catatan kelayakan, hasil verifikasi keahlian, atau rincian dokumen yang
                    harus diperbaiki jika meminta revisi.
                  </p>
                  <Textarea
                    rows={4}
                    placeholder="Contoh: Berkas CV dan sertifikat keahlian telah diverifikasi lengkap dan valid untuk bidang Budidaya Perikanan..."
                    value={rationale}
                    onChange={(e) => {
                      setRationale(e.target.value);
                      if (rationaleError) setRationaleError(null);
                    }}
                    className={`w-full text-sm ${rationaleError ? "border-destructive ring-1 ring-destructive" : ""}`}
                  />
                  {rationaleError && (
                    <p className="mt-1.5 text-xs font-semibold text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {rationaleError}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={submitting}
                    className="w-full sm:w-auto text-xs order-last sm:order-first py-2 sm:py-1.5"
                  >
                    Batal
                  </Button>

                  <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                    {detail?.status === "archived" ? (
                      <Button
                        type="button"
                        disabled={submitting}
                        onClick={handleUnarchive}
                        className="w-full sm:w-auto text-xs bg-navy hover:bg-navy/90 text-white font-semibold flex items-center justify-center gap-1.5 py-2.5 sm:py-2 shadow-xs"
                      >
                        <ArchiveRestore className="h-4 w-4 shrink-0" />
                        Pulihkan ke Direktori Publik
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={submitting}
                          onClick={() => handleDecision("reject")}
                          className="w-full sm:w-auto text-xs border-rose-300 text-rose-700 hover:bg-rose-50 flex items-center justify-center gap-1.5 py-2.5 sm:py-2"
                        >
                          <XCircle className="h-4 w-4 shrink-0" /> Tolak Pengajuan
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          disabled={submitting}
                          onClick={() => handleDecision("return_for_revision")}
                          className="w-full sm:w-auto text-xs border-amber-300 text-amber-700 hover:bg-amber-50 flex items-center justify-center gap-1.5 py-2.5 sm:py-2"
                        >
                          <RotateCcw className={`h-4 w-4 shrink-0 ${submitting ? "animate-spin" : ""}`} />
                          {submitting ? "Memproses..." : "Minta Revisi"}
                        </Button>

                        {(detail?.status === "approved" || detail?.isPublished) && (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={submitting}
                            onClick={handleArchive}
                            className="w-full sm:w-auto text-xs border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1.5 py-2.5 sm:py-2"
                          >
                            <Archive className="h-4 w-4 shrink-0 text-slate-500" /> Arsipkan Pakar
                          </Button>
                        )}

                        <Button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleDecision("approve")}
                          className="w-full sm:w-auto text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5 py-2.5 sm:py-2 shadow-xs"
                        >
                          <CheckCircle2 className={`h-4 w-4 shrink-0 ${submitting ? "animate-spin" : ""}`} />
                          {submitting
                            ? "Memproses..."
                            : detail?.status === "approved"
                              ? "Sinkronkan / Perbarui Publikasi"
                              : "Setujui & Publikasikan Expert"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          </>
        )}
        {previewDoc && (
          <DocumentViewerModal
            url={previewDoc.url}
            name={previewDoc.name}
            category={previewDoc.category}
            isOpen={Boolean(previewDoc)}
            onClose={() => setPreviewDoc(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

