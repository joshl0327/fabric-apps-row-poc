-- =====================================================================
-- Fabric Apps POC - prove the cleaning rules (Phase 1, step 6)
-- Run in a Snowsight worksheet as ROLE_BI_DEVELOPER, AFTER 04_staging_clean.sql.
-- This is the ONLY script allowed to read RAW.ANSWER_KEY. It compares the
-- problems the rules found (STG_DQ_ISSUES) against the answer key, matching
-- on (row, column). A clean run is:
--     expected 69, caught 69, missed 0, extra 0, mismatched 0
-- Safe to re-run; reads only, writes nothing.
-- =====================================================================

USE ROLE ROLE_BI_DEVELOPER;
USE SECONDARY ROLES NONE;
USE WAREHOUSE WH_TRANSFORM_XS;

USE SCHEMA ROW_DB.STAGING;

-- ---------------------------------------------------------------------
-- Shared comparison: full outer join answer key <-> found issues on
-- (row, column), with a per-row verdict on whether the cleaned values agree.
-- (Snowsight runs one statement at a time, so this CTE is repeated in each
-- query below rather than materialized.)
-- ---------------------------------------------------------------------

-- 1. SUMMARY (the headline, one row)
WITH ak AS (
  SELECT TRY_TO_NUMBER(excel_row) AS row_id, source_column,
         NULLIF(TRIM(expected_value), '')          AS clean_value,
         issue_type,
         NULLIF(TRIM(expected_date_certainty), '') AS date_certainty,
         TRY_TO_NUMBER(expected_planned_year)      AS planned_year
  FROM ROW_DB.RAW.ANSWER_KEY
),
dq AS (
  SELECT source_row AS row_id, source_column,
         NULLIF(TRIM(clean_value), '')    AS clean_value,
         issue_type,
         NULLIF(TRIM(date_certainty), '') AS date_certainty,
         planned_year
  FROM ROW_DB.STAGING.STG_DQ_ISSUES
),
j AS (
  SELECT
    ak.row_id IS NOT NULL AS in_key,
    dq.row_id IS NOT NULL AS in_found,
    (ak.row_id IS NOT NULL AND dq.row_id IS NOT NULL
     AND EQUAL_NULL(ak.clean_value, dq.clean_value)
     AND EQUAL_NULL(ak.issue_type, dq.issue_type)
     AND EQUAL_NULL(ak.date_certainty, dq.date_certainty)
     AND EQUAL_NULL(ak.planned_year, dq.planned_year)) AS values_match
  FROM ak
  FULL OUTER JOIN dq
    ON ak.row_id = dq.row_id AND ak.source_column = dq.source_column
)
SELECT
  COUNT_IF(in_key)                                        AS expected,
  COUNT_IF(in_key AND in_found)                           AS caught,
  COUNT_IF(in_key AND NOT in_found)                       AS missed,
  COUNT_IF(in_found AND NOT in_key)                       AS extra,
  COUNT_IF(in_key AND in_found AND NOT values_match)      AS mismatched
FROM j;

-- 2. MISSED - in the answer key but the rules did not flag it
WITH ak AS (
  SELECT TRY_TO_NUMBER(excel_row) AS row_id, source_column, feeder_id,
         raw_value, expected_value, issue_type,
         expected_date_certainty, expected_planned_year
  FROM ROW_DB.RAW.ANSWER_KEY
),
dq AS (SELECT source_row AS row_id, source_column FROM ROW_DB.STAGING.STG_DQ_ISSUES)
SELECT ak.*
FROM ak
LEFT JOIN dq ON ak.row_id = dq.row_id AND ak.source_column = dq.source_column
WHERE dq.row_id IS NULL
ORDER BY ak.row_id, ak.source_column;

-- 3. EXTRA - flagged by the rules but not in the answer key
WITH ak AS (SELECT TRY_TO_NUMBER(excel_row) AS row_id, source_column FROM ROW_DB.RAW.ANSWER_KEY),
dq AS (SELECT * FROM ROW_DB.STAGING.STG_DQ_ISSUES)
SELECT dq.*
FROM dq
LEFT JOIN ak ON ak.row_id = dq.source_row AND ak.source_column = dq.source_column
WHERE ak.row_id IS NULL
ORDER BY dq.source_row, dq.source_column;

-- 4. MISMATCHED - matched on (row, column) but a cleaned value disagrees
WITH ak AS (
  SELECT TRY_TO_NUMBER(excel_row) AS row_id, source_column,
         NULLIF(TRIM(expected_value), '')          AS clean_value,
         issue_type,
         NULLIF(TRIM(expected_date_certainty), '') AS date_certainty,
         TRY_TO_NUMBER(expected_planned_year)      AS planned_year
  FROM ROW_DB.RAW.ANSWER_KEY
),
dq AS (
  SELECT source_row AS row_id, source_column,
         NULLIF(TRIM(clean_value), '')    AS clean_value,
         issue_type,
         NULLIF(TRIM(date_certainty), '') AS date_certainty,
         planned_year
  FROM ROW_DB.STAGING.STG_DQ_ISSUES
)
SELECT
  ak.row_id AS row_num, ak.source_column,
  ak.issue_type      AS key_issue,   dq.issue_type      AS found_issue,
  ak.clean_value     AS key_clean,   dq.clean_value     AS found_clean,
  ak.date_certainty  AS key_cert,    dq.date_certainty  AS found_cert,
  ak.planned_year    AS key_year,    dq.planned_year    AS found_year
FROM ak
JOIN dq ON ak.row_id = dq.row_id AND ak.source_column = dq.source_column
WHERE NOT (EQUAL_NULL(ak.clean_value, dq.clean_value)
       AND EQUAL_NULL(ak.issue_type, dq.issue_type)
       AND EQUAL_NULL(ak.date_certainty, dq.date_certainty)
       AND EQUAL_NULL(ak.planned_year, dq.planned_year))
ORDER BY ak.row_id, ak.source_column;

-- 5. Row-count checks against the expected shape
SELECT 'STG_CIRCUITS = 153'           AS check_name, COUNT(*) AS actual, 153 AS expected FROM ROW_DB.STAGING.STG_CIRCUITS
UNION ALL SELECT 'STG_ROW_CLEARING_PLAN = 153', COUNT(*), 153 FROM ROW_DB.STAGING.STG_ROW_CLEARING_PLAN
UNION ALL SELECT 'STG_DQ_REVIEW = 2 (orphans)', COUNT(*), 2   FROM ROW_DB.STAGING.STG_DQ_REVIEW
ORDER BY check_name;
