import { useMemo, useState } from "react";
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
import { cleanCode, courseFieldErrors, fieldLabel, offeringFieldErrors, type FieldErrors } from "@/components/governance/programs/programValidation";
import type { CoursePayload, OfferingPayload } from "@/lib/academy/programs.functions";

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
  const editable = draft.mine && (draft.status === "draft" || draft.status === "revision_requested");
  // Codes saved with hidden spaces/tabs (e.g. pasted) are tidied on open; the user only saves.
  const [payload, setPayload] = useState(() => (editable ? tidyCodes(draft.kind, draft.payload) : draft.payload));
  const tidied = editable && JSON.stringify(payload) !== JSON.stringify(draft.payload);
  const [tried, setTried] = useState(false);
  const allErrors: FieldErrors = useMemo(
    () =>
      draft.kind === "master_course"
        ? courseFieldErrors(payload as CoursePayload, {
            isNew: !draft.targetId,
            languages: overview.lookups.languages.map((l) => l.code.toLowerCase()),
            templates: overview.lookups.templates.map((t) => t.code),
          })
        : offeringFieldErrors(payload as OfferingPayload, { isNew: !draft.targetId }),
    [draft.kind, draft.targetId, overview.lookups, payload],
  );
  // Format mistakes show at once; empty required fields after a send attempt or once the server saw a problem.
  const showAll = tried || Boolean(draft.problem);
  const errors = editable ? (showAll ? allErrors : pickFormatErrors(allErrors, payload)) : {};
  const errorKeys = Object.keys(errors);
  const focusField = (key: string) => {
    const el = document.querySelector<HTMLElement>(`[data-field="${key}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus();
  };
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
      // Tell the user which field to fix instead of sending a draft the database will refuse.
      const keys = Object.keys(allErrors);
      if (keys.length) {
        setTried(true);
        setTimeout(() => focusField(keys[0]), 50);
        throw new Error(`Perbaiki ${keys.length} isian bertanda merah dulu.`);
      }
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
          <CourseDraftForm draftId={draft.id} value={payload} onChange={setPayload} lookups={overview.lookups} isNew={!draft.targetId}
            inUse={draft.inUse} disabled={!editable} errors={errors} />
        ) : (
          <OfferingDraftForm value={payload} onChange={setPayload} lookups={overview.lookups} isNew={!draft.targetId}
            inUse={draft.inUse} disabled={!editable} courseTitle={courseTitle} errors={errors} />
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
            {errorKeys.length === 0 && !dirty && problemText ? <span className="text-xs text-amber-800">Belum lengkap: {problemText}</span> : null}
            {dirty ? (
              <span className="text-xs text-muted-foreground">
                {tidied ? "Kode berisi spasi/Tab tersembunyi sudah dirapikan otomatis. " : ""}Ada perubahan yang belum disimpan.
              </span>
            ) : null}
            {errorKeys.length ? (
              <div className="w-full rounded-lg border border-red-200 bg-red-50/60 p-2 text-xs text-red-800">
                <p className="font-semibold">Perbaiki {errorKeys.length} isian bertanda merah (klik untuk menuju ke isiannya):</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {errorKeys.slice(0, 12).map((k) => (
                    <li key={k}>
                      <button type="button" onClick={() => focusField(k)} className="rounded border border-red-300 bg-white px-1.5 py-0.5 hover:bg-red-100">
                        {fieldLabel(k)}
                      </button>
                    </li>
                  ))}
                  {errorKeys.length > 12 ? <li>+{errorKeys.length - 12} lagi</li> : null}
                </ul>
              </div>
            ) : null}
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

/** Remove hidden whitespace and typographic dashes from saved codes. */
function tidyCodes(kind: ProgramDraft["kind"], p: ProgramDraft["payload"]): ProgramDraft["payload"] {
  if (kind === "master_course") {
    const c = p as CoursePayload;
    return {
      ...c,
      ...(c.course_code !== undefined ? { course_code: cleanCode(c.course_code ?? "", "lower") } : {}),
      modules: (c.modules ?? []).map((m) => ({ ...m, module_code: cleanCode(m.module_code ?? "", "upper") })),
    } as ProgramDraft["payload"];
  }
  const o = p as OfferingPayload;
  return (o.offering_code !== undefined ? { ...o, offering_code: cleanCode(o.offering_code ?? "", "lower") } : o) as ProgramDraft["payload"];
}

/** Before a send attempt: only mistakes in fields that already hold something. */
function pickFormatErrors(all: FieldErrors, payload: ProgramDraft["payload"]): FieldErrors {
  const p = payload as unknown as Record<string, unknown> & { modules?: Array<Record<string, unknown>> };
  const filled = (key: string) => {
    const m = key.match(/^module\.(\d+)\.(code|title|hours)$/);
    if (m) {
      const row = p.modules?.[Number(m[1])] ?? {};
      const v = row[{ code: "module_code", title: "title", hours: "learning_hours" }[m[2] as "code"]];
      return v !== undefined && v !== null && v !== "" && !(typeof v === "number" && Number.isNaN(v));
    }
    const v = p[key];
    return Array.isArray(v) ? v.some((x) => String(x).trim()) : v !== undefined && v !== null && v !== "";
  };
  return Object.fromEntries(Object.entries(all).filter(([k]) => filled(k)));
}
