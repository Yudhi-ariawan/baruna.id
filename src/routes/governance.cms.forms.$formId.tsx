import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download } from "lucide-react";
import { exportCmsSubmissionsCsv, listCmsSubmissions, markCmsSubmission } from "@/lib/cms/cms.functions";
import { CMS_QUERY_KEY, fmtDate } from "@/components/governance/cms/cmsLabels";

export const Route = createFileRoute("/governance/cms/forms/$formId")({
  head: () => ({ meta: [{ title: "Kiriman Formulir — Konsol Kurasi BARUNA" }] }),
  component: SubmissionsPage,
});

type Filter = "new" | "reviewed" | "archived" | null;
const STATUS = { new: "Baru", reviewed: "Sudah ditinjau", archived: "Diarsipkan" } as const;

function SubmissionsPage() {
  const { formId } = Route.useParams();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>(null);
  const list = useServerFn(listCmsSubmissions);
  const mark = useServerFn(markCmsSubmission);
  const exportCsv = useServerFn(exportCmsSubmissionsCsv);
  const key = ["governance", "cms-submissions", formId, filter];
  const q = useQuery({ queryKey: key, queryFn: () => list({ data: { formId, status: filter } }) });
  const markM = useMutation({
    mutationFn: (v: { id: string; status: "new" | "reviewed" | "archived" }) => mark({ data: v }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["governance", "cms-submissions", formId] });
      void qc.invalidateQueries({ queryKey: CMS_QUERY_KEY });
    },
  });
  const csvM = useMutation({
    mutationFn: () => exportCsv({ data: { formId, status: filter } }),
    onSuccess: ({ filename, csv }) => {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    },
  });
  const fields = q.data?.form.fields ?? [];
  const show = (v: unknown) => (v === true ? "Ya" : v === false ? "Tidak" : v === null || v === undefined ? "" : String(v));

  return (
    <div className="space-y-5">
      <Link to="/governance/cms" className="inline-flex items-center gap-1 text-xs font-semibold text-marine hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Konten Situs (CMS)
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-navy">Kiriman: {q.data?.form.title ?? "…"}</h1>
          <p className="mt-1 text-xs text-muted-foreground">Berisi data pribadi pengirim. Hanya peninjau menu ini yang bisa membukanya.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={filter ?? ""} onChange={(e) => setFilter((e.target.value || null) as Filter)} className="rounded-lg border border-border px-2 py-1 text-xs">
            <option value="">Semua status</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button type="button" disabled={csvM.isPending || !q.data?.rows.length} onClick={() => csvM.mutate()}
            className="inline-flex items-center gap-1 rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> Ekspor CSV
          </button>
        </div>
      </header>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Memuat…</p> : null}
      {q.isError ? <p className="text-sm text-destructive">{(q.error as Error).message}</p> : null}
      {csvM.isError || markM.isError ? <p className="text-xs text-destructive">{((csvM.error ?? markM.error) as Error).message}</p> : null}
      {q.data && !q.data.rows.length ? <p className="text-sm text-muted-foreground">Belum ada kiriman{filter ? " dengan status ini" : ""}.</p> : null}
      {q.data?.rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Waktu</th><th className="px-3 py-2">Pengirim</th>
                {fields.map((f) => <th key={f.key} className="px-3 py-2">{f.label_id}</th>)}
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {q.data.rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2">{fmtDate(r.createdAt)}</td>
                  <td className="px-3 py-2"><p className="font-semibold text-navy">{r.submitter ?? "–"}</p><p className="text-muted-foreground">{r.submitterEmail}</p></td>
                  {fields.map((f) => <td key={f.key} className="max-w-xs whitespace-pre-wrap break-words px-3 py-2">{show(r.data[f.key])}</td>)}
                  <td className="px-3 py-2">
                    <select value={r.status} disabled={markM.isPending} onChange={(e) => markM.mutate({ id: r.id, status: e.target.value as "new" | "reviewed" | "archived" })}
                      className="rounded border border-border px-1 py-0.5 text-xs">
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
