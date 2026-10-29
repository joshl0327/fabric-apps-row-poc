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
audit-grade** — a client controls the value it sends. The change-log step
(prompt 10) did **not** replace it; instead it added the append-only `ChangeLog`
whose `changed_by` **is** server-pinned (to `claims.email`), so the trustworthy
record of who changed a feeder is the `ChangeLog`, not `updated_by`. See
"Change log (audit trail, prompt 10)" below. `updated_at` is a datetime
(`@date`).

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

> Superseded for population by **"Loading the 153 feeders (prompt 09)"** below —
> that's the real load. This section documents the original 15-row seed pattern.
> Note: as of prompt 09 `@authenticated('create')` is **committed enabled** for
> the load window (a follow-up PR switches it off), so step 1 below is already
> done on the current branch.

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

## Loading the 153 feeders (prompt 09)

The real population path, replacing the 15-row seed above: load the 153 clean
feeders from Snowflake `ROW_DB.ANALYTICS` into the app. Same gated-create
pattern as the seed, but driven by the **"Import feeders"** control (file
picker) instead of a fixed button, and it **upserts by `feeder_id`** so running
it twice gives the same result.

**Load steps (Josh runs these):**

1. **Export** — in Snowsight, run `snowflake/08_app_load_export.sql` as
   `ROLE_REPORTER`. Download the result grid as CSV into `data/out/`
   (gitignored). Expect **153 rows**.
2. **Merge** the reviewed PR (create is enabled in it).
3. **Deploy** — `npx rayfin up` (Josh; this PR has `@authenticated('create')`
   on).
4. **Import** — sign in, and in the "Import feeders" panel choose the CSV. The
   result summary shows created / updated / skipped and the reconciliation.
5. **Check counts** against the panel (below).
6. **Clean up** the 13 leftover seed rows (SQL below).
7. **Follow-up PR** re-comments `@authenticated('create')`; Josh deploys again
   to lock creates back down.

**Expected result (from the 15 current seed rows):**

| Metric | Expected |
|---|---|
| Source rows | 153 |
| Created | 151 |
| Updated | 2 (214-1, 328-4 — the only seed ids in the 153; 328-4's district is corrected Cedar Valley → Pine Hollow) |
| Skipped | 0 |
| Feeders in plan | 153 |
| Certainty: confirmed / tentative / next year / TBD | 142 / 1 / 2 / 8 |
| With a next clearing date | 143 |
| Leftover (reported, not deleted) | 13 |

These match `docs/measures.md` after the prompt-09 cleaning-rule change
(`Feeders TBD` 5→8). The Import panel shows each count beside its expected value
and flags any mismatch in red.

**Cleaning up the 13 leftover seed rows (one-time, manual).** The app has no
delete permission (none is added), so removing the seed feeders that aren't in
the 153 is a one-time statement in the **Fabric SQL database query editor**
(T-SQL), run once after the load. Confirm first with a `SELECT`, then delete the
exact `feeder_id`s the import summary lists as leftover — expected to be these
13 (the 15 seed ids minus 214-1 and 328-4):

```sql
-- Confirm first (expect 13 rows):
SELECT feeder_id FROM dbo.ClearingPlans
WHERE feeder_id IN (
  '101-1','118-2','203-1','227-3','245-2','316-1',
  '402-2','417-1','533-1','548-3','619-2','701-1','742-2'
);

-- Then delete:
DELETE FROM dbo.ClearingPlans
WHERE feeder_id IN (
  '101-1','118-2','203-1','227-3','245-2','316-1',
  '402-2','417-1','533-1','548-3','619-2','701-1','742-2'
);
```

After cleanup the table holds exactly the 153 feeders. (If any seed row was
hand-edited to a different `feeder_id` while testing, trust the import summary's
leftover list over this fixed set.)

## Deployed results (2026-10-16)

First deploy of the slice to `ROW-POC-Dev`, after seeding. Observations and the
one bug found, with its fix. All of this is **only fully verifiable on the
deployed app** — local mode uses the in-memory store, which has none of these
behaviours (it clears correctly, has no GraphQL layer, and runs a synthetic
local user).

Observations (recorded, no code change):

- **Claims panel shows only `id` and `email`** — no name, role or groups. This
  is the Finding 2 experiment answer in the live environment: plan the role
  model around what actually arrives (confirms the groups-claim gap).
- **"Load sample data" with create disabled failed** with "The field
  `createClearingPlan` does not exist on the type `Mutation`". With no role
  granting create, the API exposes no create operation at all — so the seed
  button only works during the gated create-enabled window (as designed).
- **Errors showed as raw GraphQL text** in the UI — fixed below (observation 3).

**Bug — clearing a field kept the old value.** Editing feeder 101-1 from
confirmed (2026-11-15) to TBD with the next clearing date cleared saved
"successfully" but the row still showed 2026-11-15; feeder 533-1 did the same.
Setting values worked, clearing them didn't. Root cause: the update sent a
cleared field as `undefined`, which the data API treats as "leave unchanged".
The form passed its own rules (TBD with no date), so the result was silent bad
data that broke our own cross-field rule.

**Fix (this change):**

1. **Explicit clear.** Cleared optional fields (`next_clearing_date`,
   `planned_year`, `last_cleared_date`, `last_work_done`, `notes`) are now sent
   as an explicit `null`, which the installed `@microsoft/rayfin-data` client
   serialises to a GraphQL `null` literal (DAB applies it as "set to null").
   `undefined` is still used only for fields the edit never touches. The
   generated `UpdateInput` type is `value | undefined` with no `null`, so the
   null is carried through a cast (`clearable`) — the runtime behaviour is the
   supported mechanism, confirmed by reading the client source
   (`formatMutationInput` skips only `undefined`; `formatGraphQLValue` renders
   `null`).
2. **Read-back guard.** After every save the full row is read back and compared
   with what was submitted (`diffSavedRow`). Any field the server kept differently
   throws a clear error naming the field and the value the server kept, so a
   silent mismatch can't recur. (`updated_at` is not compared — a datetime can
   lose sub-second precision on the round trip.)
