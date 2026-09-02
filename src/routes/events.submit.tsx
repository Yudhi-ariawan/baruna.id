import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Upload, Send } from "lucide-react";
import { EventsShell } from "@/components/baruna/events/EventsShell";
import { PageHeader, Breadcrumb } from "@/components/baruna/events/eventsUi";
import { eventCategories } from "@/data/events";

export const Route = createFileRoute("/events/submit")({
  head: () => ({
    meta: [
      { title: "Submit an Event — BARUNA Events" },
      {
        name: "description",
        content:
          "Submit your marine or fisheries event for review and reach a global BARUNA audience.",
      },
    ],
    links: [{ rel: "canonical", href: "/events/submit" }],
  }),
  component: SubmitPage,
});

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-navy">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-navy outline-none transition-colors focus:border-marine";

function SubmitPage() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <EventsShell>
        <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-10 text-center shadow-card">
          <CheckCircle2 className="mx-auto h-14 w-14 text-eco-community" />
          <h1 className="mt-4 font-display text-2xl font-bold text-navy">Event submitted for review</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Thank you! The BARUNA events team will review your submission and publish it to the
            events database once approved.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground"
          >
            Submit another event
          </button>
        </div>
      </EventsShell>
    );
  }

  return (
    <EventsShell>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Events", to: "/events" }, { label: "Submit Event" }]} />
        <PageHeader
          title="Submit an Event"
          subtitle="Share your marine or fisheries event with a global community. Submissions are reviewed before publishing."
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
          className="grid gap-5 rounded-2xl border border-border bg-card p-6 shadow-soft"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Event Title" required>
              <input required className={inputClass} placeholder="e.g. Coastal Resilience Forum 2026" />
            </Field>
            <Field label="Organizer" required>
              <input required className={inputClass} placeholder="Organization name" />
            </Field>
            <Field label="Category" required>
              <select required className={inputClass} defaultValue="">
                <option value="" disabled>
                  Select category
                </option>
                {eventCategories.map((c) => (
                  <option key={c.slug} value={c.category}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Format" required>
              <select required className={inputClass} defaultValue="">
                <option value="" disabled>
                  Select format
                </option>
                {["Offline", "Online", "Blended"].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Location" required>
              <input required className={inputClass} placeholder="City / venue" />
            </Field>
            <Field label="Country" required>
              <input required className={inputClass} placeholder="Country" />
            </Field>
            <Field label="Start Date" required>
              <input required type="date" className={inputClass} />
            </Field>
            <Field label="End Date" required>
              <input required type="date" className={inputClass} />
            </Field>
            <Field label="Website">
              <input type="url" className={inputClass} placeholder="https://" />
            </Field>
            <Field label="Registration URL">
              <input type="url" className={inputClass} placeholder="https://" />
            </Field>
            <Field label="Contact Person" required>
              <input required className={inputClass} placeholder="Full name" />
            </Field>
            <Field label="Email" required>
              <input required type="email" className={inputClass} placeholder="name@example.org" />
            </Field>
          </div>

          <Field label="Description" required>
            <textarea
              required
              rows={5}
              className={inputClass}
              placeholder="Describe the event, themes, and audience..."
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            {["Upload Poster", "Upload Banner"].map((label) => (
              <Field key={label} label={label}>
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                  <Upload className="h-5 w-5 text-marine" />
                  <span>Click to upload or drag a file here</span>
                  <input type="file" accept="image/*" className="hidden" />
                </div>
              </Field>
            ))}
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-accent/90 sm:w-auto"
          >
            <Send className="h-4 w-4" /> Submit for Review
          </button>
        </form>
      </div>
    </EventsShell>
  );
}
