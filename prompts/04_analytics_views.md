# Prompt 04: model-ready ANALYTICS views for Power BI

Given to Claude Code on branch `feat/analytics-views`. Kept here as a record of
exactly what the agent was asked to do.

---

Read CLAUDE.md first and follow its hard rules.

## Context
`ROW_DB.STAGING` holds the cleaned data (see `snowflake/04_staging_clean.sql`):
STG_CIRCUITS (153), STG_DISTRICTS (5), STG_VENDORS (6), STG_ROW_CLEARING_PLAN
(153, one per feeder), STG_DQ_ISSUES (69), STG_DQ_REVIEW (2). The cleaning has
been proven against the answer key (69 of 69 caught).

This task builds the star schema that Power BI will read in Phase 2. Power BI
connects as ROLE_REPORTER, which can read `ROW_DB.ANALYTICS` and nothing else.
You have no Snowflake access. Write the SQL only; the human runs it in
Snowsight.

## Task
1. `snowflake/06_analytics_views.sql`: re-runnable views in `ROW_DB.ANALYTICS`,
   run as ROLE_BI_DEVELOPER. Start with
   `USE ROLE ROLE_BI_DEVELOPER; USE SECONDARY ROLES NONE; USE WAREHOUSE WH_TRANSFORM_XS;`
   - `DIM_CIRCUIT`: one row per feeder (key `feeder_id`): circuit and
     substation numbers and names, line miles, and the responsible district
     (id and name).
   - `DIM_DISTRICT`, `DIM_VENDOR` (canonical names and vendor type).
   - `DIM_DATE_CERTAINTY`: the four certainty values with a sort order
     (confirmed, tentative, next year, TBD).
   - `FACT_ROW_PLAN`: one row per feeder: feeder_id, vendor_id, last cleared
     date, last work done, next clearing date, date certainty, planned year,
     notes, and the number of data quality issues the cleaning found for that
     feeder.
   - `FACT_DQ_ISSUE`: one row per issue from STG_DQ_ISSUES (feeder, column,
     issue type, raw value, clean value), for a data quality page in the
     report. Orphan feeders keep their feeder_id even though it has no match
     in DIM_CIRCUIT.
   - Plain attributes only. Anything relative to today (overdue, days until
     the next clearing) belongs in the semantic model as measures, not here.
   - Comment at the top of FACT_ROW_PLAN: in Phase 4 this is the one place
     where the source switches to the Fabric App's data.
2. A verification section at the end of the same file, written to be run as
   ROLE_REPORTER (`USE ROLE ROLE_REPORTER; USE SECONDARY ROLES NONE;
   USE WAREHOUSE WH_REPORTING_XS;`):
   - one query with the row count of every ANALYTICS view, with the expected
     count beside it
   - a commented-out query against STAGING that should fail for
     ROLE_REPORTER, to prove reports can't read past ANALYTICS
3. Add the ANALYTICS views to `docs/cleaning-rules.md` or a new
   `docs/data-model.md`: one short table listing each view, its grain, and
   its key.

## Expected results
DIM_CIRCUIT 153, DIM_DISTRICT 5, DIM_VENDOR 6, DIM_DATE_CERTAINTY 4,
FACT_ROW_PLAN 153, FACT_DQ_ISSUE 69. Every FACT_ROW_PLAN feeder_id and
vendor_id (when not null) matches its dimension.

## Do not
- Do not create anything outside `ROW_DB.ANALYTICS`, and no users, roles, or
  grants. (ROLE_REPORTER already has SELECT on future views in ANALYTICS.)
- Do not change RAW or STAGING objects. If something in STAGING is missing,
  stop and tell me.
- Do not install or run any Snowflake tool or connector.
- Do not push, open a pull request, or run any `rayfin` command.

## When done
Stop before committing. Show me: the files you created, a short diff summary,
and the exact steps I should run in Snowsight with the results to expect. Then
propose a commit on `feat/analytics-views`: list the exact files you would
stage (by name) and the commit message. Wait for my approval.
