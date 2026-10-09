import {
  ArrowRight,
  MapPin,
  Calendar,
  Download,
  FileText,
  Play,
  Users,
  Building2,
  Globe,
  UserRound,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  events,
  fellowships,
  partners,
} from "@/data/baruna";
import { useLanguage } from "@/lib/i18n";
import type { HomeKnowledgeResource } from "@/lib/home/home.types";
import type { PublicExpert } from "@/lib/experts/directory.types";

function ColHeader({ title, action, href }: { title: string; action: string; href: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="font-display text-base font-bold text-navy">{title}</h2>
      <Link
        to={href}
        className="inline-flex shrink-0 items-center gap-1 text-[0.7rem] font-semibold text-marine transition-colors hover:text-navy"
      >
        {action}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

const eventBadge: Record<string, string> = {
  Blended: "bg-badge-webinar/10 text-badge-webinar",
  Online: "bg-badge-training/10 text-badge-training",
  "In-person": "bg-eco-fellowship/10 text-eco-fellowship",
};

const resourceColor: Record<string, string> = {
  publication: "text-badge-course",
  policy_brief: "text-badge-training",
  video: "text-eco-events",
  module: "text-marine",
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-soft min-w-0">{children}</div>
  );
}

function UpcomingEvents() {
  const { t } = useLanguage();
  return (
    <Card>
      <ColHeader title={t("bottomGrid.upcomingEvents")} action={t("bottomGrid.viewAllEvents")} href="/events" />
      <ul className="space-y-4">
        {events.map((e) => (
          <li key={e.title} className="flex gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary text-center leading-none">
              <span className="text-[0.6rem] font-bold uppercase text-marine">{e.month}</span>
              <span className="text-base font-extrabold text-navy">{e.day}</span>
              <span className="text-[0.55rem] text-muted-foreground">{e.year}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold leading-snug text-navy">{e.title}</h3>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {e.location}
              </p>
            </div>
            <span
              className={`h-fit shrink-0 rounded-md px-2 py-0.5 text-[0.6rem] font-bold ${eventBadge[e.type] ?? "bg-muted"}`}
            >
              {e.type}
            </span>
          </li>
        ))}
      </ul>
      <Link
        to="/events/calendar"
        className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold text-marine"
      >
        <Calendar className="h-3.5 w-3.5" />
        {t("bottomGrid.goToEventCalendar")}
      </Link>
    </Card>
  );
}

function KnowledgeHubCard({ resources }: { resources: HomeKnowledgeResource[] }) {
  const { t } = useLanguage();
  return (
    <Card>
      <ColHeader title={t("bottomGrid.latestFromKnowledgeHub")} action={t("bottomGrid.viewAllResources")} href="/knowledge-hub" />
      {resources.length > 0 ? (
      <ul className="space-y-4">
        {resources.map((resource) => {
          const Icon = resource.type === "video" ? Play : FileText;
          const actionClass = "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-marine transition-colors hover:bg-marine hover:text-marine-foreground";
          return (
            <li key={resource.id} className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className={`text-[0.6rem] font-bold uppercase tracking-wide ${resourceColor[resource.type] ?? "text-muted-foreground"}`}>
                  {resource.typeLabel}
                </p>
                <Link to="/knowledge-hub/resource/$id" params={{ id: resource.id }} className="mt-0.5 block text-sm font-semibold leading-snug text-navy hover:text-marine">
                  {resource.title}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">{resource.metaLabel}</p>
              </div>
              {resource.externalUrl ? (
                <a href={resource.externalUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${resource.title}`} className={actionClass}>
                  <Icon className="h-4 w-4" />
                </a>
              ) : (
                <Link to="/knowledge-hub/resource/$id" params={{ id: resource.id }} aria-label={`View ${resource.title}`} className={actionClass}>
                  <Icon className="h-4 w-4" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      ) : (
        <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center">
          <div>
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-2 text-sm font-semibold text-navy">No public resources yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Published Knowledge Hub resources will appear here.</p>
          </div>
        </div>
      )}
      <Link
        to="/knowledge-hub"
        className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold text-marine"
      >
        <Download className="h-3.5 w-3.5" />
        {t("bottomGrid.goToKnowledgeHub")}
      </Link>
    </Card>
  );
}

function FeaturedExperts({ experts }: { experts: PublicExpert[] }) {
  const { t } = useLanguage();
  return (
    <Card>
      <ColHeader title={t("bottomGrid.featuredExperts")} action={t("bottomGrid.viewAllExperts")} href="/experts" />
      {experts.length > 0 ? (
      <ul className="space-y-4">
        {experts.map((ex) => (
          <li key={ex.id} className="flex items-start gap-3">
            {ex.avatarUrl ? (
              <img src={ex.avatarUrl} alt={ex.displayName} loading="lazy" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full border border-border object-cover object-center" />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-marine/10 text-marine"><UserRound className="h-5 w-5" /></span>
            )}
            <div className="min-w-0 flex-1">
              <Link to="/experts/$slug" params={{ slug: ex.slug }} className="text-sm font-semibold leading-tight text-navy hover:text-marine">{ex.displayName}</Link>
              <p className="mt-0.5 line-clamp-1 text-xs leading-snug text-muted-foreground">{ex.headline || ex.institutionRole || "BARUNA Expert"}</p>
              {ex.institution && <p className="mt-0.5 line-clamp-1 text-[0.7rem] text-muted-foreground">{ex.institution}</p>}
            </div>
            <Link to="/experts/$slug" params={{ slug: ex.slug }} aria-label={`View ${ex.displayName}'s profile`} className="shrink-0 text-muted-foreground transition-colors hover:text-marine"><ArrowRight className="h-4 w-4" /></Link>
          </li>
        ))}
      </ul>
      ) : (
        <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center">
          <div><Users className="mx-auto h-8 w-8 text-muted-foreground/60" /><p className="mt-2 text-sm font-semibold text-navy">No featured experts yet</p><p className="mt-1 text-xs text-muted-foreground">Verified experts will appear here.</p></div>
        </div>
      )}
      <Link
        to="/experts"
        className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold text-marine"
      >
        <Users className="h-3.5 w-3.5" />
        {t("bottomGrid.browseExperts")}
      </Link>
    </Card>
  );
}

function FellowshipCard() {
  const { t } = useLanguage();
  return (
    <Card>
      <ColHeader title={t("bottomGrid.fellowshipOpportunities")} action={t("bottomGrid.viewAllOpportunities")} href="/fellowship" />
      <ul className="space-y-4">
        {fellowships.map((f) => (
          <li key={f.title} className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-[0.6rem] font-bold text-navy">
              {f.abbr}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold leading-snug text-navy">{f.title}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{f.deadline}</p>
            </div>
          </li>
        ))}
      </ul>
      <Link
        to="/fellowship"
        className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold text-marine"
      >
        <Globe className="h-3.5 w-3.5" />
        {t("bottomGrid.exploreOpportunities")}
      </Link>
    </Card>
  );
}

function PartnershipCard() {
  const { t } = useLanguage();
  return (
    <Card>
      <ColHeader title={t("bottomGrid.partnershipHighlights")} action={t("bottomGrid.viewAllPartners")} href="/partnership" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {partners.map((p) => (
          <div
            key={p}
            className="flex h-14 sm:h-16 items-center justify-center rounded-lg border border-border bg-secondary/50 px-2 text-center text-[0.65rem] font-bold uppercase tracking-tight text-navy/70"
          >
            {p}
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t("bottomGrid.partnershipSubtitle")}
      </p>
      <Link
        to="/partnership"
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-marine py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground cursor-pointer"
      >
        <Building2 className="h-4 w-4" />
        {t("bottomGrid.becomePartner")}
      </Link>
    </Card>
  );
}

export function BottomGrid({
  latestResources,
  featuredExperts,
}: {
  latestResources: HomeKnowledgeResource[];
  featuredExperts: PublicExpert[];
}) {
  return (
    <section className="mx-auto max-w-[1500px] px-3 sm:px-6 py-8 sm:py-10 w-full overflow-hidden">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5 w-full">
        <UpcomingEvents />
        <KnowledgeHubCard resources={latestResources} />
        <FeaturedExperts experts={featuredExperts} />
        <FellowshipCard />
        <PartnershipCard />
      </div>
    </section>
  );
}
