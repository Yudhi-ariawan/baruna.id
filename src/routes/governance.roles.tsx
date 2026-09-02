import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { grantRole, revokeRole } from "@/lib/governance/governance.functions";

export const Route = createFileRoute("/governance/roles")({
  component: RolesPage,
});

type Role = "admin" | "management" | "qa_reviewer";

function RolesPage() {
  const grantFn = useServerFn(grantRole);
  const revokeFn = useServerFn(revokeRole);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Role>("qa_reviewer");
  const [msg, setMsg] = useState<string | null>(null);

  const grantM = useMutation({
    mutationFn: () => grantFn({ data: { userId, role } }),
    onSuccess: () => setMsg(`Granted ${role} to ${userId.slice(0, 8)}…`),
    onError: (e: Error) => setMsg(e.message),
  });
  const revokeM = useMutation({
    mutationFn: () => revokeFn({ data: { userId, role } }),
    onSuccess: () => setMsg(`Revoked ${role} from ${userId.slice(0, 8)}…`),
    onError: (e: Error) => setMsg(e.message),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Role Administration</h2>
      <p className="text-xs text-muted-foreground">
        Admin-only. Every grant/revoke is written to the governance audit log.
      </p>
      <div className="space-y-3 rounded border border-border p-4">
        <label className="block text-sm">
          User ID (auth.users.id UUID)
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="mt-1 w-full rounded border border-border bg-background p-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="mt-1 w-full rounded border border-border bg-background p-2 text-sm"
          >
            <option value="qa_reviewer">qa_reviewer</option>
            <option value="management">management</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button onClick={() => grantM.mutate()} className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">
            Grant
          </button>
          <button onClick={() => revokeM.mutate()} className="rounded border border-border px-3 py-1.5 text-sm">
            Revoke
          </button>
        </div>
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      </div>
    </div>
  );
}
