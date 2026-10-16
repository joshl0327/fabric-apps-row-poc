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

`FACT_ROW_PLAN` is the one view whose source switches in Phase 4: today it
reads the cleaned spreadsheet in STAGING; later it reads the Fabric App's own
data (`APP_SYNC`), and everything downstream stays put.
