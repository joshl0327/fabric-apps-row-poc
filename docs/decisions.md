# Decisions and assumptions

Agents append here whenever they make or receive a decision. The developer
reviewing the draft reads this first. Newest at the bottom.

| Date | Decision / finding | Why | Decided by | Affects |
|---|---|---|---|---|
| 2026-10-15 | Keep `DIM_` / `FACT_` table names and the Snowflake column names | PBIR binds visuals by name; the names match ANALYTICS | Josh | Whole model and report |
| 2026-10-15 | "Today" is `TODAY()` | A real report uses the current date; recording numbers may shift slightly | Josh | All date measures |
| 2026-10-15 | Overdue = `NEXT_CLEARING_DATE` before today, only feeders with a real date (confirmed or tentative) | "Next year" and TBD have no date to be late against | Josh | Clearing Cycle measures |
| 2026-10-15 | Snowflake server and warehouse are Power Query parameters; the trial account host is committed to the public repo | Not a credential; key-pair sign-in; trial deleted after the POC | Josh | Model, deployment |
| 2026-10-15 | BrilliT brand and standards may appear in this public repo; `docs/ai-governance-options.md` stays out | Internal demo with synthetic data only; the governance doc is an internal discussion | Josh | Theme, skills, docs |
| 2026-10-15 | One Power BI MCP server: the `powerbi-authoring` plugin's. No `claude mcp add`, no `.mcp.json` | One registration per client avoids two servers on one model | Josh | Tooling |
| 2026-10-15 | Grain of FACT_ROW_PLAN confirmed: 153 rows = 153 distinct feeders = 153 feeder-years. One row per feeder (matches expected 153). 0 plan rows without a circuit match. | Profiling queries 1–2, read-only | Profiling (R1) | Miles measures |
| 2026-10-15 | No date table exists; auto date/time is ON (hidden `LocalDateTable_*` on both `NEXT_CLEARING_DATE` and `LAST_CLEARED_DATE`). Recommend adding `DIM_DATE` (active → `NEXT_CLEARING_DATE`, inactive → `LAST_CLEARED_DATE`) and turning auto date/time off. | Relationship inventory, read-only | Profiling (R1) — Josh to approve change | Clearing Cycle measures |
| 2026-10-15 | DQ counts reconcile as expected: `SUM(FACT_ROW_PLAN[DQ_ISSUE_COUNT])` = 67; `COUNTROWS(FACT_DQ_ISSUE)` = 69; difference = 2 orphan feeders with no circuit match. 65 distinct feeders carry issues. | Profiling query 4, read-only | Profiling (R1) — which count the report uses is Josh's call | Data Quality page |
| 2026-10-15 | District names always agree: 0 circuits where `DIM_CIRCUIT[RESPONSIBLE_DISTRICT_NAME]` ≠ `DIM_DISTRICT[DISTRICT_NAME]`, 0 with no match. Use `DIM_DISTRICT[DISTRICT_NAME]`; hide `DIM_CIRCUIT[RESPONSIBLE_DISTRICT_NAME]`. | Profiling query 6, read-only | Profiling (R1) | All district slicers and visuals |
| 2026-10-15 | FACT_ROW_PLAN → DIM_CIRCUIT is **already Many→One, single-direction** in the live model — not one-to-one both directions as the AGENTS.md note stated. The known gap is resolved; no change needed. | Relationship inventory, read-only | Profiling (R1) | All filter paths |
| 2026-10-15 | Power BI MCP server license (EULA) read and accepted by Josh on 2026-10-15 via a user environment variable (`PBI_MODELING_MCP_ACCEPT_EULA`), not by the agent. | License acceptance is a human action | Josh | Tooling |
| 2026-10-15 | Grain is one row per feeder (confirmed). Line Miles measures sum `DIM_CIRCUIT[LINE_MILES]` over `FACT_ROW_PLAN` rows so they count each feeder once and still respond to vendor and certainty filters. | Profiling queries 1–2 | Josh | Miles measures (R2) |
| 2026-10-15 | Added `DIM_DATE` (DAX calculated table, CALENDAR over both date columns, 2922 rows 2022–2029). Marked as date table on `[Date]`. Active relationship → `NEXT_CLEARING_DATE`, inactive → `LAST_CLEARED_DATE`, both Many→One single direction. | AGENTS.md date-table proposal | Josh | Clearing Cycle measures |
| 2026-10-15 | Auto date/time: the `LocalDateTable_*` tables were removed when the explicit `DIM_DATE` relationships were created. The model-level Auto date/time toggle is a Desktop option (not TOM), so MCP can't set it — Josh to confirm it is OFF in Desktop. | Keeps local date tables from regenerating | Josh | Model |
| 2026-10-15 | Authoritative DQ count is `COUNTROWS(FACT_DQ_ISSUE)` = 69 (includes the 2 orphan feeders). Hid `FACT_ROW_PLAN[DQ_ISSUE_COUNT]` (the 67 figure) so it isn't used by mistake. | One agreed DQ figure | Josh | Data Quality page |
| 2026-10-15 | District: report uses `DIM_DISTRICT[DISTRICT_NAME]`. Hid `DIM_CIRCUIT[RESPONSIBLE_DISTRICT_NAME]` (duplicate) and `DIM_CIRCUIT[RESPONSIBLE_DISTRICT_ID]` / `DIM_DISTRICT[DISTRICT_ID]` (technical). | Names always agree (query 6) | Josh | District slicers/visuals |
| 2026-10-15 | Overdue (R2 rule): a feeder counts only if `NEXT_CLEARING_DATE` is not blank, on top of the certainty filter (confirmed/tentative). 4 tentative feeders (214-2, 242-6, 328-3, 858-3) have a real certainty but no date. Measures not built yet. | 4 tentative rows lack a date | Josh | Clearing Cycle measures (R2) |
| 2026-10-15 | Column conventions applied: hid fact keys (`FACT_ROW_PLAN` FEEDER_ID/VENDOR_ID/DATE_CERTAINTY, `FACT_DQ_ISSUE` FEEDER_ID); `SummarizeBy = None` on PLANNED_YEAR, CIRCUIT_NUM, SUBSTATION_NUM; `DATE_CERTAINTY` sorts by `SORT_ORDER`. | AGENTS.md model conventions | Josh | Whole model |
| 2026-10-15 | Changed relationship-key and year columns from `Double` to `Int64` (TOM data type only, no Power Query step): `VENDOR_ID` (FACT_ROW_PLAN + DIM_VENDOR), `RESPONSIBLE_DISTRICT_ID` (DIM_CIRCUIT), `DISTRICT_ID` (DIM_DISTRICT), `PLANNED_YEAR` (FACT_ROW_PLAN). Both sides of each relationship changed together. | BPA items 1–2: integer keys compress/join better; a year is a whole number | Josh | Model performance |
| 2026-10-15 | BPA item 4 (`DIM_DATE[Date]` date type): no change needed. TOM has no date-only data type; the column is `DateTime` with a date-only format (`Long Date`), which Power BI Desktop already classifies as Date. | TOM limitation | Josh | DIM_DATE |
| 2026-10-16 | From v1 on, Power BI Desktop is the source of truth for the report; `powerbi/build-report.mjs` is kept as a record of how the agent built v1 and is not rerun | Desktop saves rewrite page and visual IDs, so the generator and the report drift apart after any manual edit | Josh | Report maintenance |
| 2026-10-16 | Feeders with no vendor show as "Unassigned", not `(Blank)`. Added as a `DIM_VENDOR` member in ANALYTICS (`vendor_id` 0, `vendor_type` "unassigned"); `FACT_ROW_PLAN` maps a missing vendor to it. STAGING and the DQ issue log are unchanged — the blank is still logged as a data-quality issue. | Business logic lives in Snowflake, not in a visual; replaces the R4 "(Blank) vendor" deferral | Josh | DIM_VENDOR (now 7 rows), Vendors page, Clearing Plan table |
| 2026-10-16 | Table/matrix visuals carry visual-level display names for each field (e.g. `FEEDER_ID` → "Feeder", `RAW_VALUE` → "Raw value"). Model table/column names are unchanged. | Friendly captions on the report without renaming model columns (which PBIR binds by name); replaces the R4 "ALL-CAPS headers accepted" note | Josh | All report tables |
| 2026-10-16 | Generator now cycles every Next Clearing text pattern and ages 3 feeders' last-cleared to 6-8 years before as-of. Result: Feeders Next Year 2 (was 0), Feeders Not Cleared 5+ Years 3 (was 0), Feeders TBD 5 (was 7), feeders with a next date 143 (was 142). Feeders in Plan 153, DQ Issues 69, Orphans 2 unchanged; all issue-type counts unchanged (69). | Ops team's "Next Year" / "<date> - TBD" examples and the 5+-year signal never appeared in the synthetic draw | Josh | Measures, report KPIs |
| 2026-10-16 | The R1 Int64 key/year types are now enforced in Power Query: each partition query gets a `Table.TransformColumnTypes(..., Int64.Type)` step — `VENDOR_ID` (DIM_VENDOR, FACT_ROW_PLAN), `DISTRICT_ID` (DIM_DISTRICT), `RESPONSIBLE_DISTRICT_ID` (DIM_CIRCUIT), `PLANNED_YEAR` (FACT_ROW_PLAN). | A data refresh re-inferred these columns as `double` (Snowflake `NUMBER(38,0)`), reverting the TOM-only R1 types and flipping `PLANNED_YEAR` to summarizeBy=sum; a Snowflake cast can't help (INT is `NUMBER(38,0)`), so the fix belongs in PQ. Verified the types survive a save+refresh. | Josh | Model types, refresh stability |
| 2026-10-16 | App slice (prompt 07): validation is hand-written in the edit form, no new dependency. Cross-field rules can't be enforced by Rayfin's per-field schema/DAB, so they live only in the form; field rules are mirrored by the entity decorators (server-enforced). | Avoids swapping the Vite React plugin to `@vitejs/plugin-react` (which `toStandardSchema` would require) for a thin slice. Server-side cross-field enforcement is a later Rayfin Function. | Josh | `app/row-tracker` validation |
| 2026-10-16 | App slice local run = plain Vite (`npm run dev:frontend`): backend-free synthetic auth + in-memory pre-seeded store, never contacts Fabric. Bare `npx rayfin dev` is treated as a deploy (provisions a Fabric AppBackend by default per the installed docs) and needs Josh's ask. | The POC must not touch Fabric unasked; the docs confirm `rayfin dev` defaults to the Fabric provider. | Josh | `app/row-tracker` run workflow |
| 2026-10-16 | App slice permissions: `@authenticated('read')` + `@authenticated('update')` for all signed-in users; no delete; no create (committed state). No row-level policy yet — per-district / per-Entra-group rules are a later step. | Thin slice; proper role rules depend on confirming which claims reach the app (claims panel, post-deploy). | Josh | `ClearingPlan` entity |
| 2026-10-16 | Fabric seeding method chosen: temporarily enable `@authenticated('create')` + a "Load sample data" button shown only when the deployed table is empty, run once, then remove create and redeploy. Built but not run against Fabric. | Smallest gated way to populate the empty deployed DB. Trade-off: create is briefly open to any signed-in user; mitigated by dev-only synthetic data and immediate removal. Long-term: a seed Function or per-row create policy. | Josh | Deployed app, `ClearingPlan` entity |
| 2026-10-16 | `updated_by` is client-set (from the session) and explicitly **not** audit-grade; `updated_at` uses the `@date` datetime type. A server-stamped audit field comes with the change-log step. | The SDK provides no automatic audit columns; a client controls the value it sends. | Josh | `ClearingPlan` entity |
| 2026-10-16 | Findings recorded for the role-model design: (1) cross-field rules are form-only until a Rayfin Function exists; (2) the policy DSL has no groups claim (only `sub`/`email`/`role`) and the session is opaque, so Entra-group roles likely need a fallback — the claims panel confirms what actually arrives after deploy. | Answers the open design question the slice was meant to probe. | Agent (prompt 07) — Josh to confirm post-deploy | Later role-rules step |
| 2026-10-16 | Clear-a-field fix (prompt 08): send cleared optional fields as an explicit `null` on update (not `undefined`), carried through a cast because the generated `UpdateInput` type is `value \| undefined`. The installed `@microsoft/rayfin-data` client serialises `null` to a GraphQL `null` literal (DAB sets the column null) and omits `undefined` (leaves it unchanged) — verified in the client source, so this is the supported mechanism, not a workaround. Plus a read-back guard that re-reads the saved row and errors on any field the server kept differently, and friendly UI errors (raw GraphQL kept in the console only). | The deployed app stored silent bad data: clearing a date saved as `undefined` = "leave unchanged", so TBD feeders kept their old date, breaking the cross-field rule. Only verifiable on Fabric (local mode is in-memory). | Josh (prompt 08) | `app/row-tracker` update path, edit form errors |
| 2026-10-16 | Cleaning-rule change (prompt 09): a date cell that is a quarter/season/"year?" (a year known, no recoverable day) now cleans to **TBD** (planned year kept), not **tentative**. So **confirmed** and **tentative** always carry a real date. Applied in both `04_staging_clean.sql` certainty branches and `data/generate.py`'s answer key; regenerated deterministically (raw plan byte-identical, 5 answer-key certainty cells flip: 858-3/658-6/189-6 on Next Clearing, 125-3/328-6 on Last Cleared). Report effect: `Feeders TBD` 5→8, `tentative` 4→1; everything else (Feeders in Plan 153, DQ 69, next-date 143, %Confirmed, Overdue/Due Soon) unchanged. `05_staging_test` stays at expected/caught 69, missed/extra/mismatched 0. | The report and the app must agree. The app's edit form requires a date for confirmed/tentative, so these 3 feeders would be skipped on import. Business logic belongs in Snowflake, not the app — so the rule moves upstream rather than relaxing the form. | Josh (prompt 09) | Cleaning SQL, generator, report certainty KPIs, app load |
| 2026-10-16 | App feeder-load approach (prompt 09): an in-app **"Import feeders"** control (file picker) that reads the Snowflake export CSV at runtime and upserts by `feeder_id` (existing updated — district included — missing created), chosen over bundling the CSV into the build. Create is gated with `@authenticated('create')` (enabled in this PR, **off in a follow-up PR** after the load), the same pattern as the seed. Every row is validated with the form's rules before saving; failures are skipped and listed. | Keeps synthetic data out of the committed bundle (the repo forbids committing CSVs), is re-runnable, and reuses the gated-seed pattern. Bundling would commit data and couple reloads to a rebuild. | Josh (prompt 09) | `app/row-tracker` import path, `ClearingPlan` permissions, UI |
| 2026-10-16 | Leftover seed rows (prompt 09): only 2 of the 15 current seed feeders (214-1, 328-4) are among the 153; the other 13 are reported by the import, **not deleted**. Removing them is a **one-time manual `DELETE` in the Fabric SQL database query editor** (outside the app), run once after the load, because the app has no delete permission (and none is added here). The exact SQL and the 13 ids are in `docs/app-notes.md`. | The app must not gain delete permission for a one-off cleanup; a direct database statement is the smallest, auditable way. | Josh (prompt 09) | Deployed `dbo.ClearingPlans`, app-notes |
| 2026-10-28 | Change log (prompt 10): new **`ChangeLog`** entity, one row per saved change (`feeder_id`, `action`, `changed_by`, `changed_at`, `before_json`, `after_json`, optional `reason`). Permissions are **read + create only — no update, no delete decorator**, so DAB generates no update/delete mutation and the log is **append-only through the API**. Proven offline: the generated DAB config (from the decorators, no deploy) grants `ChangeLog` only `create`+`read`. | Phase 3 exit test: every edit produces an audit row no user can alter. | Josh (prompt 10) | `ChangeLog` entity, app DB, permissions |
| 2026-10-28 | "Who made the change" (prompt 10): a **create policy with an `@item` reference is supported and documented** (guide `data/permissions.md`). Applied to `ChangeLog` create: `@authenticated('create', { policy: (c,i) => c.email.eq(i.changed_by) })`, which compiles to `@claims.email eq @item.changed_by` — so the browser cannot forge the audit row's author. `changed_by` uses **`claims.email`** (the only non-`sub` claim the deployed app receives). | The audit row's "who" must not be client-trusted; the policy is enforced server-side by DAB. | Josh (prompt 10) | `ChangeLog` create rule |
| 2026-10-28 | **No `ClearingPlan` update policy in this task** (deferred to the role-rules task, prompt 11). With a single user we cannot tell whether DAB evaluates an update policy's `@item` against the submitted payload (what we'd want) or the stored pre-image (which, on the mutable `updated_by`, would lock a user out of rows last edited by someone else). The `ChangeLog` create policy is unambiguous and stands; `updated_by` remains client-set and **not audit-grade** — the `ChangeLog` is the trustworthy record. | Avoid shipping a policy whose semantics we can't verify yet; the audit trail doesn't depend on it. | Josh (prompt 10) | Deferred to prompt 11; `ClearingPlan` update |
| 2026-10-28 | `changed_at` is **set by the browser** (known gap). The decorator surface has no server-set/auto-now timestamp — `@date`/`default` only take a static literal (confirmed against `@microsoft/rayfin-core` `DateFieldOptions`). Recorded next to the two-writes gap. | No server-stamped time is available without a Rayfin Function. | Agent (prompt 10) — Josh to confirm | `ChangeLog.changed_at` |
| 2026-10-28 | Write sequence is **two separate writes** (save the feeder, then write the log), not one transaction. If the save succeeds but the log write fails — or there is **no email** to attribute the change to (no `'unknown'` fallback for `changed_by`) — the edit is kept and a distinct **"saved but not logged"** warning is shown, never hidden. A single server-side transaction needs a Rayfin **Function** (later step). The 153-feeder **import is not logged** (baseline). | Honest failure surface; atomic save+log is out of scope for this slice. | Josh (prompt 10) | Edit-save path, import |
| 2026-10-28 | The **Import feeders** panel is hidden unless the app is built with **`VITE_ENABLE_FEEDER_IMPORT=true`** (off by default; Vite inlines the flag so it tree-shakes out). An optional **"Reason for change"** field (≤250) was added to the edit form, logged with the change. | The one-time load panel shouldn't show in a normal build; a reason makes the audit row more useful. | Josh (prompt 10) | Home page UI, `ChangeLog.reason` |

