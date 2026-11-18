// Lists of the CMS overview: drafts, pages, forms and the menu, with the actions the
// account may take (the server checks every action again).
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, FilePlus2, Inbox, Pencil } from "lucide-react";
import { openCmsDraft, setCmsStatus } from "@/lib/cms/cms.functions";
import { CMS_DOMAIN_LABEL, CMS_LANDING_PATH, type CmsDomain, type CmsOverview } from "@/lib/cms/cms-types";
import { CMS_QUERY_KEY, DRAFT_STATUS, KIND_LABEL, PAGE_STATUS, fmtDate } from "./cmsLabels";

const btn = "inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-navy hover:bg-muted disabled:opacity-40";

function useOpenDraft() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(openCmsDraft);
  return useMutation({
    mutationFn: (v: { kind: "page" | "form" | "menu"; targetId: string | null; domain: CmsDomain | null }) => fn({ data: v }),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: CMS_QUERY_KEY });
      void navigate({ to: "/governance/cms/$draftId", params: { draftId: id } });
    },
  });
}

function useStatus() {
  const qc = useQueryClient();
  const fn = useServerFn(setCmsStatus);
  return useMutation({
    mutationFn: (v: { kind: "page" | "form"; id: string; status: "published" | "on_hold" | "closed" | "archived"; reason: string }) => fn({ data: v }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CMS_QUERY_KEY }),
  });
}
const askReason = (q: string) => {
  const r = window.prompt(`${q}\nTuliskan alasannya (5–500 karakter):`);
  return r && r.trim().length >= 5 ? r.trim() : null;
};

export function CmsDrafts({ data }: { data: CmsOverview }) {
  const open = data.drafts.filter((d) => ["draft", "submitted", "revision_requested"].includes(d.status));
  if (!open.length) return <p className="text-xs text-muted-foreground">Tidak ada draf terbuka.</p>;
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
      {open.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy">{KIND_LABEL[d.kind]}: {d.title}</p>
            <p className="text-[11px] text-muted-foreground">
              {d.kind === "menu" ? "Menu navigasi" : CMS_DOMAIN_LABEL[d.domain as CmsDomain] ?? d.domain} · {d.createdBy ?? "–"}{d.mine ? " (Anda)" : ""} · {fmtDate(d.updatedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${DRAFT_STATUS[d.status].tone}`}>{DRAFT_STATUS[d.status].label}</span>
            <Link to="/governance/cms/$draftId" params={{ draftId: d.id }} className={btn}>
              <Pencil className="h-3 w-3" /> {d.status === "submitted" && !d.mine ? "Tinjau" : "Buka"}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CmsCreate({ data }: { data: CmsOverview }) {
  const [domain, setDomain] = useState<CmsDomain | "">(data.can.editDomains[0] ?? "");
  const open = useOpenDraft();
  if (!data.can.editDomains.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-marine/40 bg-white p-3">
      <span className="text-xs font-semibold text-navy">Buat baru untuk menu</span>
      <select value={domain} onChange={(e) => setDomain(e.target.value as CmsDomain)} className="rounded-lg border border-border px-2 py-1 text-xs">
        {data.can.editDomains.map((d) => <option key={d} value={d}>{CMS_DOMAIN_LABEL[d]}</option>)}
      </select>
      <button type="button" disabled={!domain || open.isPending} onClick={() => open.mutate({ kind: "page", targetId: null, domain: domain as CmsDomain })}
        className="inline-flex items-center gap-1 rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy disabled:opacity-50">
        <FilePlus2 className="h-3.5 w-3.5" /> Halaman baru
      </button>
      <button type="button" disabled={!domain || open.isPending} onClick={() => open.mutate({ kind: "form", targetId: null, domain: domain as CmsDomain })}
        className="inline-flex items-center gap-1 rounded-lg border border-marine px-3 py-1.5 text-xs font-semibold text-marine hover:bg-marine/5 disabled:opacity-50">
        <FilePlus2 className="h-3.5 w-3.5" /> Formulir baru
      </button>
      {open.isError ? <p className="w-full text-xs text-destructive">{(open.error as Error).message}</p> : null}
    </div>
  );
}

export function CmsPages({ data }: { data: CmsOverview }) {
  const open = useOpenDraft();
  const st = useStatus();
  if (!data.pages.length) return <p className="text-xs text-muted-foreground">Belum ada halaman CMS. Halaman menu masih memakai isi bawaan.</p>;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">Halaman</th><th className="px-3 py-2">Menu</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.pages.map((p) => {
              const path = p.slug === p.domain ? CMS_LANDING_PATH[p.domain] : `/p/${p.slug}`;
              const canEdit = data.can.editDomains.includes(p.domain) && p.status !== "archived";
              return (
                <tr key={p.id}>
                  <td className="px-3 py-2"><p className="font-semibold text-navy">{p.title}</p><p className="text-muted-foreground">{path} · v{p.version}</p></td>
                  <td className="px-3 py-2">{CMS_DOMAIN_LABEL[p.domain]}</td>
                  <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 font-semibold ${PAGE_STATUS[p.status].tone}`}>{PAGE_STATUS[p.status].label}</span>
                    {p.statusReason && p.status !== "published" ? <p className="mt-0.5 italic text-muted-foreground">{p.statusReason}</p> : null}</td>
                  <td className="px-3 py-2"><div className="flex flex-wrap gap-1">
                    {p.status === "published" ? <a href={path} target="_blank" rel="noreferrer" className={btn}><ExternalLink className="h-3 w-3" /> Lihat</a> : null}
                    {canEdit ? (
                      p.openDraftId
                        ? <Link to="/governance/cms/$draftId" params={{ draftId: p.openDraftId }} className={btn}><Pencil className="h-3 w-3" /> Draf terbuka</Link>
                        : <button type="button" className={btn} disabled={open.isPending} onClick={() => open.mutate({ kind: "page", targetId: p.id, domain: null })}><Pencil className="h-3 w-3" /> Ubah</button>
                    ) : null}
                    {data.can.publish && p.status === "published" ? <button type="button" className={btn} onClick={() => { const r = askReason("Turunkan sementara halaman ini?"); if (r) st.mutate({ kind: "page", id: p.id, status: "on_hold", reason: r }); }}>Turunkan</button> : null}
                    {data.can.publish && p.status === "on_hold" ? <button type="button" className={btn} onClick={() => { const r = askReason("Tayangkan lagi halaman ini?"); if (r) st.mutate({ kind: "page", id: p.id, status: "published", reason: r }); }}>Tayangkan lagi</button> : null}
                    {data.can.decide && p.status !== "archived" ? <button type="button" className={btn + " text-red-700"} onClick={() => { const r = askReason("Arsipkan halaman ini? Halaman hilang permanen dari situs."); if (r) st.mutate({ kind: "page", id: p.id, status: "archived", reason: r }); }}>Arsipkan</button> : null}
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open.isError || st.isError ? <p className="text-xs text-destructive">{((open.error ?? st.error) as Error).message}</p> : null}
    </div>
  );
}

