// Data Master: one list of names a form offers (bidang keahlian, topik Knowledge Hub).
// Add, rename (only while unused), reorder, and activate/deactivate; the database
// enforces the same rules and writes the audit trail.
import { useState } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Pencil, Plus, Power, Save, X } from "lucide-react";

export type TaxonomyItem = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  displayOrder: number;
  /** Records that already use this name. */
  usage: number;
};

export type TaxonomySaveInput = { id: string | null; name: string; description: string | null; displayOrder: number | null };

type Props = {
  title: string;
  /** Explains where the list appears and what deactivating means. */
  intro: React.ReactNode;
  newLabel: string;
  newPlaceholder: string;
  /** Confirmation shown before deactivating, given the item name. */
  confirmDeactivate: (name: string) => string;
  items: TaxonomyItem[];
  save: (input: TaxonomySaveInput) => Promise<unknown>;
  setActive: (input: { id: string; active: boolean }) => Promise<unknown>;
  /** Queries to refresh after any change (console list and the form's options). */
  invalidate: QueryKey[];
};

export function TaxonomyMasterPanel(props: Props) {
  const { title, intro, items } = props;
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-white p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-navy">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{intro}</p>
      </div>
      <AddItem {...props} />
      <ul className="divide-y divide-border rounded-xl border border-border">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} {...props} />
        ))}
      </ul>
    </section>
  );
}

function useRefresh(keys: QueryKey[]) {
  const qc = useQueryClient();
  return () => keys.forEach((queryKey) => void qc.invalidateQueries({ queryKey }));
}

function AddItem({ newLabel, newPlaceholder, save, invalidate }: Props) {
  const refresh = useRefresh(invalidate);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const m = useMutation({
    mutationFn: () => save({ id: null, name, description: description.trim() || null, displayOrder: null }),
    onSuccess: () => {
      setName("");
      setDescription("");
      refresh();
    },
  });
  const valid = name.trim().length >= 2 && name.trim().length <= 120;
  return (
    <div className="grid gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="text-xs font-semibold text-navy">
        {newLabel}
        <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder={newPlaceholder}
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

function ItemRow({ item, save, setActive, invalidate, confirmDeactivate }: Props & { item: TaxonomyItem }) {
  const refresh = useRefresh(invalidate);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [order, setOrder] = useState(String(item.displayOrder));
  const saveM = useMutation({
    mutationFn: () => save({ id: item.id, name, description: description.trim() || null, displayOrder: Number(order) }),
    onSuccess: () => {
      setEditing(false);
      refresh();
    },
  });
  const toggle = useMutation({
    mutationFn: () => setActive({ id: item.id, active: !item.active }),
    onSuccess: refresh,
  });
  const orderValid = /^\d{1,6}$/.test(order) && Number(order) <= 100000;
  const error = (saveM.error ?? toggle.error) as Error | null;

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
          <button type="button" disabled={!orderValid || name.trim().length < 2 || saveM.isPending} onClick={() => saveM.mutate()}
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
                if (item.active && !window.confirm(confirmDeactivate(item.name))) return;
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
