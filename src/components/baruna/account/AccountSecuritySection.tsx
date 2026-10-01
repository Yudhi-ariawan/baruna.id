import { useState } from "react";
import {
  KeyRound,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Lock,
  LogOut,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { useNavigate } from "@tanstack/react-router";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";

export function AccountSecuritySection({ currentEmail }: { currentEmail: string }) {
  const { isId } = useLanguage();
  const navigate = useNavigate();

  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Email change state
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  // Logout state
  const [logoutBusy, setLogoutBusy] = useState(false);

  const isPasswordValid = newPassword.length >= 6;
  const isPasswordMatching = newPassword === confirmPassword;

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!isPasswordValid) {
      const msg = isId
        ? "Kata sandi baru harus memiliki minimal 6 karakter."
        : "New password must be at least 6 characters.";
      setPasswordError(msg);
      toast.error(msg);
      return;
    }
    if (!isPasswordMatching) {
      const msg = isId
        ? "Konfirmasi kata sandi tidak cocok."
        : "Passwords do not match.";
      setPasswordError(msg);
      toast.error(msg);
      return;
    }

    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      const successMsg = isId
        ? "Kata sandi Anda berhasil diperbarui!"
        : "Your password has been successfully updated!";
      setPasswordSuccess(successMsg);
      toast.success(successMsg);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : isId
            ? "Gagal memperbarui kata sandi."
            : "Failed to update password.";
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      const msg = isId ? "Masukkan alamat email yang valid." : "Please enter a valid email address.";
      setEmailError(msg);
      toast.error(msg);
      return;
    }
    if (cleanEmail === currentEmail.toLowerCase()) {
      const msg = isId
        ? "Alamat email baru sama dengan email saat ini."
        : "New email cannot be the same as current email.";
      setEmailError(msg);
      toast.error(msg);
      return;
    }

    setEmailBusy(true);
    setEmailError(null);
    setEmailSuccess(null);

    try {
      const { error } = await supabase.auth.updateUser({
        email: cleanEmail,
      });

      if (error) throw error;

      const successMsg = isId
        ? `Tautan konfirmasi telah dikirim ke ${cleanEmail}. Harap periksa kotak masuk email Anda.`
        : `A confirmation link has been sent to ${cleanEmail}. Please check your inbox.`;
      setEmailSuccess(successMsg);
      toast.success(successMsg);
      setNewEmail("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : isId
            ? "Gagal mengirim permintaan ubah email."
            : "Failed to update email.";
      setEmailError(msg);
      toast.error(msg);
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleSignOut() {
    setLogoutBusy(true);
    try {
      await supabase.auth.signOut();
      toast.success(isId ? "Berhasil keluar dari akun." : "Successfully signed out.");
      navigate({ to: "/auth" });
    } catch {
      toast.error(isId ? "Gagal keluar." : "Failed to sign out.");
    } finally {
      setLogoutBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-marine/10 p-1.5 text-marine">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h2 className="font-display text-lg font-bold text-navy">
              {isId ? "Keamanan Akun & Kredensial" : "Account Security & Credentials"}
            </h2>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            {isId
              ? "Kelola kata sandi, alamat email masuk, dan pengaturan sesi keamanan akun Anda."
              : "Manage your password, login email address, and security session settings."}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Change Password Form */}
        <div className="rounded-xl border border-border/80 bg-background/50 p-5 space-y-4">
          <div className="flex items-center gap-2 font-display text-sm font-bold text-navy">
            <KeyRound className="h-4 w-4 text-marine" />
            <span>{isId ? "Ubah Kata Sandi" : "Change Password"}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {isId
              ? "Ganti kata sandi default Anda untuk mengamankan akses ke platform BARUNA."
              : "Update your default password to keep your BARUNA account secure."}
          </p>

          <form onSubmit={handlePasswordChange} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                {isId ? "Kata Sandi Baru" : "New Password"}
              </label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={isId ? "Minimal 6 karakter" : "At least 6 characters"}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm pr-10 outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-navy cursor-pointer"
                  title={showPassword ? "Sembunyikan" : "Tampilkan"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                {isId ? "Konfirmasi Kata Sandi Baru" : "Confirm New Password"}
              </label>
              <input
                required
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={isId ? "Ulangi kata sandi baru" : "Repeat new password"}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
              />
            </div>

            {/* Live Password Strength Meter with Green Checkmarks */}
            {newPassword && (
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <PasswordStrengthMeter password={newPassword} isId={isId} />
                {confirmPassword && (
                  <div className="flex items-center gap-1.5 text-xs pt-1">
                    <CheckCircle2
                      className={`h-3.5 w-3.5 ${isPasswordMatching ? "text-emerald-600" : "text-destructive"}`}
                    />
                    <span className={isPasswordMatching ? "text-emerald-700 font-medium" : "text-destructive font-medium"}>
                      {isPasswordMatching
                        ? isId
                          ? "Kata sandi cocok"
                          : "Passwords match"
                        : isId
                          ? "Kata sandi belum cocok"
                          : "Passwords do not match"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {passwordError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50/50 p-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={passwordBusy || !isPasswordValid || !isPasswordMatching}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-marine px-4 py-2 text-xs font-semibold text-white hover:bg-navy transition disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
            >
              {passwordBusy ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              {isId ? "Simpan Kata Sandi Baru" : "Update Password"}
            </button>
          </form>
        </div>

        {/* Email & Session Security */}
        <div className="space-y-4">
          {/* Email Settings */}
          <div className="rounded-xl border border-border/80 bg-background/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-display text-sm font-bold text-navy">
                <Mail className="h-4 w-4 text-marine" />
                <span>{isId ? "Alamat Email Akun" : "Account Email"}</span>
              </div>
              {!showEmailChange && (
                <button
                  type="button"
                  onClick={() => setShowEmailChange(true)}
                  className="text-xs font-semibold text-marine hover:underline cursor-pointer"
                >
                  {isId ? "Ubah Email" : "Change Email"}
                </button>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-navy font-mono truncate">
              {currentEmail}
            </div>

            {showEmailChange ? (
              <form onSubmit={handleEmailChange} className="mt-3 space-y-3 pt-2 border-t border-border">
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">
                    {isId ? "Alamat Email Baru" : "New Email Address"}
                  </label>
                  <input
                    required
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="nama@contoh.go.id"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none transition focus:border-marine focus:ring-1 focus:ring-marine"
                  />
                </div>

                {emailError && (
                  <div className="flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{emailError}</span>
                  </div>
                )}

                {emailSuccess && (
                  <div className="flex items-start gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-50/50 p-2 text-xs text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600" />
                    <span>{emailSuccess}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={emailBusy || !newEmail.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-navy transition disabled:opacity-50 cursor-pointer"
                  >
                    {emailBusy ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    {isId ? "Kirim Tautan Konfirmasi" : "Send Confirmation"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmailChange(false);
                      setNewEmail("");
                      setEmailError(null);
                      setEmailSuccess(null);
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition cursor-pointer"
                  >
                    {isId ? "Batal" : "Cancel"}
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {isId
                  ? "Email digunakan untuk masuk ke akun dan menerima pemberitahuan resmi sistem BARUNA."
                  : "Email is used for logging into your account and receiving system notifications."}
              </p>
            )}
          </div>

          {/* Active Session & Sign Out */}
          <div className="rounded-xl border border-border/80 bg-background/50 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-navy">{isId ? "Sesi Aktif" : "Active Session"}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isId
                  ? "Keluar dari sesi peramban ini jika telah selesai."
                  : "Sign out of this browser session when finished."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={logoutBusy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive hover:text-white transition cursor-pointer disabled:opacity-50"
            >
              {logoutBusy ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
              {isId ? "Keluar Akun" : "Sign Out"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

