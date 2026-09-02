import { Link } from "@tanstack/react-router";
import {
  GraduationCap,
  Home,
  BookMarked,
  ChevronDown,
  CheckCircle2,
  FileText,
  ClipboardList,
  Award,
  UserSquare2,
  LayoutGrid,
  Route as RouteIcon,
  Archive,
  Users,
  Network,
  
  Layers,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { categories } from "@/data/categories";
import { pathways } from "@/data/pathways";

export type AcademyActive =
  | "overview"
  | "all-programs"
  | "training"
  | "webinar"
  | "workshop"
  | "certification"
  | "self-paced"
  | "programs-multi"
  | "categories"
  | "pathways"
  | "short-courses"
  | "archive"
  | "edition-2024"
  | "alumni"
  | "alumni-network"
  | "my-applications"
  | "my-learning"
  | "my-training-requests";

type NavLink = {
  label: string;
  key: AcademyActive;
  to: string;
  icon?: LucideIcon;
  search?: Record<string, string>;
};

const programLinks: NavLink[] = [
  { label: "All Programs", key: "all-programs", to: "/academy/programs" },
  { label: "Training", key: "training", to: "/academy/programs", search: { type: "training" } },
  { label: "Webinar", key: "webinar", to: "/academy/programs", search: { type: "webinar" } },
  { label: "Workshop", key: "workshop", to: "/academy/programs", search: { type: "workshop" } },
  { label: "Certification", key: "certification", to: "/academy/programs", search: { type: "certification" } },
  { label: "Self-Paced Course", key: "self-paced", to: "/academy/self-paced" },
];


const archiveLinks: NavLink[] = [
  { label: "All Archived Programs", key: "archive", to: "/academy/archive" },
  { label: "2024 Edition — Fisheries", key: "edition-2024", to: "/academy/edition-2024" },
];

const alumniLinks: NavLink[] = [
  { label: "Alumni Directory", key: "alumni", to: "/academy/alumni" },
  { label: "Alumni Network", key: "alumni-network", to: "/academy/alumni-network" },
];

const myJourneyLinks: (NavLink & { icon: LucideIcon })[] = [
  { label: "My Applications", key: "my-applications", to: "/academy/applications", icon: FileText },
  { label: "My Learning", key: "my-learning", to: "/academy/learn", icon: CheckCircle2 },
  { label: "My Training Requests", key: "my-training-requests", to: "/academy/training-requests", icon: ClipboardList },
];

const topLink =
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors";
const idle = "text-foreground/75 hover:bg-muted hover:text-marine";
const activeCls = "bg-marine/10 text-marine";
const subIdle = "font-medium text-foreground/70 hover:bg-muted hover:text-marine";
const subActive = "bg-marine/10 font-semibold text-marine";

function GroupHeader({
  label,
  icon: Icon,
  open,
  onToggle,
  hasActive,
}: {
  label: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  hasActive: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className={`${topLink} ${hasActive ? "text-marine" : "text-foreground/75 hover:bg-muted"}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
    </button>
  );
}

function SubLink({
  to,
  label,
  active,
  icon: Icon,
  onNavigate,
  params,
  search,
}: {
  to: string;
  label: string;
  active: boolean;
  icon?: LucideIcon;
  onNavigate?: () => void;
  params?: Record<string, string>;
  search?: Record<string, string>;
}) {
  return (
    <li>
      <Link
        to={to as never}
        params={params as never}
        search={search as never}
        onClick={onNavigate}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
          active ? subActive : subIdle
        }`}
      >
        {Icon ? (
          <Icon className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-marine" : "bg-muted-foreground/40"}`} />
        )}
        <span className="flex-1 truncate">{label}</span>
      </Link>
    </li>
  );
}


export function AcademySidebar({
  active: current,
  activeCategory,
  activePathway,
  onNavigate,
}: {
  active: AcademyActive;
  activeCategory?: string;
  activePathway?: string;
  onNavigate?: () => void;
}) {
  const isProgramsActive =
    current === "programs-multi" || programLinks.some((p) => p.key === current);

  const isArchiveActive = archiveLinks.some((p) => p.key === current);
  const isAlumniActive = alumniLinks.some((p) => p.key === current);
  const isCategoriesActive = current === "categories" || !!activeCategory;
  const isPathwaysActive = current === "pathways" || !!activePathway;

  const [programsOpen, setProgramsOpen] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(isArchiveActive);
  const [alumniOpen, setAlumniOpen] = useState(isAlumniActive);
  const [categoriesOpen, setCategoriesOpen] = useState(isCategoriesActive);
  const [pathwaysOpen, setPathwaysOpen] = useState(isPathwaysActive);

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="rounded-2xl bg-navy p-5 text-navy-foreground shadow-card">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-foreground/10">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold leading-tight">Academy</h2>
            <p className="mt-1 text-xs leading-relaxed text-navy-foreground/80">
              Learning · Training Archive · Alumni History
            </p>
          </div>
        </div>
      </div>

      {/* Nav card */}
      <nav className="rounded-2xl border border-border bg-card p-3 shadow-soft">
        <p className="px-3 pb-2 pt-1 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
          Academy Menu
        </p>

        <ul className="space-y-0.5">
          <li>
            <Link
              to="/academy"
              onClick={onNavigate}
              className={`${topLink} ${current === "overview" ? activeCls : idle}`}
            >
              <Home className="h-4 w-4 shrink-0" />
              <span className="flex-1">Overview</span>
            </Link>
          </li>

          {/* 1. Training Programs */}
          <li>
            <GroupHeader
              label="Training Programs"
              icon={BookMarked}
              open={programsOpen}
              onToggle={() => setProgramsOpen((o) => !o)}
              hasActive={isProgramsActive}
            />
            {programsOpen && (
              <ul className="mt-0.5 space-y-0.5 pl-4">
                {programLinks.map((p) => (
                  <SubLink key={p.key} to={p.to} search={p.search} label={p.label} active={p.key === current} onNavigate={onNavigate} />

                ))}
              </ul>
            )}
          </li>

          {/* 3. Training Archive */}
          <li>
            <GroupHeader
              label="Training Archive"
              icon={Archive}
              open={archiveOpen}
              onToggle={() => setArchiveOpen((o) => !o)}
              hasActive={isArchiveActive}
            />
            {archiveOpen && (
              <ul className="mt-0.5 space-y-0.5 pl-4">
                {archiveLinks.map((p) => (
                  <SubLink key={p.key} to={p.to} label={p.label} active={p.key === current} onNavigate={onNavigate} />
                ))}
              </ul>
            )}
          </li>

          {/* 4. Alumni */}
          <li>
            <GroupHeader
              label="Alumni"
              icon={Users}
              open={alumniOpen}
              onToggle={() => setAlumniOpen((o) => !o)}
              hasActive={isAlumniActive}
            />
            {alumniOpen && (
              <ul className="mt-0.5 space-y-0.5 pl-4">
                {alumniLinks.map((p) => (
                  <SubLink
                    key={p.key}
                    to={p.to}
                    label={p.label}
                    active={p.key === current}
                    onNavigate={onNavigate}
                    icon={p.key === "alumni-network" ? Network : undefined}
                  />
                ))}
              </ul>
            )}
          </li>

          {/* 5. My Journey */}
          <li className="pt-1">
            <p className="px-3 pb-1 pt-2 text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
              My Journey
            </p>
          </li>
          {myJourneyLinks.map((l) => (
            <li key={l.key}>
              <Link
                to={l.to}
                onClick={onNavigate}
                className={`${topLink} ${current === l.key ? activeCls : idle}`}
              >
                <l.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{l.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="my-3 border-t border-border" />

        {/* Browse */}
        <p className="px-3 pb-2 pt-1 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
          Browse
        </p>
        <ul className="space-y-0.5">
          <li>
            <GroupHeader
              label="By Category"
              icon={LayoutGrid}
              open={categoriesOpen}
              onToggle={() => setCategoriesOpen((o) => !o)}
              hasActive={isCategoriesActive}
            />
            {categoriesOpen && (
              <ul className="mt-0.5 space-y-0.5 pl-4">
                {categories.map((c) => {
                  const Icon = c.icon;
                  return (
                    <SubLink
                      key={c.slug}
                      to="/academy/category/$slug"
                      params={{ slug: c.slug }}
                      label={c.shortLabel}
                      active={c.slug === activeCategory}
                      onNavigate={onNavigate}
                      icon={Icon}
                    />
                  );
                })}
              </ul>
            )}
          </li>
          <li>
            <GroupHeader
              label="Learning Pathways"
              icon={RouteIcon}
              open={pathwaysOpen}
              onToggle={() => setPathwaysOpen((o) => !o)}
              hasActive={isPathwaysActive}
            />
            {pathwaysOpen && (
              <ul className="mt-0.5 space-y-0.5 pl-4">
                {pathways.map((p) => {
                  const Icon = p.icon;
                  return (
                    <SubLink
                      key={p.slug}
                      to="/academy/pathways/$slug"
                      params={{ slug: p.slug }}
                      label={p.shortLabel}
                      active={p.slug === activePathway}
                      onNavigate={onNavigate}
                      icon={Icon}
                    />
                  );
                })}
              </ul>
            )}
          </li>
          <li>
            <button className={`${topLink} ${idle}`}>
              <Award className="h-4 w-4 shrink-0" />
              <span className="flex-1">Certificates</span>
            </button>
          </li>
          <li>
            <button className={`${topLink} ${idle}`}>
              <UserSquare2 className="h-4 w-4 shrink-0" />
              <span className="flex-1">Instructors</span>
            </button>
          </li>
          <li>
            <button className={`${topLink} ${idle}`}>
              <Layers className="h-4 w-4 shrink-0" />
              <span className="flex-1">Organizations</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
