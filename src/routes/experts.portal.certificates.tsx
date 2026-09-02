import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Download, Award } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { DEMO_TRAINER, DEMO_MODULE, LEVEL_LABEL } from "@/lib/trainerModules";

export const Route = createFileRoute("/experts/portal/certificates")({
  head: () => ({
    meta: [
      { title: "Certificates — Trainer Portal" },
      { name: "description", content: "Certificates of Training Delivery and BARUNA recognition certificates." },
    ],
    links: [{ rel: "canonical", href: "/experts/portal/certificates" }],
  }),
  component: CertificatesPage,
});

function CertificatesPage() {
  const certs = [
    {
      title: "Certificate of Training Delivery",
      subtitle: DEMO_MODULE.title,
      ref: `BARUNA/CTD/2025/${DEMO_MODULE.code}/001`,
      issued: "2025-04-30",
      body: `Awarded to ${DEMO_TRAINER.fullName} for delivering ${DEMO_MODULE.title} to ${DEMO_TRAINER.uniqueSuccessfulParticipants} Unique Successful Participants.`,
    },
    {
      title: `${LEVEL_LABEL[DEMO_TRAINER.awardedLevel]} Certificate`,
      subtitle: "Recognition Level",
      ref: `BARUNA/REC/2025/${DEMO_TRAINER.trainerId}`,
      issued: "2025-05-10",
      body: `Recognises ${DEMO_TRAINER.fullName} for sustained, verified contribution to marine and fisheries capacity development.`,
    },
  ];

  return (
    <PageShell
      sidebar={{ ...EXPERTS_SIDEBAR_META, title: "Trainer Portal", subtitle: "Your BARUNA certificates.", sections: trainerPortalNav("/experts/portal/certificates") }}
      cta={{ icon: BadgeCheck, title: "Certificates are verifiable", description: "Every certificate carries a unique BARUNA reference number and can be verified publicly.", button: "Recognition Levels", href: "/experts/recognition" }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Certificates</h1>
          <p className="mt-2 text-sm text-muted-foreground">All certificates are issued only after administrative verification.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {certs.map((c) => (
            <article key={c.ref} className="relative overflow-hidden rounded-2xl border-2 border-navy/10 bg-gradient-to-br from-marine/5 to-transparent p-6 shadow-soft">
              <Award className="absolute -right-6 -top-6 h-32 w-32 text-marine/5" />
              <p className="text-[0.65rem] font-bold uppercase tracking-widest text-marine">{c.title}</p>
              <h3 className="mt-2 font-display text-xl font-extrabold text-navy">{c.subtitle}</h3>
              <p className="mt-3 max-w-md text-sm text-foreground/75">{c.body}</p>
              <div className="mt-5 flex items-center justify-between text-[0.7rem]">
                <div>
                  <p className="font-bold text-muted-foreground">Reference</p>
                  <p className="font-mono text-navy">{c.ref}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-muted-foreground">Issued</p>
                  <p className="text-navy">{c.issued}</p>
                </div>
              </div>
              <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-marine px-4 py-2 text-xs font-semibold text-marine-foreground hover:bg-navy">
                <Download className="h-3.5 w-3.5" /> Download PDF
              </button>
            </article>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
