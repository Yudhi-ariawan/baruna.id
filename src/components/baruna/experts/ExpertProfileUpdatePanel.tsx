// Update of a published expert profile (PB-EXP-01 versioning, migration 20261022030000).
// The published profile, the expert role and the trainer status stay while the
// update is prepared and verified; approval publishes the new profile version.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Clock, RefreshCcw, X } from "lucide-react";
import { toast } from "sonner";
import type { ExpertProfileUpdateState } from "@/lib/experts/application.types";
import { cancelExpertProfileUpdate, openExpertProfileUpdate } from "@/lib/experts/profile-update.functions";

// The join page reads its state once on load; reloading shows the editable draft.
const reloadJoinPage = () => window.location.assign("/experts/join");

export function ExpertProfileUpdatePanel({ update }: { update: ExpertProfileUpdateState }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const openFn = useServerFn(openExpertProfileUpdate);
  const mutation = useMutation({
    mutationFn: () => openFn({ data: { subjectId: update.subjectId, note } }),
    onSuccess: () => {
      toast.success("Draf pembaruan profil dibuat. Profil Anda saat ini tetap tayang sampai pembaruan disetujui.");
      reloadJoinPage();
    },
  });

  if (update.state === "in_review") {
    return (
      <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-left text-sm text-blue-900">
        <p className="flex items-center gap-2 font-bold">
          <Clock className="h-4 w-4" /> Pembaruan profil sedang diverifikasi
        </p>
        <p className="mt-1 text-xs leading-relaxed">
          Profil Anda saat ini tetap tampil di direktori, dan akses portal tidak berubah. Profil diganti setelah
          pembaruan disetujui verifikator.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-8 max-w-lg text-left">
      {update.lastUpdateRejected && (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900">
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-4 w-4" /> Pembaruan profil terakhir ditolak, profil sebelumnya tetap tayang
          </p>
          {update.rejectionNote && <p className="mt-1 italic">"{update.rejectionNote}"</p>}
        </div>
      )}
      {!open ? (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-white px-5 py-3 text-sm font-semibold text-emerald-800 shadow-2xs transition hover:bg-emerald-50"
          >
            <RefreshCcw className="h-4 w-4" /> Ajukan Pembaruan Profil
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-2xl border border-emerald-300 bg-white p-4">
          <p className="text-sm font-bold text-emerald-950">Perbarui profil expert Anda</p>
          <p className="text-xs text-emerald-900/80">
            Profil saat ini tetap tampil di direktori dan akses portal tidak berubah. Pembaruan diverifikasi seperti
            pendaftaran, lalu menggantikan profil (nomor versi naik) setelah disetujui.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Ringkasan perubahan, mis. jabatan baru dan publikasi 2026"
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
      )}
    </div>
  );
}

export function CancelExpertProfileUpdate({ subjectId }: { subjectId: string }) {
  const cancelFn = useServerFn(cancelExpertProfileUpdate);
  const mutation = useMutation({
    mutationFn: () => cancelFn({ data: { subjectId } }),
    onSuccess: () => {
      toast.success("Pembaruan dibatalkan. Profil tetap pada versi yang tayang.");
      reloadJoinPage();
    },
    onError: (err) => toast.error((err as Error).message),
  });
  return (
    <button
      type="button"
      disabled={mutation.isPending}
      onClick={() => {
        if (window.confirm("Batalkan pembaruan profil? Perubahan di draf pembaruan tidak akan disimpan.")) mutation.mutate();
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-muted disabled:opacity-60"
    >
      <X className="h-3.5 w-3.5" /> {mutation.isPending ? "Membatalkan…" : "Batalkan Pembaruan"}
    </button>
  );
}
