# ANALYTICS star schema (what Power BI reads)

`ROW_DB.ANALYTICS` holds the model-ready views Power BI connects to in Phase 2,
as `ROLE_REPORTER` (which can read ANALYTICS and nothing else). They are built
by `snowflake/06_analytics_views.sql` on top of the cleaned `STAGING` views
(`snowflake/04_staging_clean.sql`). Plain attributes only — anything relative
to today (overdue, days until next clearing) lives in the semantic model as a
measure, not here.

| View | Grain | Key | Rows |
|------|-------|-----|------|
| `DIM_CIRCUIT` | one per feeder (circuit) | `feeder_id` | 153 |
| `DIM_DISTRICT` | one per district | `district_id` | 5 |
| `DIM_VENDOR` | one per canonical vendor + an "Unassigned" member | `vendor_id` | 7 |
| `DIM_DATE_CERTAINTY` | one per certainty value | `date_certainty` | 4 |
| `FACT_ROW_PLAN` | one per feeder's clearing plan | `feeder_id` | 153 |
| `FACT_DQ_ISSUE` | one per data quality issue | *(none; many per feeder)* | 69 |

Relationships: `FACT_ROW_PLAN` joins `DIM_CIRCUIT` on `feeder_id`,
`DIM_VENDOR` on `vendor_id`, and `DIM_DATE_CERTAINTY` on `date_certainty`;
`DIM_CIRCUIT` joins `DIM_DISTRICT` on `responsible_district_id`.
`FACT_DQ_ISSUE` joins `DIM_CIRCUIT` on `feeder_id` — orphan feeders keep their
feeder_id so they still appear on the data quality page even though they have
no matching circuit.

`DIM_VENDOR` carries an "Unassigned" member (`vendor_id` 0, `vendor_type`
"unassigned"). `FACT_ROW_PLAN` maps a feeder with no vendor to it, so those
feeders read as "Unassigned" on the report rather than `(Blank)`. The blank is
still logged as a data quality issue in STAGING — this is only a report-facing
label.

`FACT_ROW_PLAN` is the one view whose source switches in Phase 4: originally it
read the cleaned spreadsheet in STAGING (Import). The plan was to later read the
Fabric App's own data through `APP_SYNC`, with everything downstream staying put.

## Phase 4 (trimmed, 2026-10-28): FACT_ROW_PLAN now DirectQuery from the app

In the trimmed Phase 4 (prompt 11), `FACT_ROW_PLAN` switched from Import
(Snowflake `ANALYTICS`) to **DirectQuery against the Fabric App's own SQL
database** (`dbo.ClearingPlans`), to demonstrate the live loop "edit a feeder in
the app → see it in the Power BI report" in Desktop. Every other table stays
Import from Snowflake, so the model is now **composite**. `APP_SYNC` is not used;
the report reads the app database directly. (Publishing and syncing the app's
data back to Snowflake are out of scope — design note only, see
`docs/app-notes.md`.)

What changed in the semantic model (only this one table):

- **Partition:** a DirectQuery **native SQL query** against the app database,
  wrapped in two new Power Query parameters (`App_SQL_Server`,
  `App_SQL_Database`, mirroring `Snowflake_Server`/`WH`). The `SELECT` aliases
  the app's lower-case columns to the existing UPPERCASE model column names (so
  PBIR binds unchanged), `CAST`s both `datetime2` dates to `date` to match
  `DIM_DATE`, and omits columns the model doesn't use (`id`, `district_name`).
- **Vendor key is now the name.** The app stores the vendor *name*, not an id.
  The hidden `FACT_ROW_PLAN[VENDOR_ID]` column was replaced with `VENDOR_NAME`,
  and the `FACT_ROW_PLAN → DIM_VENDOR` relationship was repointed to join on
  `VENDOR_NAME` (`DIM_VENDOR[VENDOR_NAME]` is unique — 7 distinct, 0 blank).
- **`DQ_ISSUE_COUNT` dropped** from `FACT_ROW_PLAN` (the app doesn't carry it and
  no measure or visual used it; the authoritative DQ count is
  `COUNTROWS(FACT_DQ_ISSUE)`, still Import from Snowflake).
- **Composite / limited relationships.** The relationships from the DirectQuery
  `FACT_ROW_PLAN` to the Import dimensions (`DIM_CIRCUIT`, `DIM_VENDOR`,
  `DIM_DATE_CERTAINTY`, `DIM_DATE` active + inactive) are now **limited
  (cross-source)**. `RELATED()` can't cross a limited relationship, so
  `Line Miles in Plan` was rewritten from `SUMX(FACT_ROW_PLAN, RELATED(...))` to
  a `TREATAS` virtual relationship (same value, 4,634.7; see `docs/measures.md`).
  The other line-miles measures build on it and needed no change.
- **Connection:** signed in with an Entra (Organizational) identity in Desktop;
  both sources' privacy level set to Organizational. No credentials in the PBIP.

All measure results are unchanged after the move (see `docs/measures.md` and
`tests/dax/10_measures.dax`).
