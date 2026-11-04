import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Save, Send, Undo2 } from "lucide-react";
import {
  getProgramDraft,
  getProgramOverview,
  programErrorText,
  saveProgramDraft,
  submitProgramDraft,
  withdrawProgramDraft,
  type ProgramDraft,
  type ProgramOverview,
} from "@/lib/academy/programs.functions";
import { CourseDraftForm } from "@/components/governance/programs/CourseDraftForm";
import { OfferingDraftForm } from "@/components/governance/programs/OfferingDraftForm";
import { DraftDecisionPanel } from "@/components/governance/programs/DraftDecisionPanel";
import { DRAFT_STATUS, KIND_LABEL, PROGRAMS_QUERY_KEY, fmtDate } from "@/components/governance/programs/programLabels";

export const Route = createFileRoute("/governance/programs/$draftId")({
  head: () => ({ meta: [{ title: "Draf Program — Konsol Kurasi BARUNA" }] }),
  component: DraftPage,
});

function DraftPage() {
  const { draftId } = Route.useParams();
  const getDraft = useServerFn(getProgramDraft);
  const getOverview = useServerFn(getProgramOverview);
  const draftQ = useQuery({ queryKey: ["governance", "program-draft", draftId], queryFn: () => getDraft({ data: { id: draftId } }) });
  const overviewQ = useQuery({ queryKey: PROGRAMS_QUERY_KEY, queryFn: () => getOverview(), staleTime: 30_000 });

  return (
    <div className="space-y-5">
      <Link to="/governance/programs" className="inline-flex items-center gap-1 text-xs font-semibold text-marine hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Program Academy
      </Link>
      {draftQ.isLoading || overviewQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : draftQ.isError || overviewQ.isError ? (
        <p className="text-sm text-destructive">{((draftQ.error ?? overviewQ.error) as Error).message}</p>
      ) : draftQ.data && overviewQ.data ? (
        // Remount when the server copy changes, so the form never edits a stale payload.
        <DraftEditor key={draftQ.data.updatedAt} draft={draftQ.data} overview={overviewQ.data} />
      ) : null}
    </div>
  );
}

function DraftEditor({ draft, overview }: { draft: ProgramDraft; overview: ProgramOverview }) {
  const qc = useQueryClient();
  const save = useServerFn(saveProgramDraft);
  const submit = useServerFn(submitProgramDraft);
  const withdraw = useServerFn(withdrawProgramDraft);
  const [payload, setPayload] = useState(draft.payload);
  const editable = draft.mine && (draft.status === "draft" || draft.status === "revision_requested");
  const dirty = JSON.stringify(payload) !== JSON.stringify(draft.payload);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["governance", "program-draft", draft.id] });
    void qc.invalidateQueries({ queryKey: PROGRAMS_QUERY_KEY });
  };
  const saveM = useMutation({
    mutationFn: () => save({ data: { id: draft.id, payload, expectedUpdatedAt: draft.updatedAt } }),
    onSuccess: refresh,
  });
  const submitM = useMutation({
    mutationFn: async () => {
      if (dirty) await save({ data: { id: draft.id, payload, expectedUpdatedAt: draft.updatedAt } });
      await submit({ data: { id: draft.id } });
    },
    onSettled: refresh,
  });
  const withdrawM = useMutation({ mutationFn: () => withdraw({ data: { id: draft.id } }), onSuccess: refresh });
  const status = DRAFT_STATUS[draft.status];
  const problemText = draft.problem ? programErrorText(draft.problem) : null;
  const courseTitle = overview.courses.find((c) => c.id === draft.payload.master_course_id)?.title ?? null;
  const error = (saveM.error ?? submitM.error ?? withdrawM.error) as Error | null;
  const canWithdraw = (draft.mine || overview.canDecide) && ["draft", "submitted", "revision_requested"].includes(draft.status);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-navy">
            {KIND_LABEL[draft.kind]} {draft.targetId ? "— perubahan" : "— baru"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className={`rounded px-1.5 py-0.5 font-semibold ${status.tone}`}>{status.label}</span> · dibuat {draft.createdBy ?? "–"}
            {draft.mine ? " (Anda)" : ""} · diperbarui {fmtDate(draft.updatedAt)}
            {draft.baseVersion ? ` · dari versi tayang v${draft.baseVersion}` : ""}
          </p>
          {draft.decisionNote ? <p className="mt-1 text-xs italic text-muted-foreground">Catatan keputusan: “{draft.decisionNote}”</p> : null}
        </div>
        {canWithdraw ? (
          <button type="button" disabled={withdrawM.isPending}
            onClick={() => { if (window.confirm("Tarik draf ini? Data tayang tidak berubah.")) withdrawM.mutate(); }}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy hover:bg-muted">
            <Undo2 className="h-3.5 w-3.5" /> Tarik draf
          </button>
        ) : null}
      </div>

      {draft.targetId ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-xs text-sky-950">
          Versi yang tayang tetap dipakai peserta sampai draf ini disetujui. {draft.inUse ? "Data ini sudah dipakai peserta, jadi sebagian isian dikunci." : ""}
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-white p-5">
        {draft.kind === "master_course" ? (
          <CourseDraftForm value={payload} onChange={setPayload} lookups={overview.lookups} isNew={!draft.targetId}
            inUse={draft.inUse} disabled={!editable} />
        ) : (
          <OfferingDraftForm value={payload} onChange={setPayload} lookups={overview.lookups} isNew={!draft.targetId}
            inUse={draft.inUse} disabled={!editable} courseTitle={courseTitle} />
        )}
        {editable ? (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <button type="button" disabled={!dirty || saveM.isPending} onClick={() => saveM.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-marine px-3 py-2 text-xs font-semibold text-marine hover:bg-marine/5 disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> Simpan draf
            </button>
            <button type="button" disabled={submitM.isPending} onClick={() => submitM.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-3 py-2 text-xs font-semibold text-white hover:bg-navy disabled:opacity-50">
              <Send className="h-3.5 w-3.5" /> Kirim untuk persetujuan
            </button>
            {!dirty && problemText ? <span className="text-xs text-amber-800">Belum lengkap: {problemText}</span> : null}
            {dirty ? <span className="text-xs text-muted-foreground">Ada perubahan yang belum disimpan.</span> : null}
          </div>
        ) : !draft.mine && (draft.status === "draft" || draft.status === "revision_requested") ? (
          <p className="mt-4 text-xs text-muted-foreground">Draf ini hanya bisa diubah pembuatnya.</p>
        ) : null}
        {error ? <p className="mt-2 text-xs text-destructive">{error.message}</p> : null}
      </section>

      {draft.status === "submitted" && draft.canDecide ? <DraftDecisionPanel draft={draft} problemText={problemText} /> : null}
      {draft.status === "submitted" && !draft.canDecide ? (
        <p className="text-xs text-muted-foreground">Menunggu keputusan Approver/Admin lain (pembuat draf tidak bisa memutuskan drafnya sendiri).</p>
      ) : null}

      {draft.versions.length ? (
        <section className="rounded-2xl border border-border bg-white p-5">
          <h2 className="text-sm font-semibold text-navy">Riwayat versi</h2>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {draft.versions.map((v) => (
              <li key={v.version}>v{v.version} · disetujui {fmtDate(v.approvedAt)}{v.approvedBy ? ` oleh ${v.approvedBy}` : ""}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
