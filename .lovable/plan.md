# Phase 1.3 — Submission Pipelines, Canonical Registries & Training Funding Architecture (Final Corrected)

Baseline: **PHASE-1.2-GOVERNANCE-OPERATIONS-PASSED** (immutable).
This revision preserves all previously approved Phase 1.3 scope (canonical registries, provenance, Self-Paced-first branching, funding-preference architecture, governance controls, RLS, public views, tests, rollback) and applies six mandatory corrections: Modules Registry boundary, Self-Paced offering pointer, zero-tariff scope, no `app_role` enum change, no retrofit of existing RPCs, and updated acceptance tests.

---

## A. Scope

**Preserved**
- Four canonical registries: Experts, Knowledge Resources, Modules (renamed `module_registry`, see §G), Training Needs.
- Shared provenance header on every canonical row.
- Two intake tracks: Institutional/Admin + External/Self-Service.
- Atomic idempotent publisher RPCs (governance-decision or authorized direct-publish).
- Duplicate detection + merge preparation (no auto-merge).
- Public Portal read model (`_public_v` views) with "No Participant Charge" vs "Not Applicable" distinction.
- `platform_events` append-only analytics substrate — **emitted by Phase 1.3 workflows only**.
- RLS + GRANT on every new table; RPC-only canonical writes.
- Self-Paced-first branching in Request-a-Training.
- Funding-preference capture on Training Needs (requester-declared, non-authoritative).

**Corrections in this revision**
1. `module_registry` is governance/provenance/versioning only; `master_modules` (Learning Engine) is untouched.
2. Self-Paced recommendations point to a **Course Offering**, not just a course.
3. Approved Zero Tariff is future architecture only — no UI, no publication, no event in 1.3.
4. No change to `app_role` enum in 1.3; institutional operating access via an additive, rollback-safe capability table OR restricted to Admin/Management.
5. No retrofit of Phase 1.1/1.2 RPCs to emit `platform_events`; existing governance analytics continue to read `governance_audit_log`.
6. Acceptance tests updated accordingly.

**Explicitly excluded**
- Actual payment processing, SIMPONI, gateway, billing-code issuance, tariff calculation, official payment confirmation, automatic enrolment activation based on payment.
- Executive dashboards, warehouses, BI.
- Migration of Ocean Literacy `shared_v1`, AZA, Africa Training.
- Notification delivery.
- Any change to `master_modules`, existing learning tables, existing RPC signatures/behavior, or existing audit history.

---

## B. Canonical Registry Data Model (unchanged)

Shared header on every canonical row: `source_type`, `source_submission_id`, `source_institution_id`, `original_contributor_id`, `created_by`, `approved_by`, `published_by`, `approval_date`, `publication_date`, `verification_status`, `visibility`, `version`, `previous_version_id`, `current_status`, `audit_ref`, `created_at`, `updated_at`. Canonical writes are RPC-only (`SECURITY DEFINER`, `search_path=public`, in-DB role checks).

---

## C. Submission Source Architecture (unchanged)

Shared `source_type` vocabulary: `admin_direct`, `admin_entry`, `admin_import`, `bulk_import`, `institutional_intake`, `external_submission`, `invited_contributor`, `system_sync`, `migration_legacy`. One canonical registry per domain, differentiated only by `source_type` + provenance columns.

---

## D. Intake Workflows (unchanged + Self-Paced-first branching)

Track A (Institutional/Admin): draft → governance review → publish, or Admin/Mgmt direct-publish with rationale + audit + analytics event.

Track B (External/Self-Service): draft → validate → submit → QA recommend → Admin/Mgmt decide → canonical → publish. External submitters live only in `/my-submissions/*`.

Request-a-Training branching in front of Training Needs intake:

