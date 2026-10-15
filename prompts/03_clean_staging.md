# Prompt 03: clean the clearing plan in STAGING and prove it

Given to Claude Code on branch `feat/clean-staging`. Kept here as a record of
exactly what the agent was asked to do.

---

Read CLAUDE.md first and follow its hard rules.

## Context
`ROW_DB.RAW` holds the synthetic data exactly as it arrived (all VARCHAR):
CIRCUITS (153), DISTRICTS (5), VENDORS (6), ROW_CLEARING_PLAN (157), and
ANSWER_KEY (69), a test list of every problem injected into the clearing plan
with the value it should become. See `snowflake/02_raw_objects.sql` for the
column names.

This task writes the cleaning rules as SQL in `ROW_DB.STAGING` and proves them
against the answer key. You have no Snowflake access. Write the SQL only; the
human runs it in Snowsight as ROLE_BI_DEVELOPER (reads RAW, builds STAGING).

## The rules must be honest
- The cleaning views must never read `RAW.ANSWER_KEY`. Only the test query
  may use it.
- No hard-coded row numbers, feeder IDs, or raw values copied from the answer
  key. Rules must be general, so they would work on next month's spreadsheet.
- If a rule and the answer key disagree, don't bend the rule to fit. Show me
  the cases and stop.

## Task
1. `snowflake/04_staging_clean.sql`: re-runnable, starts with
   `USE ROLE ROLE_BI_DEVELOPER; USE SECONDARY ROLES NONE; USE WAREHOUSE WH_TRANSFORM_XS;`
   - `STAGING.CLEANING_CONFIG`: one row holding the as-of date used to resolve
     relative text like "Next Year" (set it to 2026-10-14, the date the data
     was generated). Every rule that needs "today" reads it from here.
   - Typed, trimmed views: `STG_CIRCUITS`, `STG_DISTRICTS`, `STG_VENDORS`.
   - `STG_ROW_CLEARING_PLAN`: one row per feeder, the clean shape:
     - **Feeder ID:** standardize the format (spaces, leading zeros in the
       circuit number), then keep one row per feeder: the last occurrence
       (highest `source_row`). Feeders not in `STG_CIRCUITS` are left out.
     - **Next Clearing:** a real date, a date certainty (confirmed, tentative,
       next year, TBD), and a planned year where one can be inferred. Real
       Excel dates and parseable typed dates are confirmed; a date with a "TBD"
       note is tentative; a quarter, season, or "2027?" is tentative with a
       planned year; "Next Year" is next year relative to the as-of date;
       anything else (including blank and "per vendor") is TBD.
     - **Last Cleared:** a real date where one can be parsed, otherwise null.
     - **Vendor:** mapped to the canonical vendor list. Normalize first (case,
       spaces, punctuation, "&" vs "and", Inc/LLC, common abbreviations such
       as Svc and Veg), then allow a close fuzzy match for small typos. Blank
       stays null.
     - Keep `source_row` and the original raw values next to the clean ones.
   - `STG_DQ_ISSUES`: one row per problem the rules found, with the columns
     needed to compare against the answer key (source row, feeder, column,
     raw value, clean value, issue type, date certainty, planned year).
     Issue types match the answer key's: non_date, date_format, blank,
     vendor_variant, duplicate_feeder, orphan_feeder, feeder_format.
   - `STG_DQ_REVIEW`: anything a person should look at that the rules could
     not settle: a vendor with no confident match, duplicates whose values
     disagree, orphan feeders. Expected to hold only the orphans for this data.
2. `snowflake/05_staging_test.sql`: the proof.
   - A summary query, one row: expected (rows in ANSWER_KEY), caught, missed,
     extra (found by the rules but not in the key), mismatched (caught but
     with a different clean value, certainty, or planned year).
   - Detail queries listing any missed, extra, or mismatched rows.
3. `docs/cleaning-rules.md`: the rules in plain English for a business reader.
   One table: problem, rule, example raw value → clean value. Short.
4. Update `data/README.md` (or add `snowflake/README.md`) with the run order:
   04, then 05.

## Expected results
- `STG_CIRCUITS` 153 rows; `STG_ROW_CLEARING_PLAN` 153 rows (157 raw, minus 2
  duplicate copies, minus 2 orphans), one per circuit.
- Test summary: expected 69, caught 69, missed 0, extra 0, mismatched 0.

## Do not
- Do not create anything outside `ROW_DB.STAGING`, and no users, roles, or
  grants.
- Do not build ANALYTICS objects yet. That is the next task.
- Do not install or run any Snowflake tool or connector.
- Do not push, open a pull request, or run any `rayfin` command.

## When done
Stop before committing. Show me: the files you created, a short diff summary,
any rule where you were unsure how the answer key wants a case handled, and
the exact steps I should run in Snowsight with the results to expect. Then
propose a commit on `feat/clean-staging`: list the exact files you would stage
(by name) and the commit message. Wait for my approval.
