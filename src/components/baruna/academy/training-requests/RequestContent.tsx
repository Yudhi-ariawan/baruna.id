// What the requester submitted (latest revision), shown on the request page.
import {
  Building2,
  Calendar,
  Globe,
  Languages as LanguagesIcon,
  Mail,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import { LEARNING_APPROACHES, type TrainingRequestDraft } from "@/lib/trainingRequests";

export function RequesterCards({ form }: { form: TrainingRequestDraft }) {
  const approach = LEARNING_APPROACHES.find((a) => a.key === form.preferredLearningApproach)?.label;
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold text-navy">Requester</h2>
        <p className="mt-3 font-semibold text-navy">{form.fullName}</p>
        {form.position ? <p className="text-sm text-muted-foreground">{form.position}</p> : null}
        <dl className="mt-4 space-y-2 text-sm">
          {form.organization ? (
            <DetailRow icon={Building2}>
              {[form.organization, form.organizationType].filter(Boolean).join(" · ")}
            </DetailRow>
          ) : null}
          {form.country ? <DetailRow icon={MapPin}>{form.country}</DetailRow> : null}
          {form.email ? <DetailRow icon={Mail}>{form.email}</DetailRow> : null}
          {form.phone ? <DetailRow icon={Phone}>{form.phone}</DetailRow> : null}
          {form.website ? <DetailRow icon={Globe}>{form.website}</DetailRow> : null}
        </dl>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold text-navy">Training Summary</h2>
        <dl className="mt-3 space-y-2 text-sm">
          {form.targetAudience || form.participantCount ? (
            <DetailRow icon={Users}>
              {[form.targetAudience, form.participantCount ? `${form.participantCount} participants` : ""]
                .filter(Boolean)
                .join(" · ")}
            </DetailRow>
          ) : null}
          {approach ? (
            <DetailRow icon={Calendar}>
              {[approach, form.attendanceFormat, form.duration, form.trainingPeriod].filter(Boolean).join(" · ")}
            </DetailRow>
          ) : null}
          {form.location ? <DetailRow icon={MapPin}>{form.location}</DetailRow> : null}
          {form.language ? <DetailRow icon={LanguagesIcon}>{form.language}</DetailRow> : null}
        </dl>
      </div>
    </div>
  );
}

export function RequestDetails({ form }: { form: TrainingRequestDraft }) {
  const competency = [form.currentCompetencyLevel, form.desiredCompetencyLevel].filter(Boolean).join(" → ");
  return (
    <div className="space-y-4">
      <Block label="Training Objectives" value={form.objectives} />
      <Block label="Learning Needs" value={form.needs} />
      <Block label="Expected Learning Outcomes" value={form.outcomes} />
      <Block label="Current Challenges" value={form.challenges} />
      <Block label="Competency Level (current → desired)" value={competency} />
      <Block label="Urgency" value={form.urgency} />
      <Block label="Preferred Participant Profile" value={form.participantProfile} />
      <Block label="Funding Preference" value={form.fundingPreference} />
      {form.supportRequested.length > 0 && (
        <div>
          <p className="text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">
            Support Requested from BARUNA
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {form.supportRequested.map((s) => (
              <span
                key={s}
                className="inline-flex rounded-full bg-marine/10 px-3 py-1 text-xs font-semibold text-marine"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
      <Block label="Existing Partners" value={form.existingPartners} />
      <Block label="Additional Remarks" value={form.remarks} />
    </div>
  );
}

function DetailRow({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-foreground/80">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-marine" />
      <span>{children}</span>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div>
      <p className="text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-foreground/90">{value}</p>
    </div>
  );
}
