import { createFileRoute, Link } from "@tanstack/react-router";
import { HelpCircle, MessageSquare, BookOpen, Mail } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help & Support — BARUNA" }, { name: "description", content: "Get help using BARUNA — FAQ, contact, and guides." }] }),
  component: HelpPage,
});

const FAQS = [
  { q: "How do I enroll in a Self-Paced Course?", a: "Open a Self-Paced Course, then click Enroll. In Presentation Mode nothing is saved to a real store." },
  { q: "How do I become a BARUNA Trainer?", a: "Complete the Become a Trainer application under Experts. Approval is manual." },
  { q: "How is my certificate verified?", a: "Every certificate carries a verification code and QR link to a public verification page." },
  { q: "Is my data safe in Presentation Mode?", a: "Yes — Presentation Mode never writes to production storage." },
];

function HelpPage() {
  return (
    <PageShell
      sidebar={{ icon: HelpCircle, title: "Help & Support", subtitle: "Answers, guides, and contact.", sections: [{ label: "Sections", items: [
        { label: "FAQ", active: true }, { label: "About BARUNA", to: "/about" }, { label: "Contact", to: "/help#contact" },
      ] }] }}
      cta={{ icon: Mail, title: "Still stuck?", description: "Contact the BARUNA support team.", button: "Email Support", href: "/help#contact" }}
    >
      <h1 className="font-display text-3xl font-extrabold text-navy">Help & Support</h1>
      <p className="mt-1 text-sm text-muted-foreground">Everything you need to use the BARUNA demo.</p>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link to="/about" className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:border-marine/50">
          <BookOpen className="h-6 w-6 text-marine" />
          <p className="mt-2 font-bold text-navy">User guides</p>
          <p className="text-xs text-muted-foreground">How BARUNA works and how to navigate.</p>
        </Link>
        <Link to="/community" className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:border-marine/50">
          <MessageSquare className="h-6 w-6 text-marine" />
          <p className="mt-2 font-bold text-navy">Ask the community</p>
          <p className="text-xs text-muted-foreground">Post questions to the Communities of Practice.</p>
        </Link>
        <a href="mailto:hello@example.com" id="contact" className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:border-marine/50">
          <Mail className="h-6 w-6 text-marine" />
          <p className="mt-2 font-bold text-navy">Contact support</p>
          <p className="text-xs text-muted-foreground">hello@example.com — synthetic demo address.</p>
        </a>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold text-navy">Frequently asked questions</h2>
        <dl className="mt-4 space-y-4">
          {FAQS.map((f) => (
            <div key={f.q}>
              <dt className="text-sm font-bold text-navy">{f.q}</dt>
              <dd className="mt-1 text-sm text-foreground/80">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </PageShell>
  );
}
