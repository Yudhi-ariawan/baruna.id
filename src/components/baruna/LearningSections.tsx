import { ArrowRight, BarChart3, Clock, UserRound } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  continueLearning,
  type ContinueCourse,
} from "@/data/baruna";
import { useLanguage } from "@/lib/i18n";
import type { PublishedCatalogModule } from "@/lib/learning/learning.functions";
import { MODULE_CATEGORY_LABELS, primaryModuleCategory } from "@/lib/academy/module-categories";
import defaultCover from "@/assets/self-paced/m01.jpg";

const badgeBg: Record<string, string> = {
  COURSE: "bg-badge-course",
  TRAINING: "bg-badge-training",
  WEBINAR: "bg-badge-webinar",
  WORKSHOP: "bg-badge-workshop",
};

function CategoryBadge({ label }: { label: string }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-navy-foreground ${badgeBg[label]}`}
    >
      {label}
    </span>
  );
}

function SectionHead({
  title,
  action,
  href,
}: {
  title: string;
  action: string;
  href: "/academy" | "/academy/learn";
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold text-navy sm:text-xl">{title}</h2>
      <Link
        to={href}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-marine transition-colors hover:text-navy"
      >
        {action}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function ContinueCard({ course }: { course: ContinueCourse }) {
  const { t } = useLanguage();

  return (
    <article className="flex w-[300px] shrink-0 gap-3 rounded-xl border border-border bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-hover sm:w-auto sm:shrink">
      <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-lg">
        <img
          src={course.image}
          alt={course.title}
          loading="lazy"
          width={768}
          height={512}
          className="h-full w-full object-cover"
        />
        <span className="absolute left-1.5 top-1.5">
          <CategoryBadge label={course.tag} />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="line-clamp-2 text-sm font-semibold text-navy">{course.title}</h3>
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          {course.progress}% {t("learning.completed")}
        </p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-marine"
            style={{ width: `${course.progress}%` }}
          />
        </div>
        <button className="mt-auto w-full rounded-lg border border-marine/40 py-1.5 text-xs font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground">
          {t("learning.continueBtn")}
        </button>
      </div>
    </article>
  );
}

function moduleLevel(module: PublishedCatalogModule): string {
  const raw = module.metadata?.level;
  if (typeof raw !== "string" || !raw.trim()) return "Intermediate";
  const normalized = raw.trim().toLowerCase();
  if (normalized === "beginner") return "Beginner";
  if (normalized === "advanced") return "Advanced";
  return "Intermediate";
}

function RecommendedCard({ module }: { module: PublishedCatalogModule }) {
  const categorySlug = primaryModuleCategory(module);
  const category = MODULE_CATEGORY_LABELS[categorySlug] ?? module.topic ?? "Learning Module";
  const hours = Math.max(1, Number(module.estimated_learning_hours || 1));

  return (
    <Link to="/academy/self-paced/$code" params={{ code: module.id }} className="block shrink-0">
      <article className="flex h-full w-[240px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-marine/40 hover:shadow-hover">
        <div className="relative h-28 overflow-hidden bg-muted">
          <img
            src={module.coverUrl || defaultCover}
            alt={`Cover for ${module.title}`}
            loading="lazy"
            width={768}
            height={512}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            onError={(event) => {
              if (event.currentTarget.src !== defaultCover) event.currentTarget.src = defaultCover;
            }}
          />
          <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-navy/90 px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide text-white">
            {category}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-3">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-navy">
            {module.title}
          </h3>
          <p className="mt-1.5 flex items-center gap-1 truncate text-[0.7rem] text-muted-foreground">
            <UserRound className="h-3 w-3 shrink-0" />
            <span className="truncate">{module.authorName || "BARUNA Trainer"}</span>
          </p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-[0.7rem]">
            <span className="flex items-center gap-1 text-muted-foreground">
              <BarChart3 className="h-3 w-3" /> {moduleLevel(module)}
            </span>
            <span className="flex items-center gap-1 font-semibold text-marine">
              <Clock className="h-3 w-3" /> {hours} Learning Hours
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function LearningSections({ publishedModules }: { publishedModules: PublishedCatalogModule[] }) {
  const { t } = useLanguage();

  return (
    <section className="mx-auto max-w-[1500px] px-3 sm:px-6 py-6 sm:py-8 w-full overflow-hidden">
      <div className="grid gap-6 lg:grid-cols-2 w-full">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-soft min-w-0 overflow-hidden">
          <SectionHead
            title={t("learning.continueTitle")}
            action={t("learning.viewAllMyLearning")}
            href="/academy/learn"
          />
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-none sm:grid sm:grid-cols-2 sm:overflow-visible">
            {continueLearning.slice(0, 2).map((c) => (
              <ContinueCard key={c.title} course={c} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-soft min-w-0 overflow-hidden">
          <SectionHead
            title={t("learning.recommendedTitle")}
            action={t("learning.viewAllRecommendations")}
            href="/academy"
          />
          {publishedModules.length > 0 ? (
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-none">
              {publishedModules.slice(0, 6).map((module) => (
                <RecommendedCard key={module.id} module={module} />
              ))}
            </div>
          ) : (
            <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
              <div>
                <p className="text-sm font-semibold text-navy">No published modules are available yet.</p>
                <p className="mt-1 text-xs text-muted-foreground">Verified learning modules will appear here after publication.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
