import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/i18n";

const signupSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Full name is required and must be at least 2 characters."),
    organization: z.string().trim().min(2, "Institution / organization is required."),
    jobTitle: z.string().trim().min(2, "Job title / profession is required."),
    phone: z
      .string()
      .trim()
      .min(8, "Phone number / WhatsApp is required and must be at least 8 characters.")
      .regex(/^\+?[0-9 ()-]+$/, "Enter a valid phone number."),
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm password is required."),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: "You must agree to the Terms of Service and Privacy Policy." }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
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
  const { t } = useLanguage();
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
            ? t("auth.successSignUp")
            : t("auth.successSignUp"),
        );
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: redirect ?? "/academy/learn" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0]?.message ?? "Please complete all required registration fields.");
      } else {
        setError(err instanceof Error ? err.message : t("auth.invalidCredentials"));
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
            ? t("auth.signInTitle")
            : mode === "invite"
              ? t("auth.inviteTitle")
              : t("auth.signUpTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "invite"
            ? t("auth.inviteSubtitle")
            : mode === "signin"
              ? t("auth.signInSubtitle")
              : t("auth.signUpSubtitle")}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" ? (
            <>
              <AuthField
                label={t("auth.fullName")}
                value={displayName}
                onChange={setDisplayName}
                placeholder="Enter your full name"
              />
              <AuthField
                label={t("auth.organization")}
                value={organization}
                onChange={setOrganization}
                placeholder="Enter your institution or organization"
              />
              <AuthField
                label={t("auth.jobTitle")}
                value={jobTitle}
                onChange={setJobTitle}
                placeholder="e.g. Marine Researcher, Fisheries Officer"
              />
              <AuthField
                label={t("auth.phone")}
                type="tel"
                value={phone}
                onChange={setPhone}
                placeholder="e.g. +628..."
              />
            </>
          ) : null}
          {mode !== "invite" ? (
            <div>
              <label className="block text-sm font-medium text-navy">{t("auth.email")}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-marine"
              />
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-navy">{t("auth.password")}</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-marine"
            />
            {(mode === "signup" || mode === "invite") && (
              <p className="mt-1 text-xs text-muted-foreground">Minimum 8 characters.</p>
            )}
          </div>
          {mode === "signup" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-navy">{t("auth.confirmPassword")}</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="••••••••"
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
                <span>{t("auth.agreeTerms")}</span>
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
            className="w-full rounded-xl bg-marine px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-marine/90 disabled:opacity-60 cursor-pointer"
          >
            {busy
              ? t("auth.submitting")
              : mode === "signin"
                ? t("auth.signInBtn")
                : mode === "invite"
                  ? t("auth.setPassBtn")
                  : t("auth.signUpBtn")}
          </button>
        </form>
        {mode !== "invite" ? (
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-xs text-marine underline cursor-pointer"
          >
            {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}
          </button>
        ) : null}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/">← {t("common.back")} {t("nav.home")}</Link>
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
