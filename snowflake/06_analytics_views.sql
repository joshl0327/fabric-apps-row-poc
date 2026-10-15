-- =====================================================================
-- Fabric Apps POC - model-ready ANALYTICS views for Power BI (Phase 1, step 6)
-- Run in a Snowsight worksheet as ROLE_BI_DEVELOPER, AFTER 04_staging_clean.sql.
-- Builds the star schema Power BI reads in Phase 2: three dimensions, a
-- small certainty dimension, and two facts. Everything reads STAGING only.
-- Safe to re-run: every object is CREATE OR REPLACE.
--
-- Power BI connects as ROLE_REPORTER, which can read ROW_DB.ANALYTICS and
-- nothing else. The verification section at the bottom is written to be run
-- as ROLE_REPORTER to prove that boundary.
--
-- Plain attributes only. Anything relative to today - overdue, days until the
-- next clearing - belongs in the semantic model as a measure, not here.
-- =====================================================================

USE ROLE ROLE_BI_DEVELOPER;
USE SECONDARY ROLES NONE;      -- prove ROLE_BI_DEVELOPER can do this on its own
USE WAREHOUSE WH_TRANSFORM_XS;

USE SCHEMA ROW_DB.ANALYTICS;

-- ---------------------------------------------------------------------
-- DIM_CIRCUIT: one row per feeder (the clean system of record). Circuit and
-- substation numbers and names, line miles, and the responsible district
-- (id + name). row_responsibility holds the district name, so we resolve it
-- to the district id here so facts and reports can key off a stable id.
-- Grain: one row per feeder_id (153).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW ROW_DB.ANALYTICS.DIM_CIRCUIT AS
SELECT
  c.feeder_id,
  c.circuit_num,
  c.circuit_name,
  c.substation_num,
  c.substation_name,
  c.line_miles,
  d.district_id              AS responsible_district_id,
  c.row_responsibility       AS responsible_district_name
FROM ROW_DB.STAGING.STG_CIRCUITS c
LEFT JOIN ROW_DB.STAGING.STG_DISTRICTS d
  ON d.district_name = c.row_responsibility;

-- ---------------------------------------------------------------------
-- DIM_DISTRICT: the five districts.
-- Grain: one row per district_id (5).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW ROW_DB.ANALYTICS.DIM_DISTRICT AS
SELECT
  district_id,
  district_name
FROM ROW_DB.STAGING.STG_DISTRICTS;

-- ---------------------------------------------------------------------
-- DIM_VENDOR: the canonical vendor list (canonical names + vendor type).
-- Grain: one row per vendor_id (6).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW ROW_DB.ANALYTICS.DIM_VENDOR AS
SELECT
  vendor_id,
  vendor_name,
  vendor_type
FROM ROW_DB.STAGING.STG_VENDORS;

-- ---------------------------------------------------------------------
-- DIM_DATE_CERTAINTY: the four certainty values a cleaned date can carry,
-- with a sort order for the report. Values match the strings STAGING emits
-- so FACT_ROW_PLAN.date_certainty relates straight to this.
-- Grain: one row per certainty (4).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW ROW_DB.ANALYTICS.DIM_DATE_CERTAINTY AS
SELECT column1 AS date_certainty, column2 AS sort_order
FROM VALUES
  ('confirmed', 1),
  ('tentative', 2),
  ('next year', 3),
  ('TBD',       4);

-- ---------------------------------------------------------------------
-- FACT_ROW_PLAN: one row per feeder's clearing plan. Last cleared date,
-- last work done, next clearing date, the certainty + planned year of that
-- next clearing, vendor, notes, and how many data quality issues the
-- cleaning found for the feeder.
--
-- PHASE 4 NOTE: this is the one place where the source switches. Today it
-- reads STAGING.STG_ROW_CLEARING_PLAN (the cleaned spreadsheet). In Phase 4
-- it will read the Fabric App's own data (APP_SYNC) instead, and everything
-- downstream - the dimensions, the semantic model, the report - stays put.
--
-- Grain: one row per feeder_id (153).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW ROW_DB.ANALYTICS.FACT_ROW_PLAN AS
WITH issue_counts AS (
  SELECT feeder_id, COUNT(*) AS dq_issue_count
  FROM ROW_DB.STAGING.STG_DQ_ISSUES
  WHERE feeder_id IS NOT NULL
  GROUP BY feeder_id
)
SELECT
  p.feeder_id,
  v.vendor_id,
  p.last_cleared_date,
  p.last_work_done,
  p.next_clearing_date,
  p.next_clearing_certainty      AS date_certainty,
  p.next_clearing_planned_year   AS planned_year,
  p.notes,
  COALESCE(ic.dq_issue_count, 0) AS dq_issue_count
