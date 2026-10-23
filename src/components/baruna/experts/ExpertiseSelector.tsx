// Bidang keahlian picker for the Become an Expert form, from Data Master
// (expertise_taxonomy). Active bidang are offered; a bidang already chosen that is
// no longer active (or no longer listed) stays visible so it can be kept or removed.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { getExpertiseOptions } from "@/lib/experts/expertise-options.functions";

const norm = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();

export function ExpertiseSelector({
  selected,
  onToggle,
  isId,
}: {
  selected: string[];
  onToggle: (area: string) => void;
  isId: boolean;
}) {
  const fn = useServerFn(getExpertiseOptions);
  const q = useQuery({ queryKey: ["experts", "expertise-options"], queryFn: () => fn(), staleTime: 5 * 60_000 });

  if (q.isLoading) {
    return <p className="text-xs text-muted-foreground">{isId ? "Memuat daftar bidang…" : "Loading areas…"}</p>;
  }
  if (q.isError) return <p className="text-xs text-destructive">{(q.error as Error).message}</p>;

  const options = q.data ?? [];
  const activeNames = options.filter((o) => o.active).map((o) => o.name);
  const activeKeys = new Set(activeNames.map(norm));
  // Chosen earlier but no longer offered: shown so the applicant can keep or drop it.
  const retired = selected.filter((s) => !activeKeys.has(norm(s)));

  const chip = (area: string, isRetired: boolean) => {
    const on = selected.some((s) => norm(s) === norm(area));
    return (
      <button
        key={area}
        type="button"
        onClick={() => onToggle(area)}
        title={isRetired ? (isId ? "Bidang ini tidak lagi ditawarkan; klik untuk menghapus" : "No longer offered; click to remove") : undefined}
        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
          isRetired
            ? "border border-dashed border-amber-400 bg-amber-50 text-amber-900"
            : on
              ? "bg-marine text-marine-foreground shadow-xs"
              : "bg-muted text-foreground/75 hover:bg-marine/15 hover:text-marine"
        }`}
      >
        {on && <Check className="mr-1 inline h-3 w-3" />}
        {area}
        {isRetired ? (isId ? " (tidak lagi tersedia)" : " (retired)") : ""}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {activeNames.map((area) => chip(area, false))}
      {retired.map((area) => chip(area, true))}
    </div>
  );
}
