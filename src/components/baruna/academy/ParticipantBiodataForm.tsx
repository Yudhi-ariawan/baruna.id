import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Save,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  ShieldCheck,
  ArrowRight,
  Upload,
  Trash2,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  saveParticipantBiodata,
  type GetMyParticipantBiodataResult,
} from "@/lib/academy/participant-biodata.functions";
import {
  UNIT_ESELON_1_OPTIONS,
  PANGKAT_GOLONGAN_OPTIONS,
  JENIS_KELAMIN_OPTIONS,
  AGAMA_OPTIONS,
  PENDIDIKAN_TERAKHIR_OPTIONS,
  PROVINSI_INDONESIA_OPTIONS,
} from "@/lib/academy/participant-biodata.types";

interface ParticipantBiodataFormProps {
  initialData: GetMyParticipantBiodataResult;
}

export function ParticipantBiodataForm({ initialData }: ParticipantBiodataFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveParticipantBiodata);

  const existing = initialData.biodata;
  const prefill = initialData.prefill;

  const [form, setForm] = useState({
    nama: existing?.nama || prefill.nama || "",
    nip: existing?.nip || "",
    tempatLahir: existing?.tempatLahir || "",
    tanggalLahir: existing?.tanggalLahir || "",
    jenisKelamin: existing?.jenisKelamin || "",
    agama: existing?.agama || "",
    jabatan: existing?.jabatan || prefill.jabatan || "",
    pangkatGolongan: existing?.pangkatGolongan || "",
    pendidikanTerakhir: existing?.pendidikanTerakhir || "",
    noHp: existing?.noHp || prefill.noHp || "",
    unitEselon1: existing?.unitEselon1 || "",
    instansiUnitKerja: existing?.instansiUnitKerja || prefill.instansi || "",
    alamatKantor: existing?.alamatKantor || "",
    provinsi: existing?.provinsi || "",
    kabupatenKota: existing?.kabupatenKota || "",
    fotoUrl: existing?.fotoUrl || "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  useEffect(() => {
    if (initialData.biodata) {
      const b = initialData.biodata;
      setForm({
        nama: b.nama,
        nip: b.nip,
        tempatLahir: b.tempatLahir,
        tanggalLahir: b.tanggalLahir,
        jenisKelamin: b.jenisKelamin,
        agama: b.agama,
        jabatan: b.jabatan,
        pangkatGolongan: b.pangkatGolongan,
        pendidikanTerakhir: b.pendidikanTerakhir,
        noHp: b.noHp,
        unitEselon1: b.unitEselon1,
        instansiUnitKerja: b.instansiUnitKerja,
        alamatKantor: b.alamatKantor,
        provinsi: b.provinsi,
        kabupatenKota: b.kabupatenKota,
        fotoUrl: b.fotoUrl || "",
      });
    }
  }, [initialData]);

  const handlePhotoUpload = async (file: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Format foto harus JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 2 MB.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id || "temp";
      const path = `users/${uid}/participant-photo-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: true });

      if (uploadErr) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          handleChange("fotoUrl", dataUrl);
          toast.success("Foto berhasil dimuat.");
        };
        reader.readAsDataURL(file);
      } else {
        const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
        handleChange("fotoUrl", publicUrl);
        toast.success("Pas foto berhasil diunggah.");
      }
    } catch {
      toast.error("Gagal mengunggah foto.");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      return saveFn({ data });
    },
    onSuccess: async (res) => {
      toast.success(res.message);
      setSubmittedSuccess(true);
      try {
        await supabase.auth.refreshSession();
      } catch {
        /* best-effort session refresh */
      }
      queryClient.invalidateQueries({ queryKey: ["participant-biodata"] });
      queryClient.invalidateQueries({ queryKey: ["my-participant-biodata"] });
      queryClient.invalidateQueries({ queryKey: ["account", "profile"] });
      queryClient.invalidateQueries({ queryKey: ["home", "viewer"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal menyimpan biodata peserta.");
    },
  });

  const handleChange = (field: keyof typeof form, val: string) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      {/* Informative Banner */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 text-blue-900 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-2xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-base font-bold text-navy">
              Standar Pendaftaran Peserta Pelatihan Puslat KP
            </h2>
            <p className="text-xs text-blue-800 leading-relaxed">
              Setelah melengkapi biodata dan foto formal ini, role akun Anda otomatis aktif sebagai <strong>Peserta Pelatihan (Participant)</strong> tanpa perlu menunggu approval admin. Anda dapat langsung memilih program pelatihan di katalog untuk mendaftar.
            </p>
          </div>
        </div>
      </div>

      {submittedSuccess && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-sm text-emerald-900">
                Biodata Berhasil Disimpan & Role Peserta Aktif!
              </p>
              <p className="text-xs text-emerald-700">
                Akun Anda kini resmi menjadi Peserta. Silakan pilih pelatihan yang ingin Anda ikuti untuk mengajukan pendaftaran ke Administrator.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate({ to: "/academy" })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-xs"
          >
            Lanjut Pilih Pelatihan <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Form Card */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-soft space-y-6">
        <div className="border-b border-border pb-4">
          <h3 className="font-display text-lg font-bold text-navy">
            Form Biodata Peserta
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tanda bintang (<span className="text-red-500 font-bold">*</span>) menunjukkan kolom wajib diisi.
          </p>
        </div>

        <div className="space-y-4">
          {/* Pas Foto Resmi Peserta (Untuk Sertifikat) */}
          <div className="rounded-2xl border border-dashed border-border bg-slate-50/70 p-4 sm:p-5">
            <label className="block text-xs font-bold text-navy mb-1">
              Pas Foto Resmi Peserta (Akan Ditampilkan pada Sertifikat)
            </label>
            <p className="text-[0.7rem] text-muted-foreground mb-4">
              Unggah pas foto formal berpakaian rapi (rasio 3x4 / 4x6, maks. 2 MB). Foto ini akan dicantumkan secara otomatis pada Sertifikat Diklat / Kelulusan Anda.
            </p>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              {/* Frame Foto 3x4 */}
              <div className="relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border-2 border-marine/30 bg-muted/60 shadow-xs flex items-center justify-center">
                {form.fotoUrl ? (
                  <img
                    src={form.fotoUrl}
                    alt="Pas Foto Peserta"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground/60 p-2 text-center">
                    <User className="h-10 w-10 stroke-1 mb-1 text-slate-400" />
                    <span className="text-[0.65rem] font-semibold text-slate-500">Pas Foto 3x4</span>
                  </div>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-2xs">
                    <LoaderCircle className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </div>

              {/* Tombol Upload & Keterangan */}
              <div className="space-y-2 text-center sm:text-left">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handlePhotoUpload(e.target.files?.[0] || null)}
                />
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    disabled={uploadingPhoto}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-4 py-2 text-xs font-bold text-white hover:bg-navy transition shadow-2xs cursor-pointer disabled:opacity-60"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {form.fotoUrl ? "Ganti Pas Foto" : "Unggah Pas Foto (3x4)"}
                  </button>
                  {form.fotoUrl && (
                    <button
                      type="button"
                      onClick={() => handleChange("fotoUrl", "")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </button>
                  )}
                </div>
                <p className="text-[0.65rem] text-muted-foreground">
                  Format yang didukung: JPG, PNG, atau WebP (maks. 2 MB). Latar belakang disarankan merah/biru atau polos formal.
                </p>
              </div>
            </div>
          </div>

          {/* 1. Nama */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-navy">
              Nama <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.nama}
              onChange={(e) => handleChange("nama", e.target.value)}
              placeholder="Contoh: Dr. Ir. Budi Santoso, M.Si. (Lengkap dengan gelar)"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
            />
          </div>

          {/* 2. NIP */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-navy">
              NIP <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.nip}
              onChange={(e) => handleChange("nip", e.target.value)}
              placeholder="Nomor Induk Pegawai 18 digit (atau NIK jika Non-ASN)"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
            />
          </div>

          {/* 3 & 4. Tempat Lahir & Tanggal Lahir */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-navy">
                Tempat Lahir <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.tempatLahir}
                onChange={(e) => handleChange("tempatLahir", e.target.value)}
                placeholder="Kota / Kabupaten tempat lahir"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-navy">
                Tanggal Lahir <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.tanggalLahir}
                onChange={(e) => handleChange("tanggalLahir", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
              />
            </div>
          </div>

          {/* 5 & 6. Jenis Kelamin & Agama */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-navy">
                Jenis Kelamin <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.jenisKelamin}
                onChange={(e) => handleChange("jenisKelamin", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
              >
                <option value="">-- Pilih Jenis Kelamin --</option>
                {JENIS_KELAMIN_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-navy">
                Agama/Kepercayaan <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.agama}
                onChange={(e) => handleChange("agama", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
              >
                <option value="">-- Pilih Agama/Kepercayaan --</option>
                {AGAMA_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 7 & 8. Jabatan & Pangkat/Golongan (Foto 4 & 5) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-navy">
                Jabatan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.jabatan}
                onChange={(e) => handleChange("jabatan", e.target.value)}
                placeholder="Contoh: Pengelola Ekosistem Laut / Analis Kebijakan"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-navy">
                Pangkat <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.pangkatGolongan}
                onChange={(e) => handleChange("pangkatGolongan", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
              >
                <option value="">-- Pilih Pangkat / Golongan --</option>
                {PANGKAT_GOLONGAN_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 9 & 10. Pendidikan Terakhir & No. HP */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-navy">
                Pendidikan Terakhir <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.pendidikanTerakhir}
                onChange={(e) => handleChange("pendidikanTerakhir", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
              >
                <option value="">-- Pilih Pendidikan Terakhir --</option>
                {PENDIDIKAN_TERAKHIR_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-navy">
                No. HP <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={form.noHp}
                onChange={(e) => handleChange("noHp", e.target.value)}
                placeholder="081234567890"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
              />
            </div>
          </div>

          {/* 11. Unit Eselon I (Foto 3) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-navy">
              Unit Eselon I <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.unitEselon1}
              onChange={(e) => handleChange("unitEselon1", e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
            >
              <option value="">-- Pilih Unit Eselon I --</option>
              {UNIT_ESELON_1_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* 12. Instansi/ Unit Kerja/ UPT */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-navy">
              Instansi/ Unit Kerja/ UPT <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.instansiUnitKerja}
              onChange={(e) => handleChange("instansiUnitKerja", e.target.value)}
              placeholder="Contoh: Balai Pelatihan dan Penyuluhan Perikanan (BPPP) Banyuwangi"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
            />
          </div>

          {/* 13. Alamat Kantor */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-navy">
              Alamat Kantor <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              value={form.alamatKantor}
              onChange={(e) => handleChange("alamatKantor", e.target.value)}
              placeholder="Alamat lengkap instansi / kantor unit kerja"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
            />
          </div>

          {/* 14 & 15. Provinsi & Kabupaten/Kota */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-navy">
                Provinsi <span className="text-red-500">*</span>
              </label>
              <input
                list="provinsi-list"
                required
                value={form.provinsi}
                onChange={(e) => handleChange("provinsi", e.target.value)}
                placeholder="Pilih atau ketik Provinsi"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
              />
              <datalist id="provinsi-list">
                {PROVINSI_INDONESIA_OPTIONS.map((prov) => (
                  <option key={prov} value={prov} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-navy">
                Kabupaten/ Kota <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.kabupatenKota}
                onChange={(e) => handleChange("kabupatenKota", e.target.value)}
                placeholder="Contoh: Kab. Banyuwangi / Kota Serang"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            Pastikan seluruh data yang Anda masukkan adalah benar dan valid.
          </p>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-marine px-6 py-3 text-sm font-bold text-white hover:bg-navy transition shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {mutation.isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan &amp; Daftarkan sebagai Peserta
          </button>
        </div>
      </form>
    </div>
  );
}

