import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Calendar,
  Globe,
  Linkedin,
  LoaderCircle,
  Save,
  Shield,
  User,
} from "lucide-react";
import { updateAccountProfile } from "@/lib/account/account.functions";
import type { AccountProfile } from "@/lib/account/account.types";
import { useLanguage } from "@/lib/i18n";
import { CountrySelect } from "@/components/ui/country-select";
import { toast } from "sonner";

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine";

export function ProfileIdentityForm({ profile }: { profile: AccountProfile }) {
  const { isId } = useLanguage();
  const updateProfile = useServerFn(updateAccountProfile);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    ...profile,
    country: profile.country ?? "Indonesia",
    linkedin: profile.linkedin ?? "",
    website: profile.website ?? "",
    bio: profile.bio ?? "",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      ...profile,
      country: profile.country ?? "Indonesia",
      linkedin: profile.linkedin ?? "",
      website: profile.website ?? "",
      bio: profile.bio ?? "",
    });
  }, [profile]);

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
          country: form.country,
          linkedin: form.linkedin,
          website: form.website,
          bio: form.bio,
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account", "profile"] }),
        queryClient.invalidateQueries({ queryKey: ["home", "viewer"] }),
      ]);
      const successText = isId
        ? "Informasi profil Anda berhasil diperbarui."
        : "Your profile information has been updated.";
      setMessage(successText);
      toast.success(successText);
    } catch (caught) {
      const errText =
        caught instanceof Error
          ? caught.message
          : isId
            ? "Gagal memperbarui profil."
            : "Unable to update your profile.";
      setError(errText);
      toast.error(errText);
    } finally {
      setBusy(false);
    }
  }

  const roleLabels: Record<string, { label: string; bg: string; text: string }> = {
    expert: { label: "BARUNA Expert", bg: "bg-marine/10", text: "text-marine border-marine/20" },
    super_admin: { label: "Super Admin", bg: "bg-purple-50", text: "text-purple-700 border-purple-200" },
    admin: { label: "Administrator", bg: "bg-blue-50", text: "text-blue-700 border-blue-200" },
    reviewer: { label: "Reviewer", bg: "bg-amber-50", text: "text-amber-700 border-amber-200" },
    participant: { label: "Participant", bg: "bg-emerald-50", text: "text-emerald-700 border-emerald-200" },
    registered_user: { label: "Member", bg: "bg-slate-100", text: "text-slate-700 border-slate-200" },
  };

  const formattedJoinDate = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(isId ? "id-ID" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-5">
      {/* Header & Role Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="font-display text-lg font-bold text-navy">
            {isId ? "Informasi Akun & Profesi" : "Account & Professional Identity"}
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
            {isId
              ? "Kelola identitas, instansi, dan kontak profesional Anda."
              : "Keep your identity and professional contact details up to date."}
          </p>
        </div>

        {/* Roles & Member Info */}
        <div className="flex flex-wrap items-center gap-2">
          {profile.roles && profile.roles.length > 0 ? (
            profile.roles.map((r) => {
              const info = roleLabels[r] || {
                label: r,
                bg: "bg-muted",
                text: "text-foreground border-border",
              };
              return (
                <span
                  key={r}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${info.bg} ${info.text}`}
                >
                  <Shield className="h-3 w-3" />
                  {info.label}
                </span>
              );
            })
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              <Shield className="h-3 w-3" />
              Member
            </span>
          )}

          {formattedJoinDate && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground ml-1">
              <Calendar className="h-3 w-3" />
              {isId ? `Bergabung: ${formattedJoinDate}` : `Joined: ${formattedJoinDate}`}
            </span>
          )}
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <ProfileField
          label={isId ? "Nama Lengkap" : "Full Name"}
          value={form.displayName}
          onChange={(displayName) => setForm((current) => ({ ...current, displayName }))}
        />

        <ProfileField
          label={isId ? "Alamat Email (Masuk)" : "Email Address (Login)"}
          value={form.email}
          disabled
        />

        <ProfileField
          label={isId ? "Institusi / Organisasi" : "Institution / Organization"}
          value={form.organization}
          onChange={(organization) => setForm((current) => ({ ...current, organization }))}
        />

        <ProfileField
          label={isId ? "Jabatan / Profesi" : "Job Title / Profession"}
          value={form.jobTitle}
          onChange={(jobTitle) => setForm((current) => ({ ...current, jobTitle }))}
        />

        <ProfileField
          label={isId ? "Nomor Telepon / WhatsApp" : "Phone Number / WhatsApp"}
          type="tel"
          value={form.phone}
          onChange={(phone) => setForm((current) => ({ ...current, phone }))}
        />

        {/* Country */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-navy">
            {isId ? "Negara Asal / Institusi" : "Country / Region"}
          </label>
          <div className="mt-1">
            <CountrySelect
              value={form.country ?? "Indonesia"}
              onChange={(country) => setForm((current) => ({ ...current, country }))}
              placeholder={isId ? "Pilih negara" : "Select country"}
            />
          </div>
        </div>

        {/* LinkedIn */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-navy">
            <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
            <span>LinkedIn</span>
          </label>
          <input
            type="url"
            value={form.linkedin ?? ""}
            onChange={(e) => setForm((current) => ({ ...current, linkedin: e.target.value }))}
            placeholder="https://linkedin.com/in/..."
            className={inputClass}
          />
        </div>

        {/* Website */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-navy">
            <Globe className="h-3.5 w-3.5 text-marine" />
            <span>{isId ? "Situs Web / Portofolio" : "Personal Website / Portfolio"}</span>
          </label>
          <input
            type="url"
            value={form.website ?? ""}
            onChange={(e) => setForm((current) => ({ ...current, website: e.target.value }))}
            placeholder="https://..."
            className={inputClass}
          />
        </div>

        {/* Biography */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-navy mb-1">
            {isId ? "Ringkasan Biografi / Keahlian Singkat" : "Professional Biography / Summary"}
          </label>
          <textarea
            rows={3}
            value={form.bio ?? ""}
            onChange={(e) => setForm((current) => ({ ...current, bio: e.target.value }))}
            placeholder={
              isId
                ? "Tuliskan ringkasan singkat latar belakang keahlian atau peran Anda..."
                : "Brief summary of your professional background and expertise..."
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
          />
        </div>

        {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700 sm:col-span-2">{message}</p> : null}

        <div className="sm:col-span-2 flex items-center justify-end pt-2 border-t border-border">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-marine px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy transition disabled:opacity-60 cursor-pointer shadow-2xs"
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isId ? "Simpan Perubahan Profil" : "Save Changes"}
          </button>
        </div>
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
