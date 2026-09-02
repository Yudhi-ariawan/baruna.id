import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  FileText,
  GraduationCap,
  Info,
  Layers,
  MessageCircleQuestion,
  Play,
  Award,
  Users,
  Bookmark,
  Wrench,
  ArrowRight,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { StatusBadge } from "@/components/baruna/academy/ui";
import {
  AZA_META,
  AZA_MODULES,
  AZA_OUTCOMES,
  AZA_AUDIENCE,
  AZA_PREREQUISITE,
  AZA_JOURNEY,
  AZA_PROJECT_COMPONENTS,
  AZA_PROJECT_UPLOADS,
  AZA_WEIGHTS,
  AZA_RESOURCES,
  AZA_TECHNICAL,
  AZA_RELATED,
  AZA_FAQ,
  AZA_PASS_MARK,
  AZA_LEARN_ID,
} from "@/data/aza";
import { useAza, enroll, toggleSaved } from "@/lib/aza";

export const Route = createFileRoute("/academy/training/allocated-zones-for-aquaculture")({
  head: () => ({
    meta: [
      { title: `${AZA_META.title} — Training — BARUNA Academy` },
      { name: "description", content: AZA_META.shortDescription },
      { property: "og:title", content: `${AZA_META.fullTitle} — BARUNA Academy` },
      { property: "og:description", content: AZA_META.shortDescription },
      { property: "og:image", content: AZA_META.hero },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: AZA_META.hero },
    ],
    links: [{ rel: "canonical", href: "/academy/training/allocated-zones-for-aquaculture" }],
  }),
  component: AzaDetailPage,
});

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-7"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-marine/10 text-marine">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="font-display text-xl font-extrabold text-navy sm:text-2xl">{title}</h2>
      </div>
      <div className="text-sm leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}

function MetaPill({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-marine/20 bg-card/70 px-3 py-1 text-xs font-medium text-foreground/80">
      <Icon className="h-3.5 w-3.5 text-marine" />
      {children}
    </span>
  );
}

