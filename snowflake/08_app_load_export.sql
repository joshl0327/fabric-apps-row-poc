-- =====================================================================
-- Fabric Apps POC - export the 153 clean feeders for the app load (Phase 4 prep)
-- Run in a Snowsight worksheet as ROLE_REPORTER, the same role Power BI uses.
-- Produces exactly the columns the app's ClearingPlan entity needs, one row
-- per feeder, ordered by feeder_id. Download the result grid as a CSV into
-- data/out/ (gitignored); the app's "Import feeders" control reads it.
--
-- Reads ANALYTICS only (the clean star schema), so it carries the same values
-- the report shows. No STAGING, no RAW. Read-only: no objects are created.
--
-- Dates are emitted as ISO text (YYYY-MM-DD) with TO_CHAR so the CSV is
-- unambiguous regardless of the Snowsight locale/date display setting; the
-- app's CSV parser can rely on that format. planned_year stays numeric.
--
-- Target columns (match ClearingPlan + docs app-notes):
--   feeder_id, district_name, vendor, last_cleared_date, last_work_done,
--   next_clearing_date, date_certainty, planned_year, notes
-- vendor is the canonical vendor NAME; vendor_id 0 reads as "Unassigned"
-- (the DIM_VENDOR member), so feeders with no vendor arrive as "Unassigned".
-- =====================================================================

USE ROLE ROLE_REPORTER;
USE SECONDARY ROLES NONE;          -- prove ROLE_REPORTER can do this on its own
USE WAREHOUSE WH_REPORTING_XS;
USE SCHEMA ROW_DB.ANALYTICS;

SELECT
  p.feeder_id,
  d.district_name,
  v.vendor_name                              AS vendor,
  TO_CHAR(p.last_cleared_date, 'YYYY-MM-DD') AS last_cleared_date,
  p.last_work_done,
  TO_CHAR(p.next_clearing_date, 'YYYY-MM-DD') AS next_clearing_date,
  p.date_certainty,
  p.planned_year,
  p.notes
FROM ROW_DB.ANALYTICS.FACT_ROW_PLAN p
-- Inner joins: R1 profiling proved every plan row matches a circuit and a
-- vendor (0 bad rows), so no feeder is dropped and no key is left null.
JOIN ROW_DB.ANALYTICS.DIM_CIRCUIT  c ON c.feeder_id      = p.feeder_id
JOIN ROW_DB.ANALYTICS.DIM_DISTRICT d ON d.district_id    = c.responsible_district_id
JOIN ROW_DB.ANALYTICS.DIM_VENDOR   v ON v.vendor_id      = p.vendor_id
ORDER BY p.feeder_id;

-- Expected: 153 rows. Reconciliation the app will re-check after the load
-- (see docs/measures.md): certainty confirmed 142, tentative 4, next year 2,
-- TBD 5; feeders with a next_clearing_date = 143.
