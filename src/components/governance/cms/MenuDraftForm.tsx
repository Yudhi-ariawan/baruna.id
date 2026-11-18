// Menu Builder: the site's top menu and one level of submenus (order, on/off,
// internal or external address, Indonesian/English label).
import { CMS_MENU_ICONS, type CmsMenuIcon, type CmsMenuItem, type CmsMenuPayload } from "@/lib/cms/cms-types";
import { FieldError } from "@/components/baruna/forms/FieldError";
import { CmsText, RowTools } from "./CmsInputs";
import { moveItem, setAt } from "./cmsLabels";

const ICON_LABEL: Record<CmsMenuIcon, string> = {
  home: "Beranda", academy: "Academy", knowledge: "Knowledge Hub", experts: "Experts", fellowship: "Fellowship",
  community: "Community", events: "Events", partnership: "Partnership", about: "About", link: "Tautan",
};
const newItem = (): CmsMenuItem => ({ label_id: "", label_en: "", href: "/", is_external: false, is_active: true, icon: null, children: [] });
/** The menu the site shows today (Navbar navItems + nav.* labels), as a starting point. */
const BUILT_IN: Array<[string, string, string, CmsMenuIcon]> = [
  ["Beranda", "Home", "/", "home"],
  ["Akademi", "Academy", "/academy", "academy"],
  ["Pusat Pengetahuan", "Knowledge Hub", "/knowledge-hub", "knowledge"],
  ["Tenaga Ahli", "Experts", "/experts", "experts"],
  ["Pertukaran & Beasiswa", "Fellowship & Exchange", "/fellowship", "fellowship"],
  ["Komunitas", "Community", "/community", "community"],
  ["Agenda & Acara", "Events", "/events", "events"],
  ["Kemitraan", "Partnership", "/partnership", "partnership"],
  ["Tentang BARUNA", "About BARUNA", "/about", "about"],
];

function ItemFields({ item, onChange, k, errors, disabled, withIcon }: {
  item: CmsMenuItem; onChange: (m: CmsMenuItem) => void; k: string; errors: Record<string, string>; disabled: boolean; withIcon: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_1.4fr_auto]">
      <CmsText label="Label (Indonesia)" required value={item.label_id} field={`${k}.label_id`} error={errors[`${k}.label_id`]} disabled={disabled} maxLength={40}
        onChange={(v) => onChange({ ...item, label_id: v })} />
      <CmsText label="Label (Inggris)" value={item.label_en} field={`${k}.label_en`} error={errors[`${k}.label_en`]} disabled={disabled} maxLength={40}
        onChange={(v) => onChange({ ...item, label_en: v })} />
      <CmsText label="Alamat" required value={item.href} field={`${k}.href`} error={errors[`${k}.href`]} disabled={disabled} maxLength={500}
        placeholder="/academy atau https://…"
        onChange={(v) => onChange({ ...item, href: v.trim(), is_external: /^https:\/\//i.test(v.trim()) })}
        hint={item.is_external ? "Situs lain (dibuka di tab baru)." : "Halaman di BARUNA."} />
      <div className="flex flex-col gap-1 pt-4 text-xs font-semibold text-navy">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={item.is_active} disabled={disabled} onChange={(e) => onChange({ ...item, is_active: e.target.checked })} /> Tampil
        </label>
        {withIcon ? (
          <select value={item.icon ?? ""} disabled={disabled} onChange={(e) => onChange({ ...item, icon: (e.target.value || null) as CmsMenuIcon | null })}
            className="rounded border border-border bg-white px-1 py-0.5 text-xs font-normal" aria-label="Ikon">
            <option value="">Tanpa ikon</option>
            {CMS_MENU_ICONS.map((ic) => <option key={ic} value={ic}>{ICON_LABEL[ic]}</option>)}
          </select>
        ) : null}
      </div>
    </div>
  );
}

export function MenuDraftForm({ value, onChange, errors, disabled }: {
  value: CmsMenuPayload; onChange: (m: CmsMenuPayload) => void; errors: Record<string, string>; disabled: boolean;
}) {
  const items = value.items;
  const setItems = (next: CmsMenuItem[]) => onChange({ items: next });
  return (
    <div className="space-y-3" data-field="items">
      <p className="text-xs text-muted-foreground">
        Menu ini menggantikan menu bawaan di bagian atas situs setelah disetujui Admin lain. Item yang tidak dicentang "Tampil" disembunyikan beserta submenunya.
      </p>
      {items.map((m, i) => {
        const children = m.children ?? [];
        const setChildren = (c: CmsMenuItem[]) => setItems(setAt(items, i, { ...m, children: c }));
        return (
          <section key={i} className={`space-y-3 rounded-2xl border bg-white p-4 ${m.is_active ? "border-border" : "border-dashed border-slate-300 opacity-80"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-marine">Menu {i + 1}</span>
              <RowTools disabled={disabled} onUp={i > 0 ? () => setItems(moveItem(items, i, i - 1)) : undefined}
                onDown={i < items.length - 1 ? () => setItems(moveItem(items, i, i + 1)) : undefined}
                onRemove={() => setItems(items.filter((_, x) => x !== i))} />
            </div>
            <ItemFields item={m} k={`menu.${i}`} errors={errors} disabled={disabled} withIcon onChange={(nm) => setItems(setAt(items, i, nm))} />
            <div className="space-y-2 border-l-2 border-marine/20 pl-3" data-field={`menu.${i}.children`}>
              {children.map((c, j) => (
                <div key={j} className="space-y-1">
                  <div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-muted-foreground">Submenu {j + 1}</span>
                    <RowTools disabled={disabled} onUp={j > 0 ? () => setChildren(moveItem(children, j, j - 1)) : undefined}
                      onDown={j < children.length - 1 ? () => setChildren(moveItem(children, j, j + 1)) : undefined}
                      onRemove={() => setChildren(children.filter((_, x) => x !== j))} /></div>
                  <ItemFields item={c} k={`menu.${i}.children.${j}`} errors={errors} disabled={disabled} withIcon={false}
                    onChange={(nc) => setChildren(setAt(children, j, nc))} />
                </div>
              ))}
              {!disabled ? (
                <button type="button" disabled={children.length >= 12} onClick={() => setChildren([...children, { ...newItem(), children: undefined }])}
                  className="rounded-lg border border-dashed border-marine px-2 py-1 text-xs font-semibold text-marine hover:bg-marine/5 disabled:opacity-40">
                  + Submenu
                </button>
              ) : null}
              <FieldError msg={errors[`menu.${i}.children`]} />
            </div>
          </section>
        );
      })}
      {!disabled ? (
        <div className="flex flex-wrap gap-2">
          {items.length === 0 ? (
            <button type="button" onClick={() => setItems(BUILT_IN.map(([id, en, href, icon]) => ({ label_id: id, label_en: en, href, is_external: false, is_active: true, icon, children: [] })))}
              className="rounded-lg border border-marine px-3 py-1.5 text-xs font-semibold text-marine hover:bg-marine/5">
              Mulai dari menu bawaan (9 menu)
            </button>
          ) : null}
          <button type="button" disabled={items.length >= 12} onClick={() => setItems([...items, newItem()])}
            className="rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy disabled:opacity-40">
            + Menu utama
          </button>
        </div>
      ) : null}
      <FieldError msg={errors.items} />
    </div>
  );
}
