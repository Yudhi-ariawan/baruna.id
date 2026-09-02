import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  UserPlus,
  Pencil,
  Check,
  Upload,
  FileText,
  CheckCircle2,
  Briefcase,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import {
  useMyExpertProfile,
  useRequests,
  updateExpertApplication,
  EXPERTISE_AREAS,
  EXPERT_PIPELINE,
  EXPERT_STATUS_STYLES,
  REQUEST_TYPE_CONFIG,
  formatDate,
  formatBytes,
  MAX_BYTES,
  ACCEPTED_FILE_TYPES,
  type ExpertApplication,
  type ExpertStatus,
} from "@/lib/experts";

export const Route = createFileRoute("/experts/profile")({
  head: () => ({
    meta: [
      { title: "My Expert Profile — BARUNA Experts" },
      {
        name: "description",
        content: "Manage your expert profile, expertise, availability, and assigned engagements.",
      },
    ],
    links: [{ rel: "canonical", href: "/experts/profile" }],
  }),
  component: MyExpertProfilePage,
});

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-marine focus:ring-1 focus:ring-marine";

function StatusBadge({ status }: { status: ExpertStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${EXPERT_STATUS_STYLES[status]}`}>
      <CheckCircle2 className="h-3.5 w-3.5" /> {status}
    </span>
  );
}

function MyExpertProfilePage() {
  const profile = useMyExpertProfile();
  const requests = useRequests();

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-marine/10 text-marine">
            <UserPlus className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-extrabold text-navy">No expert profile yet</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Register as an expert to manage your profile, availability, and engagements.
          </p>
          <Link
            to="/experts/join"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
          >
            Join as an Expert <ArrowRight className="h-4 w-4" />
          </Link>
        </main>
      </div>
    );
  }

  return <ProfileView profile={profile} requests={requests} />;
}

function ProfileView({
  profile,
  requests,
}: {
  profile: ExpertApplication;
  requests: ReturnType<typeof useRequests>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(profile);

  const assigned = requests.filter(
    (r) => r.status === "Confirmed" || r.status === "Expert Matching",
  );
  const completed = requests.filter((r) => r.status === "Completed");

  const set = <K extends keyof ExpertApplication>(key: K, value: ExpertApplication[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleExpertise = (area: string) =>
    setForm((f) => ({
      ...f,
      expertise: f.expertise.includes(area)
        ? f.expertise.filter((x) => x !== area)
        : [...f.expertise, area],
    }));

  const save = () => {
    updateExpertApplication(profile.id, {
      fullName: form.fullName,
      title: form.title,
      institution: form.institution,
      country: form.country,
      email: form.email,
      phone: form.phone,
      linkedin: form.linkedin,
      website: form.website,
      biography: form.biography,
      yearsExperience: form.yearsExperience,
      languages: form.languages,
      keyProjects: form.keyProjects,
      publications: form.publications,
      expertise: form.expertise,
      cv: form.cv,
    });
    setEditing(false);
  };

  const toggleAvailability = () => {
    const next = !profile.available;
    updateExpertApplication(profile.id, { available: next });
    setForm((f) => ({ ...f, available: next }));
  };

  const handleCv = (f: File | null) => {
    if (!f || f.size > MAX_BYTES) return;
    set("cv", { name: f.name, size: f.size, type: f.type || "file", uploadedAt: new Date().toISOString() });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          to="/experts"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine transition-colors hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> Experts
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">My Expert Profile</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Manage your profile, expertise, availability, and engagements with the BARUNA network.
            </p>
          </div>
          <StatusBadge status={profile.status} />
        </div>

        {/* Approval pipeline */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center gap-1">
            {EXPERT_PIPELINE.map((stage, i) => {
              const reached = i <= EXPERT_PIPELINE.indexOf(profile.status);
              return (
                <div key={stage} className="flex flex-1 items-center">
                  <span className={`h-2.5 w-2.5 rounded-full ${reached ? "bg-marine" : "bg-muted"}`} />
                  {i < EXPERT_PIPELINE.length - 1 && (
                    <span className={`h-px flex-1 ${i < EXPERT_PIPELINE.indexOf(profile.status) ? "bg-marine" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[0.6rem] font-medium text-muted-foreground">
            {EXPERT_PIPELINE.map((stage) => (
              <span key={stage} className="flex-1 text-center first:text-left last:text-right">
                {stage}
              </span>
            ))}
          </div>
          {profile.status !== "Published" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Your profile becomes visible in the public Experts Directory once approved and published.
            </p>
          )}
        </div>

        {/* Availability */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div>
            <p className="font-display text-sm font-bold text-navy">Availability</p>
            <p className="text-xs text-muted-foreground">
              {profile.available
                ? "You are currently available for new engagements."
                : "You are currently marked as unavailable."}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleAvailability}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              profile.available
                ? "border border-border text-navy hover:bg-muted"
                : "bg-marine text-marine-foreground hover:bg-navy"
            }`}
          >
            {profile.available ? "Set as Unavailable" : "Set as Available"}
          </button>
        </div>

        {/* Profile details */}
        <section className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy">Profile Details</h2>
            {editing ? (
              <button
                type="button"
                onClick={save}
                className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
              >
                <Check className="h-4 w-4" /> Save Changes
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setForm(profile);
                  setEditing(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-muted"
              >
                <Pencil className="h-4 w-4" /> Edit Profile
              </button>
            )}
          </div>

          {editing ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <EditField label="Full Name" value={form.fullName} onChange={(v) => set("fullName", v)} />
                <EditField label="Professional Title" value={form.title} onChange={(v) => set("title", v)} />
                <EditField label="Institution" value={form.institution} onChange={(v) => set("institution", v)} />
                <EditField label="Country" value={form.country} onChange={(v) => set("country", v)} />
                <EditField label="Email" value={form.email} onChange={(v) => set("email", v)} />
                <EditField label="Phone Number" value={form.phone} onChange={(v) => set("phone", v)} />
                <EditField label="LinkedIn" value={form.linkedin} onChange={(v) => set("linkedin", v)} />
                <EditField label="Personal Website" value={form.website} onChange={(v) => set("website", v)} />
                <EditField label="Years of Experience" value={form.yearsExperience} onChange={(v) => set("yearsExperience", v)} />
                <EditField label="Languages Spoken" value={form.languages} onChange={(v) => set("languages", v)} />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Professional Biography
                </p>
                <textarea className={`${inputClass} min-h-[110px] resize-y`} value={form.biography} onChange={(e) => set("biography", e.target.value)} />
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Areas of Expertise
                </p>
                <div className="flex flex-wrap gap-2">
                  {EXPERTISE_AREAS.map((area) => {
                    const active = form.expertise.includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggleExpertise(area)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                          active ? "bg-marine text-marine-foreground" : "bg-muted text-foreground/75 hover:bg-marine/15 hover:text-marine"
                        }`}
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>
              <UpdateCv file={form.cv} onUpload={handleCv} onRemove={() => set("cv", null)} />
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Full Name" value={profile.fullName} />
                <Detail label="Professional Title" value={profile.title} />
                <Detail label="Institution" value={profile.institution} />
                <Detail label="Country" value={profile.country} />
                <Detail label="Email" value={profile.email} />
                <Detail label="Phone Number" value={profile.phone} />
                <Detail label="LinkedIn" value={profile.linkedin} />
                <Detail label="Personal Website" value={profile.website} />
                <Detail label="Years of Experience" value={profile.yearsExperience} />
                <Detail label="Languages Spoken" value={profile.languages} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Biography</p>
                <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                  {profile.biography || "—"}
                </p>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Areas of Expertise
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.expertise.length ? (
                    profile.expertise.map((x) => (
                      <span key={x} className="rounded-full border border-marine/20 bg-marine/5 px-3 py-1.5 text-xs font-semibold text-marine">
                        {x}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Roles</p>
                <div className="flex flex-wrap gap-2">
                  {profile.roles.map((r) => (
                    <span key={r} className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-navy">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
              {profile.cv && (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                  <FileText className="h-5 w-5 text-marine" />
                  <span className="text-sm font-semibold text-navy">{profile.cv.name}</span>
                  <span className="text-xs text-muted-foreground">({formatBytes(profile.cv.size)})</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Engagements */}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <EngagementList
            icon={Briefcase}
            title="Assigned Requests"
            empty="No assigned requests yet."
            requests={assigned}
          />
          <EngagementList
            icon={CalendarCheck}
            title="Completed Engagements"
            empty="No completed engagements yet."
            requests={completed}
          />
        </div>
      </main>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-navy">{value || "—"}</p>
    </div>
  );
}

function UpdateCv({
  file,
  onUpload,
  onRemove,
}: {
  file: ExpertApplication["cv"];
  onUpload: (f: File | null) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">CV / Resume</p>
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-eco-community/40 bg-eco-community/5 p-3">
          <FileText className="h-5 w-5 text-eco-community" />
          <span className="flex-1 truncate text-sm font-semibold text-navy">{file.name}</span>
          <button type="button" onClick={onRemove} className="text-xs font-semibold text-destructive">
            Remove
          </button>
        </div>
      ) : (
        <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-3 py-3 text-sm font-semibold text-marine transition-colors hover:border-marine/50 hover:bg-muted">
          <Upload className="h-4 w-4" /> Upload New CV
          <input type="file" accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={(e) => onUpload(e.target.files?.[0] ?? null)} />
        </label>
      )}
    </div>
  );
}

function EngagementList({
  icon: Icon,
  title,
  empty,
  requests,
}: {
  icon: LucideIcon;
  title: string;
  empty: string;
  requests: ReturnType<typeof useRequests>;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-navy">
        <Icon className="h-5 w-5 text-marine" /> {title}
      </h2>
      <div className="mt-4 space-y-3">
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-secondary/30 p-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-wide text-marine">
                {REQUEST_TYPE_CONFIG[r.type].label} · {r.id}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-navy">
                {r.values.eventName ||
                  r.values.trainingTitle ||
                  r.values.subjectArea ||
                  r.values.objective ||
                  r.values.technicalIssue ||
                  "Expert request"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {r.values.organization} · Updated {formatDate(r.updatedAt)}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
