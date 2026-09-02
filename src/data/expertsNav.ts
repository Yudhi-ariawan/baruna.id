// Shared Experts sidebar navigation used across every /experts/* route.
import {
  Users,
  Search,
  UserPlus,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  BookOpenCheck,
  Award,
  ScrollText,
  HelpCircle,
  Wrench,
  FileEdit,
  ListTree,
  BadgeCheck,
  BarChart3,
  Inbox,
  UserSquare2,
  ClipboardCheck,
} from "lucide-react";
import type { SidebarSection } from "@/components/baruna/page/Sidebar";

export function publicExpertsNav(activeTo?: string): SidebarSection[] {
  const items = [
    { label: "Expert Directory", icon: Users, to: "/experts/directory" },
    { label: "Find an Expert", icon: Search, to: "/experts" },
    { label: "Become an Expert", icon: UserPlus, to: "/experts/join" },
    { label: "Become a BARUNA Trainer", icon: GraduationCap, to: "/experts/become-trainer" },
    { label: "Expert Services", icon: Handshake, to: "/experts/services" },
    { label: "Trainer Portal", icon: LayoutDashboard, to: "/experts/portal" },
    { label: "Teaching Portfolio", icon: BookOpenCheck, to: "/experts/portal/portfolio" },
    { label: "Trainer Recognition", icon: Award, to: "/experts/recognition" },
    { label: "Expert Contributions", icon: ScrollText, to: "/experts/contributions" },
    { label: "FAQs", icon: HelpCircle, to: "/experts/faqs" },
  ];
  return [
    { label: "Experts", items: items.map((i) => ({ ...i, active: i.to === activeTo })) },
    {
      label: "My Account",
      items: [
        { label: "My Expert Profile", icon: UserSquare2, to: "/experts/profile", active: activeTo === "/experts/profile" },
        { label: "My Requests", icon: ClipboardCheck, to: "/experts/my-requests", active: activeTo === "/experts/my-requests" },
      ],
    },
  ];
}

export function trainerPortalNav(activeTo?: string): SidebarSection[] {
  const items = [
    { label: "Dashboard", icon: LayoutDashboard, to: "/experts/portal" },
    { label: "Submit Module", icon: FileEdit, to: "/experts/portal/submit-module" },
    { label: "Module Review Status", icon: ListTree, to: "/experts/portal/review-status" },
    { label: "Teaching Portfolio", icon: BookOpenCheck, to: "/experts/portal/portfolio" },
    { label: "Certificates", icon: BadgeCheck, to: "/experts/portal/certificates" },
    { label: "Recognition Level", icon: Award, to: "/experts/portal/recognition" },
    { label: "Learner Statistics", icon: BarChart3, to: "/experts/portal/analytics" },
    { label: "Service Requests", icon: Inbox, to: "/experts/portal/service-requests" },
  ];
  return [
    { label: "Trainer Portal", items: items.map((i) => ({ ...i, active: i.to === activeTo })) },
    {
      label: "Back",
      items: [{ label: "Public Experts", icon: Users, to: "/experts" }],
    },
  ];
}

export const EXPERTS_SIDEBAR_META = {
  icon: Wrench,
  title: "BARUNA Experts",
  subtitle:
    "Expert directory, trainer qualification, teaching portfolios, tiered recognition, and expert services.",
};
