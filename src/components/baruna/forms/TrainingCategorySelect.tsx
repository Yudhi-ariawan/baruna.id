// Training Category dropdown for Request a Training, from Data Master
// (training_category_taxonomy, migration 20261102040000). The table is readable by
// visitors, so the form works before login. "Other" stays as the last choice; a
// value the request already has but that is no longer offered stays visible.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// training_category_taxonomy is not in the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const norm = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();

export function TrainingCategorySelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const q = useQuery({
    queryKey: ["master", "training-category-options"],
    queryFn: async (): Promise<Array<{ name: string; active: boolean }>> => {
      const { data, error } = await db
        .from("training_category_taxonomy")
        .select("name, active, display_order")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw new Error(`Gagal memuat kategori pelatihan: ${error.message}`);
      return (data ?? []) as Array<{ name: string; active: boolean }>;
    },
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
  });
  if (q.isLoading) return <p className="text-xs text-muted-foreground">Loading categories…</p>;
  if (q.isError) return <p className="text-xs text-destructive">{(q.error as Error).message}</p>;

  const options = q.data ?? [];
  const match = value.trim() ? options.find((o) => norm(o.name) === norm(value)) : undefined;
  const isOther = norm(value) === "other";
  const legacy = value.trim() && !isOther && !match?.active ? value : null;

  return (
    <div className="space-y-1">
      <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select category…</option>
        {legacy ? <option value={legacy}>{legacy} (no longer offered)</option> : null}
        {options.filter((o) => o.active).map((o) => (
          <option key={o.name} value={o.name}>
            {o.name}
          </option>
        ))}
        <option value="Other">Other</option>
      </select>
      {legacy ? (
        <p className={`text-xs ${match ? "text-amber-800" : "text-destructive"}`}>
          {match
            ? "This category is no longer offered. You may keep it or choose another one."
            : "This category is not in the list and will be refused on submit. Choose a listed category or Other."}
        </p>
      ) : null}
    </div>
  );
}
