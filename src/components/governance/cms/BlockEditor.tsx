// Fields of one page block (content types of kurikulum 3.1). Keys of the error map
// follow cms-validation: "block.<i>.<field>" and "block.<i>.items.<j>.<field>".
import type { CmsBlock, CmsCard, CmsFaqItem, CmsLink, CmsPhoto, CmsStat } from "@/lib/cms/cms-types";
import { CmsBilingual, CmsImage, CmsText, RowTools } from "./CmsInputs";
import { moveItem, setAt } from "./cmsLabels";
import { FieldError } from "@/components/baruna/forms/FieldError";

const FORMAT_HINT = (
  <p className="text-[11px] text-muted-foreground">
    Format: **tebal**, *miring*, baris diawali "- " untuk daftar, [teks](https://alamat) atau [teks](/academy) untuk tautan. Setiap baris baru tetap tampil sebagai baris baru.
  </p>
);

type Props = {
  block: CmsBlock; index: number; onChange: (b: CmsBlock) => void; errors: Record<string, string>; disabled: boolean;
  draftId: string; forms: Array<{ slug: string; title: string }>;
};

export function BlockEditor({ block: b, index, onChange, errors, disabled, draftId, forms }: Props) {
  const k = (f: string) => `block.${index}.${f}`;
  const err = (f: string) => errors[k(f)];
  // Indonesian/English pair; the pair adds _id/_en to the field key itself.
  const bi = (label: string, f: string, multiline = false, required = false, maxLength?: number) => (
    <CmsBilingual label={label} field={k(f)} errors={errors}
      idValue={(b as Record<string, string>)[`${f}_id`]} enValue={(b as Record<string, string>)[`${f}_en`]}
      onId={(v) => onChange({ ...b, [`${f}_id`]: v } as CmsBlock)} onEn={(v) => onChange({ ...b, [`${f}_en`]: v } as CmsBlock)}
      disabled={disabled} multiline={multiline} required={required} maxLength={maxLength} />
  );
  const addBtn = (label: string, onClick: () => void, max: number, count: number) =>
    disabled ? null : (
      <button type="button" disabled={count >= max} onClick={onClick}
        className="rounded-lg border border-dashed border-marine px-2 py-1 text-xs font-semibold text-marine hover:bg-marine/5 disabled:opacity-40">
        + {label}
      </button>
    );

  switch (b.type) {
    case "banner": {
      const stats = b.stats ?? [];
      const setStats = (s: CmsStat[]) => onChange({ ...b, stats: s });
      return (
        <div className="space-y-3">
          {bi("Judul", "title", false, true, 160)}
          {bi("Teks", "text", true, false, 1000)}
          <CmsImage draftId={draftId} value={b.image} onChange={(p) => onChange({ ...b, image: p })} field={k("image")} error={err("image")} disabled={disabled} />
          <div className="space-y-2" data-field={k("stats")}>
            <p className="text-xs font-semibold text-navy">Angka (opsional, maksimal 4; isi hanya angka yang benar dan bisa dipertanggungjawabkan)</p>
            {stats.map((s, j) => (
              <div key={j} className="flex flex-wrap items-end gap-2">
                <div className="w-28"><CmsText label="Nilai" value={s.value} onChange={(v) => setStats(setAt(stats, j, { ...s, value: v }))} field={k(`stats.${j}.value`)} error={err(`stats.${j}.value`)} disabled={disabled} maxLength={30} /></div>
                <div className="min-w-40 flex-1"><CmsText label="Label (Indonesia)" value={s.label_id} onChange={(v) => setStats(setAt(stats, j, { ...s, label_id: v }))} field={k(`stats.${j}.label_id`)} error={err(`stats.${j}.label_id`)} disabled={disabled} maxLength={60} /></div>
                <div className="min-w-40 flex-1"><CmsText label="Label (Inggris)" value={s.label_en} onChange={(v) => setStats(setAt(stats, j, { ...s, label_en: v }))} field={k(`stats.${j}.label_en`)} disabled={disabled} maxLength={60} /></div>
                <RowTools disabled={disabled} onRemove={() => setStats(stats.filter((_, x) => x !== j))} />
              </div>
            ))}
            {addBtn("Angka", () => setStats([...stats, { value: "", label_id: "", label_en: "" }]), 4, stats.length)}
            <FieldError msg={err("stats")} />
          </div>
        </div>
      );
    }
    case "text":
      return (
        <div className="space-y-3">
          {bi("Judul bagian (opsional)", "heading", false, false, 160)}
          {bi("Isi", "body", true, true, 5000)}
          {FORMAT_HINT}
        </div>
      );
    case "media":
      return (
        <div className="space-y-3">
          {bi("Judul bagian (opsional)", "heading", false, false, 160)}
          {bi("Isi", "body", true, true, 5000)}
          {FORMAT_HINT}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
            <CmsImage draftId={draftId} value={b.image} onChange={(p) => onChange({ ...b, image: p })} field={k("image")} error={err("image")} disabled={disabled} />
            <label className="block text-xs font-semibold text-navy">
              Letak gambar
              <select value={b.image_side ?? "right"} disabled={disabled} onChange={(e) => onChange({ ...b, image_side: e.target.value as "left" | "right" })}
                className="mt-1 block rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm">
                <option value="right">Kanan teks</option>
                <option value="left">Kiri teks</option>
              </select>
            </label>
          </div>
        </div>
      );
    case "gallery": {
      const setItems = (items: CmsPhoto[]) => onChange({ ...b, items });
      return (
        <div className="space-y-3">
          {bi("Judul bagian (opsional)", "heading", false, false, 160)}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-field={k("items")}>
            {b.items.map((p, j) => {
              const pk = (f: string) => k(`items.${j}.${f}`);
              const set = (patch: Partial<CmsPhoto>) => setItems(setAt(b.items, j, { ...p, ...patch }));
              return (
                <div key={j} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between"><span className="text-xs font-semibold text-navy">Foto {j + 1}</span>
                    <RowTools disabled={disabled} onUp={j > 0 ? () => setItems(moveItem(b.items, j, j - 1)) : undefined}
                      onDown={j < b.items.length - 1 ? () => setItems(moveItem(b.items, j, j + 1)) : undefined}
                      onRemove={() => setItems(b.items.filter((_, x) => x !== j))} /></div>
                  <CmsImage draftId={draftId} value={p.image} onChange={(v) => set({ image: v })} field={pk("image")} error={errors[pk("image")]} disabled={disabled} />
                  <CmsBilingual label="Keterangan (opsional)" field={pk("caption")} errors={errors} idValue={p.caption_id} enValue={p.caption_en}
                    onId={(v) => set({ caption_id: v })} onEn={(v) => set({ caption_en: v })} disabled={disabled} maxLength={160} />
                </div>
              );
            })}
          </div>
          {addBtn("Foto", () => setItems([...b.items, { image: null, caption_id: "", caption_en: "" }]), 8, b.items.length)}
          <FieldError msg={err("items")} />
        </div>
      );
    }
    case "cards": {
      const setItems = (items: CmsCard[]) => onChange({ ...b, items });
      return (
        <div className="space-y-3">
          {bi("Judul bagian (opsional)", "heading", false, false, 160)}
          <div className="space-y-3" data-field={k("items")}>
            {b.items.map((c, j) => {
              const ck = (f: string) => k(`items.${j}.${f}`);
              const set = (patch: Partial<CmsCard>) => setItems(setAt(b.items, j, { ...c, ...patch }));
              return (
                <div key={j} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between"><span className="text-xs font-semibold text-navy">Kartu {j + 1}</span>
                    <RowTools disabled={disabled} onUp={j > 0 ? () => setItems(moveItem(b.items, j, j - 1)) : undefined}
                      onDown={j < b.items.length - 1 ? () => setItems(moveItem(b.items, j, j + 1)) : undefined}
                      onRemove={() => setItems(b.items.filter((_, x) => x !== j))} /></div>
                  <CmsBilingual label="Judul" field={ck("title")} errors={errors} idValue={c.title_id} enValue={c.title_en}
                    onId={(v) => set({ title_id: v })} onEn={(v) => set({ title_en: v })} disabled={disabled} required maxLength={160} />
                  <CmsBilingual label="Teks" field={ck("text")} errors={errors} idValue={c.text_id} enValue={c.text_en} multiline rows={2}
                    onId={(v) => set({ text_id: v })} onEn={(v) => set({ text_en: v })} disabled={disabled} maxLength={600} />
                  <CmsText label="Tautan (opsional)" value={c.url} onChange={(v) => set({ url: v })} field={ck("url")} error={errors[ck("url")]}
                    disabled={disabled} placeholder="/academy atau https://…" maxLength={500} />
                  <CmsImage draftId={draftId} value={c.image} onChange={(p) => set({ image: p })} field={ck("image")} error={errors[ck("image")]} disabled={disabled} />
                </div>
              );
            })}
            {addBtn("Kartu", () => setItems([...b.items, { title_id: "", title_en: "", text_id: "", text_en: "", image: null, url: "" }]), 12, b.items.length)}
            <FieldError msg={err("items")} />
          </div>
        </div>
      );
    }
    case "cta":
      return (
        <div className="space-y-3">
          {bi("Judul", "title", false, true, 160)}
          {bi("Teks (opsional)", "text", true, false, 600)}
          {bi("Teks tombol", "button", false, true, 60)}
          <CmsText label="Tautan tombol" required value={b.url} onChange={(v) => onChange({ ...b, url: v })} field={k("url")} error={err("url")}
            disabled={disabled} placeholder="/academy atau https://…" maxLength={500} />
        </div>
      );
    case "faq": {
      const setItems = (items: CmsFaqItem[]) => onChange({ ...b, items });
      return (
        <div className="space-y-3">
          {bi("Judul bagian (opsional)", "heading", false, false, 160)}
          <div className="space-y-3" data-field={k("items")}>
            {b.items.map((q, j) => {
              const qk = (f: string) => k(`items.${j}.${f}`);
              const set = (patch: Partial<CmsFaqItem>) => setItems(setAt(b.items, j, { ...q, ...patch }));
              return (
                <div key={j} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between"><span className="text-xs font-semibold text-navy">Pertanyaan {j + 1}</span>
                    <RowTools disabled={disabled} onUp={j > 0 ? () => setItems(moveItem(b.items, j, j - 1)) : undefined}
                      onDown={j < b.items.length - 1 ? () => setItems(moveItem(b.items, j, j + 1)) : undefined}
                      onRemove={() => setItems(b.items.filter((_, x) => x !== j))} /></div>
                  <CmsBilingual label="Pertanyaan" field={qk("q")} errors={errors} idValue={q.q_id} enValue={q.q_en}
                    onId={(v) => set({ q_id: v })} onEn={(v) => set({ q_en: v })} disabled={disabled} required maxLength={300} />
                  <CmsBilingual label="Jawaban" field={qk("a")} errors={errors} idValue={q.a_id} enValue={q.a_en} multiline
                    onId={(v) => set({ a_id: v })} onEn={(v) => set({ a_en: v })} disabled={disabled} required maxLength={2000} />
                </div>
              );
            })}
            {addBtn("Pertanyaan", () => setItems([...b.items, { q_id: "", q_en: "", a_id: "", a_en: "" }]), 20, b.items.length)}
            <FieldError msg={err("items")} />
          </div>
        </div>
      );
    }
    case "links": {
      const setItems = (items: CmsLink[]) => onChange({ ...b, items });
      return (
        <div className="space-y-3">
          {bi("Judul bagian (opsional)", "heading", false, false, 160)}
          <div className="space-y-2" data-field={k("items")}>
            {b.items.map((l, j) => {
              const lk = (f: string) => k(`items.${j}.${f}`);
              const set = (patch: Partial<CmsLink>) => setItems(setAt(b.items, j, { ...l, ...patch }));
              return (
                <div key={j} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-40 flex-1"><CmsText label="Label (Indonesia)" required value={l.label_id} onChange={(v) => set({ label_id: v })} field={lk("label_id")} error={errors[lk("label_id")]} disabled={disabled} maxLength={160} /></div>
                  <div className="min-w-40 flex-1"><CmsText label="Label (Inggris)" value={l.label_en} onChange={(v) => set({ label_en: v })} field={lk("label_en")} disabled={disabled} maxLength={160} /></div>
                  <div className="min-w-52 flex-1"><CmsText label="Tautan" required value={l.url} onChange={(v) => set({ url: v })} field={lk("url")} error={errors[lk("url")]} disabled={disabled} placeholder="/help atau https://…" maxLength={500} /></div>
                  <RowTools disabled={disabled} onUp={j > 0 ? () => setItems(moveItem(b.items, j, j - 1)) : undefined}
                    onDown={j < b.items.length - 1 ? () => setItems(moveItem(b.items, j, j + 1)) : undefined}
                    onRemove={() => setItems(b.items.filter((_, x) => x !== j))} />
                </div>
              );
            })}
            {addBtn("Tautan", () => setItems([...b.items, { label_id: "", label_en: "", url: "" }]), 20, b.items.length)}
            <FieldError msg={err("items")} />
          </div>
        </div>
      );
    }
    case "form":
      return (
        <label className="block text-xs font-semibold text-navy" data-field={k("form_slug")}>
          Formulir yang ditampilkan
          <select value={b.form_slug} disabled={disabled} onChange={(e) => onChange({ ...b, form_slug: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm">
            <option value="">— pilih formulir —</option>
            {forms.map((f) => <option key={f.slug} value={f.slug}>{f.title} (/f/{f.slug})</option>)}
          </select>
          {forms.length === 0 ? <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">Belum ada formulir tayang di menu ini. Buat formulir dulu.</span> : null}
          <FieldError msg={err("form_slug")} />
        </label>
      );
  }
}
