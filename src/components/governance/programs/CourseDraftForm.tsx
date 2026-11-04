// Master Course draft form (PB-ACA-01): course fields and its Master Modules.
// Module order is the list order. When the course is already used by
// participants the module set is fixed (add/remove/code), only titles, hours and
// order can change - the database refuses anything else.
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { CoursePayload, ModulePayload, ProgramOverview } from "@/lib/academy/programs.functions";
import { CourseCoverField } from "@/components/governance/programs/CourseCoverField";

const input = "mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm disabled:bg-slate-50";
const label = "block text-xs font-semibold text-navy";

type Props = {
  draftId: string;
  value: CoursePayload;
  onChange: (next: CoursePayload) => void;
  lookups: ProgramOverview["lookups"];
  isNew: boolean;
  /** Course already used by participants: module set is fixed. */
  inUse: boolean;
  disabled: boolean;
};

export function CourseDraftForm({ draftId, value, onChange, lookups, isNew, inUse, disabled }: Props) {
  const modules = value.modules ?? [];
  const set = (patch: Partial<CoursePayload>) => onChange({ ...value, ...patch });
  const setModule = (i: number, patch: Partial<ModulePayload>) =>
    set({ modules: modules.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const move = (i: number, d: -1 | 1) => {
    const next = [...modules];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    set({ modules: next });
  };
  const totalHours = modules.reduce((n, m) => n + (Number(m.learning_hours) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Kode course {isNew ? "(tidak bisa diubah setelah disetujui)" : "(tetap)"}
          <input className={input} value={value.course_code ?? ""} disabled={disabled || !isNew} maxLength={80}
            onChange={(e) => set({ course_code: e.target.value.toLowerCase() })} placeholder="mis. seaweed-farming" />
        </label>
        <label className={label}>
          Judul
          <input className={input} value={value.title ?? ""} disabled={disabled} maxLength={200} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Deskripsi
          <textarea className={`${input} min-h-[90px]`} value={value.description ?? ""} disabled={disabled} maxLength={4000}
            onChange={(e) => set({ description: e.target.value })} />
        </label>
        <label className={label}>
          Bahasa
          <select className={input} value={value.language ?? ""} disabled={disabled} onChange={(e) => set({ language: e.target.value })}>
            <option value="">Pilih bahasa…</option>
            {lookups.languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </label>
        <label className={label}>
          Template pembelajaran
          <select className={input} value={value.learning_template_code ?? ""} disabled={disabled}
            onChange={(e) => set({ learning_template_code: e.target.value })}>
            <option value="">Pilih template…</option>
            {lookups.templates.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
          </select>
        </label>
        <CourseCoverField draftId={draftId} value={value.cover_path} disabled={disabled}
          onChange={(cover_path) => set({ cover_path })} />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-navy">Master Module ({modules.length}) · total {totalHours} jam</p>
          {inUse ? (
            <p className="text-xs text-amber-800">
              Course sudah dipakai peserta: modul tidak bisa ditambah, dihapus, atau diganti kodenya. Judul, jam, dan urutan tetap bisa diubah.
            </p>
          ) : null}
        </div>
        <ol className="space-y-2">
          {modules.map((m, i) => (
            <li key={i} className="grid gap-2 rounded-xl border border-border p-2.5 sm:grid-cols-[2.5rem_8rem_1fr_6rem_auto] sm:items-end">
              <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
              <label className={label}>
                Kode
                <input className={input} value={m.module_code} disabled={disabled || inUse} maxLength={30}
                  onChange={(e) => setModule(i, { module_code: e.target.value.toUpperCase() })} placeholder="SW-01" />
              </label>
              <label className={label}>
                Judul modul
                <input className={input} value={m.title} disabled={disabled} maxLength={200} onChange={(e) => setModule(i, { title: e.target.value })} />
              </label>
              <label className={label}>
                Jam
                <input className={input} inputMode="decimal" value={String(m.learning_hours ?? "")} disabled={disabled}
                  onChange={(e) => setModule(i, { learning_hours: e.target.value === "" ? (NaN as number) : Number(e.target.value.replace(",", ".")) })} />
              </label>
              <div className="flex gap-1">
                <button type="button" aria-label="Naikkan" disabled={disabled || i === 0} onClick={() => move(i, -1)}
                  className="rounded-lg border border-border p-1.5 disabled:opacity-40"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Turunkan" disabled={disabled || i === modules.length - 1} onClick={() => move(i, 1)}
                  className="rounded-lg border border-border p-1.5 disabled:opacity-40"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Hapus modul" disabled={disabled || inUse}
                  onClick={() => set({ modules: modules.filter((_, j) => j !== i) })}
                  className="rounded-lg border border-red-200 p-1.5 text-red-700 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
        </ol>
        {!disabled && !inUse ? (
          <button type="button" onClick={() => set({ modules: [...modules, { module_code: "", title: "", learning_hours: 1 }] })}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-marine px-3 py-1.5 text-xs font-semibold text-marine hover:bg-marine/5">
            <Plus className="h-3.5 w-3.5" /> Tambah modul
          </button>
        ) : null}
      </div>
    </div>
  );
}
