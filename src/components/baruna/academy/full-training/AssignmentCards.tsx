import { Lock, CheckCircle2, FolderUp, PenLine, Send, ScrollText } from "lucide-react";
import { DocumentUploadRow } from "@/components/baruna/academy/DocumentUploadRow";
import type { DocumentMeta } from "@/lib/application";

const ACTION_PLAN_FLOW = ["Not Submitted", "Submitted", "Reviewed", "Approved"] as const;

export function AssignmentProgress({ done }: { done: number }) {
  const total = 3;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-sm font-bold text-navy">Post-Course Progress</p>
        <span className="text-sm font-semibold text-marine">{done}/{total} completed</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-marine transition-all" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </div>
  );
}

export function KnowledgeSharingCard({
  status,
  meta,
  locked,
  onChange,
}: {
  status: string;
  meta: DocumentMeta | null;
  locked: boolean;
  onChange: (file: File | null) => void;
}) {
  if (locked) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-base font-bold text-navy">Knowledge Sharing Report</p>
            <p className="mt-1 text-xs text-muted-foreground">Submit your Reflection Paper to unlock the Knowledge Sharing Report.</p>
          </div>
        </div>
      </div>
    );
  }
  const activeIdx = ACTION_PLAN_FLOW.indexOf(status as (typeof ACTION_PLAN_FLOW)[number]);
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
          <ScrollText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-navy">Knowledge Sharing Report</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Report on how you shared this training's knowledge with your organization or community. PDF or DOCX, maximum 10 MB.
          </p>
        </div>
      </div>

      {/* status stepper */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {ACTION_PLAN_FLOW.map((s, i) => (
          <span
            key={s}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-semibold ${
              i <= activeIdx && activeIdx > 0 ? "bg-badge-training/15 text-badge-training" : "bg-muted text-muted-foreground"
            }`}
          >
            {i <= activeIdx && activeIdx > 0 && <CheckCircle2 className="h-3 w-3" />}
            {s}
          </span>
        ))}
      </div>

      <div className="mt-4">
        <DocumentUploadRow
          field={{ key: "knowledgeSharing", label: "Knowledge Sharing Report", accept: ".pdf,.doc,.docx", hint: "PDF or DOCX · max 10 MB" }}
          meta={meta}
          onChange={onChange}
          uploadedLabel="Submitted"
        />
      </div>
    </div>
  );
}

export function ActionPlanCard({
  status,
  meta,
  locked,
  onChange,
}: {
  status: string;
  meta: DocumentMeta | null;
  locked: boolean;
  onChange: (file: File | null) => void;
}) {
  if (locked) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-base font-bold text-navy">Action Plan Assignment</p>
            <p className="mt-1 text-xs text-muted-foreground">Pass the Final Examination to unlock the Action Plan submission.</p>
          </div>
        </div>
      </div>
    );
  }
  const activeIdx = ACTION_PLAN_FLOW.indexOf(status as (typeof ACTION_PLAN_FLOW)[number]);
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
          <FolderUp className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-navy">Action Plan for Fisheries Development in My Country</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Submit a practical action plan to apply what you learned back home. PDF or DOCX, maximum 10 MB.
          </p>
        </div>
      </div>

      {/* status stepper */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {ACTION_PLAN_FLOW.map((s, i) => (
          <span
            key={s}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-semibold ${
              i <= activeIdx && activeIdx > 0
                ? "bg-badge-training/15 text-badge-training"
                : i === 0 && activeIdx === 0
                  ? "bg-muted text-muted-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i <= activeIdx && activeIdx > 0 && <CheckCircle2 className="h-3 w-3" />}
            {s}
          </span>
        ))}
      </div>

      <div className="mt-4">
        <DocumentUploadRow
          field={{ key: "actionPlan", label: "Action Plan", accept: ".pdf,.doc,.docx", hint: "PDF or DOCX · max 10 MB" }}
          meta={meta}
          onChange={onChange}
          uploadedLabel="Submitted"
        />
      </div>
    </div>
  );
}

export function ReflectionCard({
  text,
  status,
  locked,
  onChange,
  onSubmit,
}: {
  text: string;
  status: string;
  locked: boolean;
  onChange: (text: string) => void;
  onSubmit: () => void;
}) {
  const words = (text || "").trim() ? (text || "").trim().split(/\s+/).filter(Boolean).length : 0;
  const valid = words >= 300 && words <= 1000;
  const submitted = status === "Submitted";

  if (locked) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-base font-bold text-navy">Reflection Paper</p>
            <p className="mt-1 text-xs text-muted-foreground">Submit your Action Plan to unlock the Reflection Paper.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${submitted ? "bg-badge-training/15 text-badge-training" : "bg-marine/10 text-marine"}`}>
          <PenLine className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-base font-bold text-navy">Reflection Paper</p>
            <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold ${submitted ? "bg-badge-training/15 text-badge-training" : "bg-muted text-muted-foreground"}`}>
              {status}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            What lessons from this training will you apply in your organization or country?
          </p>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        disabled={submitted}
        rows={8}
        placeholder="Write your reflection here (300–1000 words)…"
        className="mt-4 w-full resize-y rounded-xl border border-border bg-background p-4 text-sm text-foreground outline-none transition-colors focus:border-marine disabled:opacity-70"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs font-medium ${valid || submitted ? "text-badge-training" : "text-muted-foreground"}`}>
          {words} words · minimum 300, maximum 1000
        </span>
        {!submitted && (
          <button
            onClick={onSubmit}
            disabled={!valid}
            className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-xs font-semibold text-marine-foreground transition-colors hover:bg-marine/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> Submit Reflection
          </button>
        )}
        {submitted && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-badge-training">
            <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
          </span>
        )}
      </div>
    </div>
  );
}
