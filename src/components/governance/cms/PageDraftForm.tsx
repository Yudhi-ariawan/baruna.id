// Page Builder: address, title, summary, and an ordered list of blocks, with a
// preview that uses the same renderer visitors see.
import { useState } from "react";
import { Eye, Pencil } from "lucide-react";
import { CMS_BLOCK_LABEL, CMS_DOMAIN_LABEL, emptyBlock, type CmsBlockType, type CmsPagePayload } from "@/lib/cms/cms-types";
import { CmsPageView } from "@/components/cms/CmsPageView";
import { FieldError } from "@/components/baruna/forms/FieldError";
import { BlockEditor } from "./BlockEditor";
import { CmsBilingual, CmsText, RowTools } from "./CmsInputs";
import { moveItem, setAt } from "./cmsLabels";

type Props = {
  value: CmsPagePayload; onChange: (p: CmsPagePayload) => void; errors: Record<string, string>; disabled: boolean;
  isNew: boolean; draftId: string; forms: Array<{ slug: string; title: string }>;
};

export function PageDraftForm({ value: p, onChange, errors, disabled, isNew, draftId, forms }: Props) {
  const [preview, setPreview] = useState(false);
  const [addType, setAddType] = useState<CmsBlockType>("text");
  const setBlocks = (blocks: CmsPagePayload["blocks"]) => onChange({ ...p, blocks });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Menu pemilik: <b className="text-navy">{CMS_DOMAIN_LABEL[p.domain]}</b></p>
        <button type="button" onClick={() => setPreview((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-navy hover:bg-muted">
          {preview ? <><Pencil className="h-3.5 w-3.5" /> Kembali menyunting</> : <><Eye className="h-3.5 w-3.5" /> Pratinjau</>}
        </button>
      </div>

      {preview ? (
        <div className="rounded-2xl border border-dashed border-marine/40 bg-slate-50/60 p-5">
          <CmsPageView page={p} preview />
        </div>
      ) : (
        <>
          <CmsText label="Alamat halaman (slug)" required value={p.slug} field="slug" error={errors.slug} maxLength={80}
            disabled={disabled || !isNew} onChange={(v) => onChange({ ...p, slug: v.toLowerCase() })}
            hint={isNew
              ? `Tampil di /p/${p.slug || "alamat"}. Isi "${p.domain}" untuk menjadikannya halaman utama menu ${CMS_DOMAIN_LABEL[p.domain]}. Tidak bisa diubah setelah tayang.`
              : "Alamat tidak bisa diubah setelah tayang."} />
          <CmsBilingual label="Judul halaman" field="title" errors={errors} idValue={p.title_id} enValue={p.title_en} required maxLength={160}
            onId={(v) => onChange({ ...p, title_id: v })} onEn={(v) => onChange({ ...p, title_en: v })} disabled={disabled} />
          <CmsBilingual label="Ringkasan (opsional)" field="summary" errors={errors} idValue={p.summary_id} enValue={p.summary_en} multiline rows={2} maxLength={500}
            onId={(v) => onChange({ ...p, summary_id: v })} onEn={(v) => onChange({ ...p, summary_en: v })} disabled={disabled} />

          <div className="space-y-3" data-field="blocks">
            <h3 className="text-sm font-semibold text-navy">Blok halaman ({p.blocks.length}/30)</h3>
            {p.blocks.map((b, i) => (
              <section key={i} className="rounded-2xl border border-border bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-marine">Blok {i + 1} · {CMS_BLOCK_LABEL[b.type]?.label ?? b.type}</span>
                  <RowTools disabled={disabled}
                    onUp={i > 0 ? () => setBlocks(moveItem(p.blocks, i, i - 1)) : undefined}
                    onDown={i < p.blocks.length - 1 ? () => setBlocks(moveItem(p.blocks, i, i + 1)) : undefined}
                    onRemove={() => { if (window.confirm(`Hapus blok ${i + 1}?`)) setBlocks(p.blocks.filter((_, x) => x !== i)); }} />
                </div>
                <BlockEditor block={b} index={i} onChange={(nb) => setBlocks(setAt(p.blocks, i, nb))} errors={errors}
                  disabled={disabled} draftId={draftId} forms={forms} />
              </section>
            ))}
            {!disabled ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-marine/40 p-3">
                <select value={addType} onChange={(e) => setAddType(e.target.value as CmsBlockType)}
                  className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm">
                  {(Object.keys(CMS_BLOCK_LABEL) as CmsBlockType[]).map((tp) => (
                    <option key={tp} value={tp}>{CMS_BLOCK_LABEL[tp].label}: {CMS_BLOCK_LABEL[tp].hint}</option>
                  ))}
                </select>
                <button type="button" disabled={p.blocks.length >= 30} onClick={() => setBlocks([...p.blocks, emptyBlock(addType)])}
                  className="rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy disabled:opacity-40">
                  + Tambah blok
                </button>
              </div>
            ) : null}
            <FieldError msg={errors.blocks} />
          </div>
        </>
      )}
    </div>
  );
}
