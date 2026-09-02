import { createFileRoute } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { publicExpertsNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";

export const Route = createFileRoute("/experts/faqs")({
  head: () => ({
    meta: [
      { title: "Experts FAQs — BARUNA" },
      { name: "description", content: "Frequently asked questions about BARUNA experts, trainers, module submission, and recognition." },
      { property: "og:title", content: "Experts FAQs — BARUNA" },
      { property: "og:description", content: "Experts, trainers, and recognition FAQs." },
    ],
    links: [{ rel: "canonical", href: "/experts/faqs" }],
  }),
  component: FaqPage,
});

const FAQS = [
  { q: "Is every expert automatically a BARUNA Trainer?", a: "No. Being a Verified BARUNA Expert is a prerequisite, but Trainer status requires a separate application, technical review, and teaching-competency review." },
  { q: "How many modules can a new trainer submit?", a: "Each newly Approved BARUNA Trainer may submit ONE initial module. Additional modules unlock only after the first module is approved, published, and maintains satisfactory quality performance." },
  { q: "What counts as a Unique Successful Participant?", a: "A participant is counted only when they complete all required content, pass the assessment at or above the required passing score, and submit the course evaluation. Page views, downloads, or incomplete enrollments do not count." },
  { q: "When do I receive a Certificate of Training Delivery?", a: "You become Eligible for Certificate Review after at least 30 Unique Successful Participants and meeting quality requirements. Certificates are issued only after administrative verification." },
  { q: "Are recognition levels awarded automatically?", a: "No. Reaching a numerical threshold makes you Eligible for Level Review. Recognition is awarded only after admin verification of participant uniqueness, quality gates, and professional contribution requirements." },
  { q: "What is the difference between Instructional Hours and Participant Learning Hours Generated?", a: "Instructional Hours is the official duration of your module. Participant Learning Hours Generated = Instructional Hours × Unique Successful Participants — it is a learning-reach metric, not a claim of teaching hours delivered." },
  { q: "Where is my published module distributed?", a: "One approved module becomes: (1) a master module in the Knowledge Hub, (2) a standalone Self-Paced Course, (3) a listing on your Expert Profile, (4) a record in your Teaching Portfolio, and (5) available for inclusion in Full Training Programs — from one master record, never duplicated." },
];

function FaqPage() {
  return (
    <PageShell
      sidebar={{ ...EXPERTS_SIDEBAR_META, sections: publicExpertsNav("/experts/faqs") }}
      cta={{ icon: HelpCircle, title: "Still have questions?", description: "Contact the BARUNA Experts team.", button: "About BARUNA", href: "/about" }}
    >
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-extrabold text-navy">Experts FAQs</h1>
        <div className="space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-border bg-card p-5 shadow-soft">
              <summary className="cursor-pointer list-none font-display text-sm font-bold text-navy">{f.q}</summary>
              <p className="mt-3 text-sm text-foreground/80">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