## R1 profile findings (2026-10-15)

Source: `tests/dax/00_profile.dax` run against the live Desktop model through
the Power BI Authoring MCP server. Read-only; nothing in the model changed.
Compared against the expected answers in AGENTS.md.

**1. Grain of FACT_ROW_PLAN — matches expected (one row per feeder, 153).**
- Plan rows 153, distinct feeders 153, distinct feeder-years 153, DIM_CIRCUIT 153.
- Plan rows with no circuit match: 0. Plan rows with no vendor: 4.
- Missing `NEXT_CLEARING_DATE`: 11. Missing `LAST_CLEARED_DATE`: 4.
- `NEXT_CLEARING_DATE` range: 2026-04-11 to 2029-03-31.
- Rows equal feeders within every planned year (2026: 23, 2027: 57, 2028: 55,
  2029: 11, no year: 7), so no feeder repeats. Miles measures can count each
  feeder once and still respond to vendor/certainty filters.

**2. Date table — not present; auto date/time is ON.**
- Two hidden `LocalDateTable_*` tables exist, one on `NEXT_CLEARING_DATE` and
  one on `LAST_CLEARED_DATE` (both Many→One, active). No `DIM_DATE` yet.
- Proposal stands: add `DIM_DATE` (active to `NEXT_CLEARING_DATE`, inactive to
  `LAST_CLEARED_DATE`) and turn auto date/time off. Needs Josh's approval
  before changing the model.