3. **Friendly errors.** Raw GraphQL text is replaced in the UI with a short
   plain message; the full error still goes to the browser console
   (`src/services/errors.ts`, `toUserMessage`).

## Change log (audit trail, prompt 10)

The second half of Phase 3's exit test — "every edit produces an audit row" —
an **append-only** log of who changed what and when, that no user can edit or
delete.

### How it works

| Layer | File(s) | What it does |
|---|---|---|
| Entity | `rayfin/data/ChangeLog.ts`, `rayfin/data/schema.ts` | One row per saved change: `feeder_id`, `action`, `changed_by`, `changed_at`, `before_json`, `after_json`, optional `reason`. **read + create only** (see permissions). |
| Types | `src/services/changeLogModel.ts` | The logged fields, friendly labels, and the `ChangeLogRow` / `FieldChange` shapes. |
| Service | `src/services/changeLog.ts` | `diffFeeder` (changed-fields diff), `buildChangeLogWrite`, `logFeederUpdate` (orchestrates the write), `listFeederHistory`, `listRecentChanges`. In-memory in local mode; typed Rayfin client against Fabric. |
| UI | `src/pages/HomePage.tsx` | A **History** block in each feeder's edit view (newest first: when, who, field `old → new`, reason) and a **Recent changes** panel (last 20 across all feeders). An optional **Reason for change** input. Plain React + Tailwind; no new library. |
| Flag | `src/services/featureFlags.ts`, `src/vite-env.d.ts` | `isFeederImportEnabled()` — the Import panel is hidden unless built with `VITE_ENABLE_FEEDER_IMPORT=true`. |

**Write sequence.** On save: `updateClearingPlan` saves and read-backs the
server-verified row (prompt 08). Then `logFeederUpdate(before, saved, …)` diffs
the two, keeps only the fields that changed (a cleared value recorded as
`null`), and writes one `ChangeLog` row holding just those fields. An unchanged
save writes nothing.

**Who is trustworthy.** `changed_by` is the signed-in **email**, and a create
policy pins it server-side: `@authenticated('create', { policy: (c,i) =>
c.email.eq(i.changed_by) })`, which DAB compiles to
`@claims.email eq @item.changed_by`. A row whose `changed_by` ≠ the caller's
email is rejected by the API — the browser cannot forge the author.

### Proving it is append-only

