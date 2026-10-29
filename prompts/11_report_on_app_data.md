# Prompt 11: point the report's FACT_ROW_PLAN at the app's data (Phase 4, trimmed)

Given to Claude Code on branch `feat/report-app-data`, with Power BI Desktop open
on `powerbi/row_pbi_poc.pbip`. Kept here as a record of exactly what the agent
was asked to do.

---

Read `AGENTS.md`, `docs/decisions.md`, `docs/app-notes.md`, `docs/measures.md`
and `docs/data-model.md` first and follow them.

**This prompt is my explicit request to change one table's data source and
Power Query in the semantic model** (`FACT_ROW_PLAN` only), which `AGENTS.md`
otherwise forbids without asking. Nothing else in the model's sources changes.

## Why

Phase 4 (trimmed): show the loop "edit a feeder in the Fabric App, see it in the
Power BI report" in Desktop. `FACT_ROW_PLAN` switches from Import (Snowflake
`ANALYTICS`) to **DirectQuery** against the app's Fabric SQL database
(`dbo.ClearingPlans`). Every other table stays Import from Snowflake, so this
becomes a composite model. Out of scope: publishing the report, and syncing the
app's data back to Snowflake (record both as a design note only).

## First: record the scope decisions

Add rows to `docs/decisions.md`: role rules (prompt 11 in the old plan) were
scoped out of the POC on 2026-10-28, with the findings (only `id` and `email`
reach the app; district scoping is possible by matching a manager email on each
feeder; group access goes through app sharing). Phases 6 and 7 were cut, and
Phase 4 is trimmed as above.

## Part A: plan (no changes)

1. **Shape.** `dbo.ClearingPlans` (feeder_id, district_name, vendor name,
   dates, date_certainty, planned_year, last_work_done, notes, updated_by,
   updated_at) must look like today's `FACT_ROW_PLAN` to the model, so the
   measures, relationships and visuals keep working. Compare the two column by
   column. Note in particular: `VENDOR_ID` (the app stores the vendor *name*),
   `DQ_ISSUE_COUNT` (not in the app; check whether any measure or visual uses
   it), and column names and types.
2. **Where the shaping lives.** Compare at least: (a) a native SQL query in the
   `FACT_ROW_PLAN` partition (DirectQuery against the app database, nothing
   created in the app's database); (b) a view in the app's database (check
   whether `rayfin up` could drop or conflict with objects it didn't create);
   (c) changing the relationship to join on vendor name. Recommend one.
3. **Connection.** The app database's SQL endpoint, sign-in (my Entra work
   identity in Desktop), and two new Power Query parameters for the server and
   database, like `Snowflake_Server` and `WH`. No credentials in the PBIP.
4. **Composite-model effects.** Relationships between the DirectQuery table and
   the Import dimensions become limited (cross-source) relationships. List which
   measures, relationships (including `DIM_DATE`) or visuals could behave
   differently, and how you'll check them.
5. **What I'll do by hand** (for example entering credentials in Desktop,
   saving, refreshing) and in what order.

**CHECKPOINT 1:** stop with the comparison, your recommendation, the full list
of changes, and anything you're unsure about. Wait for my approval.

## Part B: build (after I approve)

1. Through the MCP server, make the approved changes. Ask me to enter
   credentials and save when needed. Don't edit `.tmdl` files while Desktop has
   the project open.
2. Re-run every query in `tests/dax/10_measures.dax` and compare with
   `docs/measures.md`. Expected after the move: Feeders in Plan 153; confirmed
   142, tentative 1, next year 2, TBD 8; 143 with a next clearing date;
   DQ Issues 69 and Orphans 2 unchanged (they still come from Snowflake). Explain
   every difference.
3. Run `powerbi-report-author validate` and screenshot the affected pages.
4. Write the test I'll run by hand: edit a named feeder in the deployed app,
   refresh the report visual in Desktop, and time how long until it shows.
5. Update `docs/data-model.md`, `docs/measures.md` (if anything changed),
   `docs/app-notes.md` (a short "Report reads the app" section, plus the design
   note on publishing and Snowflake sync), `docs/decisions.md` and
   `docs/poc-log.md` (agent time; leave review time blank).

**CHECKPOINT 2:** stop and give me: what changed, measure results versus
expected, validation status, the hand test, and the proposed commits with the
paths to stage.

## Do not

- Change any other table's data source, partition or Power Query.
- Rename or delete tables, columns or measures (a native query can alias
  columns to the existing names).
- Create, alter or drop anything in the app's database, or in Snowflake.
- Publish, deploy, run `npx rayfin up`, or call Fabric write APIs.
- Read any `.env` file or secret.
- Push, open a pull request, or use `--force`.
