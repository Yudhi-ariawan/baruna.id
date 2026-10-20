import { PlayCircle, FileText, Presentation, BookOpen, ListChecks, type LucideIcon } from "lucide-react";
import type { LmsModule, ResourceKind } from "@/data/lms";

export const TABS = ["Welcome", "Modules", "Assessment", "Assignments", "Completion"] as const;
export type Tab = (typeof TABS)[number];

export type AssessmentId = "preTest" | "postTest" | "finalExam";

// Synthetic modules used to drive the standalone assessments through the shared
// quiz engine. Only id/no/title are read by ModuleQuiz.
export function assessmentModule(id: AssessmentId, title: string): LmsModule {
  return {
    id,
    no: 0,
    title,
    category: "Assessment",
    summary: "",
    hours: 0,
    objectives: [],
    resources: {},
  } as unknown as LmsModule;
}

export const resourceMeta: Record<ResourceKind, { icon: LucideIcon; label: string }> = {
  video: { icon: PlayCircle, label: "Video" },
  pdf: { icon: FileText, label: "PDF Module" },
  ppt: { icon: Presentation, label: "PowerPoint" },
  reading: { icon: BookOpen, label: "Additional Reading" },
  quiz: { icon: ListChecks, label: "Quiz" },
};

export const RESOURCE_ORDER: ResourceKind[] = ["pdf", "ppt", "video", "reading", "quiz"];
