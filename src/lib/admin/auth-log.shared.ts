// Authentication Log (Slide 42, LS-01). Shared by the server function and the page.

export const AUTH_EVENTS = [
  "sign_in",
  "sign_out",
  "account_created",
  "email_confirmed",
  "password_changed",
  "recovery_requested",
] as const;
export type AuthEvent = (typeof AUTH_EVENTS)[number];

export const AUTH_EVENT_INFO: Record<AuthEvent, { label: string; tone: string }> = {
  sign_in: { label: "Masuk", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  sign_out: { label: "Keluar / sesi berakhir", tone: "bg-slate-50 text-slate-700 border-slate-200" },
  account_created: { label: "Akun dibuat", tone: "bg-sky-50 text-sky-800 border-sky-200" },
  email_confirmed: { label: "Email dikonfirmasi", tone: "bg-sky-50 text-sky-800 border-sky-200" },
  password_changed: { label: "Kata sandi diubah", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  recovery_requested: { label: "Minta reset kata sandi", tone: "bg-amber-50 text-amber-800 border-amber-200" },
};

export type AuthLogEntry = {
  id: number;
  event: AuthEvent;
  at: string;
  userId: string | null;
  email: string | null;
  name: string | null;
  isAdmin: boolean;
  ip: string | null;
  userAgent: string | null;
};

/** "Chrome · Windows" from a user-agent string; null when there is none. */
export function describeDevice(ua: string | null): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : /node|undici|axios|curl|python/i.test(ua)
              ? "Skrip/server"
              : "Peramban lain";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return os ? `${browser} · ${os}` : browser;
}