```
Training need identified
  → suitable Open Self-Paced Course Offering exists?
      ├── YES → "Start Learning Independently"
      │         ├── accept  → self_paced_alternative_selected
      │         │            + enrol into referenced Course Offering
      │         │            + training_need_converted_to_self_paced
      │         └── decline → continue to Facilitated Training
      └── NO/unsuitable → "Request Facilitated Training"
                          → funding-preference + logistics capture
                          → submit as Training Need
                          → QA triage → Prioritization → Decision
                          → Convert to Course Offering (Track A)
```

A user who accepts the Self-Paced pathway does not need to submit a cohort request. A Self-Paced recommendation may only be presented as immediately available when the referenced offering is enabled and uses an eligible Self-Paced delivery mode (see §H).

---

## E. Expert Digital Identity Model (unchanged)

Canonical `experts` + normalized children per prior revision; `experts_public_v` enforces per-section visibility; sensitive fields never leave the DB.

---

## F. Knowledge Resource Taxonomy (unchanged, boundary clarified)

Full 24-type `resource_type` enum. Canonical `knowledge_resources` per prior revision. Versioning via new row + `previous_version_id`.

**Boundary vs `module_registry`** — a **downloadable module document** (PDF, slide deck, handbook) is a `knowledge_resources` row of type `module` or `training_material`. A **structured instructional module** (learning objectives, competencies, activities, assessment approach, delivery suitability) is a `module_registry` row. The two are related — a `module_registry` row may reference one or more `knowledge_resources` rows via `related_resource_ids[]` — but neither owns the other. No duplicate canonical ownership.

---

## G. Modules Registry — Corrected Boundary (Correction #1)

**Naming**
- **`module_registry`** — new canonical governance/provenance/ownership/publication/versioning record introduced by Phase 1.3.
- **`master_modules`** — existing Learning Engine table. **Untouched in Phase 1.3.** No schema changes, no data changes, no trigger changes, no policy changes.

**Boundary rules**
- `module_registry` never writes to, mutates, or overwrites `master_modules`.
- Approval and publication of a `module_registry` record do **not** auto-create a `master_modules` row.
- The eventual link between an approved registry record and a Learning Engine implementation is deferred to a future phase via one of:
  - a nullable `module_registry_id` column on a future mapping table; or
  - a separate `module_learning_mappings` table.
  Neither is created in 1.3.
- A `module_registry` row may reference a `master_modules.id` as informational provenance only (nullable text or nullable soft-uuid without FK), never as a source of truth for that Learning Engine row.

**Fields on `module_registry`** — as previously approved: title, summary, learning_objectives[], competency_refs[], target_participants, prerequisites[], estimated_learning_hours, language, module_type, delivery_suitability[], content_outline (jsonb), learning_activities (jsonb), assessment_approach (jsonb), author_expert_id, institution_id, related_resource_ids[]. Plus the shared header (§B).

Explicit: AZA and Africa Training remain untouched. Ocean Literacy `shared_v1` remains untouched.

---

## H. Training Needs Model — Corrected Self-Paced Pointer (Correction #2)

Canonical `training_needs` fields as previously approved, with the following pointer correction:

**Self-paced alternative capture (corrected)**
- `self_paced_alternative_found` boolean
- `recommended_self_paced_course_id` uuid nullable — preserved for course identity/provenance
- **`recommended_self_paced_offering_id` uuid nullable** — the actual accessible Course Offering used for enrolment, access, availability, delivery mode, and progress
- `requester_selected_learning_path` text CHECK IN (`self_paced`, `facilitated`, `undecided`)

**Availability rule**
A Self-Paced recommendation may only be **presented as immediately available** when:
- `recommended_self_paced_offering_id` is set AND
- the referenced offering is enabled AND
- the offering's delivery mode is on the eligible Self-Paced list.

If any condition fails, the recommendation may still be recorded but must be surfaced as "not currently available" and MUST NOT drive enrolment.

**Funding preference (unchanged, non-authoritative)**
`funding_preference` ∈ {`government_funded`, `requesting_institution_funded`, `sponsor_or_partner_funded`, `cost_sharing`, `participant_paid_potential_pnbp`, `institution_paid_potential_pnbp`, `scholarship_or_approved_support`, `not_yet_determined`}; `proposed_payer`; `indicative_budget`; `participant_charge_preference` ∈ {`no_participant_charge`, `participant_paid`, `mixed`, `to_be_determined`}.

