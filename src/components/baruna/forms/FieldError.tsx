// Message under a form field that needs fixing, plus the red border for the field.
// Shared by the public forms (biodata, applications, Request a Training); the
// Program Academy console forms use the same look (components/governance/programs).
import { AlertCircle } from "lucide-react";
import { focusField } from "./field-errors";

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <span role="alert" className="mt-1 flex items-start gap-1 text-[11px] font-medium text-red-700">
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> {msg}
    </span>
  );
}

/** Summary under a form: one button per field that jumps to it. */
export function FieldErrorSummary({
  errors,
  labels,
  title,
}: {
  errors: Record<string, string | undefined>;
  labels: Record<string, string>;
  title?: (count: number) => string;
}) {
  const keys = Object.keys(errors).filter((k) => errors[k]);
  if (!keys.length) return null;
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50/60 p-3 text-xs text-red-800">
      <p className="font-semibold">
        {title ? title(keys.length) : `Perbaiki ${keys.length} isian bertanda merah (klik untuk menuju ke isiannya):`}
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {keys.map((k) => (
          <li key={k}>
            <button type="button" onClick={() => focusField(k)} className="rounded border border-red-300 bg-white px-1.5 py-0.5 hover:bg-red-100">
              {labels[k] ?? k}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
