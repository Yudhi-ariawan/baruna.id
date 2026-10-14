import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/experts";
import { TRAINER_LEVELS, type TrainerLevel } from "@/lib/experts/trainer-application";
import {
  decideTrainerApplication,
  getTrainerApplicationFileUrl,
  type AdminTrainerApplication,
} from "@/lib/admin/trainer-applications.functions";

const STATUS_STYLE: Record<AdminTrainerApplication["status"], string> = {
  submitted: "bg-yellow-100 text-yellow-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-slate-100 text-slate-600",
};
const STATUS_TEXT: Record<AdminTrainerApplication["status"], string> = {
  submitted: "Menunggu Keputusan",
  approved: "Disetujui",
  rejected: "Ditolak",
  withdrawn: "Ditarik Pemohon",
};

export function TrainerApplicationReview({ app, onChanged }: { app: AdminTrainerApplication; onChanged: () => Promise<void> }) {
  const decide = useServerFn(decideTrainerApplication);
  const openFile = useServerFn(getTrainerApplicationFileUrl);
  const [level, setLevel] = useState<TrainerLevel>("certified");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const p = app.payload;

  const run = async (decision: "approve" | "reject") => {
    if (inFlight.current) return;
    if (decision === "reject" && note.trim().length < 5) {
      toast.error("Alasan penolakan wajib diisi (minimal 5 karakter).");
      return;
    }
    if (!window.confirm(decision === "approve" ? `Setujui ${app.expertName} sebagai trainer level ${level}?` : `Tolak pengajuan ${app.expertName}?`)) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await decide({ data: { applicationId: app.id, decision, level, note: note.trim() || undefined } });
      toast.success(decision === "approve" ? "Trainer disetujui dan diaktifkan." : "Pengajuan ditolak.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal menyimpan keputusan.");
    } finally {
      inFlight.current = false;
      setBusy(false);
      await onChanged();
    }
  };

  const open = async () => {
    try {
      const { url } = await openFile({ data: { applicationId: app.id } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal membuka berkas.");
    }
  };

  return (
    <article className="space-y-3 rounded-2xl border border-border bg-white p-4 shadow-2xs sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-navy">{app.expertName}</p>
          <p className="truncate text-xs text-muted-foreground">{app.expertHeadline || "—"} · {app.applicantEmail || "—"}</p>
          <p className="text-xs text-muted-foreground">
            Diajukan {formatDate(app.createdAt)} · Status trainer saat ini: <strong>{app.currentTrainerStatus ?? "belum ada"}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[app.status]}`}>{STATUS_TEXT[app.status]}</span>
          <a href={`/experts/${app.expertSlug}`} target="_blank" rel="noopener noreferrer" className="text-marine" title="Profil publik"><ExternalLink className="h-4 w-4" /></a>
        </div>
      </div>

      <details>
        <summary className="cursor-pointer text-xs font-semibold text-marine">Lihat isi pengajuan</summary>
        <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
          <Item label="Peran diajukan" value={p.proposedRoles?.join(", ")} wide />
          <Item label="Pengalaman melatih" value={p.trainingExperience} wide />
          <Item label="Bukti kompetensi mengajar" value={p.teachingEvidence} wide />
          <Item label="Pengembangan materi & asesmen" value={p.materialDevelopment} wide />
          <Item label="Topik modul" value={p.proposedModuleTopic} />
          <Item label="Target peserta" value={p.targetParticipants} />
          <Item label="Jam pembelajaran" value={String(p.instructionalHours ?? "")} />
          <Item label="Capaian pembelajaran" value={p.learningOutcomes} wide />
        </dl>
        <div className="mt-2 flex flex-wrap gap-2">
          {p.sampleMaterial && (
            <button type="button" onClick={() => void open()} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-marine hover:bg-muted">
              <Paperclip className="h-3 w-3" /> {p.sampleMaterial.name}
            </button>
          )}
          {p.sampleMaterialUrl && /^https?:\/\//i.test(p.sampleMaterialUrl) && (
            <a href={p.sampleMaterialUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-marine hover:bg-muted">
              <ExternalLink className="h-3 w-3" /> Tautan contoh materi
            </a>
          )}
        </div>
      </details>

      {app.status === "submitted" ? (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="font-semibold text-navy" htmlFor={`lvl-${app.id}`}>Level trainer:</label>
            <select id={`lvl-${app.id}`} value={level} onChange={(e) => setLevel(e.target.value as TrainerLevel)} className="rounded-lg border border-border px-2 py-1">
              {TRAINER_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={2} placeholder="Catatan keputusan (wajib untuk penolakan)" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marine/30" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void run("reject")} className="border-destructive/40 text-destructive">Tolak</Button>
            <Button size="sm" disabled={busy} onClick={() => void run("approve")} className="bg-navy text-white hover:bg-navy/90">{busy ? "Menyimpan…" : "Setujui & Aktifkan Trainer"}</Button>
          </div>
        </div>
      ) : (
        app.decidedAt && (
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            Diputuskan {formatDate(app.decidedAt)}{app.grantedLevel ? ` · level ${app.grantedLevel}` : ""}{app.decisionNote ? ` · "${app.decisionNote}"` : ""}
          </p>
        )
      )}
    </article>
  );
}

function Item({ label, value, wide }: { label: string; value?: string; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-navy">{value}</dd>
    </div>
  );
}
