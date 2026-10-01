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
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  assignUserRole,
  createUser,
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

function roleCodeOf(role: unknown): string {
  if (!role) return "";
  if (typeof role === "string") return role;
  return (role as { code?: string })?.code || (role as { name?: string })?.name || String(role || "");
}

function initials(user: UserRow) {
  const source = (user.displayName || user.email || "User").trim();
  return (
    source
      .split(/\s+|@/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function getRoleBadgeStyle(rawRole: unknown) {
  const r = roleCodeOf(rawRole).toLowerCase();
  if (r === "expert") return "bg-teal-50 text-teal-800 border-teal-200";
  if (r === "admin" || r === "super_admin") return "bg-indigo-50 text-indigo-800 border-indigo-200";
  if (r === "reviewer" || r === "verifier" || r === "approver") return "bg-amber-50 text-amber-800 border-amber-200";
  if (r === "participant") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function UsersPage() {
  const queryClient = useQueryClient();
  const usersFn = useServerFn(listUsers);
  const rolesFn = useServerFn(listRoles);
  const accessFn = useServerFn(getAdminAccess);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
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

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const uRoles = (u.roles || []).map(roleCodeOf);
      if (roleFilter !== "all") {
        if (!uRoles.includes(roleFilter)) return false;
      }
      if (statusFilter === "active" && !u.isActive) return false;
      if (statusFilter === "suspended" && u.isActive) return false;
      return true;
    });
  }, [users, roleFilter, statusFilter]);

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

  // Quick stats
  const totalCount = users.length;
  const expertCount = users.filter((u) =>
    (u.roles || []).some((r) => roleCodeOf(r) === "expert"),
  ).length;
  const adminCount = users.filter((u) =>
    (u.roles || []).some((r) => {
      const code = roleCodeOf(r);
      return code === "admin" || code === "super_admin";
    }),
  ).length;
  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-marine/10 p-1.5 text-marine">
              <Users className="h-5 w-5" />
            </span>
            <h1 className="font-display text-2xl font-extrabold text-navy">
              Manajemen Pengguna &amp; Akses
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Kelola data autentikasi, status aktif, dan penugasan peran (RBAC) seluruh pengguna platform BARUNA.
          </p>
        </div>

        {accessQuery.data?.canInviteUsers ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-navy/90 transition cursor-pointer"
            >
              <UserPlus className="h-4 w-4" /> Tambah User
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
            >
              <MailPlus className="h-4 w-4 text-marine" /> Undang User
            </button>
          </div>
        ) : null}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Akun</span>
          <p className="mt-1 font-display text-2xl font-extrabold text-navy">{totalCount}</p>
          <span className="text-[11px] text-muted-foreground">Terdaftar di Auth</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pakar &amp; Instruktur</span>
          <p className="mt-1 font-display text-2xl font-extrabold text-teal-700">{expertCount}</p>
          <span className="text-[11px] text-muted-foreground">Role Expert</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Administrator</span>
          <p className="mt-1 font-display text-2xl font-extrabold text-indigo-700">{adminCount}</p>
          <span className="text-[11px] text-muted-foreground">Akses Admin/Super</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status Aktif</span>
          <p className="mt-1 font-display text-2xl font-extrabold text-emerald-700">{activeCount}</p>
          <span className="text-[11px] text-muted-foreground">Akun Normal</span>
        </div>
      </div>

      {notice ? (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-semibold ${
            notice.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Main Table Card */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        {/* Filter Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Bar */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(input.trim());
              }}
              className="flex w-full sm:max-w-md gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Cari nama, email, instansi, UID…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-xs sm:text-sm outline-none focus:border-marine focus:bg-white transition"
                />
                {input && (
                  <button
                    type="button"
                    onClick={() => {
                      setInput("");
                      setSearch("");
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-marine transition shrink-0 cursor-pointer"
              >
                Cari
              </button>
            </form>

            <span className="text-xs text-muted-foreground">
              Menampilkan <strong className="text-navy font-bold">{filteredUsers.length}</strong> dari {totalCount} akun
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filter Role:</span>
            {[
              { id: "all", label: "Semua Role" },
              { id: "expert", label: "Expert" },
              { id: "admin", label: "Admin" },
              { id: "participant", label: "Participant" },
              { id: "registered_user", label: "Registered User" },
            ].map((tab) => {
              const active = roleFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoleFilter(tab.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                    active
                      ? "bg-navy text-white shadow-2xs font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {usersQuery.isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Memuat data pengguna…</div>
        ) : null}
        {usersQuery.isError ? (
          <div className="p-12 text-center text-sm text-red-600">{messageOf(usersQuery.error)}</div>
        ) : null}
        {!usersQuery.isLoading && !usersQuery.isError && filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Tidak ada pengguna yang sesuai dengan filter atau kata kunci pencarian.
          </div>
        ) : null}
        {filteredUsers.length > 0 ? (
          <>
            {/* Mobile Cards */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <div key={user.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy to-marine text-xs font-bold text-white shadow-2xs">
                        {initials(user)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-navy truncate">
                          {user.displayName || "Unnamed user"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        user.isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {user.isActive ? <CheckCircle2 className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                      {user.isActive ? "Active" : "Suspended"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {(user.roles || []).length ? (
                      user.roles.map((rawRole, idx) => {
                        const role = roleCodeOf(rawRole);
                        return (
                          <span
                            key={role || idx}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getRoleBadgeStyle(role)}`}
                          >
                            {role}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">No role</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-slate-100">
                    <span className="text-[11px]">Terakhir: {formatDate(user.lastSignInAt)}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedId(user.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50 transition cursor-pointer"
                    >
                      <Pencil className="h-3 w-3" /> Kelola
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Pengguna &amp; Identitas</th>
                    <th className="px-6 py-3.5">Peran (Roles)</th>
                    <th className="px-6 py-3.5">Status Akun</th>
                    <th className="px-6 py-3.5">Terakhir Masuk</th>
                    <th className="px-6 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy to-marine text-xs font-bold text-white shadow-2xs">
                            {initials(user)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-navy leading-snug truncate">
                              {user.displayName || "Pengguna Tanpa Nama"}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                            <p className="font-mono text-[9px] text-slate-400 truncate">{user.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {(user.roles || []).length ? (
                            user.roles.map((rawRole, idx) => {
                              const role = roleCodeOf(rawRole);
                              return (
                                <span
                                  key={role || idx}
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getRoleBadgeStyle(role)}`}
                                >
                                  {role}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Tanpa peran</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                            user.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {user.isActive ? <CheckCircle2 className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                          {user.isActive ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {formatDate(user.lastSignInAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(user.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-marine hover:text-marine hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Kelola
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      {showCreate ? (
        <CreateUserDialog
          availableRoles={((rolesQuery.data ?? []) as AdminRole[]).map(
            (role) => role.code as AdminRoleCode,
          )}
          onClose={() => setShowCreate(false)}
          onSuccess={(text) => {
            setShowCreate(false);
            refresh(text);
          }}
          onError={(text) => setNotice({ type: "error", text })}
        />
      ) : null}
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-4 sm:px-6 py-3 sm:py-4">
          <h3 className="font-display text-lg sm:text-xl font-bold text-navy">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 sm:p-2 hover:bg-muted cursor-pointer" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateUserDialog({
  availableRoles,
  onClose,
  onSuccess,
  onError,
}: {
  availableRoles: AdminRoleCode[];
  onClose: () => void;
  onSuccess: (text: string) => void;
  onError: (text: string) => void;
}) {
  const fn = useServerFn(createUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [organization, setOrganization] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<AdminRoleCode[]>([
    "registered_user",
  ]);
  const [emailConfirm, setEmailConfirm] = useState(true);

  function toggleRole(role: AdminRoleCode) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  const mutation = useMutation({
    mutationFn: () =>
      fn({
        data: {
          email,
          password,
          displayName,
          organization: organization.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          phone: phone.trim() || undefined,
          roles: selectedRoles,
          emailConfirm,
        },
      }),
    onSuccess: (result: any) =>
      onSuccess(`User ${result?.email ?? email} created successfully with roles: ${(result?.roles ?? selectedRoles).join(", ")}.`),
    onError: (error) => onError(messageOf(error)),
  });

  return (
    <Modal title="Create new user" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (selectedRoles.length === 0) {
            onError("Please select at least one role for the user.");
            return;
          }
          mutation.mutate();
        }}
        className="space-y-4 p-4 sm:p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name *">
            <input
              required
              minLength={2}
              value={displayName}
              placeholder="e.g. Dr. Budi Santoso"
              onChange={(event) => setDisplayName(event.target.value)}
              className="input-admin"
            />
          </Field>
          <Field label="Email address *">
            <input
              required
              type="email"
              value={email}
              placeholder="e.g. user@baruna.id"
              onChange={(event) => setEmail(event.target.value)}
              className="input-admin"
            />
          </Field>
        </div>

        <Field label="Password * (min. 8 characters)">
          <input
            required
            type="password"
            minLength={8}
            value={password}
            placeholder="••••••••"
            onChange={(event) => setPassword(event.target.value)}
            className="input-admin"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Institution / Organization">
            <input
              value={organization}
              placeholder="e.g. BRIN / KKP"
              onChange={(event) => setOrganization(event.target.value)}
              className="input-admin"
            />
          </Field>
          <Field label="Job title / Position">
            <input
              value={jobTitle}
              placeholder="e.g. Researcher / Lecturer"
              onChange={(event) => setJobTitle(event.target.value)}
              className="input-admin"
            />
          </Field>
          <Field label="Phone / WhatsApp">
            <input
              value={phone}
              placeholder="e.g. +62812345678"
              onChange={(event) => setPhone(event.target.value)}
              className="input-admin"
            />
          </Field>
        </div>

        <div>
          <label className="block text-sm font-medium text-navy">
            Assign Roles *
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Select one or more roles to be assigned to this user immediately.
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-44 overflow-y-auto p-1 border border-border/60 rounded-lg">
            {availableRoles.map((role) => {
              const checked = selectedRoles.includes(role);
              return (
                <label
                  key={role}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    checked
                      ? "border-marine bg-blue-50/70 text-marine"
                      : "border-border bg-white text-foreground hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRole(role)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-marine focus:ring-marine"
                  />
                  <span>{role}</span>
                </label>
              );
            })}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs font-medium text-navy">
          <input
            type="checkbox"
            checked={emailConfirm}
            onChange={(e) => setEmailConfirm(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-marine focus:ring-marine"
          />
          <span>Auto-confirm email (user can sign in immediately without verification email)</span>
        </label>

        <Actions busy={mutation.isPending} onCancel={onClose} submit="Create user" />
      </form>
    </Modal>
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
    onSuccess: (result: any) => onSuccess(`Invitation sent to ${result?.email ?? email}.`),
    onError: (error) => onError(messageOf(error)),
  });
  return (
    <Modal title="Invite new user" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4 p-4 sm:p-6"
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
      <div className="space-y-6 p-4 sm:p-6">
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
