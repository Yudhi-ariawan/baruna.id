// Language dropdown from Data Master. A value the record already has that is no
// longer offered (deactivated, or a free-text value from before the list) stays
// visible and marked, so nothing is replaced without the user noticing.
import { matchLanguage, useLanguageOptions } from "@/lib/master/useLanguageOptions";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Extra choice after the list (e.g. "Other" where the form allows it). */
  otherLabel?: string;
};

export function LanguageSelect({ value, onChange, className, otherLabel }: Props) {
  const q = useLanguageOptions();
  if (q.isLoading) return <p className="text-xs text-muted-foreground">Memuat daftar bahasa…</p>;
  if (q.isError) return <p className="text-xs text-destructive">{(q.error as Error).message}</p>;

  const options = q.data ?? [];
  const active = options.filter((o) => o.active);
  const match = matchLanguage(options, value);
  const isOther = Boolean(otherLabel) && value === otherLabel;
  // The stored value, shown as-is when it is not one of the offered names.
  const current = value.trim() && !isOther && !(match?.active && match.name === value) ? value : null;
  const hint = current
    ? match?.active
      ? `Dikenali sebagai ${match.name}; pilih ${match.name} agar seragam.`
      : match
        ? "Bahasa ini sudah dinonaktifkan kurator. Boleh tetap dipakai, atau pilih bahasa lain."
        : "Bahasa ini tidak ada di daftar dan akan ditolak saat dikirim. Pilih bahasa dari daftar."
    : null;

  return (
    <div className="space-y-1">
      <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
        {!value.trim() ? <option value="">Pilih bahasa…</option> : null}
        {current ? <option value={current}>{current} (data lama)</option> : null}
        {active.map((o) => (
          <option key={o.code} value={o.name}>
            {o.name}
            {o.nativeName && o.nativeName !== o.name ? ` · ${o.nativeName}` : ""}
          </option>
        ))}
        {otherLabel ? <option value={otherLabel}>{otherLabel}</option> : null}
      </select>
      {hint ? <p className={`text-xs ${match ? "text-amber-800" : "text-destructive"}`}>{hint}</p> : null}
    </div>
  );
}