**3. Date certainty — confirmed 142, tentative 4, next year 0, TBD 7** (sorted
  by `SORT_ORDER` 1–4). Real-date certainties (confirmed + tentative) = 146
  feeders, but only 142 have a non-blank `NEXT_CLEARING_DATE` — so ~4
  confirmed/tentative feeders still lack a date. The Overdue measure must guard
  with `ISBLANK(NEXT_CLEARING_DATE)` in addition to the certainty filter.

**4. Two DQ counts — reconcile as expected.**
- `SUM(FACT_ROW_PLAN[DQ_ISSUE_COUNT])` = 67; `COUNTROWS(FACT_DQ_ISSUE)` = 69;
  difference = 2 orphan feeders with no circuit match. 65 distinct feeders
  carry issues. Which figure the report headlines is Josh's decision.
- Issue mix (query 5): vendor_variant/Vendor 38, non_date/Next Clearing 9,
  blank/Vendor 4, date_format/Next Clearing 3, non_date/Last Cleared 3,
  feeder_format/Feeder ID 3, orphan_feeder/Feeder ID 2, date_format/Last
  Cleared 2, duplicate_feeder/Feeder ID 2, blank/Next Clearing 2, blank/Last
  Cleared 1 — total 69.

**5. District duplication — names always agree.** 0 circuits disagree, 0 with
  no district match. Report uses `DIM_DISTRICT[DISTRICT_NAME]`; hide
  `DIM_CIRCUIT[RESPONSIBLE_DISTRICT_NAME]`.

