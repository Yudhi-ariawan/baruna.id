import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const signupSchema = z
  .object({
    displayName: z.string().trim().min(2, "Nama lengkap wajib diisi (minimal 2 karakter)."),
    organization: z.string().trim().min(2, "Instansi / organisasi wajib diisi."),
    jobTitle: z.string().trim().min(2, "Jabatan / profesi wajib diisi."),
    phone: z
      .string()
      .trim()
      .min(8, "Nomor telepon / WhatsApp wajib diisi (minimal 8 karakter).")
      .regex(/^\+?[0-9 ()-]+$/, "Gunakan format nomor telepon yang valid."),
    email: z.string().trim().email("Alamat email tidak valid."),
    password: z.string().min(8, "Password minimal 8 karakter."),
    confirmPassword: z.string().min(8, "Konfirmasi password wajib diisi."),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: "Anda harus menyetujui Syarat & Ketentuan." }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok.",
    path: ["confirmPassword"],
  });

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["signin", "signup", "invite"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — BARUNA Academy" },
      { name: "description", content: "Sign in or create your BARUNA Academy learner account." },
      { property: "og:title", content: "Sign in — BARUNA Academy" },
      {
        property: "og:description",
        content: "Sign in or create your BARUNA Academy learner account.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect, mode: requestedMode } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "invite">(requestedMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [organization, setOrganization] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // If already signed in, bounce to redirect.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user && mode !== "invite") navigate({ to: redirect ?? "/academy/learn" });
    });
  }, [mode, navigate, redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === "invite") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      } else if (mode === "signup") {
        const signup = signupSchema.parse({
          displayName,
          organization,
          jobTitle,
          phone,
          email,
          password,
          confirmPassword,
          acceptedTerms,
        });
        const { data, error } = await supabase.auth.signUp({
          email: signup.email,
          password: signup.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth?mode=signin`,
            data: {
              display_name: signup.displayName,
              organization: signup.organization,
              job_title: signup.jobTitle,
              phone: signup.phone,
              terms_accepted_at: new Date().toISOString(),
            },
          },
        });
        if (error) throw error;
        setSuccess(
          data.session
            ? "Registrasi berhasil. Akun Anda sudah aktif dan dapat digunakan."
            : "Registrasi berhasil. Silakan periksa email Anda untuk melakukan verifikasi akun.",
        );
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: redirect ?? "/academy/learn" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0]?.message ?? "Mohon lengkapi seluruh data pendaftaran.");
      } else {
        setError(err instanceof Error ? err.message : "Authentication failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-soft">
        <h1 className="font-display text-2xl font-extrabold text-navy">
          {mode === "signin"
            ? "Sign in to BARUNA"
            : mode === "invite"
              ? "Complete your BARUNA account"
              : "Create your BARUNA account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "invite"
            ? "Choose a secure password to accept your invitation."
            : "Access your enrolments, progress, and certificates."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" ? (
            <>
              <AuthField label="Nama Lengkap" value={displayName} onChange={setDisplayName} />
              <AuthField
                label="Instansi / Organisasi"
                value={organization}
                onChange={setOrganization}
              />
              <AuthField label="Jabatan / Profesi" value={jobTitle} onChange={setJobTitle} />
              <AuthField
                label="Nomor Telepon / WhatsApp"
                type="tel"
                value={phone}
                onChange={setPhone}
                placeholder="+62..."
              />
            </>
          ) : null}
          {mode !== "invite" ? (
            <div>
              <label className="block text-sm font-medium text-navy">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-marine"
              />
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-navy">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-marine"
            />
            {(mode === "signup" || mode === "invite") && (
              <p className="mt-1 text-xs text-muted-foreground">Minimum 8 characters.</p>
            )}
          </div>
          {mode === "signup" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-navy">Konfirmasi Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-marine"
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-marine"
                />
                <span>Saya menyetujui Syarat &amp; Ketentuan serta Kebijakan Privasi BARUNA.</span>
              </label>
            </>
          ) : null}
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {success}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-marine px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-marine/90 disabled:opacity-60"
          >
            {busy
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : mode === "invite"
                  ? "Set password"
                  : "Create account"}
          </button>
        </form>
        {mode !== "invite" ? (
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-xs text-marine underline"
          >
            {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        ) : null}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/">← Back to BARUNA</Link>
        </div>
      </div>
    </div>
  );
}

function AuthField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "tel";
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-navy">{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-marine"
      />
    </div>
  );
}
