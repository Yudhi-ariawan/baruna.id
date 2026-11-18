import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Save, Send, Undo2 } from "lucide-react";
import { getCmsDraft, getCmsOverview, saveCmsDraft, submitCmsDraft, withdrawCmsDraft } from "@/lib/cms/cms.functions";
import { cmsErrorText } from "@/lib/cms/cms-errors";
import { formErrors, menuErrors, pageErrors, type CmsFieldErrors } from "@/lib/cms/cms-validation";
import type { CmsDraft, CmsFormPayload, CmsMenuPayload, CmsOverview, CmsPagePayload, CmsPayload } from "@/lib/cms/cms-types";
import { FieldErrorSummary } from "@/components/baruna/forms/FieldError";
import { focusField } from "@/components/baruna/forms/field-errors";
import { PageDraftForm } from "@/components/governance/cms/PageDraftForm";
import { FormDraftForm } from "@/components/governance/cms/FormDraftForm";
import { MenuDraftForm } from "@/components/governance/cms/MenuDraftForm";
import { CmsDecisionPanel } from "@/components/governance/cms/CmsDecisionPanel";
import { CMS_QUERY_KEY, DRAFT_STATUS, KIND_LABEL, cmsDraftKey, fmtDate } from "@/components/governance/cms/cmsLabels";

export const Route = createFileRoute("/governance/cms/$draftId")({
  head: () => ({ meta: [{ title: "Draf Konten — Konsol Kurasi BARUNA" }] }),
  component: CmsDraftPage,
});

