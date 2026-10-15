# Prompt 02: land the synthetic data in Snowflake RAW

Given to Claude Code on branch `feat/load-raw`. Kept here as a record of
exactly what the agent was asked to do.

---

Read CLAUDE.md first and follow its hard rules.

## Context
`data/generate.py` writes the synthetic files to `data/out/`. At work, Azure
Data Factory lands source files in Snowflake RAW as-is, and cleaning happens
later. This task prepares that landing: everything goes into `ROW_DB.RAW`
exactly as it arrived, with no cleaning. Cleaning comes in the next task.

You have no Snowflake access. Write the code and SQL only. The human uploads
the files in Snowsight and runs the SQL as ROLE_LOADER.

## Task
1. `data/to_landing.py`: convert the generator output into landing CSVs in
   `data/out/landing/`.
   - `circuits.csv`, `districts.csv`, `vendors.csv`, `answer_key.csv`: copy
     through unchanged.
   - `row_clearing_plan.xlsx` → `row_clearing_plan.csv`:
     - a `source_row` column holding the Excel row number, so it matches
       `excel_row` in the answer key
     - every cell as raw text, exactly as it appears: no trimming, no type
       conversion, blanks as empty
     - real Excel date cells written as ISO `YYYY-MM-DD`
     - for each of the two date columns, a cell-type column (`date`, `text`,
       or `blank`), so a typed "2027-03-15" can be told apart from a real date
   - Accept `--in` (default `data/out`) and `--out` (default
     `data/out/landing`). Deterministic output.
2. `snowflake/02_raw_objects.sql`: re-runnable, starts with
   `USE ROLE ROLE_LOADER; USE SECONDARY ROLES NONE; USE WAREHOUSE WH_TRANSFORM_XS;`
   - A CSV file format that keeps values exactly as they are (keep leading and
     trailing spaces) and an internal stage `ROW_DB.RAW.LANDING`.
   - One table per landing file in `ROW_DB.RAW` (CIRCUITS, DISTRICTS, VENDORS,
     ROW_CLEARING_PLAN, ANSWER_KEY), every source column as VARCHAR, plus
     `_source_file` and `_loaded_at`. Add a comment on ANSWER_KEY: test data,
     not a source.
3. `snowflake/03_raw_load.sql`: run after the files are uploaded to the stage.
   Same three `USE` lines at the top.
   - Each load is a full refresh: re-running gives the same row counts, never
     doubled and never skipped. (COPY INTO skips files it has loaded before
     unless told otherwise.)
   - Verification queries at the end: row count per table, and checks that the
     mess survived (rows with trailing spaces in Vendor, rows with text in
     Next Clearing).
4. Update `data/README.md` with the steps in order: run `to_landing.py`; in
   Snowsight run `02_raw_objects.sql`; upload the five landing CSVs to the
   `LANDING` stage (Snowsight: Data → Databases → ROW_DB → RAW → Stages →
   LANDING → + Files, with role ROLE_LOADER); run `03_raw_load.sql`.

## Expected results
CIRCUITS 153, DISTRICTS 5, VENDORS 6, ROW_CLEARING_PLAN 157, ANSWER_KEY 69
(with the generator run as `--seed 42 --as-of 2026-10-14`).

## Do not
- Do not create anything outside `ROW_DB.RAW`, and do not create users, roles,
  or grants.
- Do not install or run any Snowflake tool or connector.
- Do not clean, trim, dedupe, or parse anything. That is the next task.
- Do not push, open a pull request, or run any `rayfin` command.
- Do not commit anything in `data/out/`.

## When done
Stop before committing. Show me: the files you created, a short diff summary,
and the exact steps I should follow in Snowsight, with the row counts to
expect. Then propose a commit on `feat/load-raw`: list the exact files you would
stage (by name) and the commit message. Wait for my approval.
