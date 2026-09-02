// Shared Knowledge Hub sidebar meta so every catalogue/detail page renders
// consistent navigation to Publications, Learning Modules, Best Practices,
// Videos, Policy Briefs, Infographics, Case Studies, Toolkits, and the
// unified Resource Library.
import {
  BookOpen,
  FileText,
  GraduationCap,
  Award,
  Video,
  ScrollText,
  PieChart,
  FolderOpen,
  Layers,
  Library,
  Compass,
  Plus,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { KH_TYPES, countByType, totalPublished } from "@/data/demo/knowledgeHub";
import type { SidebarSection } from "@/components/baruna/page/Sidebar";

const ICONS: Record<string, LucideIcon> = {
  publications: FileText,
  "learning-modules": GraduationCap,
  "best-practices": Award,
  videos: Video,
  "policy-briefs": ScrollText,
  infographics: PieChart,
  "case-studies": FolderOpen,
  toolkits: Layers,
};

export const KH_SIDEBAR_META = {
  icon: BookOpen,
  title: "Knowledge Hub",
  subtitle:
    "Explore, discover, and share knowledge for a sustainable ocean and fisheries future.",
};

export function knowledgeHubSidebarSections(
  activeType: string | null = null,
): SidebarSection[] {
  const browse = KH_TYPES.map((t) => ({
    label: t.label,
    icon: ICONS[t.slug],
    count: countByType(t.slug),
    to: `/knowledge-hub/${t.slug}`,
    active: activeType === t.slug,
  }));
  browse.push({
    label: "Resource Library",
    icon: Library,
    count: totalPublished(),
    to: "/knowledge-hub/library",
    active: activeType === "library",
  });
  return [
    { label: "Browse by Type", items: browse },
    {
      label: "Knowledge Hub",
      items: [
        { label: "All Resources", icon: Compass, to: "/knowledge-hub" },
        { label: "Submit Resource", icon: Plus, to: "/knowledge-hub/submit-resource" },
        { label: "My Contributions", icon: ListChecks, to: "/knowledge-hub/my-contributions" },
        { label: "Saved Items", icon: BookOpen, to: "/saved" },
      ],
    },
  ];
}
