// Withdraw a training request before it is decided (training_need_withdraw RPC).
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Undo2 } from "lucide-react";
import { withdrawMyTrainingRequest } from "@/lib/training-requests/my-requests.functions";

export function WithdrawPanel({ requestId, onWithdrawn }: { requestId: string; onWithdrawn: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const withdrawFn = useServerFn(withdrawMyTrainingRequest);
  const mutation = useMutation({
    mutationFn: () => withdrawFn({ data: { id: requestId, reason } }),
    onSuccess: () => {
      setOpen(false);
      onWithdrawn();
    },
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
      >
        <Undo2 className="h-3.5 w-3.5" /> Withdraw Request
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-semibold text-navy">Withdraw this training request?</p>
      <p className="text-xs text-muted-foreground">
        The BARUNA team will stop reviewing it. A withdrawn request cannot be resubmitted; you can always submit a
        new one.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="Reason (optional)"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-marine focus:ring-1 focus:ring-marine"
      />
      {mutation.isError ? <p className="text-xs text-destructive">{(mutation.error as Error).message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground disabled:opacity-60"
        >
          {mutation.isPending ? "Withdrawing…" : "Yes, withdraw"}
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
