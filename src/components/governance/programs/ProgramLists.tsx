// Program Academy lists: drafts (the approval queue), Master Courses and Course
// Offerings. Opening an edit creates a draft; the live data changes only when a
// different approver approves that draft.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Lock, Pencil } from "lucide-react";
import {
  openProgramDraft,
  setProgramStatus,
  type ProgramKind,
  type ProgramOverview,
} from "@/lib/academy/programs.functions";
import { DRAFT_STATUS, KIND_LABEL, LEARNING_MODEL, LIVE_STATUS, PROGRAMS_QUERY_KEY, fmtDate } from "./programLabels";

const pill = (tone: string, text: string) => <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone}`}>{text}</span>;

function useOpenDraft() {
  const fn = useServerFn(openProgramDraft);
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (v: { kind: ProgramKind; targetId: string | null }) => fn({ data: v }),
    onSuccess: (id) => navigate({ to: "/governance/programs/$draftId", params: { draftId: id } }),
  });
}

export function NewProgramButtons() {
  const m = useOpenDraft();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={m.isPending} onClick={() => m.mutate({ kind: "master_course", targetId: null })}
        className="rounded-lg bg-marine px-3 py-2 text-xs font-semibold text-white hover:bg-navy disabled:opacity-50">+ Master Course baru</button>
      <button type="button" disabled={m.isPending} onClick={() => m.mutate({ kind: "course_offering", targetId: null })}
        className="rounded-lg border border-marine px-3 py-2 text-xs font-semibold text-marine hover:bg-marine/5 disabled:opacity-50">+ Course Offering baru</button>
      {m.isError ? <span className="text-xs text-destructive">{(m.error as Error).message}</span> : null}
    </div>
  );
}

export function DraftList({ drafts }: { drafts: ProgramOverview["drafts"] }) {
  const navigate = useNavigate();
  if (!drafts.length) return <p className="text-sm text-muted-foreground">Belum ada draf.</p>;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-white">
      {drafts.map((d) => (
        <li key={d.id}>
          <button type="button" onClick={() => navigate({ to: "/governance/programs/$draftId", params: { draftId: d.id } })}
            className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left hover:bg-muted/40">
            <div className="min-w-0">
              <p className="font-semibold text-navy">{d.title}</p>
              <p className="text-xs text-muted-foreground">
                {KIND_LABEL[d.kind]} · {d.targetId ? "perubahan" : "baru"} · oleh {d.createdBy ?? "–"}{d.mine ? " (Anda)" : ""} ·
                diperbarui {fmtDate(d.updatedAt)}
              </p>
              {d.decisionNote ? <p className="mt-0.5 text-xs italic text-muted-foreground">“{d.decisionNote}”</p> : null}
            </div>
            {pill(DRAFT_STATUS[d.status].tone, DRAFT_STATUS[d.status].label)}
          </button>
        </li>
      ))}
    </ul>
  );
}

function StatusAction({ kind, id, to, label, confirmText }: { kind: ProgramKind; id: string; to: string; label: string; confirmText: string }) {
  const qc = useQueryClient();
  const fn = useServerFn(setProgramStatus);
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (note: string) => fn({ data: { kind, id, status: to as "archived", note } }),
    onSuccess: () => { setErr(null); void qc.invalidateQueries({ queryKey: PROGRAMS_QUERY_KEY }); },
    onError: (e) => setErr((e as Error).message),
  });
  return (
    <span className="inline-flex flex-col">
      <button type="button" disabled={m.isPending}
        onClick={() => {
          const note = window.prompt(`${confirmText}\n\nTuliskan alasannya (5–500 karakter):`);
          if (note && note.trim().length >= 5) m.mutate(note.trim());
          else if (note !== null) setErr("Alasan minimal 5 karakter.");
        }}
        className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-navy hover:bg-muted disabled:opacity-50">{label}</button>
      {err ? <span className="mt-0.5 max-w-[16rem] text-[11px] text-destructive">{err}</span> : null}
    </span>
  );
}

function EditButton({ kind, id, openDraftId, disabled }: { kind: ProgramKind; id: string; openDraftId: string | null; disabled: boolean }) {
  const m = useOpenDraft();
  const navigate = useNavigate();
  if (disabled) return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Hanya baca</span>;
  return (
    <span className="inline-flex flex-col">
      <button type="button" disabled={m.isPending}
        onClick={() => (openDraftId ? navigate({ to: "/governance/programs/$draftId", params: { draftId: openDraftId } }) : m.mutate({ kind, targetId: id }))}
        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-navy hover:bg-muted disabled:opacity-50">
        <Pencil className="h-3.5 w-3.5" /> {openDraftId ? "Lihat draf" : "Ubah"}
      </button>
      {m.isError ? <span className="mt-0.5 max-w-[16rem] text-[11px] text-destructive">{(m.error as Error).message}</span> : null}
    </span>
  );
}

export function CourseList({ data }: { data: ProgramOverview }) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-white">
      {data.courses.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="font-semibold text-navy">{c.title} <span className="font-normal text-muted-foreground">· {c.code}</span></p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {pill((LIVE_STATUS[c.status] ?? LIVE_STATUS.active).tone, (LIVE_STATUS[c.status] ?? { label: c.status }).label)}
              v{c.version} · {c.moduleCount} modul · {c.offeringCount} offering
              {c.inUse ? pill("bg-sky-50 text-sky-700", "Sudah dipakai peserta") : null}
              {c.legacy ? pill("bg-slate-100 text-slate-600", "Program lama (isi di kode)") : null}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <EditButton kind="master_course" id={c.id} openDraftId={c.openDraftId} disabled={c.legacy || c.status === "archived"} />
            {data.canDecide && !c.legacy ? (
              c.status === "archived"
                ? <StatusAction kind="master_course" id={c.id} to="active" label="Aktifkan lagi" confirmText={`Aktifkan lagi "${c.title}"?`} />
                : <StatusAction kind="master_course" id={c.id} to="archived" label="Arsipkan" confirmText={`Arsipkan "${c.title}"? Course tidak bisa dipakai offering baru.`} />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function OfferingList({ data }: { data: ProgramOverview }) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-white">
      {data.offerings.map((o) => (
        <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="font-semibold text-navy">{o.title} <span className="font-normal text-muted-foreground">· {o.code}</span></p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {pill((LIVE_STATUS[o.status] ?? LIVE_STATUS.published).tone, (LIVE_STATUS[o.status] ?? { label: o.status }).label)}
              {o.courseTitle} · {o.year ?? "–"}{o.cohortName ? ` · ${o.cohortName}` : ""} · {o.deliveryMode ?? "–"}
              {o.learningModel ? ` · ${LEARNING_MODEL[o.learningModel as keyof typeof LEARNING_MODEL] ?? o.learningModel}` : ""}
              {o.inUse ? pill("bg-sky-50 text-sky-700", "Ada pendaftar") : null}
              {o.legacy ? pill("bg-slate-100 text-slate-600", "Program lama (isi di kode)") : null}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {o.path ? (
              <a href={o.path} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-navy hover:bg-muted">
                <ExternalLink className="h-3.5 w-3.5" /> Buka
              </a>
            ) : null}
            <EditButton kind="course_offering" id={o.id} openDraftId={o.openDraftId} disabled={o.legacy} />
            {data.canDecide && !o.legacy ? (
              o.status === "published" ? (
                <>
                  <StatusAction kind="course_offering" id={o.id} to="completed" label="Tandai selesai" confirmText={`Tandai "${o.title}" selesai?`} />
                  <StatusAction kind="course_offering" id={o.id} to="closed" label="Tutup" confirmText={`Tutup "${o.title}"?`} />
                </>
              ) : (
                <StatusAction kind="course_offering" id={o.id} to="published" label="Tayangkan lagi" confirmText={`Tayangkan lagi "${o.title}"?`} />
              )
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
