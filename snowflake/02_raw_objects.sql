-- =====================================================================
-- Fabric Apps POC - RAW landing objects (Phase 1, step 3)
-- Run in a Snowsight worksheet as ROLE_LOADER, BEFORE uploading files.
-- Creates the file format, the LANDING stage, and one RAW table per
-- landing file. Everything lands exactly as it arrived: no cleaning,
-- no typing. Cleaning is the next task.
-- Safe to re-run: IF NOT EXISTS everywhere, so re-running never drops a
-- table or wipes files already uploaded to the stage.
-- =====================================================================

USE ROLE ROLE_LOADER;
USE SECONDARY ROLES NONE;      -- prove ROLE_LOADER can do this on its own
USE WAREHOUSE WH_TRANSFORM_XS;

USE SCHEMA ROW_DB.RAW;

-- ---------------------------------------------------------------------
-- 1. File format: read CSV values EXACTLY as written.
--    - FIELD_OPTIONALLY_ENCLOSED_BY '"' handles embedded commas and the
--      fully quoted clearing-plan file.
--    - TRIM_SPACE = FALSE keeps leading/trailing spaces (the mess).
--    - EMPTY_FIELD_AS_NULL = FALSE and NULL_IF = () keep blanks as '' and
--      never turn any text into NULL.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FILE FORMAT ROW_DB.RAW.FF_RAW_CSV
  TYPE = CSV
  FIELD_DELIMITER = ','
  RECORD_DELIMITER = '\n'
  SKIP_HEADER = 1
  FIELD_OPTIONALLY_ENCLOSED_BY = '"'
  TRIM_SPACE = FALSE
  EMPTY_FIELD_AS_NULL = FALSE
  NULL_IF = ()
  COMMENT = 'RAW landing: preserve values exactly, keep spaces, no NULL coercion';

-- ---------------------------------------------------------------------
-- 2. Internal stage the five landing CSVs are uploaded to.
--    IF NOT EXISTS so re-running this script never deletes staged files.
-- ---------------------------------------------------------------------
CREATE STAGE IF NOT EXISTS ROW_DB.RAW.LANDING
  FILE_FORMAT = ROW_DB.RAW.FF_RAW_CSV
  COMMENT = 'Landing zone for synthetic ROW CSVs (uploaded via Snowsight)';

-- ---------------------------------------------------------------------
-- 3. One table per landing file. Every source column is VARCHAR (RAW
--    keeps the text as-is). Two bookkeeping columns on each table:
--    _source_file (which file the row came from) and _loaded_at.
-- ---------------------------------------------------------------------

-- circuits.csv (clean system of record)
CREATE TABLE IF NOT EXISTS ROW_DB.RAW.CIRCUITS (
  feeder_id         VARCHAR,
  circuit_num       VARCHAR,
  circuit_name      VARCHAR,
  substation_num    VARCHAR,
  substation_name   VARCHAR,
  line_miles        VARCHAR,
  row_responsibility VARCHAR,
  _source_file      VARCHAR,
  _loaded_at        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- districts.csv (dimension)
CREATE TABLE IF NOT EXISTS ROW_DB.RAW.DISTRICTS (
  district_id   VARCHAR,
  district_name VARCHAR,
  _source_file  VARCHAR,
  _loaded_at    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- vendors.csv (canonical vendor list)
CREATE TABLE IF NOT EXISTS ROW_DB.RAW.VENDORS (
  vendor_id    VARCHAR,
  vendor_name  VARCHAR,
  vendor_type  VARCHAR,
  _source_file VARCHAR,
  _loaded_at   TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- row_clearing_plan.csv (the messy spreadsheet, flattened)
CREATE TABLE IF NOT EXISTS ROW_DB.RAW.ROW_CLEARING_PLAN (
  source_row             VARCHAR,
  feeder_id              VARCHAR,
  last_cleared           VARCHAR,
  last_cleared_celltype  VARCHAR,
  last_work_done         VARCHAR,
  next_clearing          VARCHAR,
  next_clearing_celltype VARCHAR,
  vendor                 VARCHAR,
  notes                  VARCHAR,
  _source_file           VARCHAR,
  _loaded_at             TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- answer_key.csv (test data, not a source)
CREATE TABLE IF NOT EXISTS ROW_DB.RAW.ANSWER_KEY (
  excel_row               VARCHAR,
  feeder_id               VARCHAR,
  source_column           VARCHAR,
  raw_value               VARCHAR,
  expected_value          VARCHAR,
  issue_type              VARCHAR,
  expected_date_certainty VARCHAR,
  expected_planned_year   VARCHAR,
  _source_file            VARCHAR,
  _loaded_at              TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

COMMENT ON TABLE ROW_DB.RAW.ANSWER_KEY IS
  'Test data, not a source: the values the generator damaged on purpose, used to prove the cleaning rules.';

-- ---------------------------------------------------------------------
-- 4. Verify
-- ---------------------------------------------------------------------
SHOW FILE FORMATS LIKE 'FF_RAW_CSV' IN SCHEMA ROW_DB.RAW;
SHOW STAGES LIKE 'LANDING' IN SCHEMA ROW_DB.RAW;
SHOW TABLES IN SCHEMA ROW_DB.RAW;
