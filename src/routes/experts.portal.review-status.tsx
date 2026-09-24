import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Eye, ListTree, Paperclip } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { getMyModuleAttachmentLinks } from "@/lib/experts/portal-services.functions";
import { useTrainerPortal } from "@/lib/experts/useTrainerPortal";

export const Route = createFileRoute("/experts/portal/review-status")({
  head: () => ({ meta: [{ title: "Module Review Status — Trainer Portal" }] }),
  component: ReviewStatusPage,
});

function DraftAttachments({ draftId }: { draftId: string }) {
  const loadLinks = useServerFn(getMyModuleAttachmentLinks);
  const query = useQuery({ queryKey: ["experts", "module-attachment-links", draftId], queryFn: () => loadLinks({ data: { draftId } }), staleTime: 4 * 60 * 1000 });
  if (query.isLoading) return <p className="mt-2 text-xs text-muted-foreground">Preparing secure attachment links…</p>;
  if (query.isError) return <p className="mt-2 text-xs text-destructive">Unable to open attachments: {(query.error as Error).message}</p>;
  if (!query.data?.length) return null;
  return <div className="mt-5 border-t border-border pt-4">
    <h3 className="flex items-center gap-2 font-display text-sm font-bold text-navy"><Paperclip className="h-4 w-4" />Submitted Attachments</h3>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">{query.data.map((file) => <a key={file.path} href={file.signedUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"><span className="min-w-0"><span className="block truncate font-semibold text-navy">{file.name}</span><span className="text-xs capitalize text-muted-foreground">{file.category.replaceAll("_", " ")}</span></span><span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-marine"><Eye className="h-4 w-4" />View Document</span></a>)}</div>
    <p className="mt-2 text-xs text-muted-foreground">Secure links expire after 5 minutes.</p>
  </div>;
}

function ReviewStatusPage() {
  const query = useTrainerPortal();
  const drafts = query.data?.moduleDrafts ?? [];
  return <PageShell sidebar={{ ...EXPERTS_SIDEBAR_META, title: "Trainer Portal", subtitle: "Module review pipeline.", sections: trainerPortalNav("/experts/portal/review-status") }} cta={{ icon: ListTree, title: "Transparent review history", description: "Decisions and reviewer comments come directly from governance records.", button: "Back to Dashboard", href: "/experts/portal" }}><div className="space-y-6">
    <div><h1 className="font-display text-3xl font-extrabold text-navy">Module Review Status</h1><p className="mt-2 text-sm text-muted-foreground">Track every module draft and submitted review subject.</p></div>
    {query.isLoading ? <p className="text-sm text-muted-foreground">Loading module reviews…</p> : drafts.length ? <div className="space-y-4">{drafts.map((draft) => <section key={draft.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-muted-foreground">Module</p><h2 className="mt-1 font-display text-xl font-bold text-navy">{draft.title}</h2><p className="mt-1 text-xs text-muted-foreground">Updated {new Date(draft.updatedAt).toLocaleDateString()}</p></div><span className="rounded-full bg-marine/10 px-3 py-1 text-xs font-bold capitalize text-marine">{(draft.reviewStatus ?? draft.status).replaceAll("_", " ")}</span></div><DraftAttachments draftId={draft.id} /><h3 className="mt-5 font-display text-sm font-bold text-navy">Review History</h3>{draft.reviewHistory.length ? <ul className="mt-2 divide-y divide-border">{draft.reviewHistory.map((history, index) => <li key={`${history.at}-${index}`} className="py-3"><div className="flex justify-between gap-2"><b className="text-sm text-navy">{history.actor}</b><span className="text-xs text-muted-foreground">{new Date(history.at).toLocaleString()}</span></div><p className="mt-1 text-xs font-semibold capitalize text-marine">{history.decision.replaceAll("_", " ")}</p>{history.comment && <p className="mt-1 text-sm text-foreground/75">{history.comment}</p>}</li>)}</ul> : <p className="mt-2 flex items-center gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground"><Clock className="h-4 w-4" />No reviewer decision has been recorded yet.</p>}</section>)}</div> : <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center"><ListTree className="mx-auto h-8 w-8 text-marine" /><p className="mt-3 font-display text-lg font-bold text-navy">No module submissions yet</p><p className="mt-1 text-sm text-muted-foreground">Saved drafts and submitted modules will appear here.</p></div>}
  </div></PageShell>;
}
