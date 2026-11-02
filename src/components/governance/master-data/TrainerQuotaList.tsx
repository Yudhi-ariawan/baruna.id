// Data Master: active trainers per level with the module quota they use now, and
// what an unsaved quota change would mean for them. Read only: a trainer's level is
// changed through Kualifikasi Trainer, never here.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import {
  TRAINER_LEVEL_ORDER,
  getTrainerQuotaList,
  type ModuleLimitMap,
  type TrainerLevelCode,
  type TrainerQuotaRow,
} from "@/lib/governance/master-data.functions";

const LABEL: Record<TrainerLevelCode, string> = {
  certified: "Certified",
  advanced: "Advanced",
  senior: "Senior",
  master: "Master",
};

function status(row: TrainerQuotaRow, limit: number): { text: string; tone: string } {
  if (!row.portalActive) return { text: "Portal tidak aktif", tone: "bg-slate-100 text-slate-700" };
  if (row.used > limit) return { text: "Melewati kuota", tone: "bg-red-50 text-red-700" };
  if (row.used === limit) return { text: "Kuota penuh", tone: "bg-amber-50 text-amber-800" };
  return { text: `Sisa ${limit - row.used}`, tone: "bg-emerald-50 text-emerald-700" };
}

export function TrainerQuotaList({ total, draft }: { total: number; draft: Partial<ModuleLimitMap> }) {
  const [open, setOpen] = useState(false);
  const fn = useServerFn(getTrainerQuotaList);
  const q = useQuery({
    queryKey: ["governance", "master-data", "module-limits", "trainers"],
    queryFn: () => fn(),
    enabled: open,
    staleTime: 30_000,
  });
  const rows = q.data ?? [];
  const changed = rows.some((r) => draft[r.level] !== undefined && draft[r.level] !== r.limit);

  return (
    <div className="rounded-xl border border-border">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-navy hover:bg-muted/40">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Users className="h-4 w-4 text-marine" /> Lihat trainer per level ({total})
      </button>
      {open ? (
        <div className="border-t border-border p-3">
          {q.isLoading ? (
            <p className="text-xs text-muted-foreground">Memuat…</p>
          ) : q.isError ? (
            <p className="text-xs text-destructive">{(q.error as Error).message}</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada trainer aktif yang punya level.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-2 font-semibold">Trainer</th>
                    <th className="py-1 pr-2 font-semibold">Level</th>
                    <th className="py-1 pr-2 font-semibold" title="Tayang + menunggu keputusan">Modul aktif</th>
                    <th className="py-1 pr-2 font-semibold">Kuota</th>
                    {changed ? <th className="py-1 pr-2 font-semibold">Bila disimpan</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {TRAINER_LEVEL_ORDER.flatMap((level) => rows.filter((r) => r.level === level)).map((r) => {
                    const now = status(r, r.limit);
                    const next = draft[r.level];
                    const after = next !== undefined && next !== r.limit ? status(r, next) : null;
                    return (
                      <tr key={r.expertId} className="border-t border-border/60">
                        <td className="py-1.5 pr-2 font-medium text-navy">
                          {r.slug ? (
                            <Link to="/experts/$slug" params={{ slug: r.slug }} className="hover:underline">{r.name}</Link>
                          ) : (
                            r.name
                          )}
                        </td>
                        <td className="py-1.5 pr-2">{LABEL[r.level]}</td>
                        <td className="py-1.5 pr-2">
                          {r.used}
                          <span className="text-muted-foreground"> ({r.live} tayang, {r.queued} menunggu)</span>
                        </td>
                        <td className="py-1.5 pr-2">
                          {r.portalActive ? r.limit : "–"}{" "}
                          <span className={`ml-1 rounded px-1.5 py-0.5 ${now.tone}`}>{now.text}</span>
                        </td>
                        {changed ? (
                          <td className="py-1.5 pr-2">
                            {after ? (
                              <>
                                {next} <span className={`ml-1 rounded px-1.5 py-0.5 ${after.tone}`}>{after.text}</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">tidak berubah</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Angka sama dengan yang dihitung saat trainer membuat modul. "Portal tidak aktif": profil tidak tayang atau
            role expert tidak aktif, sehingga trainer itu tidak bisa membuat modul. Level trainer diubah lewat Kualifikasi
            Trainer, bukan di sini.
          </p>
        </div>
      ) : null}
    </div>
  );
}