FROM ROW_DB.STAGING.STG_ROW_CLEARING_PLAN p
LEFT JOIN ROW_DB.STAGING.STG_VENDORS v
  ON v.vendor_name = p.vendor
LEFT JOIN issue_counts ic
  ON ic.feeder_id = p.feeder_id;

-- ---------------------------------------------------------------------
-- FACT_DQ_ISSUE: one row per data quality issue the cleaning found, for the
-- report's data quality page. Feeder, which column, the issue type, and the
-- raw -> clean values.
--
-- Orphan feeders (not in DIM_CIRCUIT) keep their feeder_id here so they still
-- show on the DQ page; STG_DQ_ISSUES leaves their feeder_id null and carries
-- the raw id in raw_value, so we fall back to that.
--
-- Grain: one row per issue (69).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW ROW_DB.ANALYTICS.FACT_DQ_ISSUE AS
SELECT
  COALESCE(feeder_id, raw_value) AS feeder_id,
  source_column,
  issue_type,
  raw_value,
  clean_value
FROM ROW_DB.STAGING.STG_DQ_ISSUES;

-- =====================================================================
-- VERIFICATION - run this section as ROLE_REPORTER, the role Power BI uses.
-- It should see every ANALYTICS view and nothing in STAGING.
-- =====================================================================
USE ROLE ROLE_REPORTER;
USE SECONDARY ROLES NONE;
USE WAREHOUSE WH_REPORTING_XS;

-- Row count of every ANALYTICS view, with the expected count beside it.
SELECT 'DIM_CIRCUIT'        AS view_name, COUNT(*) AS row_count, 153 AS expected FROM ROW_DB.ANALYTICS.DIM_CIRCUIT
UNION ALL SELECT 'DIM_DISTRICT',       COUNT(*),   5 FROM ROW_DB.ANALYTICS.DIM_DISTRICT
UNION ALL SELECT 'DIM_VENDOR',         COUNT(*),   6 FROM ROW_DB.ANALYTICS.DIM_VENDOR
UNION ALL SELECT 'DIM_DATE_CERTAINTY', COUNT(*),   4 FROM ROW_DB.ANALYTICS.DIM_DATE_CERTAINTY
UNION ALL SELECT 'FACT_ROW_PLAN',      COUNT(*), 153 FROM ROW_DB.ANALYTICS.FACT_ROW_PLAN
UNION ALL SELECT 'FACT_DQ_ISSUE',      COUNT(*),  69 FROM ROW_DB.ANALYTICS.FACT_DQ_ISSUE
ORDER BY view_name;

-- Referential check: every fact key matches its dimension (expect 0 rows).
SELECT 'FACT_ROW_PLAN.feeder_id with no DIM_CIRCUIT' AS problem, COUNT(*) AS bad_rows
FROM ROW_DB.ANALYTICS.FACT_ROW_PLAN f
LEFT JOIN ROW_DB.ANALYTICS.DIM_CIRCUIT d ON d.feeder_id = f.feeder_id
WHERE d.feeder_id IS NULL
UNION ALL
SELECT 'FACT_ROW_PLAN.vendor_id with no DIM_VENDOR', COUNT(*)
FROM ROW_DB.ANALYTICS.FACT_ROW_PLAN f
LEFT JOIN ROW_DB.ANALYTICS.DIM_VENDOR d ON d.vendor_id = f.vendor_id
WHERE f.vendor_id IS NOT NULL AND d.vendor_id IS NULL
UNION ALL
SELECT 'FACT_ROW_PLAN.date_certainty with no DIM_DATE_CERTAINTY', COUNT(*)
FROM ROW_DB.ANALYTICS.FACT_ROW_PLAN f
LEFT JOIN ROW_DB.ANALYTICS.DIM_DATE_CERTAINTY d ON d.date_certainty = f.date_certainty
WHERE d.date_certainty IS NULL;

-- Boundary check: ROLE_REPORTER must NOT be able to read STAGING. Uncomment
-- and run on its own; it should fail with an "Object does not exist or not
-- authorized" error, proving reports can't read past ANALYTICS.
-- SELECT COUNT(*) FROM ROW_DB.STAGING.STG_ROW_CLEARING_PLAN;