**6. FACT_ROW_PLAN → DIM_CIRCUIT relationship — already Many→One, single
  direction** (`fromCardinality: Many`, `toCardinality: One`,
  `crossFilteringBehavior: OneDirection`). This differs from the AGENTS.md note
  that said it was created one-to-one both directions; the live model is
  already correct, so the known gap is resolved and no change is needed. Worth
  updating the AGENTS.md note to match.

## Assumed during R2–R4 (to review)

Choices the agent made where the inputs were ambiguous, per prompt 05. Review
and confirm or correct.

- **Measure display folders follow `docs/report-requirements.md` exactly.** The
  two foundational measures (`Feeders in Plan`, `Line Miles in Plan`) are placed
  in `10 - Plan` as that table specifies; `00 - Base` keeps only the
  `Ex_Measure` placeholder. AGENTS.md's "base measures first (00 - Base)" is
  treated as build-order guidance, not a folder override. (R2)
- **`Line Miles by Vendor` is an explicit alias measure** (`= [Line Miles in Plan]`)
  rather than a re-implementation, so prompt 05's "build every measure in
  report-requirements" is satisfied while the logic stays written once. It is
  the same value as Line Miles in Plan and splits by the vendor on a visual. (R2)
- **`Feeders Due Soon` applies only the 0–90-day date-window filter**, no
  certainty filter, following the explicit decision in prompt 05. (In this data
  every feeder with a next-clearing date is confirmed/tentative, so the result
  is unaffected.) (R2)
