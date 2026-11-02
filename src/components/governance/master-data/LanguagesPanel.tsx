// Data Master: languages offered on the Knowledge Hub, Request a Training and
// Become an Expert forms. The ISO code is set once (expert profiles reference it)
// and never changes; name, native name and order can be edited.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Power, Save, X } from "lucide-react";
import {
  getMasterLanguages,
  saveMasterLanguage,
  setMasterLanguageActive,
  type MasterLanguage,
} from "@/lib/governance/languages.functions";

const QUERY_KEY = ["governance", "master-data", "languages"];
const input = "mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm disabled:bg-slate-50";

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: QUERY_KEY });
    void qc.invalidateQueries({ queryKey: ["master", "language-options"] });
  };
}

export function LanguagesPanel() {
  const fn = useServerFn(getMasterLanguages);
  const q = useQuery({ queryKey: QUERY_KEY, queryFn: () => fn(), staleTime: 30_000 });
  const items = q.data ?? [];
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-white p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-navy">Bahasa</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Bahasa aktif ({items.filter((i) => i.active).length}) tampil di formulir Knowledge Hub, Request a Training, dan
          Become an Expert; publikasi dengan bahasa di luar daftar ditolak saat dikirim. Kode ISO tidak bisa diubah setelah
          dibuat. Bahasa yang sudah dipakai tidak bisa diganti namanya; menonaktifkan tidak mengubah data yang ada.
        </p>
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : (
        <>
          <AddLanguage />
          <ul className="divide-y divide-border rounded-xl border border-border">
            {items.map((item) => (
              <LanguageRow key={item.id} item={item} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function AddLanguage() {
  const refresh = useRefresh();
  const fn = useServerFn(saveMasterLanguage);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [native, setNative] = useState("");
  const m = useMutation({
    mutationFn: () => fn({ data: { id: null, code: code.trim().toLowerCase(), name, nativeName: native.trim() || null, displayOrder: null } }),
    onSuccess: () => {
      setCode("");
      setName("");
      setNative("");
      refresh();
    },
  });
  const codeOk = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(code.trim().toLowerCase());
  const valid = codeOk && name.trim().length >= 2;
  return (
    <div className="grid gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[7rem_1fr_1fr_auto] sm:items-end">
      <label className="text-xs font-semibold text-navy">
        Kode ISO
        <input value={code} maxLength={12} onChange={(e) => setCode(e.target.value)} placeholder="mis. sw" className={input} />
      </label>
      <label className="text-xs font-semibold text-navy">
        Nama (Inggris)
        <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="mis. Swahili" className={input} />
      </label>
      <label className="text-xs font-semibold text-navy">
        Nama asli (opsional)
        <input value={native} maxLength={80} onChange={(e) => setNative(e.target.value)} placeholder="mis. Kiswahili" className={input} />
      </label>
      <button type="button" disabled={!valid || m.isPending} onClick={() => m.mutate()}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-marine px-3 py-2 text-xs font-semibold text-white hover:bg-navy disabled:opacity-50">
        <Plus className="h-3.5 w-3.5" /> {m.isPending ? "Menyimpan…" : "Tambah"}
      </button>
      {code.trim() && !codeOk ? (
        <p className="text-xs text-destructive sm:col-span-4">Kode ISO 639: 2–3 huruf kecil, boleh dengan varian (mis. sw, fil, pt-br).</p>
      ) : null}
      {m.isError ? <p className="text-xs text-destructive sm:col-span-4">{(m.error as Error).message}</p> : null}
    </div>
  );
}

function LanguageRow({ item }: { item: MasterLanguage }) {
  const refresh = useRefresh();
  const saveFn = useServerFn(saveMasterLanguage);
  const activeFn = useServerFn(setMasterLanguageActive);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [native, setNative] = useState(item.nativeName ?? "");
  const [order, setOrder] = useState(String(item.displayOrder));
  const reset = () => { setEditing(false); setName(item.name); setNative(item.nativeName ?? ""); setOrder(String(item.displayOrder)); };
  const save = useMutation({
    mutationFn: () =>
      saveFn({ data: { id: item.id, code: item.code, name, nativeName: native.trim() || null, displayOrder: Number(order) } }),
    onSuccess: () => { setEditing(false); refresh(); },
  });
  const toggle = useMutation({ mutationFn: () => activeFn({ data: { id: item.id, active: !item.active } }), onSuccess: refresh });
  const orderValid = /^\d{1,6}$/.test(order) && Number(order) <= 100000;
  const error = (save.error ?? toggle.error) as Error | null;

  return (
    <li className="p-3 text-sm">
      {editing ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto_auto] sm:items-end">
          <label className="text-xs font-semibold text-navy">
            Nama ({item.code})
            <input value={name} maxLength={80} disabled={item.usage > 0} onChange={(e) => setName(e.target.value)}
              title={item.usage > 0 ? "Sudah dipakai: nama tidak bisa diganti" : undefined} className={input} />
          </label>
          <label className="text-xs font-semibold text-navy">
            Nama asli
            <input value={native} maxLength={80} onChange={(e) => setNative(e.target.value)} className={input} />
          </label>
          <label className="text-xs font-semibold text-navy">
            Urutan
            <input value={order} inputMode="numeric" onChange={(e) => setOrder(e.target.value)} className={input} />
          </label>
          <button type="button" disabled={!orderValid || name.trim().length < 2 || save.isPending} onClick={() => save.mutate()}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-marine px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> Simpan
          </button>
          <button type="button" onClick={reset}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-navy">
            <X className="h-3.5 w-3.5" /> Batal
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className={`font-semibold ${item.active ? "text-navy" : "text-muted-foreground line-through"}`}>
              {item.name}
              {item.nativeName && item.nativeName !== item.name ? <span className="font-normal text-muted-foreground"> · {item.nativeName}</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">
              Kode {item.code} · {item.active ? "Aktif" : "Nonaktif"} · urutan {item.displayOrder} · dipakai {item.usage}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-navy hover:bg-muted">
              <Pencil className="h-3.5 w-3.5" /> Ubah
            </button>
            <button type="button" disabled={toggle.isPending}
              onClick={() => {
                if (item.active && !window.confirm(`Nonaktifkan "${item.name}"? Bahasa ini tidak lagi ditawarkan di formulir; data yang sudah memakainya tidak berubah.`)) return;
                toggle.mutate();
              }}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${item.active ? "border border-slate-300 text-slate-700 hover:bg-slate-100" : "bg-emerald-600 text-white hover:bg-emerald-700"} disabled:opacity-50`}>
              <Power className="h-3.5 w-3.5" /> {item.active ? "Nonaktifkan" : "Aktifkan"}
            </button>
          </div>
        </div>
      )}
      {error ? <p className="mt-1 text-xs text-destructive">{error.message}</p> : null}
    </li>
  );
}
