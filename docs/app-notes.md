# Fabric App notes: ROW clearing tracker (thin slice)

The first thin slice of the ROW clearing app, built on `app/row-tracker`
(Microsoft "Basic Todo App" template, create-rayfin 1.36.2). It replaces the
Todo entity with one feeder-plan entity, a list + edit form with a certainty
picklist and vendor dropdown, the cross-field rules from
`docs/cleaning-rules.md`, and a diagnostic claims panel. Synthetic data only.

## How the slice is built

| Layer | File(s) | What it does |
|---|---|---|
| Entity | `rayfin/data/ClearingPlan.ts`, `rayfin/data/schema.ts` | One row per feeder. Column names mirror the Snowflake ANALYTICS layer. `read` + `update` for any signed-in user; no create/delete (see permissions). |
| Shared model | `src/services/clearingPlanModel.ts` | Vendor / certainty / district constants and the row + edit types used by the service, validation, seed, and UI. |
| Data service | `src/services/clearingPlans.ts` | `listClearingPlans`, `updateClearingPlan`, `seedFabric`. In-memory (pre-seeded) when the backend is local; the typed Rayfin client against Fabric otherwise. |
| Validation | `src/services/validation.ts` | Per-field checks (mirror the decorators) **and** the cross-field rules. The only place the cross-field rules are enforced. |
| Seed | `src/services/seed.ts` | 15 synthetic feeder rows (every certainty ≥ 2×, two "Unassigned", all five districts). |
| Auth | `src/services/LocalAuthService.ts`, `RayfinAuthService.ts`, `bootstrap.ts` | Local = backend-free synthetic user (DEV-only). Fabric = Entra SSO (unchanged from the template). |
| UI | `src/pages/HomePage.tsx`, `src/components/ClaimsPanel.tsx`, `src/hooks/AuthContext.tsx` | Feeder table + inline edit form, the "Who am I" diagnostic card, and the gated "Load sample data" button. |

## Where each rule is enforced (a finding)

| Rule | Form | Server |
|---|---|---|
| `feeder_id` required, unique, ≤ 20 chars | ✓ | ✓ (`@text({ unique, max })`) |
| `district_name` required | ✓ | ✓ |
| `vendor` ∈ canonical list + "Unassigned" | ✓ | ✓ (`@set`) |
| `date_certainty` ∈ {confirmed, tentative, next year, TBD} | ✓ | ✓ (`@set`) |
| `notes` ≤ 500 chars | ✓ | ✓ (`@text({ max: 500 })`) |
| **confirmed/tentative → next date required** | ✓ | ✗ |
| **next year → planned year required, no date** | ✓ | ✗ |
| **TBD → no date** | ✓ | ✗ |

**Finding 1 — cross-field rules are form-only.** Rayfin's schema validator
(`toStandardSchema`) and Data API Builder both validate **per field**; there is
no cross-field rule surface. The three certainty↔date rules are enforced only in
the edit form (`validation.ts`). Server-side enforcement would need a Rayfin
**Function** (server-side UDF) that runs on write — a later step. Until then, a
direct API write could store an inconsistent row.

**Finding 2 — no groups claim in the policy model.** Rayfin's policy DSL exposes
only `claims.sub`, `claims.email`, and `claims.role`; there is no group claim,
and the client session is opaque (the app reads `id`, `email`, `name`). So the
planned role model — district managers edit their own district, an approved
**Entra group** edits all — likely cannot key off an Entra **group** claim
directly and will need a fallback (a mapped `role` claim, a lookup table, or a
Function). The **claims panel** is the experiment: after deploy, sign in through
Fabric and read exactly which claims arrive. The panel confirms or refutes this
before we design the role rules.

## Permissions for this slice

`@authenticated('read')` + `@authenticated('update')` — every signed-in user can
read and update **every** feeder. No delete. No create (rows arrive through the
seed). There is **no row-level policy yet**: the per-district / per-group rules
are a later step. This is deliberately coarse for the thin slice.

`updated_by` is set by the client from the signed-in session. It is **not
audit-grade** — a client controls the value it sends. The change-log step will
replace it with a server-stamped field. `updated_at` is a datetime (`@date`).

## How to run it locally (no Fabric)

The supported local run is **plain Vite** — it never contacts Fabric and starts
no backend:

```bash
cd app/row-tracker
npm install        # first time only
npm run dev:frontend
```

This serves the frontend only. Auth resolves instantly to a synthetic local
user (`LocalAuthService`, DEV-only), and the feeder list is the 15 seed rows
held in memory. Edit a feeder, try a rule violation (e.g. set certainty to
"confirmed" and clear the next clearing date → the form blocks the save).

**Do not use `npx rayfin dev` / `npm run dev` for a quick local check.** Per the
installed Rayfin docs, bare `rayfin dev` uses the Fabric provider **by default**
and *provisions a missing AppBackend in Fabric* — so it changes Fabric state and
is treated like a deploy (ask first). A Fabric-free managed backend exists only
behind the preview Docker provider (`rayfin dev --provider docker`, needs Docker
and the `docker-local-dev` feature flag).

## Seeding the Fabric database (gated)

The deployed app starts **empty** (`read`/`update` only, no create). To load the
15 sample rows once, after the first deploy:

1. In `rayfin/data/ClearingPlan.ts`, uncomment `// @authenticated('create')`.
2. `npx rayfin up` (deploy + apply schema) — **only when Josh asks.**
3. In the app, the empty list shows a **"Load sample data"** button; click it
   once (`seedFabric` inserts the 15 rows).
4. Re-comment `@authenticated('create')` and `npx rayfin up` again to lock
   creates back down.

Trade-off (recorded in `docs/decisions.md`): while create is enabled, any
signed-in user can insert rows. Mitigated by this being a dev-only POC with
synthetic data and by removing the permission immediately after seeding. The
clean long-term answer is a seed Function or a per-row create policy, with the
role rules.

## Open questions

- **Entra groups / roles** (Finding 2): confirm with the claims panel after
  deploy; then choose the fallback for the role rules.
- **Server-side cross-field enforcement** (Finding 1): add a Rayfin Function on
  write.
- **Clear-to-null on Fabric:** the generated mutation type takes
  `value | undefined`, not `null`, so "clear this date" is sent as `undefined`
  (interpreted as "leave unchanged") on the Fabric path. The in-memory local
  path clears correctly. Needs a Fabric-path fix (confirm whether the client
  supports an explicit null, or clear via a Function).
- **Audit fields:** replace client-set `updated_by` with a server-stamped value
  in the change-log step.
