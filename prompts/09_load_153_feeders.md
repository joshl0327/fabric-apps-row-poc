# Prompt 09: load all 153 clean feeders into the app (row-tracker)

Given to Claude Code on branch `feat/load-feeders`. Kept here as a record of
exactly what the agent was asked to do.

---

Read `AGENTS.md`, `docs/decisions.md`, `docs/app-notes.md`,
`docs/cleaning-rules.md` and `docs/measures.md` first and follow them. For
Rayfin questions, use `app/row-tracker/.agents/skills/rayfin/SKILL.md` first,
then `npx rayfin docs ...` from `app/row-tracker` (I approve each call).

## Why

The deployed app holds 15 synthetic seed rows (some edited by hand while
testing). Phase 4 points the Power BI report's `FACT_ROW_PLAN` at the app's
database, so the app must start from the same 153 clean feeders that Snowflake
`ROW_DB.ANALYTICS` holds today. This is the migration from the cleaned
spreadsheet into the app.

## Constraints (don't ask about these)

- **Source:** Snowflake `ANALYTICS` (clean values; the same data the report
  shows). You have no Snowflake access: write the export SQL; I run it in
  Snowsight and download the result as a CSV into `data/out/` (gitignored).
- **Target shape:** one row per feeder in `ClearingPlan`: `feeder_id`,
  `district_name`, `vendor` (vendor name; `vendor_id` 0 = "Unassigned"),
  `last_cleared_date`, `last_work_done`, `next_clearing_date`,
  `date_certainty`, `planned_year`, `notes`.
- **You never write to Fabric.** I trigger the load myself in the deployed app,
  after a reviewed merge and my own deploy, like the seed button.
- **Re-runnable:** loading twice must give the same result. Match on
  `feeder_id`: update existing rows, create missing ones. The 15 current rows
  get overwritten with the clean values.
- **No delete permission.** If any current feeder_id isn't among the 153, report
  it; don't delete it.
- **Create only while loading:** the same pattern as the seed (create switched on
  in this PR, off in a follow-up PR after the load).
- **Reconcile against the report.** After the load, the app must match
  `docs/measures.md`: 153 feeders; certainty counts that match the report;
  feeders with a next clearing date = 143; Next Year = 2; TBD = 5.

## Part A: plan (no code changes)

1. Write `snowflake/08_app_load_export.sql`: one SELECT, run as
   `ROLE_REPORTER`, producing exactly the target columns from the ANALYTICS
   views, ordered by `feeder_id`. Show it to me.
2. Propose how the CSV gets into the deployed app. Compare at least: (a) an
   in-app "Import feeders" control that reads a file I pick, shown only when
   create is allowed; (b) bundling the CSV into the app build. Recommend one,
   with the trade-offs (data in the published bundle, effort, re-runnability).
3. Say exactly what the deploy will change: permissions, schema (should be
   none), and UI.
4. List the reconciliation counts the app will show after a load, and where.

**CHECKPOINT 1:** stop with the SQL, the recommendation and anything you're
unsure about. Wait for my approval.

## Part B: build (after I approve)

1. Build the approved load path: validate every row with the same rules as the
   form before saving (skip and list any row that fails, with the reason),
   upsert by `feeder_id`, use the full-row read-back from prompt 08, and show
   a result summary: created, updated, skipped, plus the reconciliation counts.
2. Switch `@authenticated('create')` on, with a comment that a follow-up PR
   switches it off after the load.
3. Tests: CSV parsing, row validation (including a bad row), the upsert
   decision (create vs update), and the summary counts. `npm run build`, the
   tests and the linter must pass.
4. Update `docs/app-notes.md` (load steps and expected counts),
   `docs/decisions.md` (load approach) and `docs/poc-log.md` (agent time;
   leave review time blank).

**CHECKPOINT 2:** stop and give me: what changed, check results, my exact steps
(Snowsight export → merge → deploy → load → check counts → follow-up PR to
switch create off → deploy), and the proposed commits with the paths to stage.

## Do not

- Deploy, run `npx rayfin up`, or run any `db` command against Fabric.
- Change the entity's fields or the schema.
- Add delete permission.
- Install new npm dependencies without asking (prefer a small CSV parser you
  write and test yourself).
- Commit any CSV or anything under `data/out/`.
- Read any `.env` file, or change anything in `powerbi/`.
- Push, open a pull request, or use `--force`.
