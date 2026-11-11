// Temporary page for reporting release readiness to supervisors (to be removed).
// Content comes from dokumen/KESIAPAN_RILIS.md through a server check; see
// src/lib/release/release-readiness.functions.ts. The login is kept in memory only.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, FileText, KanbanSquare, Loader2, Lock, LogOut } from "lucide-react";
import { getReleaseReadiness } from "@/lib/release/release-readiness.functions";
import type { ReadinessBoard } from "@/lib/release/readiness-board";
import { ReadinessBoardView } from "@/components/release/ReadinessBoardView";
import { ReleaseMarkdown } from "@/components/release/ReleaseMarkdown";

export const Route = createFileRoute("/kesiapanrilis")({
  head: () => ({ meta: [{ title: "Kesiapan Rilis — BARUNA" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ReleaseReadinessPage,
});

function ReleaseReadinessPage() {
  const fetchFn = useServerFn(getReleaseReadiness);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [doc, setDoc] = useState<{ markdown: string; board: ReadinessBoard } | null>(null);
  const [view, setView] = useState<"board" | "document">("board");
  const login = useMutation({
    mutationFn: () => fetchFn({ data: { username: username.trim(), password } }),
    onSuccess: (res) => { setDoc(res); setPassword(""); },
  });

  if (doc) {
    const tab = (key: "board" | "document", label: string, Icon: typeof FileText) => (
      <button type="button" onClick={() => setView(key)} aria-pressed={view === key}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${view === key ? "bg-white text-navy" : "bg-white/15 hover:bg-white/25"}`}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </button>
    );
    return (
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-navy px-5 py-4 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="h-5 w-5" /> Laporan kesiapan rilis (internal, jangan disebarkan)</div>
          <div className="flex flex-wrap items-center gap-2">
            {tab("board", "Papan", KanbanSquare)}
            {tab("document", "Dokumen lengkap", FileText)}
            <button type="button" onClick={() => { setDoc(null); setUsername(""); setView("board"); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25">
              <LogOut className="h-3.5 w-3.5" /> Keluar
            </button>
          </div>
        </div>
        {view === "board" ? (
          <ReadinessBoardView board={doc.board} />
        ) : (
          <article className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-8">
            <ReleaseMarkdown>{doc.markdown}</ReleaseMarkdown>
          </article>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-sm items-center px-4 py-10">
      <form
        className="w-full space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft"
        onSubmit={(e) => { e.preventDefault(); if (!login.isPending) login.mutate(); }}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-marine/10 text-marine"><Lock className="h-5 w-5" /></span>
          <div>
            <h1 className="font-display text-lg font-bold text-navy">Kesiapan Rilis</h1>
            <p className="text-xs text-muted-foreground">Halaman internal. Masuk untuk melihat laporan.</p>
          </div>
        </div>
        <label className="block text-sm font-medium text-navy">
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required maxLength={100}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm font-medium text-navy">
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required maxLength={200}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        {login.isError ? (
          <p className="text-xs text-red-700">{login.error instanceof Error ? login.error.message : String(login.error)}</p>
        ) : null}
        <button type="submit" disabled={login.isPending}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-marine px-3 py-2 text-sm font-semibold text-white hover:bg-marine/90 disabled:opacity-60">
          {login.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Masuk
        </button>
      </form>
    </main>
  );
}
