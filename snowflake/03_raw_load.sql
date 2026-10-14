-- =====================================================================
-- Fabric Apps POC - load RAW from the LANDING stage (Phase 1, step 4)
-- Run in a Snowsight worksheet as ROLE_LOADER, AFTER the five landing
-- CSVs are uploaded to @ROW_DB.RAW.LANDING.
-- Each load is a FULL REFRESH: TRUNCATE then COPY ... FORCE = TRUE, so
-- re-running gives the same row counts every time -- never doubled (the
-- truncate clears first) and never skipped (FORCE reloads files COPY has
-- already seen). No cleaning happens here; values land exactly as staged.
-- =====================================================================

USE ROLE ROLE_LOADER;
USE SECONDARY ROLES NONE;
USE WAREHOUSE WH_TRANSFORM_XS;

USE SCHEMA ROW_DB.RAW;

-- ---------------------------------------------------------------------
-- 1. Full-refresh load, one file per table.
--    _source_file comes from METADATA$FILENAME; _loaded_at uses the
--    table default (CURRENT_TIMESTAMP at load time).
-- ---------------------------------------------------------------------

TRUNCATE TABLE ROW_DB.RAW.CIRCUITS;
COPY INTO ROW_DB.RAW.CIRCUITS
    (feeder_id, circuit_num, circuit_name, substation_num,
     substation_name, line_miles, row_responsibility, _source_file)
  FROM (
    SELECT $1, $2, $3, $4, $5, $6, $7, METADATA$FILENAME
    FROM @ROW_DB.RAW.LANDING
  )
  FILES = ('circuits.csv')
  FILE_FORMAT = (FORMAT_NAME = ROW_DB.RAW.FF_RAW_CSV)
  FORCE = TRUE
  ON_ERROR = ABORT_STATEMENT;

TRUNCATE TABLE ROW_DB.RAW.DISTRICTS;
COPY INTO ROW_DB.RAW.DISTRICTS
    (district_id, district_name, _source_file)
  FROM (
    SELECT $1, $2, METADATA$FILENAME
    FROM @ROW_DB.RAW.LANDING
  )
  FILES = ('districts.csv')
  FILE_FORMAT = (FORMAT_NAME = ROW_DB.RAW.FF_RAW_CSV)
  FORCE = TRUE
  ON_ERROR = ABORT_STATEMENT;

TRUNCATE TABLE ROW_DB.RAW.VENDORS;
COPY INTO ROW_DB.RAW.VENDORS
    (vendor_id, vendor_name, vendor_type, _source_file)
  FROM (
    SELECT $1, $2, $3, METADATA$FILENAME
    FROM @ROW_DB.RAW.LANDING
  )
  FILES = ('vendors.csv')
  FILE_FORMAT = (FORMAT_NAME = ROW_DB.RAW.FF_RAW_CSV)
  FORCE = TRUE
  ON_ERROR = ABORT_STATEMENT;

TRUNCATE TABLE ROW_DB.RAW.ROW_CLEARING_PLAN;
COPY INTO ROW_DB.RAW.ROW_CLEARING_PLAN
    (source_row, feeder_id, last_cleared, last_cleared_celltype,
     last_work_done, next_clearing, next_clearing_celltype,
     vendor, notes, _source_file)
  FROM (
    SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, METADATA$FILENAME
    FROM @ROW_DB.RAW.LANDING
  )
  FILES = ('row_clearing_plan.csv')
  FILE_FORMAT = (FORMAT_NAME = ROW_DB.RAW.FF_RAW_CSV)
  FORCE = TRUE
  ON_ERROR = ABORT_STATEMENT;

TRUNCATE TABLE ROW_DB.RAW.ANSWER_KEY;
COPY INTO ROW_DB.RAW.ANSWER_KEY
    (excel_row, feeder_id, source_column, raw_value, expected_value,
     issue_type, expected_date_certainty, expected_planned_year, _source_file)
  FROM (
    SELECT $1, $2, $3, $4, $5, $6, $7, $8, METADATA$FILENAME
    FROM @ROW_DB.RAW.LANDING
  )
  FILES = ('answer_key.csv')
  FILE_FORMAT = (FORMAT_NAME = ROW_DB.RAW.FF_RAW_CSV)
  FORCE = TRUE
  ON_ERROR = ABORT_STATEMENT;

-- ---------------------------------------------------------------------
-- 2. Verify: row count per table (expected with the generator run as
--    --seed 42 --as-of 2026-10-14):
--      CIRCUITS 153, DISTRICTS 5, VENDORS 6,
--      ROW_CLEARING_PLAN 157, ANSWER_KEY 69
-- ---------------------------------------------------------------------
SELECT 'CIRCUITS'          AS table_name, COUNT(*) AS row_count FROM ROW_DB.RAW.CIRCUITS
UNION ALL SELECT 'DISTRICTS',         COUNT(*) FROM ROW_DB.RAW.DISTRICTS
UNION ALL SELECT 'VENDORS',           COUNT(*) FROM ROW_DB.RAW.VENDORS
UNION ALL SELECT 'ROW_CLEARING_PLAN', COUNT(*) FROM ROW_DB.RAW.ROW_CLEARING_PLAN
UNION ALL SELECT 'ANSWER_KEY',        COUNT(*) FROM ROW_DB.RAW.ANSWER_KEY
ORDER BY table_name;

-- ---------------------------------------------------------------------
-- 3. Verify the mess survived (values landed untouched).
-- ---------------------------------------------------------------------

-- Trailing spaces preserved in Vendor (should be > 0).
SELECT COUNT(*) AS vendor_trailing_space_rows
FROM ROW_DB.RAW.ROW_CLEARING_PLAN
WHERE vendor <> RTRIM(vendor);

-- Text (non-date) values sitting in the Next Clearing date column.
SELECT COUNT(*) AS next_clearing_text_rows
FROM ROW_DB.RAW.ROW_CLEARING_PLAN
WHERE next_clearing_celltype = 'text';

-- A peek at those text-in-date values, exactly as they landed.
SELECT source_row, feeder_id, next_clearing, next_clearing_celltype
FROM ROW_DB.RAW.ROW_CLEARING_PLAN
WHERE next_clearing_celltype = 'text'
ORDER BY TRY_TO_NUMBER(source_row);
