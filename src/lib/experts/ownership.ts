/**
 * The ONE rule for "which account an expert profile belongs to" (Slide 37,
 * "Link / Match Record"): `experts.original_contributor_id`.
 *
 * `created_by` only records who inserted the row. For profiles published
 * directly by an administrator or created by a provisioning script that is the
 * administrator, so treating it as ownership would hand every such profile to
 * the admin (avatar overwrites, wrong trainer portal, wrong module author).
 *
 * The database applies the same rule (public._expert_is_owner and the trainer
 * portal functions, migration 20261020030000) and allows at most one
 * non-archived profile per account (experts_one_active_profile_per_contributor).
 */
export const EXPERT_OWNER_COLUMN = "original_contributor_id" as const;
