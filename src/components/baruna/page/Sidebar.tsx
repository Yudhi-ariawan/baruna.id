import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useLanguage } from "@/lib/i18n";

export type SidebarItem = {
  label: string;
  icon?: LucideIcon;
  count?: number;
  active?: boolean;
  to?: string;
};

export type SidebarSection = {
  label?: string;
  items: SidebarItem[];
};

export type SidebarProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  sections: SidebarSection[];
  footer?: { icon: LucideIcon; label: string };
  extra?: ReactNode;
};

const labelMap: Record<string, string> = {
  "Academy Menu": "sidebar.academyMenu",
  "Overview": "sidebar.overview",
  "Training Programs": "sidebar.trainingPrograms",
  "All Programs": "sidebar.allPrograms",
  "Training": "sidebar.training",
  "Webinar": "sidebar.webinar",
  "Workshop": "sidebar.workshop",
  "Certification": "sidebar.certification",
  "Self-Paced Course": "sidebar.selfPacedCourse",
  "Self-Paced Courses": "sidebar.selfPacedCourse",
  "Training Archive": "sidebar.trainingArchive",
  "All Archived Programs": "sidebar.allArchivedPrograms",
  "2024 Edition — Fisheries": "sidebar.edition2024",
  "Alumni": "sidebar.alumni",
  "Alumni Directory": "sidebar.alumniDirectory",
  "Alumni Network": "sidebar.alumniNetwork",
  "My Journey": "sidebar.myJourney",
  "My Applications": "sidebar.myApplications",
  "My Learning": "sidebar.myLearning",
  "My Training Requests": "sidebar.myTrainingRequests",
  "Browse": "sidebar.browse",
  "By Category": "sidebar.byCategory",
  "Learning Pathways": "sidebar.learningPathways",
  "Certificates": "sidebar.certificates",
  "Instructors": "sidebar.instructors",
  "Organizations": "sidebar.organizations",
  "Browse by Type": "sidebar.browseByType",
  "Publications": "sidebar.publications",
  "Learning Modules": "sidebar.learningModules",
  "Best Practices": "sidebar.bestPractices",
  "Videos": "sidebar.videos",
  "Policy Briefs": "sidebar.policyBriefs",
  "Infographics": "sidebar.infographics",
  "Case Studies": "sidebar.caseStudies",
  "Toolkits": "sidebar.toolkits",
  "Resource Library": "sidebar.resourceLibrary",
  "All Resources": "sidebar.allResources",
  "Submit Resource": "sidebar.submitResource",
  "Submit a Resource": "sidebar.submitResource",
  "My Contributions": "sidebar.myContributions",
  "Saved Items": "sidebar.savedItems",
  "Knowledge Hub": "knowledgeHub.title",
  "Experts": "experts.title",
  "Expert Directory": "sidebar.expertDirectory",
  "Browse Experts": "sidebar.findAnExpert",
  "Find an Expert": "sidebar.findAnExpert",
  "Become an Expert": "sidebar.becomeAnExpert",
  "Join as an Expert": "sidebar.becomeAnExpert",
  "Become a BARUNA Trainer": "sidebar.becomeATrainer",
  "Expert Services": "sidebar.expertServices",
  "Trainer Portal": "sidebar.trainerPortal",
  "Teaching Portfolio": "sidebar.teachingPortfolio",
  "Trainer Recognition": "sidebar.trainerRecognition",
  "Expert Contributions": "sidebar.expertContributions",
  "FAQs": "sidebar.faqs",
  "FAQ": "sidebar.faqs",
  "My Account": "sidebar.myAccount",
  "My Expert Profile": "sidebar.myExpertProfile",
  "My Requests": "sidebar.myRequests",
  "Opportunities": "sidebar.opportunities",
  "My Exchange": "sidebar.myExchange",
  "Fellowships": "sidebar.fellowships",
  "Short-term Exchange": "sidebar.shortTermExchange",
  "Training & Attachment": "sidebar.trainingAttachment",
  "Research Collaboration": "sidebar.researchCollaboration",
  "Mentorship Programs": "sidebar.mentorshipPrograms",
  "Guidelines": "sidebar.guidelines",
  "Partner Institutions": "sidebar.partnerInstitutions",
  "Success Stories": "sidebar.successStories",
  "Community Home": "sidebar.communityHome",
  "Discussions": "sidebar.discussions",
  "Groups": "sidebar.groups",
  "Member Directory": "sidebar.memberDirectory",
  "My Network": "sidebar.myNetwork",
  "Messages": "sidebar.messages",
  "Topics": "sidebar.topics",
  "Resource Sharing": "sidebar.resourceSharing",
  "My Activity": "sidebar.myActivity",
  "Following": "sidebar.following",
  "Events Home": "sidebar.eventsHome",
  "All Events": "sidebar.allEvents",
  "Event Calendar": "sidebar.eventCalendar",
  "Categories": "sidebar.categories",
  "Host an Event": "sidebar.hostAnEvent",
  "Submit an Event": "sidebar.submitAnEvent",
  "Call for Speakers": "sidebar.callForSpeakers",
  "Past Events": "sidebar.pastEvents",
  "My Registrations": "sidebar.myRegistrations",
  "Partnership Home": "sidebar.partnershipHome",
  "Our Partners": "sidebar.ourPartners",
  "Partnership Opportunities": "sidebar.partnershipOpportunities",
  "Active Collaborations": "sidebar.activeCollaborations",
  "MoUs & Agreements": "sidebar.mousAgreements",
  "Sectors": "sidebar.sectors",
  "Regions": "sidebar.regions",
  "Impact Stories": "sidebar.impactStories",
  "Resources for Partners": "sidebar.resourcesForPartners",
  "My Collaborations": "sidebar.myCollaborations",
  "The Inspiration Behind BARUNA": "sidebar.theInspiration",
  "Mission & Vision": "sidebar.missionVision",
  "Values": "sidebar.values",
  "What We Do": "sidebar.whatWeDo",
  "Impact & Outcomes": "sidebar.impactOutcomes",
  "Roadmap 2026–2030": "sidebar.roadmap",
  "Governance & Partners": "sidebar.governancePartners",
  "Platform": "sidebar.platform",
  "Executive Summary": "sidebar.executiveSummary",
  "Annual Report": "sidebar.annualReport",
  "Filters": "sidebar.filters",
  "Sections": "sidebar.sections",
  "All results": "search.allResults",
  "BARUNA Experts": "experts.title",
  "Help & Support": "help.title",
  "Global Search": "search.title",
  "Fellowship & Exchange": "fellowship.title",
  "Community": "community.title",
  "Partnership": "partnership.title",
  "About BARUNA": "about.title",
};

