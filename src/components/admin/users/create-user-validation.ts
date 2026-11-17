// Field-level checks for the Admin Portal "Tambah User" dialog. Same limits as the
// server (createUser in src/lib/admin/users.functions.ts); the server stays the
// authority. A duplicate e-mail can only be known by the server, so its message is
// mapped back to the e-mail field (emailTakenMessage).
import { z } from "zod";

export type CreateUserFields = {
  displayName: string;
  email: string;
  password: string;
  organization: string;
  jobTitle: string;
  phone: string;
  roles: string[];
};

const EMAIL = z.string().trim().email();

export const CREATE_USER_LABELS: Record<string, string> = {
  displayName: "Full name", email: "Email address", password: "Password", organization: "Institution",
  jobTitle: "Job title", phone: "Phone", roles: "Roles",
};

export function createUserErrors(f: CreateUserFields): Record<string, string> {
  const e: Record<string, string> = {};
  const name = f.displayName.trim();
  if (!name) e.displayName = "Enter the full name.";
  else if (name.length < 2 || name.length > 120) e.displayName = `Full name must be 2–120 characters (now ${name.length}).`;
  if (!f.email.trim()) e.email = "Enter an e-mail address.";
  else if (!EMAIL.safeParse(f.email).success) e.email = "Enter a valid e-mail address, e.g. name@kkp.go.id.";
  else if (f.email.trim().length > 254) e.email = "E-mail is too long (max 254 characters).";
  if (!f.password) e.password = "Enter a password.";
  else if (f.password.length < 8 || f.password.length > 128) e.password = `Password must be 8–128 characters (now ${f.password.length}).`;
  if (f.organization.trim().length > 160) e.organization = "Maximum 160 characters.";
  if (f.jobTitle.trim().length > 120) e.jobTitle = "Maximum 120 characters.";
  if (f.phone.trim().length > 40) e.phone = "Maximum 40 characters.";
  if (f.roles.length === 0) e.roles = "Select at least one role.";
  return e;
}

/** The auth server's "already registered" error, shown on the e-mail field. */
export function emailTakenMessage(serverMessage: string): string | null {
  return /already (been )?registered|already exists|email_exists/i.test(serverMessage)
    ? "This e-mail already has a BARUNA account. Find it in the list, or use another e-mail."
    : null;
}
