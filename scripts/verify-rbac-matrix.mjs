import { createClient } from "@supabase/supabase-js";

const domains = [
  "academy",
  "knowledge",
  "experts",
  "events",
  "partnership",
  "community",
  "fellowship",
  "about",
];
const actions = [
  "read",
  "create",
  "update",
  "delete",
  "review",
  "verify",
  "approve",
  "publish",
  "archive",
];
const corePermissions = [
  "users.read",
  "users.update",
  "users.invite",
  "users.suspend",
  "users.assign_role",
  "roles.read",
  "roles.manage",
  "audit.read",
  "governance.read",
  "governance.manage",
];

// Values transcribed from the approved BARUNA business-role matrix.
const levels = {
  registered_user: [
    "limited",
    "limited",
    "limited",
    "limited",
    "read",
    "limited",
    "limited",
    "limited",
  ],
  participant: ["full", "full", "read", "limited", "read", "full", "limited", "limited"],
  expert: ["limited", "limited", "full", "limited", "limited", "limited", "limited", "limited"],
  operator: ["full", "full", "full", "full", "full", "limited", "full", "limited"],
  reviewer: ["limited", "limited", "limited", "limited", "limited", "read", "limited", "limited"],
  verifier: ["limited", "limited", "full", "limited", "limited", "read", "limited", "limited"],
  approver: ["full", "full", "full", "full", "full", "full", "full", "full"],
  publisher: ["limited", "limited", "limited", "full", "full", "full", "limited", "full"],
};

const processAction = {
  operator: "archive",
  reviewer: "review",
  verifier: "verify",
  approver: "approve",
  publisher: "publish",
};

function expectedFor(role) {
  if (role === "public") return new Set();
  if (role === "super_admin") {
    return new Set([
      ...corePermissions,
      ...domains.flatMap((domain) => actions.map((action) => `${domain}.${action}`)),
    ]);
  }

  const expected = new Set();
  levels[role].forEach((level, index) => {
    const domain = domains[index];
    expected.add(`${domain}.read`);
    if (level === "limited" || level === "full") {
      expected.add(`${domain}.create`);
      expected.add(`${domain}.update`);
    }
    if (level === "full") expected.add(`${domain}.delete`);

    const lifecycleAction = processAction[role];
    if (
      lifecycleAction &&
      ((role === "operator" && level === "full") ||
        (["reviewer", "verifier"].includes(role) && level !== "read") ||
        ["approver", "publisher"].includes(role))
    ) {
      expected.add(`${domain}.${lifecycleAction}`);
    }
  });
  return expected;
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const [{ data: roles, error: roleError }, { data: permissions, error: permissionError }] =
  await Promise.all([
    client.from("rbac_roles").select("id,code"),
    client.from("rbac_permissions").select("id,code"),
  ]);
if (roleError) throw roleError;
if (permissionError) throw permissionError;

const { data: mappings, error: mappingError } = await client
  .from("rbac_role_permissions")
  .select("role_id,permission_id")
  .range(0, 9999);
if (mappingError) throw mappingError;

const permissionById = new Map(permissions.map((permission) => [permission.id, permission.code]));
const actualByRole = new Map(roles.map((role) => [role.code, new Set()]));
for (const mapping of mappings) {
  const role = roles.find((candidate) => candidate.id === mapping.role_id);
  const permission = permissionById.get(mapping.permission_id);
  if (role && permission) actualByRole.get(role.code).add(permission);
}

const expectedCatalog = new Set([
  ...corePermissions,
  ...domains.flatMap((domain) => actions.map((action) => `${domain}.${action}`)),
]);
const actualCatalog = new Set(permissions.map((permission) => permission.code));
const failures = [];
if (actualCatalog.size !== 82)
  failures.push(`permission catalog count: ${actualCatalog.size} !== 82`);
for (const permission of expectedCatalog) {
  if (!actualCatalog.has(permission)) failures.push(`missing permission: ${permission}`);
}
for (const permission of actualCatalog) {
  if (!expectedCatalog.has(permission)) failures.push(`unexpected permission: ${permission}`);
}

const personas = ["public", ...Object.keys(levels), "super_admin"];
let assertions = 0;
for (const persona of personas) {
  const expected = expectedFor(persona);
  const actual = persona === "public" ? new Set() : actualByRole.get(persona);
  if (!actual) {
    failures.push(`missing role for persona: ${persona}`);
    continue;
  }
  for (const permission of expectedCatalog) {
    assertions += 1;
    if (actual.has(permission) !== expected.has(permission)) {
      failures.push(
        `${persona} ${permission}: expected=${expected.has(permission)} actual=${actual.has(permission)}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`RBAC matrix verified: ${assertions} assertions, 82 permissions, 10 personas.`);
  console.log("Public access is intentionally delegated to existing published-data RLS policies.");
}
