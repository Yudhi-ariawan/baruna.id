// Trainer controls to open / cancel an update of a live module.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCcw, X } from "lucide-react";
import { toast } from "sonner";
import { cancelModuleUpdate, openModuleUpdate } from "@/lib/experts/module-update.functions";

const refreshPortal = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: ["experts", "trainer-portal-dashboard"] });

export function RequestModuleUpdate({ subjectId }: { subjectId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openFn = useServerFn(openModuleUpdate);
  const mutation = useMutation({
    mutationFn: () => openFn({ data: { subjectId, note } }),
    onSuccess: async ({ draftId }) => {
      await refreshPortal(queryClient);
      toast.success("Draf pembaruan dibuat. Versi yang tayang tidak berubah sampai pembaruan disetujui.");
      navigate({ to: "/experts/portal/submit-module", search: { draftId } });
    },
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-xs hover:bg-emerald-50 transition"
      >
        <RefreshCcw className="h-3.5 w-3.5" /> Ajukan Pembaruan
      </button>
    );
  }

  return (
    <div className="mt-3 w-full space-y-2 rounded-xl border border-emerald-300 bg-white p-4">
      <p className="text-sm font-bold text-emerald-950">Perbarui modul yang sedang tayang</p>
      <p className="text-xs text-emerald-900/80">
        Versi saat ini tetap tayang untuk peserta. Pembaruan Anda diverifikasi seperti pengajuan biasa, lalu
        menggantikan versi tayang (nomor versi naik) setelah disetujui.
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Ringkasan perubahan, mis. memperbarui data statistik 2026 dan menambah studi kasus"
        className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-marine focus:ring-1 focus:ring-marine"
      />
      {mutation.isError ? <p className="text-xs text-destructive">{(mutation.error as Error).message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={note.trim().length < 5 || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {mutation.isPending ? "Membuat draf…" : "Buka Draf Pembaruan"}
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-navy hover:bg-muted"
        >
          Batal
        </button>
      </div>
    </div>
  );
}

export function CancelModuleUpdate({ subjectId }: { subjectId: string }) {
  const queryClient = useQueryClient();
  const cancelFn = useServerFn(cancelModuleUpdate);
  const mutation = useMutation({
    mutationFn: () => cancelFn({ data: { subjectId } }),
    onSuccess: async () => {
      await refreshPortal(queryClient);
      toast.success("Pembaruan dibatalkan. Modul kembali ke versi yang tayang.");
    },
    onError: (err) => toast.error((err as Error).message),
  });
  return (
    <button
      type="button"
      disabled={mutation.isPending}
      onClick={() => {
        if (window.confirm("Batalkan pembaruan ini? Perubahan di draf pembaruan tidak akan disimpan.")) mutation.mutate();
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-muted disabled:opacity-60"
    >
      <X className="h-3.5 w-3.5" /> {mutation.isPending ? "Membatalkan…" : "Batalkan Pembaruan"}
    </button>
  );
}
