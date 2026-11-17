// Message under a form field that needs fixing, plus the red border for the field.
// Shared by the public forms (biodata, applications); the Program Academy console
// forms use the same look (components/governance/programs).
import { AlertCircle } from "lucide-react";

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <span role="alert" className="mt-1 flex items-start gap-1 text-[11px] font-medium text-red-700">
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> {msg}
    </span>
  );
}

/** Summary under a form: one button per field that jumps to it. */
export function FieldErrorSummary({ errors, labels }: { errors: Record<string, string>; labels: Record<string, string> }) {
  const keys = Object.keys(errors);
  if (!keys.length) return null;
  const go = (k: string) => {
    const el = document.querySelector<HTMLElement>(`[data-field="${k}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus();
  };
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50/60 p-3 text-xs text-red-800">
      <p className="font-semibold">Perbaiki {keys.length} isian bertanda merah (klik untuk menuju ke isiannya):</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {keys.map((k) => (
          <li key={k}>
            <button type="button" onClick={() => go(k)} className="rounded border border-red-300 bg-white px-1.5 py-0.5 hover:bg-red-100">
              {labels[k] ?? k}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
