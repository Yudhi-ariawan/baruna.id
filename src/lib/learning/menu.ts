// ============================================================================
// BARUNA Learning Architecture — Dynamic Menu resolver
// ----------------------------------------------------------------------------
// Resolves the final ordered menu for a (template × delivery mode × offering)
// triple. Placeholder items are never returned — only enabled items.
// ============================================================================

import { getDeliveryMode } from "./deliveryModes";
import { LEARNING_TEMPLATES, type MenuItemId } from "./templates";
import type { CourseOffering, MasterCourse } from "./types";

const MENU_LABELS: Record<MenuItemId, string> = {
  overview: "Overview",
  journey: "My Learning Journey",
  orientation: "Orientation",
  schedule: "Schedule",
  announcements: "Announcements",
  "pre-test": "Pre-Test",
  modules: "Learning Modules",
  phases: "Learning Phases",
  "guided-practice": "Guided Practice",
  "live-sessions": "Live Sessions",
  assignments: "Assignments",
  evidence: "Evidence Upload",
  project: "Project Builder",
  discussion: "Discussion",
  "post-test": "Post-Test",
  "final-assessment": "Final Assessment",
  "in-person": "In-Person Training",
  travel: "Travel & Logistics",
  "expert-review": "Expert Review",
  "assessor-review": "Assessor Review",
  resources: "Resources",
  evaluation: "Evaluation",
  certificate: "Certificate",
  alumni: "Alumni",
  faq: "FAQ",
};

export function menuLabel(id: MenuItemId): string {
  return MENU_LABELS[id];
}

export function resolveMenu(
  master: MasterCourse,
  offering: CourseOffering,
): MenuItemId[] {
  const template = LEARNING_TEMPLATES[master.template];
  const delivery = getDeliveryMode(offering.deliveryMode);

  const seen = new Set<MenuItemId>();
  const items: MenuItemId[] = [];
  const add = (id: MenuItemId) => {
    if (seen.has(id)) return;
    seen.add(id);
    items.push(id);
  };

  add("overview");
  template.defaultMenu.forEach(add);
  delivery.extraMenu.forEach(add);
  (offering.extraMenu ?? []).forEach(add);

  const hide = new Set<MenuItemId>(offering.hideMenu ?? []);
  // Feature-flag pruning: drop items that the delivery mode doesn't support.
  const f = delivery.features;
  if (!f.schedule) hide.add("schedule");
  if (!f.liveSessions) hide.add("live-sessions");
  if (!f.announcements) hide.add("announcements");
  if (!f.discussion) hide.add("discussion");
  if (!f.inPerson) hide.add("in-person");
  if (!f.travel) hide.add("travel");
  if (!f.attendance) hide.add("assessor-review");
  // Certificate rules pruning
  const hasReviewCert = master.certificates.some((c) => c.requiresReview);
  if (!hasReviewCert) {
    hide.add("expert-review");
    hide.add("assessor-review");
  }

  return items.filter((id) => !hide.has(id));
}