`ChangeLog` carries **no `update` and no `delete` decorator**. DAB only exposes
a GraphQL mutation for an action some role grants (the same reason the
create-disabled seed earlier failed with "`createClearingPlan` does not exist on
the type `Mutation`"), so there is no `updateChangeLog` / `deleteChangeLog`
operation at all. The generated client *types* expose `.update`/`.delete` on
every entity regardless of grants, so they can't prove it — the **DAB config**
(which drives the GraphQL schema) is the authoritative artifact.

`src/__tests__/changeLogPermissions.test.ts` proves it **offline, no deploy**:
it runs the core `SchemaAnalyzer` + `ConfigGenerator` over the real decorators
in-memory and asserts `ChangeLog` grants only `create` (with the email policy) +
`read`. The generated permissions block:

```json
{ "role": "authenticated",
  "actions": [ { "action": "create",
                 "policy": { "database": "@claims.email eq @item.changed_by" } },
               "read" ] }
```

(The test reads the entities from the `tsc`-compiled output under
`rayfin/.temp/compiled/`, because the Stage-3 decorators in `rayfin/data/*.ts`
aren't parsed by the test runner's swc transform; run `npm run build` first, as
the DoD does.)

### Known gaps

- **Two writes, not one transaction.** Save and log are separate API calls. If
  the save succeeds but the log write fails — or there is **no email** on the
  session to attribute the change to (no `'unknown'` fallback for `changed_by`)
  — the edit is kept and a distinct **"saved but not logged"** warning is shown,
  never hidden. Making both atomic needs a server-side Rayfin **Function** on
  write (same place as the cross-field enforcement in Finding 1).
- **`changed_at` is set by the browser.** The decorator surface has no
  server-set / auto-now timestamp (`default` is a static literal only). A
  server-stamped time also needs a Function.
- **The import is not logged.** The 153-feeder load is the baseline, not an
  edit.
- **`ClearingPlan.updated_by` is still client-set** and not audit-grade. The
  trustworthy record of who changed a feeder is the `ChangeLog`, not
  `updated_by`. Pinning `updated_by` with an update policy was deliberately
  deferred (see Open questions / prompt 11).

## Report reads the app (Phase 4, trimmed — prompt 11, 2026-10-28)

The Power BI report's `FACT_ROW_PLAN` table now reads the app's **own Fabric SQL
database** (`dbo.ClearingPlans`) in **DirectQuery**, instead of Import from
Snowflake `ANALYTICS`. This demonstrates the live loop — *edit a feeder in the
Fabric App → see it in the Power BI report* — in Power BI Desktop. Every other
table stays Import from Snowflake, so the semantic model is now **composite**.
The full model-side detail is in `docs/data-model.md`; in short: two new Power
Query parameters (`App_SQL_Server`, `App_SQL_Database`), a DirectQuery native
`SELECT` that aliases the app's lower-case columns to the model's UPPERCASE
names and `CAST`s the two `datetime2` dates to `date`, the vendor join moved to
`VENDOR_NAME` (the app stores the name, not an id), `DQ_ISSUE_COUNT` dropped, and
`Line Miles in Plan` rewritten with `TREATAS` (the limited cross-source
relationship breaks `RELATED()`). Nothing was created or altered in the app's
database; the report only reads it.

### Hand test: edit in the app, see it in the report

To show the loop end to end (Josh runs this against the deployed app):

1. In Power BI Desktop, open the **Clearing Plan** page and note a named
   feeder's row — e.g. find a **Scheduled** feeder and remember its **Next
   clearing** date and **Vendor**.
2. In the **deployed Fabric App**, sign in and edit that same feeder: change its
   **Next clearing date** (e.g. move it earlier so it becomes **Overdue**, or
   change the **Vendor**). Save; confirm the edit succeeded (and that a
   `ChangeLog` row was written).
3. Back in Desktop, refresh just that visual (or the page). Because
   `FACT_ROW_PLAN` is **DirectQuery**, no full model refresh is needed — the
   visual re-queries the app database. **Time how long** from the app save until
   the report shows the new value.
4. Confirm the **Clearing Status** / KPIs move as expected (e.g. Feeders Overdue
   +1, or the vendor split shifts). Record the latency and anything surprising.

Expected: the change appears on the next visual refresh (seconds, network- and
capacity-dependent), with no republish and no Snowflake involvement.

### Design note: publishing and Snowflake sync (out of scope)

Two things were deliberately **left out** of this trimmed phase and remain design
notes only:

- **Publishing the report.** The composite report runs in Desktop only. A
  published version would need the dataset's DirectQuery source (the Fabric SQL
  DB) reachable with a gateway/credentials in the service — not set up here, and
  publishing is gated by AGENTS.md anyway.
- **Syncing the app's data back to Snowflake (`APP_SYNC`).** The original Phase 4
  design routed app edits into Snowflake `APP_SYNC` and kept the report on
  Snowflake. This trimmed version points the report straight at the app DB
  instead, so there is **no** app→Snowflake pipeline. If the analytics layer
  should stay the system of record later, add an `APP_SYNC` write path (a Rayfin
  Function or a scheduled copy) and switch `FACT_ROW_PLAN` back to Import from
  `ANALYTICS` — the downstream model and report would stay put.

## Open questions

- **Entra groups / roles** (Finding 2): the deployed claims panel shows only
  `id` and `email` (no groups/role) — choose the fallback for the role rules
  (mapped `role` claim, lookup table, or a Function).
- **Server-side cross-field enforcement** (Finding 1): add a Rayfin Function on
  write. The read-back guard catches an inconsistent save after the fact, but
  the rules are still only enforced client-side. The same Function would make
  the feeder save + change-log write atomic and server-stamp `changed_at`.
- **Clear-to-null on Fabric: resolved.** The client does support clearing via an
  explicit `null` (see "Deployed results" above). A Rayfin Function is no longer
  required for this; it stays on the list only for cross-field enforcement.
- **`ClearingPlan` update policy (prompt 11 / role rules):** decide whether to
  pin `updated_by` with `@authenticated('update', { policy: (c,i) =>
  c.email.eq(i.updated_by) })`. Deferred from prompt 10 because, with one user,
  we can't tell whether DAB evaluates an update policy's `@item` against the
  submitted payload (what we want) or the stored pre-image (which would lock a
  user out of rows last edited by someone else). Confirm with a two-user test
  after deploy. The `ChangeLog` **create** policy is unambiguous and already
  applied.
- **Audit fields: addressed** by the change-log step. `ChangeLog.changed_by` is
  server-pinned to the caller's email. `ClearingPlan.updated_by` stays client-set
  (not audit-grade) — the `ChangeLog` is the trustworthy record.
