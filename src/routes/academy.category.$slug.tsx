import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import {
  GraduationCap,
  Users,
  MapPin,
  Target,
  Globe,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import {
  AcademyHeader,
  StatusBadge,
  FilterPanel,
  FilterSearch,
  FilterGroup,
  CheckRow,
  FilterSelect,
  ApplyButton,
  AsidePanel,
} from "@/components/baruna/academy/ui";
import { Tag } from "@/components/baruna/page/primitives";
import { categories, categoryBySlug, type AcademyCategory } from "@/data/categories";
import { getPublishedModulesCatalog, type PublishedCatalogModule } from "@/lib/learning/learning.functions";
import { academyCategorySlugs } from "@/lib/academy/module-categories";
import defaultCover from "@/assets/self-paced/m01.jpg";

export const Route = createFileRoute("/academy/category/$slug")({
  loader: async ({ params }) => {
    const normalizedSlug = params.slug === "fish-processing-value-addition"
      ? "fish-processing-and-value-addition"
      : params.slug;
    const category = categoryBySlug[normalizedSlug];
    if (!category) throw notFound();
    const modules = (await getPublishedModulesCatalog()).filter((module) =>
      academyCategorySlugs(module).includes(normalizedSlug),
    );
    return { category, modules };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.category;
    if (!c) return {};
    const url = `/academy/category/${c.slug}`;
    return {
      meta: [
        { title: `${c.title} — Academy — BARUNA` },
        { name: "description", content: c.description },
        { property: "og:title", content: `${c.title} — Academy — BARUNA` },
        { property: "og:description", content: c.description },
        { property: "og:image", content: c.heroImage },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <AcademyShell active="categories">
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Category not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The category you're looking for doesn't exist.
        </p>
        <Link
          to="/academy/category/$slug"
          params={{ slug: categories[0].slug }}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground"
        >
          Browse categories <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </AcademyShell>
  ),
  component: CategoryPage,
});

/* ---------------- Stat cards ---------------- */

function StatCards({ modules }: { modules: PublishedCatalogModule[] }) {
  const instructors = new Set(modules.map((module) => module.authorName).filter(Boolean)).size;
  const items = [
    { icon: GraduationCap, value: String(modules.length), label: "Published Courses", active: true },
    { icon: Users, value: String(instructors), label: "Verified Instructors" },
    { icon: MapPin, value: "Online", label: "Availability" },
    { icon: Target, value: "Self-Paced", label: "Learning Format" },
    { icon: Globe, value: "BARUNA", label: "Platform" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(({ icon: Icon, value, label, active }) => (
        <div
          key={label}
          className={`flex items-center gap-3 rounded-xl border p-3.5 transition-colors ${
            active ? "border-marine bg-marine/5" : "border-border bg-card hover:border-marine/40"
          }`}
        >
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
              active ? "bg-marine/15 text-marine" : "bg-secondary text-marine"
            }`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="font-display text-lg font-extrabold text-navy">{value}</p>
            <p className="truncate text-[0.7rem] text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Filter tabs (pills) ---------------- */

const filterTabs = [
  "All",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Self-paced",
  "Training",
  "Webinar",
  "Workshop",
  "Certification",
];

function CategoryTabs() {
  return (
    <div className="flex flex-wrap gap-2.5">
      {filterTabs.map((t, i) => (
        <button
          key={t}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
            i === 0
              ? "bg-marine text-marine-foreground shadow-soft"
              : "border border-border bg-card text-navy hover:-translate-y-0.5 hover:border-marine/40 hover:text-marine"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Course card ---------------- */

function CourseGridCard({ course }: { course: PublishedCatalogModule }) {
  return (
    <Link
      to="/academy/self-paced/$code"
      params={{ code: course.id }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-hover"
    >
      <div className="relative h-36 overflow-hidden">
        <img
          src={course.coverUrl || defaultCover}
          alt={course.title}
          loading="lazy"
          width={768}
          height={512}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute left-2.5 top-2.5">
          <StatusBadge label="AVAILABLE ONLINE" />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 min-h-[2.75rem] font-display text-[0.95rem] font-bold leading-snug text-navy">
          {course.title}
        </h3>
        <p className="mt-2 line-clamp-1 text-[0.7rem] font-semibold text-marine">{course.authorName}</p>
        <p className="mt-1 text-[0.7rem] font-medium text-muted-foreground">
          {course.estimated_learning_hours} Learning Hours · {course.language}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="text-xs font-semibold text-foreground">Self-Paced Course</span>
          <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-marine">View <ArrowRight className="h-3.5 w-3.5" /></span>
        </div>
      </div>
    </Link>
  );
}

/* ---------------- Pagination ---------------- */

function Pagination() {
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <button className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-marine/40 hover:text-marine">
        <ChevronLeft className="h-4 w-4" />
      </button>
      {[1, 2, 3].map((p) => (
        <button
          key={p}
          className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-semibold transition-colors ${
            p === 1
              ? "bg-marine text-marine-foreground"
              : "border border-border bg-card text-navy hover:border-marine/40 hover:text-marine"
          }`}
        >
          {p}
        </button>
      ))}
      <button className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-marine/40 hover:text-marine">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function CategoryPage() {
  const { category, modules } = Route.useLoaderData() as { category: AcademyCategory; modules: PublishedCatalogModule[] };
  const instructors = Array.from(
    new Map(modules.map((module) => [module.authorName, module])).values(),
  );

  return (
    <AcademyShell
      active="categories"
      activeCategory={category.slug}
      aside={
        <>
          <FilterPanel title="Filter Courses">
            <FilterSearch placeholder="Search within results..." />
            <FilterGroup label="Level">
              {category.levelCounts.map((l) => (
                <CheckRow key={l.label} label={l.label} count={l.count} />
              ))}
            </FilterGroup>
            <FilterGroup label="Format">
              {category.formatCounts.map((f) => (
                <CheckRow key={f.label} label={f.label} count={f.count} />
              ))}
            </FilterGroup>
            <FilterGroup label="Duration">
              <FilterSelect placeholder="All Durations" />
            </FilterGroup>
            <FilterGroup label="Language">
              <FilterSelect placeholder="All Languages" />
            </FilterGroup>
            <ApplyButton />
          </FilterPanel>

          <AsidePanel title="Verified Instructors" action="View all">
            <ul className="space-y-4">
              {instructors.map((module) => (
                <li key={module.authorName} className="flex items-start gap-3">
                  {module.authorAvatar ? <img src={module.authorAvatar} alt={module.authorName} loading="lazy" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-marine/10 text-sm font-bold text-marine">{module.authorName.charAt(0)}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-tight text-navy">{module.authorName}</p>
                    <p className="text-xs text-muted-foreground">Verified BARUNA Instructor</p>
                  </div>
                </li>
              ))}
            </ul>
          </AsidePanel>

          <AsidePanel title="Upcoming Events" action="View all">
            <ul className="space-y-4">
              {category.events.map((e) => (
                <li key={e.title} className="flex gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-secondary text-center leading-none">
                    <span className="text-[0.55rem] font-bold uppercase text-marine">{e.month}</span>
                    <span className="text-sm font-extrabold text-navy">{e.day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="line-clamp-2 text-xs font-semibold leading-snug text-navy">{e.title}</h4>
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{e.location}</p>
                  </div>
                  <span className="h-fit shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[0.6rem] font-bold text-marine">
                    {e.type}
                  </span>
                </li>
              ))}
            </ul>
            <button className="mt-4 flex w-full items-center gap-1.5 text-sm font-semibold text-marine hover:text-navy">
              <CalendarDays className="h-4 w-4" /> Go to Event Calendar <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </AsidePanel>

          <AsidePanel title="Popular Topics">
            <div className="flex flex-wrap gap-2">
              {category.relatedTopics.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          </AsidePanel>
        </>
      }
    >
      <div className="space-y-6">
        <AcademyHeader
          crumb={category.title}
          parent="Browse by Category"
          title={category.title}
          description={category.description}
          searchPlaceholder="Search courses, topics, or instructors..."
        />

        <StatCards modules={modules} />

        <CategoryTabs />

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Showing {modules.length} published {modules.length === 1 ? "course" : "courses"}
          </p>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">View as:</span>
            <button className="grid h-8 w-8 place-items-center rounded-lg bg-marine text-marine-foreground">
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-marine">
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {modules.map((course) => (
            <CourseGridCard key={course.id} course={course} />
          ))}
        </div>

        {modules.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-soft">
            <GraduationCap className="mx-auto h-10 w-10 text-marine/60" />
            <h2 className="mt-3 font-display text-lg font-bold text-navy">No published courses in this category yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Approved public courses will appear here after their category metadata has been verified.</p>
          </div>
        )}

        {modules.length > 12 && <Pagination />}
      </div>
    </AcademyShell>
  );
}
