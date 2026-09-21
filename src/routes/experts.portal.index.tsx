import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LayoutDashboard, Award, BookOpen, Users, TrendingUp, FileEdit, ArrowRight, History } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { LEVEL_LABEL, formatUsp } from "@/lib/trainerModules";
import { getTrainerPortalBootstrap } from "@/lib/experts/portal-services.functions";

export const Route = createFileRoute("/experts/portal/")({
  head: () => ({ meta: [{ title: "Trainer Portal — BARUNA Experts" }, { name: "description", content: "Private dashboard for approved BARUNA trainers." }], links: [{ rel: "canonical", href: "/experts/portal" }] }),
  component: PortalDashboard,
});

function PortalDashboard() {
  const load = useServerFn(getTrainerPortalBootstrap);
  const query = useQuery({ queryKey: ["experts", "trainer-portal-dashboard"], queryFn: () => load(), retry: false });
  const data = query.data;
  if (query.isLoading) return <div className="p-10 text-sm text-muted-foreground">Loading trainer workspace…</div>;
  if (!data?.trainer || data.access !== "active_trainer") return <div className="p-10 text-sm text-destructive">Trainer workspace data is unavailable.</div>;
  const trainer = data.trainer;
  const modules = data.modules ?? [];
  const history = data.history ?? [];
  const approvedModules = modules.filter((m) => m.status === "approved" || m.status === "published").length;
  const published = modules.filter((m) => m.status === "published").length;
  const instructionalHours = history.reduce((sum, item) => sum + (item.startDate && item.endDate ? Math.max(1, Math.round((Date.parse(item.endDate) - Date.parse(item.startDate)) / 86400000) + 1) * 8 : 0), 0);
  const learningHours = instructionalHours * trainer.uniqueSuccessfulParticipants;
  return <PageShell sidebar={{ ...EXPERTS_SIDEBAR_META, title: "Trainer Portal", subtitle: "Approved BARUNA Trainer workspace.", sections: trainerPortalNav("/experts/portal") }} cta={{ icon: LayoutDashboard, title: "Ready to submit your next module?", description: "Additional modules unlock as your recognition level grows.", button: "Submit a Module", href: "/experts/portal/submit-module" }}><div className="space-y-6">
    <header className="rounded-2xl border border-marine/20 bg-gradient-to-br from-marine/5 to-transparent p-6"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-marine"><LayoutDashboard className="h-3.5 w-3.5" /> Welcome back</p><h1 className="mt-2 font-display text-3xl font-extrabold text-navy">{trainer.fullName}</h1><p className="mt-1 text-sm text-muted-foreground">{[trainer.title, trainer.organization].filter(Boolean).join(" · ")}</p><div className="mt-4 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-marine/10 px-3 py-1 text-xs font-bold text-marine"><Award className="h-3 w-3" /> {LEVEL_LABEL[trainer.level === "not_assigned" ? "none" : trainer.level]}</span><span className="rounded-full bg-eco-community/10 px-3 py-1 text-xs font-semibold text-eco-community">Active trainer since {new Date(trainer.approvedAt).toLocaleDateString()}</span></div></header>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard icon={FileEdit} label="Approved Modules" value={approvedModules} /><StatCard icon={BookOpen} label="Published Courses" value={published} /><StatCard icon={Users} label="Successful Participants" value={formatUsp(trainer.uniqueSuccessfulParticipants)} /><StatCard icon={TrendingUp} label="Learning Hours Generated" value={formatUsp(learningHours)} sub={`${instructionalHours} instructional hours`} /></div>
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold text-navy">My Modules</h2><Link to="/experts/portal/submit-module" className="text-xs font-semibold text-marine">Submit new <ArrowRight className="inline h-3 w-3" /></Link></div>{modules.length ? <div className="mt-4 divide-y divide-border">{modules.slice(0, 5).map((m) => <div key={m.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-navy">{m.title}</p><p className="text-xs text-muted-foreground">Version {m.version} · {m.hours ?? 0} hours{m.language ? ` · ${m.language}` : ""}</p></div><span className="rounded-full bg-marine/10 px-3 py-1 text-xs font-bold capitalize text-marine">{m.status.replaceAll("_", " ")}</span></div>)}</div> : <Empty icon={BookOpen} text="No canonical modules have been assigned to your expert profile yet." />}</section>
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft"><h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy"><History className="h-5 w-5 text-marine" /> Training History</h2>{history.length ? <div className="mt-4 space-y-3">{history.slice(0, 5).map((h) => <div key={h.id} className="rounded-xl border border-border p-4"><p className="text-sm font-bold text-navy">{h.title}</p><p className="mt-1 text-xs text-muted-foreground">{[h.organizer, h.country, h.participants ? `${h.participants} participants` : null].filter(Boolean).join(" · ")}</p></div>)}</div> : <Empty icon={History} text="No facilitation history has been recorded yet." />}</section>
  </div></PageShell>;
}
function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) { return <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center"><Icon className="mx-auto h-6 w-6 text-marine" /><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>; }
function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) { return <div className="rounded-2xl border border-border bg-card p-4 shadow-soft"><div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground"><Icon className="h-3.5 w-3.5 text-marine" /> {label}</div><p className="mt-2 font-display text-2xl font-extrabold text-navy">{value}</p>{sub && <p className="mt-1 text-[0.65rem] text-muted-foreground">{sub}</p>}</div>; }
