// Data Master: bidang keahlian offered on the Become an Expert form.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Power, Save, X } from "lucide-react";
import {
  saveMasterExpertise,
  setMasterExpertiseActive,
  type MasterExpertise,
} from "@/lib/governance/master-data.functions";

const refresh = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ["governance", "master-data"] });
  void qc.invalidateQueries({ queryKey: ["experts", "expertise-options"] });
};

export function ExpertiseMasterPanel({ items }: { items: MasterExpertise[] }) {
  const activeCount = items.filter((i) => i.active).length;
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-white p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-navy">Bidang Keahlian</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Bidang aktif ({activeCount}) tampil di formulir <em>Become an Expert</em>. Bidang yang sudah dipakai profil atau
          pengajuan tidak bisa diganti namanya (profil yang tayang menyimpan nama itu); nonaktifkan lalu buat bidang baru.
          Menonaktifkan tidak mengubah profil yang sudah ada.
        </p>
      </div>
      <AddExpertise />
      <ul className="divide-y divide-border rounded-xl border border-border">
        {items.map((item) => (
          <ExpertiseRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function AddExpertise() {
  const qc = useQueryClient();
  const fn = useServerFn(saveMasterExpertise);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const m = useMutation({
    mutationFn: () => fn({ data: { id: null, name, description: description.trim() || null, displayOrder: null } }),
    onSuccess: () => {
      setName("");
      setDescription("");
      refresh(qc);
    },
  });
  const valid = name.trim().length >= 2 && name.trim().length <= 120;
  return (
    <div className="grid gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="text-xs font-semibold text-navy">
        Bidang baru
        <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="mis. Seaweed Farming"
          className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm" />
      </label>
      <label className="text-xs font-semibold text-navy">
        Deskripsi (opsional)
        <input value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm" />
      </label>
      <button type="button" disabled={!valid || m.isPending} onClick={() => m.mutate()}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-marine px-3 py-2 text-xs font-semibold text-white hover:bg-navy disabled:opacity-50">
        <Plus className="h-3.5 w-3.5" /> {m.isPending ? "Menyimpan…" : "Tambah"}
      </button>
      {m.isError ? <p className="text-xs text-destructive sm:col-span-3">{(m.error as Error).message}</p> : null}
    </div>
  );
}

function ExpertiseRow({ item }: { item: MasterExpertise }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveMasterExpertise);
  const activeFn = useServerFn(setMasterExpertiseActive);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [order, setOrder] = useState(String(item.displayOrder));
  const save = useMutation({
    mutationFn: () =>
      saveFn({ data: { id: item.id, name, description: description.trim() || null, displayOrder: Number(order) } }),
    onSuccess: () => {
      setEditing(false);
      refresh(qc);
    },
  });
  const toggle = useMutation({
    mutationFn: () => activeFn({ data: { id: item.id, active: !item.active } }),
    onSuccess: () => refresh(qc),
  });
  const orderValid = /^\d{1,6}$/.test(order) && Number(order) <= 100000;
  const error = (save.error ?? toggle.error) as Error | null;

  return (
    <li className="p-3 text-sm">
      {editing ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto_auto] sm:items-end">
          <label className="text-xs font-semibold text-navy">
            Nama
            <input value={name} maxLength={120} disabled={item.usage > 0} onChange={(e) => setName(e.target.value)}
              title={item.usage > 0 ? "Sudah dipakai: nama tidak bisa diganti" : undefined}
              className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm disabled:bg-slate-50" />
          </label>
          <label className="text-xs font-semibold text-navy">
            Deskripsi
            <input value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs font-semibold text-navy">
            Urutan
            <input value={order} inputMode="numeric" onChange={(e) => setOrder(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm" />
          </label>
          <button type="button" disabled={!orderValid || name.trim().length < 2 || save.isPending} onClick={() => save.mutate()}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-marine px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> Simpan
          </button>
          <button type="button" onClick={() => { setEditing(false); setName(item.name); setDescription(item.description ?? ""); setOrder(String(item.displayOrder)); }}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-navy">
            <X className="h-3.5 w-3.5" /> Batal
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className={`font-semibold ${item.active ? "text-navy" : "text-muted-foreground line-through"}`}>{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {item.active ? "Aktif" : "Nonaktif"} · urutan {item.displayOrder} · dipakai {item.usage}
              {item.description ? ` · ${item.description}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-navy hover:bg-muted">
              <Pencil className="h-3.5 w-3.5" /> Ubah
            </button>
            <button type="button" disabled={toggle.isPending}
              onClick={() => {
                if (item.active && !window.confirm(`Nonaktifkan "${item.name}"? Bidang ini tidak lagi ditawarkan di formulir; profil yang sudah memakainya tidak berubah.`)) return;
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
