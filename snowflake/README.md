# Snowflake scripts — run order

Numbered SQL scripts, run in Snowsight in order. Each sets its own role at the
top and is safe to re-run. Synthetic data only.

| # | Script | Role | What it does |
|---|--------|------|--------------|
| 01 | `01_setup_roles_warehouses_db.sql` | `ACCOUNTADMIN` | Warehouses, database, schemas, per-purpose roles, cost guardrail. |
| 02 | `02_raw_objects.sql` | `ROLE_LOADER` | RAW file format, `LANDING` stage, one VARCHAR table per landing file. |
| — | *(upload CSVs)* | `ROLE_LOADER` | Upload the five files from `data/out/landing/` to `@ROW_DB.RAW.LANDING` (see `data/README.md`). |
| 03 | `03_raw_load.sql` | `ROLE_LOADER` | Full-refresh load of RAW from the stage. |
| 04 | `04_staging_clean.sql` | `ROLE_BI_DEVELOPER` | Build STAGING: config, typed dimension views, the clean clearing plan, and the data-quality views. |
| 05 | `05_staging_test.sql` | `ROLE_BI_DEVELOPER` | Prove the cleaning rules against `RAW.ANSWER_KEY`. |

## Staging step (04 then 05)

Run **`04_staging_clean.sql`**, then **`05_staging_test.sql`**, both as
`ROLE_BI_DEVELOPER`.

`04` creates, in `ROW_DB.STAGING`:

- `CLEANING_CONFIG` — the as-of date the rules resolve "Next Year" against.
- `STG_CIRCUITS`, `STG_DISTRICTS`, `STG_VENDORS` — typed, trimmed dimensions.
- `STG_VENDOR_LOOKUP` — maps hand-typed vendor names to the canonical list.
- `STG_PLAN_RESOLVED` — the engine: one annotated row per raw plan row.
- `STG_ROW_CLEARING_PLAN` — one clean row per feeder (153 rows).
- `STG_DQ_ISSUES` — every problem the rules found, for comparison.
- `STG_DQ_REVIEW` — what a person must decide (orphans, for this data).

The cleaning rules in plain English: `docs/cleaning-rules.md`.

`05` prints a one-row summary. A clean run is:

```
expected  caught  missed  extra  mismatched
      69      69       0      0           0
```

Only `05` reads `RAW.ANSWER_KEY`; the cleaning views never do. If any detail
query (missed / extra / mismatched) returns rows, the rules and the answer key
disagree — read those rows before changing anything.
