// A CMS form for visitors: fields marked like every other BARUNA form, login
// required to send (the database checks it again, with the daily limit).
import { useMemo, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useHomeExperience } from "@/components/baruna/home-experience";
import { useLanguage } from "@/lib/i18n";
import { cmsText, type CmsPublicForm, type CmsValue } from "@/lib/cms/cms-types";
import { submissionErrors } from "@/lib/cms/cms-validation";
import { submitCmsForm } from "@/lib/cms/cms-public.functions";
import { FieldError } from "@/components/baruna/forms/FieldError";
import { fieldErrorCls, focusField } from "@/components/baruna/forms/field-errors";

const INPUT = "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm";

export function CmsFormView({ form, preview = false }: { form: CmsPublicForm; preview?: boolean }) {
  const { language } = useLanguage();
  const t = (id?: string | null, en?: string | null) => cmsText(language, id, en);
  const location = useLocation();
  const submit = useServerFn(submitCmsForm);
  const [values, setValues] = useState<Record<string, CmsValue>>({});
  const [tried, setTried] = useState(false);
  // The app-wide sign-in state (same source as the Navbar), so the two always agree.
  const { authState } = useHomeExperience();
  const signedIn = authState === "loading" ? null : authState === "authenticated";

  const all = useMemo(() => submissionErrors(form.fields, values), [form.fields, values]);
  const errors = tried ? all : {};
  const m = useMutation({
    mutationFn: () => submit({ data: { slug: form.slug, data: values } }),
  });
  const send = () => {
    const keys = Object.keys(all);
    if (keys.length) {
      setTried(true);
      setTimeout(() => focusField(`cmsf.${keys[0]}`), 50);
      return;
    }
    m.mutate();
  };
  const set = (key: string, v: CmsValue) => setValues((s) => ({ ...s, [key]: v }));

  if (m.isSuccess) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" /> Terima kasih, kiriman Anda sudah diterima.</p>
        <p className="mt-1 text-emerald-900/80">Pengelola akan meninjaunya. Anda bisa mengirim lagi maksimal {form.max_per_user_per_day} kali per hari.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div>
        <h2 className="font-display text-lg font-bold text-navy">{t(form.title_id, form.title_en)}</h2>
        {t(form.description_id, form.description_en) ? <p className="mt-1 text-sm text-muted-foreground">{t(form.description_id, form.description_en)}</p> : null}
      </div>
      {form.fields.map((f) => {
        const label = t(f.label_id, f.label_en);
        const help = t(f.help_id, f.help_en);
        const err = errors[f.key];
        const v = values[f.key];
        const common = { "data-field": `cmsf.${f.key}` };
        if (f.type === "checkbox") {
          return (
            <label key={f.key} {...common} className="flex items-start gap-2 text-sm text-navy">
              <input type="checkbox" checked={v === true} onChange={(e) => set(f.key, e.target.checked)} className="mt-1" />
              <span>{label} {f.required ? <span className="text-red-600">*</span> : null}{help ? <span className="block text-xs text-muted-foreground">{help}</span> : null}<FieldError msg={err} /></span>
            </label>
          );
        }
        return (
          <label key={f.key} {...common} className="block text-sm font-semibold text-navy">
            {label} {f.required ? <span className="text-red-600">*</span> : null}
            {f.type === "textarea" ? (
              <textarea rows={4} value={typeof v === "string" ? v : ""} maxLength={f.max_length ?? 5000}
                onChange={(e) => set(f.key, e.target.value)} className={INPUT + fieldErrorCls(err)} />
            ) : f.type === "select" ? (
              <select value={typeof v === "string" ? v : ""} onChange={(e) => set(f.key, e.target.value)} className={INPUT + fieldErrorCls(err)}>
                <option value="">— pilih —</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type={f.type === "email" ? "email" : f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                value={v === null || v === undefined ? "" : String(v)} maxLength={f.type === "text" ? (f.max_length ?? 500) : undefined}
                onChange={(e) => set(f.key, f.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
                className={INPUT + fieldErrorCls(err)} />
            )}
            {help ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{help}</span> : null}
            <FieldError msg={err} />
          </label>
        );
      })}
      {preview ? (
        <p className="text-xs text-muted-foreground">Pratinjau: tombol kirim tidak aktif.</p>
      ) : signedIn === false ? (
        <p className="text-sm">
          <Link to="/auth" search={{ redirect: location.pathname }} className="font-semibold text-marine underline">Masuk</Link> dulu untuk mengirim formulir ini.
        </p>
      ) : (
        <button type="button" onClick={send} disabled={m.isPending || signedIn === null}
          className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-4 py-2 text-sm font-semibold text-white hover:bg-navy disabled:opacity-50">
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim
        </button>
      )}
      {tried && Object.keys(all).length ? <p className="text-xs font-semibold text-red-700">Perbaiki isian bertanda merah.</p> : null}
      {m.isError ? <p className="text-xs text-red-700">{(m.error as Error).message}</p> : null}
    </section>
  );
}
