// Temporary page for reporting release readiness to supervisors (to be removed).
// Content comes from dokumen/KESIAPAN_RILIS.md through a server check; see
// src/lib/release/release-readiness.functions.ts. The login is kept in memory only.
import { useState, type ComponentProps } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ClipboardCheck, Loader2, Lock, LogOut } from "lucide-react";
import { getReleaseReadiness } from "@/lib/release/release-readiness.functions";

export const Route = createFileRoute("/kesiapanrilis")({
  head: () => ({ meta: [{ title: "Kesiapan Rilis — BARUNA" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ReleaseReadinessPage,
});

type Md = ComponentProps<typeof ReactMarkdown>["components"];
const components: Md = {
  h1: (p) => <h1 className="font-display text-2xl font-extrabold text-navy sm:text-3xl" {...p} />,
  h2: (p) => <h2 className="mt-8 border-b border-border pb-2 font-display text-xl font-bold text-navy" {...p} />,
  h3: (p) => <h3 className="mt-6 font-display text-lg font-bold text-navy" {...p} />,
  p: (p) => <p className="mt-3 text-sm leading-relaxed text-foreground" {...p} />,
  ul: (p) => <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed" {...p} />,
  ol: (p) => <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed" {...p} />,
  a: (p) => <a className="font-semibold text-marine underline" target="_blank" rel="noreferrer" {...p} />,
  code: (p) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]" {...p} />,
  hr: () => <hr className="my-6 border-border" />,
  table: (p) => (
    <div className="mt-3 overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-sm" {...p} />
    </div>
  ),
  th: (p) => <th className="border-b border-border bg-muted/60 px-3 py-2 font-semibold text-navy" {...p} />,
  td: (p) => <td className="border-b border-border px-3 py-2 align-top" {...p} />,
};

function ReleaseReadinessPage() {
  const fetchFn = useServerFn(getReleaseReadiness);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [markdown, setMarkdown] = useState<string | null>(null);
  const login = useMutation({
    mutationFn: () => fetchFn({ data: { username: username.trim(), password } }),
    onSuccess: (res) => { setMarkdown(res.markdown); setPassword(""); },
  });

  if (markdown !== null) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-navy px-5 py-4 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="h-5 w-5" /> Laporan kesiapan rilis (internal, jangan disebarkan)</div>
          <button type="button" onClick={() => { setMarkdown(null); setUsername(""); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25">
            <LogOut className="h-3.5 w-3.5" /> Keluar
          </button>
        </div>
        <article className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{markdown}</ReactMarkdown>
        </article>
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
