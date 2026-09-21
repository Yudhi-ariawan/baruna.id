import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileEdit, CheckCircle2, AlertCircle, Send, Info } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import {
  LEVEL_MODULE_LIMIT,
} from "@/lib/trainerModules";
import { useTrainerPortal } from "@/lib/experts/useTrainerPortal";
import { saveTrainerModuleSubmission } from "@/lib/experts/portal-services.functions";

export const Route = createFileRoute("/experts/portal/submit-module")({
  head: () => ({
    meta: [
      { title: "Submit Module — Trainer Portal" },
      { name: "description", content: "Submit a training module for BARUNA review and publication as a Self-Paced Course." },
    ],
    links: [{ rel: "canonical", href: "/experts/portal/submit-module" }],
  }),
  component: SubmitModulePage,
});

const RESOURCES = [
  "Complete module document (PDF)",
  "Presentation slides (PDF or PPT)",
  "Learning video (optional but strongly encouraged)",
  "Quiz / assessment with answer key",
  "Trainer guide",
  "Evaluation form",
  "Course cover image",
  "Practical exercise (if applicable)",
];

const DECLARATIONS = [
  "This is my own original work.",
  "I hold or have cleared all copyrights for included content.",
  "I have no undisclosed conflict of interest.",
  "I accept the BARUNA Code of Conduct and reviewer feedback process.",
];

