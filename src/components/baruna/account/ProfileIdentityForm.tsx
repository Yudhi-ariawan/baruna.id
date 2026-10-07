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
import { PhoneCountryInput } from "@/components/ui/phone-country-input";
import {
  UNIT_ESELON_1_OPTIONS,
  PANGKAT_GOLONGAN_OPTIONS,
  JENIS_KELAMIN_OPTIONS,
  AGAMA_OPTIONS,
  PENDIDIKAN_TERAKHIR_OPTIONS,
  PROVINSI_INDONESIA_OPTIONS,
} from "@/lib/academy/participant-biodata.types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
    nip: profile.nip ?? "",
    tempatLahir: profile.tempatLahir ?? "",
    tanggalLahir: profile.tanggalLahir ?? "",
    jenisKelamin: profile.jenisKelamin ?? "",
    agama: profile.agama ?? "",
    pangkatGolongan: profile.pangkatGolongan ?? "",
    pendidikanTerakhir: profile.pendidikanTerakhir ?? "",
    unitEselon1: profile.unitEselon1 ?? "",
    alamatKantor: profile.alamatKantor ?? "",
    provinsi: profile.provinsi ?? "",
    kabupatenKota: profile.kabupatenKota ?? "",
    fotoUrl: profile.fotoUrl ?? "",
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
      nip: profile.nip ?? "",
      tempatLahir: profile.tempatLahir ?? "",
      tanggalLahir: profile.tanggalLahir ?? "",
      jenisKelamin: profile.jenisKelamin ?? "",
      agama: profile.agama ?? "",
      pangkatGolongan: profile.pangkatGolongan ?? "",
      pendidikanTerakhir: profile.pendidikanTerakhir ?? "",
      unitEselon1: profile.unitEselon1 ?? "",
      alamatKantor: profile.alamatKantor ?? "",
      provinsi: profile.provinsi ?? "",
      kabupatenKota: profile.kabupatenKota ?? "",
      fotoUrl: profile.fotoUrl ?? "",
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
          nip: form.nip,
          tempatLahir: form.tempatLahir,
          tanggalLahir: form.tanggalLahir,
          jenisKelamin: form.jenisKelamin,
          agama: form.agama,
          pangkatGolongan: form.pangkatGolongan,
          pendidikanTerakhir: form.pendidikanTerakhir,
          unitEselon1: form.unitEselon1,
          alamatKantor: form.alamatKantor,
          provinsi: form.provinsi,
          kabupatenKota: form.kabupatenKota,
          fotoUrl: form.fotoUrl,
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account", "profile"] }),
        queryClient.invalidateQueries({ queryKey: ["home", "viewer"] }),
        queryClient.invalidateQueries({ queryKey: ["participant-biodata"] }),
        queryClient.invalidateQueries({ queryKey: ["my-participant-biodata"] }),
      ]);
      try {
        await supabase.auth.refreshSession();
      } catch {
        /* best-effort session refresh */
      }
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
              ? "Kelola identitas resmi, kepegawaian, instansi, dan kontak Anda."
              : "Keep your official identity, civil service rank, institution, and contact details up to date."}
          </p>
        </div>

        {/* Roles & Member Info */}
        <div className="flex flex-wrap items-center gap-2">
          {(() => {
            const rawRoles = profile.roles && profile.roles.length > 0 ? profile.roles : ["registered_user"];
            const rolesToShow =
              rawRoles.length > 1 &&
              (rawRoles.includes("participant") ||
                rawRoles.includes("expert") ||
                rawRoles.includes("admin") ||
                rawRoles.includes("super_admin"))
                ? rawRoles.filter((r) => r !== "registered_user")
                : rawRoles;

            return rolesToShow.map((r) => {
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
            });
          })()}

          {formattedJoinDate && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground ml-1">
              <Calendar className="h-3 w-3" />
              {isId ? `Bergabung: ${formattedJoinDate}` : `Joined: ${formattedJoinDate}`}
            </span>
          )}
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {/* Identitas Pribadi */}
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

        {/* NIP / NIK */}
        <div>
          <label className="block text-sm font-medium text-navy">
            {isId ? "NIP / NIK" : "NIP / National ID"}
          </label>
          <input
            type="text"
            value={form.nip ?? ""}
            onChange={(e) => setForm((c) => ({ ...c, nip: e.target.value }))}
            placeholder={
              isId
                ? "Nomor Induk Pegawai 18 digit (atau NIK jika Non-ASN)"
                : "18-digit employee number or national ID"
            }
            className={inputClass}
          />
        </div>

        {/* Pangkat / Golongan */}
        <div>
          <label className="block text-sm font-medium text-navy">
            {isId ? "Pangkat / Golongan" : "Rank / Civil Grade"}
          </label>
          <select
            value={form.pangkatGolongan ?? ""}
            onChange={(e) => setForm((c) => ({ ...c, pangkatGolongan: e.target.value }))}
            className={inputClass}
          >
            <option value="">
              {isId ? "-- Pilih Pangkat / Golongan --" : "-- Select Rank / Grade --"}
            </option>
            {PANGKAT_GOLONGAN_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Tempat & Tanggal Lahir */}
        <div>
          <label className="block text-sm font-medium text-navy">
            {isId ? "Tempat Lahir" : "Place of Birth"}
          </label>
          <input
            type="text"
            value={form.tempatLahir ?? ""}
            onChange={(e) => setForm((c) => ({ ...c, tempatLahir: e.target.value }))}
            placeholder={isId ? "Kota / Kabupaten tempat lahir" : "City / Place of birth"}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-navy">
            {isId ? "Tanggal Lahir" : "Date of Birth"}
          </label>
          <input
            type="date"
            value={form.tanggalLahir ?? ""}
            onChange={(e) => setForm((c) => ({ ...c, tanggalLahir: e.target.value }))}
            className={inputClass}
          />
        </div>

        {/* Jenis Kelamin & Agama */}
        <div>
          <label className="block text-sm font-medium text-navy">
            {isId ? "Jenis Kelamin" : "Gender"}
          </label>
          <select
            value={form.jenisKelamin ?? ""}
            onChange={(e) => setForm((c) => ({ ...c, jenisKelamin: e.target.value }))}
            className={inputClass}
          >
            <option value="">
              {isId ? "-- Pilih Jenis Kelamin --" : "-- Select Gender --"}
            </option>
            {JENIS_KELAMIN_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-navy">
            {isId ? "Agama / Kepercayaan" : "Religion"}
          </label>
          <select
            value={form.agama ?? ""}
            onChange={(e) => setForm((c) => ({ ...c, agama: e.target.value }))}
            className={inputClass}
          >
            <option value="">
              {isId ? "-- Pilih Agama/Kepercayaan --" : "-- Select Religion --"}
            </option>
            {AGAMA_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Institusi / Organisasi */}
        <ProfileField
          label={isId ? "Institusi / Organisasi / Unit Kerja" : "Institution / Organization"}
          value={form.organization}
          onChange={(organization) => setForm((current) => ({ ...current, organization }))}
        />

        {/* Unit Eselon I */}
        <div>
          <label className="block text-sm font-medium text-navy">
            {isId ? "Unit Eselon I" : "Echelon I Unit"}
          </label>
          <select
            value={form.unitEselon1 ?? ""}
            onChange={(e) => setForm((c) => ({ ...c, unitEselon1: e.target.value }))}
            className={inputClass}
          >
            <option value="">
              {isId ? "-- Pilih Unit Eselon I --" : "-- Select Echelon I --"}
            </option>
            {UNIT_ESELON_1_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Jabatan / Profesi */}
        <ProfileField
          label={isId ? "Jabatan / Profesi" : "Job Title / Profession"}
          value={form.jobTitle}
          onChange={(jobTitle) => setForm((current) => ({ ...current, jobTitle }))}
        />

        {/* Pendidikan Terakhir */}
        <div>
          <label className="block text-sm font-medium text-navy">
            {isId ? "Pendidikan Terakhir" : "Highest Education"}
          </label>
          <select
            value={form.pendidikanTerakhir ?? ""}
            onChange={(e) => setForm((c) => ({ ...c, pendidikanTerakhir: e.target.value }))}
            className={inputClass}
          >
            <option value="">
              {isId ? "-- Pilih Pendidikan Terakhir --" : "-- Select Education --"}
            </option>
            {PENDIDIKAN_TERAKHIR_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Kontak Telepon */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-navy">
            {isId ? "Nomor Telepon / WhatsApp" : "Phone Number / WhatsApp"}
          </label>
          <div className="mt-1">
            <PhoneCountryInput
              value={form.phone ?? ""}
              onChange={(phone) => setForm((current) => ({ ...current, phone }))}
              placeholder={isId ? "812 3456 7890" : "812 3456 7890"}
              isId={isId}
            />
          </div>
        </div>

        {/* Negara Asal */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-navy">
            {isId ? "Negara Asal / Wilayah" : "Country / Region"}
          </label>
          <div className="mt-1">
            <CountrySelect
              value={form.country ?? "Indonesia"}
              onChange={(country) => setForm((current) => ({ ...current, country }))}
              placeholder={isId ? "Pilih negara" : "Select country"}
            />
          </div>
        </div>

        {/* Provinsi */}
        <div>
          <label className="block text-sm font-medium text-navy">
            {isId ? "Provinsi Instansi / Domisili" : "Province"}
          </label>
          <select
            value={form.provinsi ?? ""}
            onChange={(e) => setForm((c) => ({ ...c, provinsi: e.target.value }))}
            className={inputClass}
          >
            <option value="">
              {isId ? "-- Pilih Provinsi --" : "-- Select Province --"}
            </option>
            {PROVINSI_INDONESIA_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Kabupaten / Kota */}
        <div>
          <label className="block text-sm font-medium text-navy">
            {isId ? "Kabupaten / Kota" : "Regency / City"}
          </label>
          <input
            type="text"
            value={form.kabupatenKota ?? ""}
            onChange={(e) => setForm((c) => ({ ...c, kabupatenKota: e.target.value }))}
            placeholder={isId ? "Contoh: Denpasar / Banyuwangi" : "e.g. Denpasar / Jakarta"}
            className={inputClass}
          />
        </div>

        {/* Alamat Kantor */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-navy">
            {isId ? "Alamat Kantor / Unit Kerja" : "Office Address"}
          </label>
          <textarea
            rows={2}
            value={form.alamatKantor ?? ""}
            onChange={(e) => setForm((c) => ({ ...c, alamatKantor: e.target.value }))}
            placeholder={
              isId
                ? "Alamat lengkap instansi / kantor unit kerja..."
                : "Full office address..."
            }
            className={inputClass}
          />
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
