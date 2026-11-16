// Message under a form field that needs fixing (Program Academy drafts).
import { AlertCircle } from "lucide-react";


export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <span role="alert" className="mt-1 flex items-start gap-1 text-[11px] font-medium text-red-700">
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> {msg}
    </span>
  );
}