- **`Feeders Next Year` and `Feeders Not Cleared 5+ Years` return BLANK** (0
  feeders) in the synthetic data. Left without a `+ 0` wrapper so they stay
  correct under slicing; a KPI card will show blank/0. (R2)
- **Divisors:** `Avg Years Since Last Clearing` divides day-diff by `365.25`;
  `Feeders Not Cleared 5+ Years` uses `EDATE(TODAY(), -60)` (5 years) as the
  cutoff. (R2)
- **Two report-support helper measures added** in `90 - Helpers`, visible (not
  hidden) because they are surfaced in visuals: `Clearing Status` (status text
  for the Clearing Plan table) and `Feeder Detail Title` (dynamic drillthrough
  title). AGENTS.md reserves `90 - Helpers` for "hidden helpers only"; these are
  display helpers kept visible for transparency. Validated in
  `tests/dax/10_measures.dax`. (R4)
- **Orphan DQ feeders inject a blank `DIM_CIRCUIT` member.** The 2 orphan
  feeders in `FACT_DQ_ISSUE` don't match a circuit, so the
  `FACT_DQ_ISSUE → DIM_CIRCUIT` relationship adds a blank virtual row to
  `DIM_CIRCUIT`; `VALUES(DIM_CIRCUIT[FEEDER_ID])` returns 154. `Clearing Status`
  returns BLANK for feeders with no plan row so the phantom is dropped; report
  tables built on `DIM_CIRCUIT` get a visual-level filter to the same effect.
  (R4)