export function Sidebar({ icon: Icon, title, subtitle, sections, footer, extra }: SidebarProps) {
  const { t } = useLanguage();

  const translateLabel = (text?: string) => {
    if (!text) return "";
    const mapped = labelMap[text];
    if (mapped) return t(mapped, text);
    return t(text, text);
  };

  const translatedTitle = translateLabel(title) || title;
  const translatedSubtitle = translateLabel(subtitle) || subtitle;
  const RenderIcon = typeof Icon === "function" || (typeof Icon === "object" && Icon !== null) ? Icon : null;

  return (
    <aside className="hidden w-full shrink-0 lg:block lg:w-[260px]">
      <div className="sticky top-24 space-y-5">
        <div className="rounded-2xl bg-navy p-5 text-navy-foreground shadow-card">
          <div className="flex items-start gap-3">
            {RenderIcon && (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-foreground/10">
                <RenderIcon className="h-5 w-5" />
              </div>
            )}
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">{translatedTitle}</h2>
              <p className="mt-1 text-xs leading-relaxed text-navy-foreground/80">{translatedSubtitle}</p>
            </div>
          </div>
        </div>

        <nav className="rounded-2xl border border-border bg-card p-3 shadow-soft">
          {(sections || []).map((section, si) => (
            <div key={si} className={si > 0 ? "mt-4" : ""}>
              {section.label && (
                <p className="px-3 pb-2 pt-1 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                  {translateLabel(section.label)}
                </p>
              )}
              <ul className="space-y-0.5">
                {(section.items || []).map((item) => {
                  const itemLabel = translateLabel(item.label);
                  const cls = `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    item.active
                      ? "bg-marine/10 text-marine"
                      : "text-foreground/75 hover:bg-muted hover:text-marine"
                  }`;
                  const ItemIcon = typeof item.icon === "function" || (typeof item.icon === "object" && item.icon !== null) ? item.icon : null;
                  const inner = (
                    <>
                      {ItemIcon && <ItemIcon className="h-4 w-4 shrink-0" />}
                      <span className="flex-1 truncate">{itemLabel}</span>
                      {item.count != null && (
                        <span className="text-xs font-semibold text-muted-foreground">
                          {item.count}
                        </span>
                      )}
                    </>
                  );
                  return (
                    <li key={item.label}>
                      {item.to ? (
                        <Link to={item.to} className={cls}>
                          {inner}
                        </Link>
                      ) : (
                        <button type="button" className={cls}>{inner}</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {footer && (
            <button type="button" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-marine py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground cursor-pointer">
              {footer.icon && (typeof footer.icon === "function" || typeof footer.icon === "object") ? (
                <footer.icon className="h-4 w-4" />
              ) : null}
              {translateLabel(footer.label)}
            </button>
          )}
        </nav>
        {extra}
      </div>
    </aside>
  );
}
