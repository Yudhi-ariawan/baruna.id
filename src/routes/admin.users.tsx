import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Ban,
  CheckCircle2,
  Clock3,
  MailPlus,
  Pencil,
  Search,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  assignUserRole,
  getAdminAccess,
  inviteUser,
  listRoles,
  listUserAccessHistory,
  listUsers,
  revokeUserRole,
  setUserSuspended,
  updateUserProfile,
} from "@/lib/admin/users.functions";
import type {
  AdminAccess,
  AdminAuditEvent,
  AdminRole,
  AdminRoleCode,
  AdminUser,
} from "@/lib/admin/users.functions";

export const Route = createFileRoute("/admin/users")({ component: UsersPage });

type UserRow = AdminUser;

function messageOf(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const translations: Record<string, string> = {
    forbidden: "You do not have permission for this action.",
    self_lockout_protected: "You cannot suspend yourself or remove your own super-admin access.",
    last_super_admin_protected: "The last active super-admin is protected.",
  };
  return translations[message] ?? message;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function initials(user: UserRow) {
  const source = user.displayName || user.email;
  return source
    .split(/\s+|@/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function UsersPage() {
  const queryClient = useQueryClient();
  const usersFn = useServerFn(listUsers);
  const rolesFn = useServerFn(listRoles);
  const accessFn = useServerFn(getAdminAccess);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin", "users", search],
    queryFn: () => usersFn({ data: { search } }),
    retry: false,
  });
  const rolesQuery = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => rolesFn(),
    retry: false,
  });
  const accessQuery = useQuery({
    queryKey: ["admin", "access"],
    queryFn: () => accessFn(),
    retry: false,
  });
  const users = useMemo(() => usersQuery.data?.users ?? [], [usersQuery.data?.users]);
  const selected = useMemo(
    () => users.find((user) => user.id === selectedId) ?? null,
    [users, selectedId],
  );

  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selected, selectedId]);

  function refresh(text: string) {
    setNotice({ type: "ok", text });
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "history"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-marine">
            User management
          </p>
          <h2 className="mt-1 font-display text-3xl font-bold text-navy">Users & access</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Auth identities are read securely through the Supabase Admin API.
          </p>
        </div>
        {accessQuery.data?.canInviteUsers ? (
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-marine px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-marine/90"
          >
            <MailPlus className="h-4 w-4" /> Invite user
          </button>
        ) : null}
      </div>

      {notice ? (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${notice.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(input.trim());
            }}
            className="flex w-full max-w-xl gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Search name, email, organization, UID…"
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-marine"
              />
            </div>
            <button className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
              Search
            </button>
          </form>
          <span className="text-xs text-muted-foreground">
            {usersQuery.data?.total ?? 0} user(s)
          </span>
        </div>

        {usersQuery.isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading users…</div>
        ) : null}
        {usersQuery.isError ? (
          <div className="p-10 text-center text-sm text-red-600">{messageOf(usersQuery.error)}</div>
        ) : null}
        {!usersQuery.isLoading && !usersQuery.isError && users.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No users found.</div>
        ) : null}
        {users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Roles</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last sign-in</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                          {initials(user)}
                        </span>
                        <div>
                          <p className="font-semibold text-navy">
                            {user.displayName || "Unnamed user"}
                          </p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {user.roles.length ? (
                          user.roles.map((role) => (
                            <span
                              key={role}
                              className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700"
                            >
                              {role}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">No role</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                      >
                        {user.isActive ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Ban className="h-3.5 w-3.5" />
                        )}
                        {user.isActive ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {formatDate(user.lastSignInAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setSelectedId(user.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-marine hover:text-marine"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {showInvite ? (
        <InviteDialog
          onClose={() => setShowInvite(false)}
          onSuccess={(text) => {
            setShowInvite(false);
            refresh(text);
          }}
          onError={(text) => setNotice({ type: "error", text })}
        />
      ) : null}
      {selected ? (
        <UserDialog
          user={selected}
          roles={((rolesQuery.data ?? []) as AdminRole[]).map((role) => role.code as AdminRoleCode)}
          access={accessQuery.data}
          onClose={() => setSelectedId(null)}
          onSuccess={refresh}
          onError={(text) => setNotice({ type: "error", text })}
        />
      ) : null}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-6 py-4">
          <h3 className="font-display text-xl font-bold text-navy">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InviteDialog({
  onClose,
  onSuccess,
  onError,
}: {
  onClose: () => void;
  onSuccess: (text: string) => void;
  onError: (text: string) => void;
}) {
  const fn = useServerFn(inviteUser);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const mutation = useMutation({
    mutationFn: () => fn({ data: { email, displayName } }),
    onSuccess: (result) => onSuccess(`Invitation sent to ${result.email}.`),
    onError: (error) => onError(messageOf(error)),
  });
  return (
    <Modal title="Invite new user" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4 p-6"
      >
        <Field label="Full name">
          <input
            required
            minLength={2}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="input-admin"
          />
        </Field>
        <Field label="Email address">
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input-admin"
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Supabase will email a secure invitation link. Roles can be assigned after the user is
          created.
        </p>
        <Actions busy={mutation.isPending} onCancel={onClose} submit="Send invitation" />
      </form>
    </Modal>
  );
}

function UserDialog({
  user,
  roles,
  access,
  onClose,
  onSuccess,
  onError,
}: {
  user: UserRow;
  roles: AdminRoleCode[];
  access: AdminAccess | undefined;
  onClose: () => void;
  onSuccess: (text: string) => void;
  onError: (text: string) => void;
}) {
  const queryClient = useQueryClient();
  const profileFn = useServerFn(updateUserProfile);
  const assignFn = useServerFn(assignUserRole);
  const revokeFn = useServerFn(revokeUserRole);
  const suspendFn = useServerFn(setUserSuspended);
  const historyFn = useServerFn(listUserAccessHistory);
  const [form, setForm] = useState({
    displayName: user.displayName || "Unnamed user",
    phone: user.phone ?? "",
    jobTitle: user.jobTitle ?? "",
    organization: user.organization ?? "",
  });
  const history = useQuery({
    queryKey: ["admin", "history", user.id],
    queryFn: () => historyFn({ data: { userId: user.id } }),
    enabled: Boolean(access?.canReadAudit),
  });
  const profileM = useMutation({
    mutationFn: () =>
      profileFn({
        data: {
          userId: user.id,
          displayName: form.displayName,
          phone: form.phone || null,
          jobTitle: form.jobTitle || null,
          organization: form.organization || null,
        },
      }),
    onSuccess: () => onSuccess("Profile updated."),
    onError: (error) => onError(messageOf(error)),
  });
  const roleM = useMutation({
    mutationFn: ({ role, assigned }: { role: AdminRoleCode; assigned: boolean }) =>
      assigned
        ? revokeFn({ data: { userId: user.id, role } })
        : assignFn({ data: { userId: user.id, role } }),
    onSuccess: () => onSuccess("Role assignment updated."),
    onError: (error) => onError(messageOf(error)),
  });
  const suspendM = useMutation({
    mutationFn: () => suspendFn({ data: { userId: user.id, suspended: user.isActive } }),
    onSuccess: () => onSuccess(user.isActive ? "User suspended." : "User reactivated."),
    onError: (error) => onError(messageOf(error)),
  });
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["admin", "history", user.id] });
  }, [user.roles, user.isActive, queryClient, user.id]);
  return (
    <Modal title={user.displayName || user.email} onClose={onClose}>
      <div className="space-y-6 p-6">
        <div className="rounded-xl bg-slate-50 p-4 text-xs">
          <p className="font-semibold text-navy">{user.email}</p>
          <p className="mt-1 font-mono text-muted-foreground">{user.id}</p>
          <p className="mt-2 text-muted-foreground">
            Created {formatDate(user.createdAt)} · Email confirmed{" "}
            {formatDate(user.emailConfirmedAt)}
          </p>
        </div>
        {access?.canUpdateUsers ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              profileM.mutate();
            }}
            className="space-y-3"
          >
            <SectionTitle icon={<UserRound className="h-4 w-4" />} text="Profile" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name">
                <input
                  required
                  minLength={2}
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  className="input-admin"
                />
              </Field>
              <Field label="Phone">
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input-admin"
                />
              </Field>
              <Field label="Job title">
                <input
                  value={form.jobTitle}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                  className="input-admin"
                />
              </Field>
              <Field label="Organization">
                <input
                  value={form.organization}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  className="input-admin"
                />
              </Field>
            </div>
            <button
              disabled={profileM.isPending}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Save profile
            </button>
          </form>
        ) : null}
        {access?.canAssignRoles ? (
          <section>
            <SectionTitle icon={<Shield className="h-4 w-4" />} text="Roles" />
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.map((role) => {
                const assigned = user.roles.includes(role);
                return (
                  <label
                    key={role}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-navy">{role}</span>
                    <input
                      type="checkbox"
                      checked={assigned}
                      disabled={roleM.isPending}
                      onChange={() => roleM.mutate({ role, assigned })}
                    />
                  </label>
                );
              })}
            </div>
          </section>
        ) : null}
        {access?.canSuspendUsers ? (
          <section className="rounded-xl border border-red-100 bg-red-50/60 p-4">
            <SectionTitle icon={<Ban className="h-4 w-4" />} text="Account status" />
            <p className="mb-3 text-xs text-muted-foreground">
              Suspension blocks Supabase Auth sign-in and disables permission checks.
            </p>
            <button
              disabled={suspendM.isPending}
              onClick={() => suspendM.mutate()}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${user.isActive ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}
            >
              {user.isActive ? "Suspend user" : "Reactivate user"}
            </button>
          </section>
        ) : null}
        {access?.canReadAudit ? (
          <section>
            <SectionTitle icon={<Clock3 className="h-4 w-4" />} text="Access history" />
            {history.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading history…</p>
            ) : null}
            <div className="space-y-2">
              {((history.data ?? []) as AdminAuditEvent[]).map((event) => (
                <div key={event.id} className="rounded-lg border border-border p-3">
                  <div className="flex justify-between gap-3">
                    <p className="text-sm font-semibold text-navy">
                      {event.event_type.replaceAll("_", " ")}
                    </p>
                    <time className="text-[11px] text-muted-foreground">
                      {formatDate(event.created_at)}
                    </time>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    Actor: {event.actor_id ?? "system"}
                  </p>
                </div>
              ))}
              {!history.isLoading && !(history.data ?? []).length ? (
                <p className="text-xs text-muted-foreground">No access changes recorded.</p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-navy">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
function Actions({
  busy,
  onCancel,
  submit,
}: {
  busy: boolean;
  onCancel: () => void;
  submit: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
      >
        Cancel
      </button>
      <button
        disabled={busy}
        className="rounded-lg bg-marine px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? "Processing…" : submit}
      </button>
    </div>
  );
}
function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-navy">
      {icon}
      {text}
    </h4>
  );
}
