import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, Save } from "lucide-react";
import { updateAccountProfile } from "@/lib/account/account.functions";
import type { AccountProfile } from "@/lib/account/account.types";

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine";

export function ProfileIdentityForm({ profile }: { profile: AccountProfile }) {
  const updateProfile = useServerFn(updateAccountProfile);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setForm(profile), [profile]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await updateProfile({
        data: {
          displayName: form.displayName,
          organization: form.organization,
          jobTitle: form.jobTitle,
          phone: form.phone,
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account", "profile"] }),
        queryClient.invalidateQueries({ queryKey: ["home", "viewer"] }),
      ]);
      setMessage("Your profile information has been updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update your profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-lg font-bold text-navy">Account Information</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Keep your identity and professional contact details up to date.
      </p>
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <ProfileField
          label="Full Name"
          value={form.displayName}
          onChange={(displayName) => setForm((current) => ({ ...current, displayName }))}
        />
        <ProfileField label="Email Address" value={form.email} disabled />
        <ProfileField
          label="Institution / Organization"
          value={form.organization}
          onChange={(organization) => setForm((current) => ({ ...current, organization }))}
        />
        <ProfileField
          label="Job Title / Profession"
          value={form.jobTitle}
          onChange={(jobTitle) => setForm((current) => ({ ...current, jobTitle }))}
        />
        <ProfileField
          label="Phone Number / WhatsApp"
          type="tel"
          value={form.phone}
          onChange={(phone) => setForm((current) => ({ ...current, phone }))}
        />
        <div className="flex items-end sm:justify-end">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-marine px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy disabled:opacity-60 sm:w-auto"
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </button>
        </div>
        {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700 sm:col-span-2">{message}</p> : null}
      </form>
    </section>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: "text" | "tel";
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-navy">
      {label}
      <input
        required={!disabled}
        disabled={disabled}
        type={type}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        className={`${inputClass} disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground`}
      />
    </label>
  );
}