function CmsDraftPage() {
  const { draftId } = Route.useParams();
  const getDraft = useServerFn(getCmsDraft);
  const getOverview = useServerFn(getCmsOverview);
  const draftQ = useQuery({ queryKey: cmsDraftKey(draftId), queryFn: () => getDraft({ data: { id: draftId } }) });
  const overviewQ = useQuery({ queryKey: CMS_QUERY_KEY, queryFn: () => getOverview(), staleTime: 30_000 });
  return (
    <div className="space-y-5">
      <Link to="/governance/cms" className="inline-flex items-center gap-1 text-xs font-semibold text-marine hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Konten Situs (CMS)
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

/** Readable name of an error key, for the summary buttons. */
function errorLabel(key: string): string {
  const m = key.match(/^(block|field|menu)\.(\d+)\.(.+)$/);
  const base: Record<string, string> = { slug: "Alamat", title_id: "Judul", title_en: "Judul (Inggris)", summary_id: "Ringkasan", blocks: "Blok", fields: "Kolom", items: "Menu", max_per_user_per_day: "Batas per hari", description_id: "Deskripsi" };
  if (!m) return base[key] ?? key;
  const what = { block: "Blok", field: "Kolom", menu: "Menu" }[m[1] as "block"];
  return `${what} ${Number(m[2]) + 1}`;
}

function DraftEditor({ draft, overview }: { draft: CmsDraft; overview: CmsOverview }) {
  const qc = useQueryClient();
  const save = useServerFn(saveCmsDraft);
  const submit = useServerFn(submitCmsDraft);
  const withdraw = useServerFn(withdrawCmsDraft);
  const editable = draft.canEdit && (draft.status === "draft" || draft.status === "revision_requested");
  const [payload, setPayload] = useState<CmsPayload>(draft.payload);
  const [tried, setTried] = useState(false);
  const isNew = !draft.targetId;
  const formsOfDomain = useMemo(
    () => overview.forms.filter((f) => f.domain === draft.domain && f.status !== "archived").map((f) => ({ slug: f.slug, title: f.title })),
    [overview.forms, draft.domain],
  );
  const allErrors: CmsFieldErrors = useMemo(() => {
    if (draft.kind === "page") {
      return pageErrors(payload as CmsPagePayload, { isNew, usedSlugs: overview.pages.map((p) => p.slug), formSlugs: formsOfDomain.map((f) => f.slug) });
    }
    if (draft.kind === "form") return formErrors(payload as CmsFormPayload, { isNew, usedSlugs: overview.forms.map((f) => f.slug) });
    return menuErrors(payload as CmsMenuPayload);
  }, [draft.kind, payload, isNew, overview.pages, overview.forms, formsOfDomain]);
  const errors = editable && (tried || draft.problem) ? allErrors : {};
  const dirty = JSON.stringify(payload) !== JSON.stringify(draft.payload);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: cmsDraftKey(draft.id) });
    void qc.invalidateQueries({ queryKey: CMS_QUERY_KEY });
  };
  const saveM = useMutation({ mutationFn: () => save({ data: { id: draft.id, payload, expectedUpdatedAt: draft.updatedAt } }), onSuccess: refresh });
  const submitM = useMutation({
    mutationFn: async () => {
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
  const problemText = draft.problem ? cmsErrorText(draft.problem) : null;
  const error = (saveM.error ?? submitM.error ?? withdrawM.error) as Error | null;
  const canWithdraw = (draft.mine || draft.canDecide) && ["draft", "submitted", "revision_requested"].includes(draft.status);
  const labels = Object.fromEntries(Object.keys(errors).map((k) => [k, errorLabel(k)]));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-navy">{KIND_LABEL[draft.kind]} {draft.kind === "menu" ? "" : isNew ? "— baru" : "— perubahan"}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className={`rounded px-1.5 py-0.5 font-semibold ${status.tone}`}>{status.label}</span> · dibuat {draft.createdBy ?? "–"}
            {draft.mine ? " (Anda)" : ""} · diperbarui {fmtDate(draft.updatedAt)}
            {draft.baseVersion ? ` · dari versi tayang v${draft.baseVersion}` : ""}
          </p>
          {draft.decisionNote ? <p className="mt-1 text-xs italic text-muted-foreground">Catatan keputusan: “{draft.decisionNote}”</p> : null}
        </div>
        {canWithdraw ? (
          <button type="button" disabled={withdrawM.isPending}
            onClick={() => { if (window.confirm("Tarik draf ini? Konten tayang tidak berubah.")) withdrawM.mutate(); }}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy hover:bg-muted">
            <Undo2 className="h-3.5 w-3.5" /> Tarik draf
          </button>
        ) : null}
      </div>

      {draft.targetId || draft.kind === "menu" ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-xs text-sky-950">
          Versi yang tayang tetap dilihat pengunjung sampai draf ini disetujui orang lain.
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-white p-5">
        {draft.kind === "page" ? (
          <PageDraftForm value={payload as CmsPagePayload} onChange={setPayload} errors={errors} disabled={!editable} isNew={isNew}
            draftId={draft.id} forms={formsOfDomain} />
        ) : draft.kind === "form" ? (
          <FormDraftForm value={payload as CmsFormPayload} onChange={setPayload} errors={errors} disabled={!editable} isNew={isNew} />
        ) : (
          <MenuDraftForm value={payload as CmsMenuPayload} onChange={setPayload} errors={errors} disabled={!editable} />
        )}
        {editable ? (
          <div className="mt-5 space-y-2 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={!dirty || saveM.isPending} onClick={() => saveM.mutate()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-marine px-3 py-2 text-xs font-semibold text-marine hover:bg-marine/5 disabled:opacity-50">
                <Save className="h-3.5 w-3.5" /> Simpan draf
              </button>
              <button type="button" disabled={submitM.isPending} onClick={() => submitM.mutate()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-3 py-2 text-xs font-semibold text-white hover:bg-navy disabled:opacity-50">
                <Send className="h-3.5 w-3.5" /> Kirim untuk persetujuan
              </button>
              {dirty ? <span className="text-xs text-muted-foreground">Ada perubahan yang belum disimpan.</span> : null}
              {!dirty && problemText && !Object.keys(errors).length ? <span className="text-xs text-amber-800">Belum lengkap: {problemText}</span> : null}
            </div>
            <FieldErrorSummary errors={errors} labels={labels} />
          </div>
        ) : !draft.mine && (draft.status === "draft" || draft.status === "revision_requested") ? (
          <p className="mt-4 text-xs text-muted-foreground">Draf ini hanya bisa diubah pembuatnya.</p>
        ) : null}
        {error ? <p className="mt-2 text-xs text-destructive">{error.message}</p> : null}
      </section>

      {draft.status === "submitted" && draft.canDecide ? <CmsDecisionPanel draft={draft} problemText={problemText} /> : null}
      {draft.status === "submitted" && !draft.canDecide ? (
        <p className="text-xs text-muted-foreground">
          Menunggu keputusan {draft.kind === "menu" ? "Admin lain" : "Approver/Admin lain"} (pembuat draf tidak bisa memutuskan drafnya sendiri).
        </p>
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