## Independent review pass (R4, 2026-10-16)

`pbi-report-reviewer` subagent reviewed the six-page draft against the spec, the
BrilliT standards and AGENTS.md. Triage:

**Fixed (agent):**
- **Alt text** added to every data visual (cards, charts, tables) via
  `visualContainerObjects.general.altText` — closes the accessibility blocker.
- **Raw field-name chart subtitles** removed (auto `subTitle` turned off on all
  charts) so no `DATE_CERTAINTY` / `DISTRICT_NAME` / `VENDOR_NAME` tokens show.
- **About glossary** rounded out to all 15 measures (matches `docs/measures.md`).

**Accepted / clarified (not a defect):**
- **ALL-CAPS table headers** (FEEDER_ID, RAW_VALUE, …) are the model column
  names, kept deliberately per the 2026-10-15 decision "table and column names
  stay as they are; PBIR binds by name." Friendly per-column display names are a
  developer polish option (would mean renaming model columns).
- **KPI card green accent bar** is the BrilliT house standard for *every* KPI
  card (brand accent, decorative) — not a semantic good/bad signal, so Overdue
  cards carrying it is by design, not an error.
- **"(Blank)" vendor / vendor-type categories** are 4 real feeders with no
  assigned vendor — a legitimate signal for the veg-management lead, not missing
  data. Developer may filter or relabel "Unassigned" later.

**Deferred to the Power BI developer (recorded, not fixed in v1):**
- Hard-coded brand hex in PBIR → move color governance into the theme
  `visualStyles` so a brand swap is a theme rebuild (risk of appearance
  regression made this unsuitable right before handoff).
- `Clearing Status` cell: single-cell background + icon (text status is shipped
  and is accessible; background/icon need a color-returning measure + table
  conditional formatting).
- Dynamic drillthrough title, Overdue/Due-soon bookmark toggle, report-page
  tooltip, measure-driven subtitle — the approved deviations.
- Re-capture at exact 1920×1080 to rule out off-canvas placement (the empty band
  above/below content in the captures is a screenshot-height artifact).
