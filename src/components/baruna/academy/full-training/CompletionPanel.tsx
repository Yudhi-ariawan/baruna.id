import { CheckCircle2, Circle, Award, FileText, BadgeCheck, Download, Medal, ScrollText, ExternalLink } from "lucide-react";
import { barunaToast } from "@/lib/downloads";
import {
  downloadCertificatePdf,
  openCertificatePdf,
  downloadBadgePng,
  downloadTranscriptPdf,
  type CertificateData,
  type TranscriptScores,
} from "@/lib/certificate";

export function CompletionPanel({ data, transcript }: { data: CertificateData; transcript: TranscriptScores }) {
  const onCertificate = () =>
    downloadCertificatePdf(data)
      .then(() => barunaToast("Certificate downloaded"))
      .catch(() => barunaToast("Could not generate the certificate"));
  const onBadge = () => {
    downloadBadgePng();
    barunaToast("Digital badge downloaded");
  };
  const onTranscript = () => {
    downloadTranscriptPdf(data, transcript);
    barunaToast("Transcript downloaded");
  };

  const rows: { label: string; value: string }[] = [
    { label: "Participant Name", value: data.name },
    ...(data.nip ? [{ label: "NIP / Nomor Identitas", value: data.nip }] : []),
    ...(data.workUnit ? [{ label: "Unit Kerja / Instansi", value: data.workUnit }] : []),
    { label: "Country", value: data.country || "Indonesia" },
    { label: "Program Title", value: data.program },
    { label: "Training Dates", value: data.dates },
    { label: "Certificate Number", value: data.certNo },
    { label: "Overall Score", value: `${transcript.overall}%` },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-badge-training/30 bg-badge-training/5 p-8 text-center shadow-soft sm:p-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-badge-training/15 text-badge-training">
          <Award className="h-8 w-8" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold text-navy">Congratulations!</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          You have successfully completed the International Training on Fisheries for African Countries.
          Your certificate, digital badge and learning transcript are ready below.
        </p>
      </div>

      {/* Certificate */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-marine" />
          <h3 className="font-display text-base font-bold text-navy">Digital Certificate</h3>
        </div>

        {data.photoUrl && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
            <img
              src={data.photoUrl}
              alt={data.name}
              className="h-14 w-11 rounded-md border border-navy/20 object-cover shadow-xs"
            />
            <div className="text-xs">
              <p className="font-bold text-navy">{data.name}</p>
              <p className="text-muted-foreground">{data.nip ? `NIP. ${data.nip}` : "Peserta Terdaftar"}</p>
              <p className="text-[11px] font-medium text-emerald-600">✓ Pas foto resmi tersemat otomatis pada sertifikat</p>
            </div>
          </div>
        )}

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="rounded-xl border border-border bg-background p-3">
              <dt className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{r.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-navy">{r.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={onCertificate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-marine px-6 py-3 text-sm font-semibold text-marine-foreground transition-all hover:-translate-y-0.5 hover:bg-marine/90 hover:shadow-hover"
          >
            <Download className="h-4 w-4" /> Download Certificate PDF
          </button>
          <button
            onClick={() => openCertificatePdf(data)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-marine bg-card px-5 py-3 text-sm font-semibold text-marine transition-all hover:bg-marine hover:text-white"
          >
            <ExternalLink className="h-4 w-4" /> Buka / Cetak di Tab Baru
          </button>
        </div>
      </div>

      {/* Badge + Transcript */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-marine" />
            <h3 className="font-display text-base font-bold text-navy">Digital Badge</h3>
          </div>
          <p className="mt-2 flex-1 text-sm text-muted-foreground">
            “International Fisheries Training Graduate” — share your achievement. Downloadable as PNG.
          </p>
          <button
            onClick={onBadge}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-marine bg-card px-5 py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
          >
            <Medal className="h-4 w-4" /> Download Badge PNG
          </button>
        </div>

        <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-marine" />
            <h3 className="font-display text-base font-bold text-navy">Learning Transcript</h3>
          </div>
          <p className="mt-2 flex-1 text-sm text-muted-foreground">
            Full record of your Pre-Test, module quizzes, Post-Test, Final Exam and overall score.
          </p>
          <button
            onClick={onTranscript}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-marine bg-card px-5 py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
          >
            <Download className="h-4 w-4" /> Download Transcript PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export function RequirementCard({ label, done, detail }: { label: string; done: boolean; detail: string }) {
  return (
    <div className={`rounded-2xl border p-5 text-center shadow-soft ${done ? "border-badge-training/30 bg-badge-training/5" : "border-border bg-card"}`}>
      <span className={`mx-auto grid h-11 w-11 place-items-center rounded-full ${done ? "bg-badge-training/15 text-badge-training" : "bg-muted text-muted-foreground"}`}>
        {done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
      </span>
      <p className="mt-3 font-display text-sm font-bold text-navy">{label}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