function AzaDetailPage() {
  const [state, update] = useAza();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const navigate = useNavigate();

  const onEnroll = () => {
    update(enroll);
    navigate({ to: "/academy/learn/allocated-zones-for-aquaculture" });
  };
  const onSave = () => update(toggleSaved);

  return (
    <AcademyShell active="training">
      <div className="space-y-6">
        {/* ---------------- Hero ---------------- */}
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
          <div className="relative">
            <img
              src={AZA_META.hero}
              alt={AZA_META.title}
              className="h-56 w-full object-cover sm:h-72"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label="OPEN ENROLLMENT" />
                <StatusBadge label="FULLY ONLINE" />
                <StatusBadge label="INDIVIDUAL SELF-PACED" />
              </div>
              <h1 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">
                {AZA_META.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-white/85 sm:text-base">
                {AZA_META.fullTitle}
              </p>
              <p className="mt-1 text-xs italic text-white/70">{AZA_META.subtitle}</p>
              <p className="mt-2 font-display text-sm font-semibold text-accent">
                {AZA_META.tagline}
              </p>
            </div>
          </div>

          <div className="border-t border-border p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <MetaPill icon={GraduationCap}>{AZA_META.level}</MetaPill>
              <MetaPill icon={Layers}>{AZA_META.format}</MetaPill>
              <MetaPill icon={Users}>{AZA_META.mode}</MetaPill>
              <MetaPill icon={Calendar}>{AZA_META.enrollment}</MetaPill>
              <MetaPill icon={Clock}>{AZA_META.hours}</MetaPill>
              <MetaPill icon={Calendar}>{AZA_META.access}</MetaPill>
              <MetaPill icon={BookOpen}>
                {AZA_META.language} · {AZA_META.languageSupport}
              </MetaPill>
              <MetaPill icon={Award}>Digital Certificate Available</MetaPill>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {state.enrolled ? (
                <Link
                  to="/academy/learn/allocated-zones-for-aquaculture"
                  className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-marine/90 hover:shadow-hover"
                >
                  <Play className="h-4 w-4" /> Continue Learning
                </Link>

              ) : (
                <button
                  onClick={onEnroll}
                  className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-marine/90 hover:shadow-hover"
                >
                  <Play className="h-4 w-4" /> Start Learning
                </button>
              )}
              <a
                href="#curriculum"
                className="inline-flex items-center gap-2 rounded-xl border border-marine/30 bg-card px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:border-marine hover:bg-marine/5"
              >
                <ClipboardList className="h-4 w-4" /> View Curriculum
              </a>
              <a
                href="/course-guides/aza-course-guide.pdf"
                onClick={(e) => {
                  e.preventDefault();
                  const blob = new Blob(
                    [
                      `BARUNA Academy — ${AZA_META.title}\n\n${AZA_META.fullTitle}\n\n${AZA_META.shortDescription}\n\nModules:\n${AZA_MODULES.map(
                        (m) => `  ${m.no}. ${m.title}`,
                      ).join("\n")}\n\nAssessment pass mark: ${AZA_PASS_MARK}/100.`,
                    ],
                    { type: "text/plain" },
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "aza-course-guide.txt";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:border-marine/40"
              >
                <Download className="h-4 w-4" /> Download Course Guide
              </a>
              <Link
                to="/academy/request-training"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:border-marine/40"
              >
                <MessageCircleQuestion className="h-4 w-4" /> Ask a Question
              </Link>
              <button
                onClick={onSave}
                className={`inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors ${
                  state.saved
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-card text-navy hover:border-marine/40"
                }`}
              >
                <Bookmark className={`h-4 w-4 ${state.saved ? "fill-current" : ""}`} />
                {state.saved ? "Saved" : "Save for Later"}
              </button>
            </div>
          </div>
        </section>

        {/* ---------------- Program Overview ---------------- */}
        <Section id="overview" icon={Info} title="Program Overview">
          <p className="mb-3">
            This individual self-paced training introduces the principles and methodological
            process for establishing Allocated Zones for Aquaculture, or AZAs.
          </p>
          <p className="mb-3">
            Participants learn how Marine Spatial Planning provides the broader multi-sectoral
            spatial framework, while AZA translates that framework into more detailed planning
            specifically for sustainable aquaculture development.
          </p>
          <p className="mb-3">
            The course covers spatial-use conflicts, governance, data requirements, environmental
            and socio-economic criteria, stakeholder analysis, multi-criteria assessment,
            carrying capacity, and environmental monitoring.
          </p>
          <p>
            Each participant completes an individual preliminary AZA planning proposal using
            either a BARUNA simulation case or a selected area from their own professional
            context.
          </p>
        </Section>

        {/* ---------------- Why This Matters ---------------- */}
        <Section id="why" icon={Info} title="Why This Training Matters">
          <ul className="space-y-2">
            {[
              "Aquaculture must share limited marine and coastal space with fisheries, tourism, shipping, energy, conservation and coastal infrastructure.",
              "Without spatial planning, sector expansion generates conflicts, environmental damage and stalled licensing.",
              "MSP and AZA provide a proven, participatory framework for reconciling these uses.",
              "This training equips public officials and practitioners to plan sustainable aquaculture zones — independently and at their own pace.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-marine" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* ---------------- Learning Outcomes ---------------- */}
        <Section id="outcomes" icon={GraduationCap} title="Learning Outcomes">
          <p className="mb-3">After completing the course, participants should be able to:</p>
          <ol className="grid gap-2 sm:grid-cols-2">
            {AZA_OUTCOMES.map((o, i) => (
              <li key={o} className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-marine/15 text-xs font-bold text-marine">
                  {i + 1}
                </span>
                <span>{o}</span>
              </li>
            ))}
          </ol>
        </Section>

        {/* ---------------- Target Participants ---------------- */}
        <Section id="audience" icon={Users} title="Who Should Join">
          <ul className="grid gap-2 sm:grid-cols-2">
            {AZA_AUDIENCE.map((a) => (
              <li key={a} className="flex items-start gap-2">
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-marine" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-marine/20 bg-marine/5 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-marine" />
            <p className="text-xs text-foreground/80">
              <span className="font-semibold text-navy">Prerequisite:</span> {AZA_PREREQUISITE}
            </p>
          </div>
        </Section>

        {/* ---------------- Curriculum ---------------- */}
        <Section id="curriculum" icon={BookOpen} title="Course Curriculum">
          <div className="space-y-3">
            {AZA_MODULES.map((m) => (
              <details
                key={m.no}
                className="group rounded-xl border border-border bg-muted/30 open:bg-card"
              >
                <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-marine text-sm font-bold text-marine-foreground">
                    {m.no}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display font-bold text-navy">{m.title}</p>
                      <span className="rounded-full bg-marine/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-marine">
                        {m.code}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground/70">
                        {m.hours}h · {m.quiz.length}Q{m.assignment ? " · assignment" : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{m.summary}</p>
                  </div>
                  <ChevronDown className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-border p-4 pt-3 text-xs">
                  <p className="font-semibold text-navy">Content</p>
                  <ul className="mt-1 space-y-1 pl-4">
                    {m.content.map((c) => (
                      <li key={c} className="list-disc marker:text-marine">
                        {c}
                      </li>
                    ))}
                  </ul>
                  {m.activity && (
                    <>
                      <p className="mt-3 font-semibold text-navy">Activity</p>
                      <p className="mt-1 text-foreground/80">{m.activity}</p>
                    </>
                  )}
                  {m.assignment && (
                    <>
                      <p className="mt-3 font-semibold text-navy">Assignment</p>
                      <p className="mt-1 text-foreground/80">
                        <span className="font-medium">{m.assignment.title}</span> —{" "}
                        {m.assignment.instructions}
                      </p>
                    </>
                  )}
                </div>
              </details>
            ))}
          </div>
        </Section>

        {/* ---------------- Learning Journey ---------------- */}
        <Section id="journey" icon={Layers} title="Individual Learning Journey">
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {AZA_JOURNEY.map((step, i) => (
              <li
                key={step}
                className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-marine/15 text-[10px] font-bold text-marine">
                  {i + 1}
                </span>
                <span className="text-foreground/80">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            Participants never have to wait for other participants. Progress is individual and
            fully asynchronous.
          </p>
        </Section>

        {/* ---------------- Final Project ---------------- */}
        <Section id="project" icon={FileText} title="Final Individual Project">
          <p className="mb-3 font-display font-semibold text-navy">
            Preliminary Allocated Zone for Aquaculture Proposal
          </p>
          <p className="mb-3">
            The final project is completed individually. Participants choose one of two options:
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-marine/20 bg-marine/5 p-3">
              <p className="text-xs font-bold text-marine">OPTION A</p>
              <p className="mt-1 font-semibold text-navy">BARUNA Simulation Case</p>
              <p className="mt-1 text-xs text-foreground/70">
                Use a standard fictional coastal-area dataset supplied by BARUNA.
              </p>
            </div>
            <div className="rounded-xl border border-marine/20 bg-marine/5 p-3">
              <p className="text-xs font-bold text-marine">OPTION B</p>
              <p className="mt-1 font-semibold text-navy">Participant's Own Area</p>
              <p className="mt-1 text-xs text-foreground/70">
                Use a selected professional, local, regional or national area.
              </p>
            </div>
          </div>
          <p className="mb-2 font-semibold text-navy">Required components</p>
          <ul className="mb-4 grid gap-1 sm:grid-cols-2">
            {AZA_PROJECT_COMPONENTS.map((c, i) => (
              <li key={c} className="text-xs text-foreground/80">
                {i + 1}. {c}
              </li>
            ))}
          </ul>
          <p className="mb-2 font-semibold text-navy">Uploads</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {AZA_PROJECT_UPLOADS.map((u) => (
              <li key={u.key} className="text-xs text-foreground/80">
                {u.required ? "• " : "• (optional) "}
                {u.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            The optional recorded presentation does not affect certification eligibility.
          </p>
        </Section>

        {/* ---------------- Assessment ---------------- */}
        <Section id="assessment" icon={ClipboardList} title="Assessment and Completion Requirements">
          <p className="mb-3">Weighting:</p>
          <div className="mb-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 text-navy">
                <tr>
                  <th className="p-2 font-semibold">Component</th>
                  <th className="p-2 font-semibold">Weight</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Module quizzes", AZA_WEIGHTS.quizzes],
                  ["Institutional and stakeholder mapping", AZA_WEIGHTS.institutionalStakeholder],
                  ["Spatial data inventory", AZA_WEIGHTS.spatialInventory],
                  ["AZA criteria matrix", AZA_WEIGHTS.criteriaMatrix],
                  ["Environmental Monitoring Plan", AZA_WEIGHTS.monitoringPlan],
                  ["Final Individual AZA Proposal", AZA_WEIGHTS.finalProject],
                  ["Post-course reflection", AZA_WEIGHTS.reflection],
                ].map(([label, w]) => (
                  <tr key={label as string} className="border-t border-border">
                    <td className="p-2">{label}</td>
                    <td className="p-2 font-semibold text-marine">{w}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            Pre-test is diagnostic only and excluded from the final grade. Passing grade: minimum{" "}
            {AZA_PASS_MARK}/100.
          </p>
          <p className="mt-3 font-semibold text-navy">Completion requires:</p>
          <ul className="mt-1 grid gap-1 sm:grid-cols-2">
            {[
              "Complete every mandatory module",
              "Complete every mandatory quiz",
              "Submit all required individual assignments",
              "Complete the final individual project",
              "Complete the post-test",
              `Achieve a minimum final score of ${AZA_PASS_MARK}`,
              "Obtain final-project approval",
              "Complete the course evaluation",
            ].map((r) => (
              <li key={r} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-marine" />
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            No live attendance, cohort, group work, discussion-forum participation, peer review,
            synchronous presentation, or waiting for another participant is required.
          </p>
        </Section>

        {/* ---------------- Expert Review ---------------- */}
        <Section id="review" icon={Users} title="Expert Review Process">
          <p className="mb-3">
            Final projects are reviewed asynchronously by an assigned expert. Feedback target:
            within five working days after a complete submission.
          </p>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Submit Final Project",
              "Administrative Completeness Check",
              "Assigned Expert Review",
              "Written Feedback",
              "Revision Required or Approved",
              "Participant Revision if Required",
              "Resubmission",
              "Final Approval",
              "Certificate Issued",
            ].map((s, i) => (
              <li
                key={s}
                className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-marine/15 text-[10px] font-bold text-marine">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </Section>

        {/* ---------------- Certificate ---------------- */}
        <Section id="certificate" icon={Award} title="Certificate">
          <p className="mb-3">
            <span className="font-semibold text-navy">{AZA_META.certificate}</span> —{" "}
            {AZA_META.fullTitle}.
          </p>
          <p className="mb-3 text-xs">
            Issued only after all completion requirements and final-project approval are met.
            Includes the participant's full name, course title, learning format, estimated
            learning hours, completion date, certificate number, QR-code verification, an
            authorised electronic signature, and a certificate verification link.
          </p>
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">Attribution</p>
            <p className="mt-1">
              Learning content developed with reference to the FAO–GFCM AZA approach. Participants
              are not described as "FAO certified" or "GFCM certified", and FAO/GFCM logos are
              not shown as certificate issuers unless separate formal authorisation is provided.
            </p>
          </div>
        </Section>

        {/* ---------------- Learning Resources ---------------- */}
        <Section id="resources" icon={FileText} title="Learning Resources">
          <ul className="grid gap-1 sm:grid-cols-2">
            {AZA_RESOURCES.map((r) => (
              <li key={r} className="flex items-start gap-2 text-xs">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-marine" />
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            The original reference presentation is not the only learning content. Material is
            delivered as short learning units, narrated slides, concise reading pages, diagrams,
            infographics, interactive knowledge checks, quizzes, individual exercises, and
            downloadable templates.
          </p>
        </Section>

        {/* ---------------- Technical Requirements ---------------- */}
        <Section id="technical" icon={Wrench} title="Technical Requirements">
          <ul className="space-y-1 text-xs">
            {AZA_TECHNICAL.map((t) => (
              <li key={t} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-marine" />
                {t}
              </li>
            ))}
          </ul>
        </Section>

        {/* ---------------- Related Programs ---------------- */}
        <Section id="related" icon={Layers} title="Related Programs">
          <div className="grid gap-3 sm:grid-cols-2">
            {AZA_RELATED.map((r) => (
              <a
                key={r.title}
                href={r.href}
                className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3 text-sm transition-colors hover:border-marine/40 hover:bg-card"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase text-marine">{r.tag}</p>
                  <p className="mt-0.5 truncate font-medium text-navy">{r.title}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-marine" />
              </a>
            ))}
          </div>
        </Section>

        {/* ---------------- FAQ ---------------- */}
        <Section id="faq" icon={MessageCircleQuestion} title="Frequently Asked Questions">
          <div className="space-y-2">
            {AZA_FAQ.map((f, i) => (
              <div key={f.q} className="rounded-xl border border-border bg-muted/30">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-start gap-3 p-3 text-left"
                >
                  <ChevronDown
                    className={`mt-0.5 h-4 w-4 shrink-0 text-marine transition-transform ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                  <span className="text-sm font-semibold text-navy">{f.q}</span>
                </button>
                {openFaq === i && (
                  <p className="border-t border-border p-3 pt-2 text-xs text-foreground/80">
                    {f.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AcademyShell>
  );
}