**Logistics** (unchanged): `logistics_requirements` jsonb, `accommodation_required`, `meals_required`, `travel_support_required`, `equipment_required`.

**Conversion routing** (unchanged): `conversion_destination` ∈ {`self_paced_course`, `facilitated_training`, `custom_course_offering`, `no_action`, `further_analysis`}.
`convert_training_need(_need_id, _destination, _target_ref?)` refuses invalid combos (e.g. `self_paced_course` destination without both `recommended_self_paced_course_id` and `recommended_self_paced_offering_id`).

Explicit: the requester cannot set an official tariff, approve a zero tariff, generate a billing code, or confirm payment. `approved_zero_tariff` cannot appear anywhere in a requester payload (see §J, Correction #3).

---

## I. Publication & Versioning Rules (unchanged)

Publisher RPCs only (`publish_<domain>_from_decision`, `publish_<domain>_direct`) — atomic, idempotent, in-DB role-checked, duplicate-guarded, audit + `registry_record_published` event on success. New version = new row + `previous_version_id`; supersession explicit.

---

## J. Public Portal & Zero-Tariff Scope (Correction #3)

Public views (`experts_public_v`, `knowledge_resources_public_v`, `module_registry_public_v`, `training_needs_public_v`) enforce `current_status` approved/published + `visibility='public'` + acceptable verification + not withdrawn/archived/deprecated.

**Terminology in 1.3 public + admin surfaces**
Two distinct labels only:
- **A. "No Participant Charge"** — another funding source covers the cost.
- **C. "Not Applicable"** — payment concept does not apply.

**Approved Zero Tariff is future architecture only in 1.3:**
- Vocabulary and future model are preserved in documentation.
- Any requester attempt to set `approved_zero_tariff` on a submission or training need is rejected at the API layer.
- No UI control in 1.3 grants a zero tariff.
- No canonical record may be marked `approved_zero_tariff` in 1.3.
- `zero_tariff_approved` is declared in the event enum but **never emitted** in 1.3.
- The prior acceptance requirement that Public Training Needs must display an actual Approved Zero Tariff record is **removed**. Actual display + tests belong to the future Offering Financial Configuration phase.

Public CTAs unchanged: Join as an Expert, Contribute Knowledge, Submit a Resource, Propose a Module, Submit Training Needs.

---

## K. Analytics Event Readiness — 1.3 Emitters Only (Correction #5)

`platform_events` table introduced in 1.3 is append-only.

**Emitted by Phase 1.3 workflows** (new pipelines only):
- `draft_created`, `submission_started`, `submission_submitted`, `review_assigned` *(only from 1.3 registry submissions)*, `recommendation_submitted` *(only from 1.3 registry reviews)*, `decision_recorded` *(only from 1.3 registry decisions)*, `returned_for_revision` *(1.3 registry only)*, `approved`, `rejected`, `directly_published`, `registry_record_created`, `registry_record_updated`, `registry_record_published`, `registry_record_archived`.
- `self_paced_alternative_presented`, `self_paced_alternative_selected`, `self_paced_course_started`, `training_request_avoided_by_existing_content`, `facilitated_training_requested`, `training_need_converted_to_self_paced`, `training_need_converted_to_course_offering`, `funding_preference_selected`.

**Declared in the enum but NOT emitted in 1.3** (future):
- `funding_model_confirmed`, `zero_tariff_approved`, `billing_requested`, `billing_issued`, `payment_confirmed`.

**No retrofit of Phase 1.1 / 1.2 RPCs.**
Existing Phase 1.1 and 1.2 governance RPCs continue to write only to `governance_audit_log`. Their signatures, authorization behavior, transaction behavior, and audit behavior are frozen. Cross-platform event normalization and any safe historical backfill are deferred to **Phase 1.4 — Analytics & Reporting Foundation**.

Reporting dimensions prepared (SQL views only, no dashboards): self-paced vs facilitated; no-participant-charge vs paid; government/institution/sponsor/scholarship funded; cost-sharing; potential PNBP; training needs resolved by existing learning content.

---

## L. RLS, Authorization & Capability Model (Correction #4)

**No change to `app_role` enum in Phase 1.3.**
`app_role` remains `{admin, management, qa_reviewer}` exactly as in the 1.2 baseline.

**Contributor / Expert applicant / Institutional submitter access** remains ownership-based through `/my-submissions` — a signed-in user reads and writes only rows they own. No new role values.

**Institutional operating access** in 1.3 chooses one of two options at approval time — both are additive and reversible:

**Option A (default, safest):** limit all institutional entry and import in 1.3 to Admin/Management. No new capability table.

**Option B (only if Option A proves operationally insufficient during design review):** introduce a new, additive, domain-scoped capability table — no enum change:

```text
domain_operator_assignments
  id, user_id, domain, permission_level,
  assigned_by, active boolean,
  created_at, updated_at
```

- Full RLS + GRANTs.
- Assignments granted/revoked only by Admin via new SECURITY DEFINER RPCs.
- Every grant/revoke writes a `governance_audit_log` event.
- Fully reversible migration (drop table + RPCs cleanly restores 1.2 baseline).

Option B is documented here but is **not** the default; if adopted it ships as its own increment gated by explicit approval.

**Role matrix** (unchanged from 1.2 for Admin/Management/QA Reviewer). Canonical registry writes remain RPC-only for all roles. Public users read only `_public_v` views.

Every new table ships with `ENABLE RLS` + explicit `GRANT` + policies scoped by `has_role` / ownership.

---

## M. Delivery Increments

1. **Shared foundation** — provenance columns, `source_type` CHECK, shared lifecycle helper, `platform_events` table + emit helper (used by 1.3 pipelines only).
2. **Experts registry + intake.**
3. **Knowledge resources registry + intake.**
4. **`module_registry` + intake.** No touching of `master_modules`. No future mapping table in 1.3.
5. **Training needs registry + intake** — Self-Paced-first branching, corrected offering pointer (`recommended_self_paced_offering_id`), funding-preference capture, `convert_training_need(_destination, _target_ref?)`.
6. **Admin registry workspaces + direct-publication controls.** Default Option A (institutional entry limited to Admin/Management). Option B (`domain_operator_assignments`) only if explicitly approved.
7. **Public Portal read surfaces + CTAs** with "No Participant Charge" vs "Not Applicable" labels (no Approved Zero Tariff surface).
8. **Analytics events wiring** — 1.3 pipelines only. No retrofit of 1.1/1.2 RPCs. Future event names present in enum but unemitted.
9. **E2E, RLS, RPC security, duplicate, regression, rollback** (see §N).

**Deferred to later phases:**
- Offering Financial Configuration (`funding_model`, `tariff_reference`, `tariff_amount`, `currency`, `price_visibility`, `payment_deadline`, `funding_approval_reference`, `access_activation_policy`, etc.).
- Payment lifecycle table (`billing_provider`, `billing_code`, `NTPN`, `payment_status`, refunds, etc.).
- Versioned tariff configuration (`service_code`, `legal_basis`, `effective_date`, `expiry_date`, etc.).
- Payment status vocabulary implementation and access policies (`access_before_payment`, `access_only_after_payment_confirmation`, etc.).
- Cross-platform event normalization + historical backfill (**Phase 1.4**).
- `module_registry` ↔ `master_modules` linkage (mapping table).

---

## N. Acceptance Test Matrix

Per registry (Experts, Knowledge, `module_registry`, Training Needs) — all 19 tests from prior revision (external draft, submit, assign, recommend, approve, publish, provenance, public visibility, reject, RFR, withdraw, admin direct entry, admin direct publish, unauthorized direct-publish rejected, cross-user RLS isolation, duplicate prevention, versions preserved, audit chain, analytics event emitted).

**Additional Training-Needs tests (updated)**
- Self-Paced alternative presented → `self_paced_alternative_presented` emitted.
- User accepts Self-Paced → `self_paced_alternative_selected` + `training_need_converted_to_self_paced` emitted; enrolment lands on the exact Course Offering referenced by `recommended_self_paced_offering_id`; no facilitated draft created.
- User declines → `facilitated_training_requested` emitted; funding-preference fields persisted verbatim.
- Self-Paced recommendation is only surfaced as immediately available when the referenced offering is enabled and uses an eligible Self-Paced delivery mode; otherwise surfaced as "not currently available" and cannot drive enrolment.
- Requester cannot set `approved_zero_tariff` — API rejects if injected.
- `convert_training_need` refuses invalid combos (e.g. `self_paced_course` destination without both course and offering IDs).

**New correction-specific tests**
- `module_registry` and `master_modules` remain separate; no duplicate learning-delivery record is created.
- An approved `module_registry` record does not mutate `master_modules` (row count and content hash of `master_modules` unchanged before/after approval + publish).
- Self-Paced recommendation resolves to an enabled, eligible Course Offering (enrolment lands on it).
- `approved_zero_tariff` cannot be set on any 1.3 record and `zero_tariff_approved` is never emitted in 1.3 (guard test scanning `platform_events`).
- `pg_enum` scan confirms no new values added to `app_role` in 1.3.
- Contributor / applicant / institutional submitter access is ownership-based only (no role grant required for `/my-submissions`).
- Existing Phase 1.1 and 1.2 RPC definitions unchanged (compare `pg_proc.prosrc` + `proconfig` + `proacl` for every 1.1/1.2 RPC against baseline snapshot).
- `platform_events` contains no rows attributable to 1.1/1.2 RPCs after regression runs (only 1.3 pipelines emit).
- No 1.3 endpoint emits `billing_requested`, `billing_issued`, `payment_confirmed`, `funding_model_confirmed`, or `zero_tariff_approved`.

**Cross-cutting** — public views never expose non-public rows; `platform_events` append-only enforced; all 1.3 RPCs `search_path=public`, `EXECUTE` revoked from `PUBLIC`/`anon`; full Phase 1, 1.1, 1.2 regression suites re-run and pass unchanged.

---

## O. Rollback Strategy (unchanged)

Every increment ships as one reversible migration bundle + one code batch behind `registries.<domain>.enabled` feature flag. Per-increment rollback drops that increment's objects only; `platform_events` retained (append-only) for forensic value. Full-phase rollback returns cleanly to **PHASE-1.2-GOVERNANCE-OPERATIONS-PASSED**. No destructive change to `master_modules`, Ocean Literacy, AZA, Africa Training, existing governance RPCs, audit history, feature flags, or auth. If Option B (`domain_operator_assignments`) is adopted, its migration is self-contained and independently reversible.

---

## P. Explicit Exclusions

- `master_modules` — untouched (Correction #1).
- `app_role` enum — unchanged (Correction #4).
- Ocean Literacy `shared_v1`, AZA legacy, Africa Training legacy — untouched.
- Existing Phase 1.1 / 1.2 RPC signatures, authorization behavior, transaction behavior, audit behavior — frozen (Correction #5).
- Existing learner journeys, feature flags, auth — untouched.
- Phase 1, 1.1, 1.2 checkpoints — immutable.
- No billing, SIMPONI, payment gateway, tariff calculation, official payment confirmation, billing-code issuance, automatic enrolment activation based on payment, hard-coded PNBP tariff amounts, state-revenue receipt, storage of bank-account/card/payment credentials, or unofficial payment references.
- Approved Zero Tariff — vocabulary preserved, model deferred; no UI, no publication, no emission in 1.3 (Correction #3).
- Cross-platform event normalization + backfill — deferred to Phase 1.4.

---

PHASE 1.3 FINAL CORRECTED PLAN READY FOR APPROVAL
