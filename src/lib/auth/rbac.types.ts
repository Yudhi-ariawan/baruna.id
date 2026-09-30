export const BUSINESS_DOMAINS = [
  "academy",
  "knowledge",
  "experts",
  "events",
  "partnership",
  "community",
  "fellowship",
  "about",
] as const;

export const BUSINESS_ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "review",
  "verify",
  "approve",
  "publish",
  "archive",
] as const;

export const RBAC_ROLE_CODES = [
  "super_admin",
  "admin",
  "management",
  "qa_reviewer",
  "registered_user",
  "participant",
  "expert",
  "operator",
  "reviewer",
  "verifier",
  "approver",
  "publisher",
] as const;

export type BusinessDomain = (typeof BUSINESS_DOMAINS)[number];
export type BusinessAction = (typeof BUSINESS_ACTIONS)[number];
export type BusinessPermission = `${BusinessDomain}.${BusinessAction}`;
export type RbacRoleCode = (typeof RBAC_ROLE_CODES)[number];

export type AssignmentStatus = "active" | "suspended" | "revoked";
export type AssignmentScope = Record<string, string | number | boolean | null>;

export function businessPermission(
  domain: BusinessDomain,
  action: BusinessAction,
): BusinessPermission {
  return `${domain}.${action}`;
}