export function CmsForms({ data }: { data: CmsOverview }) {
  const open = useOpenDraft();
  const st = useStatus();
  if (!data.forms.length) return <p className="text-xs text-muted-foreground">Belum ada formulir CMS.</p>;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">Formulir</th><th className="px-3 py-2">Menu</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.forms.map((f) => {
              const canEdit = data.can.editDomains.includes(f.domain) && f.status !== "archived";
              const canReview = data.can.reviewDomains.includes(f.domain);
              return (
                <tr key={f.id}>
                  <td className="px-3 py-2"><p className="font-semibold text-navy">{f.title}</p><p className="text-muted-foreground">/f/{f.slug} · v{f.version}</p></td>
                  <td className="px-3 py-2">{CMS_DOMAIN_LABEL[f.domain]}</td>
                  <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 font-semibold ${PAGE_STATUS[f.status].tone}`}>{PAGE_STATUS[f.status].label}</span></td>
                  <td className="px-3 py-2"><div className="flex flex-wrap gap-1">
                    {canReview ? <Link to="/governance/cms/forms/$formId" params={{ formId: f.id }} className={btn}><Inbox className="h-3 w-3" /> Kiriman{f.newSubmissions ? ` (${f.newSubmissions} baru)` : ""}</Link> : null}
                    {canEdit ? (
                      f.openDraftId
                        ? <Link to="/governance/cms/$draftId" params={{ draftId: f.openDraftId }} className={btn}><Pencil className="h-3 w-3" /> Draf terbuka</Link>
                        : <button type="button" className={btn} disabled={open.isPending} onClick={() => open.mutate({ kind: "form", targetId: f.id, domain: null })}><Pencil className="h-3 w-3" /> Ubah</button>
                    ) : null}
                    {data.can.publish && f.status === "published" ? <button type="button" className={btn} onClick={() => { const r = askReason("Tutup formulir ini (tidak menerima kiriman)?"); if (r) st.mutate({ kind: "form", id: f.id, status: "closed", reason: r }); }}>Tutup</button> : null}
                    {data.can.publish && f.status === "closed" ? <button type="button" className={btn} onClick={() => { const r = askReason("Buka lagi formulir ini?"); if (r) st.mutate({ kind: "form", id: f.id, status: "published", reason: r }); }}>Buka lagi</button> : null}
                    {data.can.decide && f.status !== "archived" ? <button type="button" className={btn + " text-red-700"} onClick={() => { const r = askReason("Arsipkan formulir ini?"); if (r) st.mutate({ kind: "form", id: f.id, status: "archived", reason: r }); }}>Arsipkan</button> : null}
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open.isError || st.isError ? <p className="text-xs text-destructive">{((open.error ?? st.error) as Error).message}</p> : null}
    </div>
  );
}

export function CmsMenu({ data }: { data: CmsOverview }) {
  const open = useOpenDraft();
  const items = data.menu.snapshot.items;
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-white p-4">
      <p className="text-xs text-muted-foreground">
        {items.length
          ? `Menu situs dari CMS, versi ${data.menu.version}: ${items.filter((i) => i.is_active).length} menu tampil.`
          : "Belum ada menu CMS. Situs memakai menu bawaan."}
      </p>
      {items.length ? (
        <ul className="flex flex-wrap gap-1.5 text-xs">
          {items.map((m, i) => <li key={i} className={`rounded-full border px-2 py-0.5 ${m.is_active ? "border-marine/40 text-navy" : "border-dashed text-muted-foreground line-through"}`}>{m.label_id}{m.children?.length ? ` (+${m.children.length})` : ""}</li>)}
        </ul>
      ) : null}
      {data.can.editMenu ? (
        data.menu.openDraftId
          ? <Link to="/governance/cms/$draftId" params={{ draftId: data.menu.openDraftId }} className={btn}><Pencil className="h-3 w-3" /> Draf menu terbuka</Link>
          : <button type="button" className={btn} disabled={open.isPending} onClick={() => open.mutate({ kind: "menu", targetId: null, domain: null })}><Pencil className="h-3 w-3" /> Ubah menu</button>
      ) : <p className="text-[11px] text-muted-foreground">Menu navigasi diubah oleh Admin (berlaku untuk seluruh situs).</p>}
      {open.isError ? <p className="text-xs text-destructive">{(open.error as Error).message}</p> : null}
    </div>
  );
}