function SubmitModulePage() {
  const portal=useTrainerPortal(); const trainer=portal.data?.trainer; const modules=portal.data?.modules??[];
  const saveModule=useServerFn(saveTrainerModuleSubmission); const queryClient=useQueryClient();
  const level=trainer?.level==="not_assigned"?"none":trainer?.level??"none";
  const activeModules=modules.filter(m=>["approved","published"].includes(m.status)).length;
  const limit=LEVEL_MODULE_LIMIT[level];
  const gate={allowed:Boolean(trainer)&&activeModules<limit,reason:!trainer?"Trainer profile unavailable.":activeModules>=limit?`Level limit reached (${limit} active modules).`:undefined};
  const [submitted, setSubmitted] = useState(false);
  const [savedAsDraft,setSavedAsDraft]=useState(false); const [saving,setSaving]=useState(false); const [error,setError]=useState<string|null>(null); const [intent,setIntent]=useState<"draft"|"submit">("submit");
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const allDecls = DECLARATIONS.every((_, i) => checked[i]);

  return (
    <PageShell
      sidebar={{ ...EXPERTS_SIDEBAR_META, title: "Trainer Portal", subtitle: "Submit a new training module.", sections: trainerPortalNav("/experts/portal/submit-module") }}
      cta={{ icon: FileEdit, title: "After submission", description: "Your module enters Administrative → Academic → QA → Digital Learning → Final Approval.", button: "View Review Status", href: "/experts/portal/review-status" }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Submit a Training Module</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Your submission enters the BARUNA multi-stage review pipeline. Only Approved modules are published as Self-Paced Courses.
          </p>
        </div>

        {!gate.allowed && (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-destructive"><AlertCircle className="h-4 w-4" /> Submission Blocked</p>
            <p className="mt-1 text-sm text-foreground/80">{gate.reason}</p>
          </div>
        )}

        <div className="rounded-2xl border border-marine/20 bg-marine/5 p-4 text-sm text-foreground/80">
          <p className="flex items-center gap-2 font-bold text-marine"><Info className="h-4 w-4" /> Level limit</p>
          <p className="mt-1">
            Your current level ({level}) allows up to <strong>{limit}</strong> active module{limit === 1 ? "" : "s"}. You currently have <strong>{activeModules}</strong>.
          </p>
        </div>

        {submitted || savedAsDraft ? (
          <div className="rounded-2xl border border-eco-community/30 bg-eco-community/5 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-eco-community" />
            <h2 className="mt-3 font-display text-xl font-bold text-navy">{submitted?"Module submitted":"Draft saved"}</h2>
            <p className="mt-2 text-sm text-foreground/70">{submitted?"Your module is now recorded in the governance review workflow.":"Your module draft is securely stored in Supabase."}</p>
          </div>
        ) : (
          <form
            className="space-y-5"
            onSubmit={async(e) => {
              e.preventDefault();
              if (!gate.allowed || (intent==="submit"&&!allDecls)) return; setSaving(true);setError(null);
              const form=new FormData(e.currentTarget); const title=String(form.get("title")??"");
              try{await saveModule({data:{title,moduleType:"technical",submit:intent==="submit",payload:{title,module_type:"technical",summary:String(form.get("summary")??""),language:String(form.get("language")??""),estimated_learning_hours:Number(form.get("hours")??0),target_participants:String(form.get("targetParticipants")??""),content_outline:{topic:String(form.get("topic")??""),competency:String(form.get("competency")??"")},learning_objectives:String(form.get("objectives")??"").split("\n").filter(Boolean),assessment_approach:{method:String(form.get("assessment")??""),passing_score:Number(form.get("passingScore")??0)},metadata:{level:String(form.get("level")??""),delivery_format:String(form.get("deliveryFormat")??""),copyright_holder:String(form.get("copyrightHolder")??"")}}}});await queryClient.invalidateQueries({queryKey:["experts","trainer-portal-dashboard"]});if(intent==="submit")setSubmitted(true);else setSavedAsDraft(true)}catch(cause){setError(cause instanceof Error?cause.message:"Unable to save module.")}finally{setSaving(false)}
            }}
          >
            <Section title="Module Metadata">
              <Grid>
                <Field label="Module Title" required><input name="title" className={inp} required /></Field>
                <Field label="Topic / Field" required><input name="topic" className={inp} required /></Field>
                <Field label="Competency Area" required><input name="competency" className={inp} required /></Field>
                <Field label="Delivery Format" required>
                  <select name="deliveryFormat" className={inp} required defaultValue="Self-paced">
                    <option>Self-paced</option><option>Scheduled</option><option>Blended</option>
                  </select>
                </Field>
                <Field label="Instructional Hours" required><input name="hours" type="number" min={1} className={inp} required /></Field>
                <Field label="Independent Study Hours"><input type="number" min={0} className={inp} /></Field>
                <Field label="Level" required>
                  <select name="level" className={inp} required defaultValue="Intermediate">
                    <option>Introductory</option><option>Intermediate</option><option>Advanced</option>
                  </select>
                </Field>
                <Field label="Language" required><input name="language" className={inp} defaultValue="English" required /></Field>
              </Grid>
              <Field label="Short Description" required>
                <textarea name="summary" className={`${inp} min-h-[80px]`} required />
              </Field>
              <Field label="Rationale">
                <textarea className={`${inp} min-h-[60px]`} placeholder="Why this module matters strategically." />
              </Field>
            </Section>

            <Section title="Target Learners">
              <Field label="Target Participants" required><input name="targetParticipants" className={inp} required /></Field>
              <Field label="Entry Requirements"><input className={inp} /></Field>
            </Section>

            <Section title="Learning Design">
              <Field label="Learning Objectives" required><textarea name="objectives" className={`${inp} min-h-[80px]`} required /></Field>
              <Field label="Expected Competency Outcomes" required><textarea className={`${inp} min-h-[80px]`} required /></Field>
              <Grid>
                <Field label="Assessment Method" required><input name="assessment" className={inp} required /></Field>
                <Field label="Passing Score (%)" required><input name="passingScore" type="number" min={0} max={100} defaultValue={70} className={inp} required /></Field>
              </Grid>
            </Section>

            <Section title="Attached Resources">
              <ul className="grid gap-2 sm:grid-cols-2">
                {RESOURCES.map((r) => (
                  <li key={r} className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-foreground/70">
                    <input type="file" className="hidden" id={r} />
                    <label htmlFor={r} className="flex-1 cursor-pointer">{r}</label>
                    <span className="text-[0.65rem] font-bold text-marine">UPLOAD</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Copyright, Originality & Ethics">
              <Grid>
                <Field label="Copyright Holder" required><input name="copyrightHolder" className={inp} defaultValue={trainer?.fullName??""} required /></Field>
                <Field label="Licensing"><input className={inp} placeholder="e.g. CC BY-NC-SA 4.0" /></Field>
              </Grid>
              <div className="space-y-2 rounded-xl border border-marine/20 bg-marine/5 p-4">
                {DECLARATIONS.map((d, i) => (
                  <label key={i} className="flex items-start gap-2 text-xs font-medium text-foreground/85">
                    <input type="checkbox" className="mt-0.5 accent-marine" checked={!!checked[i]} onChange={(e) => setChecked({ ...checked, [i]: e.target.checked })} />
                    {d}
                  </label>
                ))}
              </div>
            </Section>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" onClick={()=>setIntent("submit")} disabled={!gate.allowed || !allDecls||saving} className="inline-flex items-center gap-2 rounded-xl bg-marine px-6 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy disabled:cursor-not-allowed disabled:opacity-50">
                <Send className="h-4 w-4" /> {saving?"Saving…":"Submit for Review"}
              </button>
              <button type="submit" onClick={()=>setIntent("draft")} disabled={!gate.allowed||saving} className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-navy hover:bg-muted">
                Save as Draft
              </button>
            </div>
            {error&&<p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          </form>
        )}
      </div>
    </PageShell>
  );
}

const inp = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-marine focus:ring-1 focus:ring-marine";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h3 className="font-display text-base font-bold text-navy">{title}</h3>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
      {children}
    </div>
  );
}
