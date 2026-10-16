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
