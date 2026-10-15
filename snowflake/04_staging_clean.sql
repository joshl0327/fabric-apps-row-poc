-- =====================================================================
-- Fabric Apps POC - clean the clearing plan in STAGING (Phase 1, step 5)
-- Run in a Snowsight worksheet as ROLE_BI_DEVELOPER, AFTER 03_raw_load.sql.
-- Builds STAGING on top of RAW: typed/trimmed dimension views, one clean
-- row per feeder for the clearing plan, and two data-quality views.
-- Safe to re-run: every object is CREATE OR REPLACE and reads only RAW.
--
-- HONESTY RULES (see prompts/03_clean_staging.md):
--   * No cleaning view reads RAW.ANSWER_KEY. The answer key is touched only
--     by the test script (05_staging_test.sql).
--   * No hard-coded row numbers, feeder IDs, or raw values copied from the
--     answer key. The rules are general and key off the shape of the data
--     (the cell-type columns, the canonical vendor list, the as-of date).
-- =====================================================================

USE ROLE ROLE_BI_DEVELOPER;
USE SECONDARY ROLES NONE;      -- prove ROLE_BI_DEVELOPER can do this on its own
USE WAREHOUSE WH_TRANSFORM_XS;

USE SCHEMA ROW_DB.STAGING;

-- ---------------------------------------------------------------------
-- 1. CLEANING_CONFIG: the one tunable the rules depend on.
--    "Next Year" and other relative text are resolved against this date.
--    Set to 2026-10-14, the date the synthetic data was generated.
--    Re-runnable: replaced then re-seeded, so always exactly one row.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE ROW_DB.STAGING.CLEANING_CONFIG (
  as_of_date DATE NOT NULL
);
INSERT INTO ROW_DB.STAGING.CLEANING_CONFIG (as_of_date) VALUES ('2026-10-14');

-- ---------------------------------------------------------------------
-- 2. Typed, trimmed dimension views. RAW is all VARCHAR; here we cast and
--    trim, but change nothing else. These are the clean system of record.
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW ROW_DB.STAGING.STG_CIRCUITS AS
SELECT
  TRIM(feeder_id)                        AS feeder_id,
  TRY_TO_NUMBER(TRIM(circuit_num))       AS circuit_num,
  TRIM(circuit_name)                     AS circuit_name,
  TRY_TO_NUMBER(TRIM(substation_num))    AS substation_num,
  TRIM(substation_name)                  AS substation_name,
  TRY_TO_DECIMAL(TRIM(line_miles), 6, 1) AS line_miles,
  TRIM(row_responsibility)               AS row_responsibility
FROM ROW_DB.RAW.CIRCUITS;

CREATE OR REPLACE VIEW ROW_DB.STAGING.STG_DISTRICTS AS
SELECT
  TRY_TO_NUMBER(TRIM(district_id)) AS district_id,
  TRIM(district_name)              AS district_name
FROM ROW_DB.RAW.DISTRICTS;

CREATE OR REPLACE VIEW ROW_DB.STAGING.STG_VENDORS AS
SELECT
  TRY_TO_NUMBER(TRIM(vendor_id)) AS vendor_id,
  TRIM(vendor_name)              AS vendor_name,
  TRIM(vendor_type)              AS vendor_type
FROM ROW_DB.RAW.VENDORS;

-- ---------------------------------------------------------------------
-- 3. STG_VENDOR_LOOKUP: map every hand-typed vendor to the canonical list.
--
--    Normalization (same expression applied to the raw cell, the canonical
--    name, and the canonical type):
--      lower-case; "&" -> "and"; strip punctuation; drop Inc/LLC;
--      expand abbreviations (Veg->Vegetation, Mgmt->Management, Svc->Service);
--      collapse spaces.
--    Match, best first:
--      1 exact      normalized cell == normalized canonical name
--      2 type       normalized cell == normalized canonical type
--                   (handles "In-House Crew" -> North District Line Crew)
--      3 subset     cell's words are all contained in one canonical name
--                   (handles "North District Crew" -> ...Line Crew)
--      4 fuzzy      edit distance <= 2 on the normalized strings (small typos)
--    A cell with no match does not appear here -> it falls to STG_DQ_REVIEW.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW ROW_DB.STAGING.STG_VENDOR_LOOKUP AS
WITH canon AS (
  SELECT
    vendor_name AS canonical,
    TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
      ' ' || REGEXP_REPLACE(REPLACE(LOWER(TRIM(vendor_name)), '&', ' and '),
             '[^a-z0-9 ]', ' ') || ' ',
      ' veg ',  ' vegetation '), ' mgmt ', ' management '),
      ' svc ',  ' service '),    ' (llc|inc) ', ' '),
      '\\s+', ' ')) AS name_norm,
    TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
      ' ' || REGEXP_REPLACE(REPLACE(LOWER(TRIM(vendor_type)), '&', ' and '),
             '[^a-z0-9 ]', ' ') || ' ',
      ' veg ',  ' vegetation '), ' mgmt ', ' management '),
      ' svc ',  ' service '),    ' (llc|inc) ', ' '),
      '\\s+', ' ')) AS type_norm
  FROM ROW_DB.STAGING.STG_VENDORS
),
raw_cells AS (
  SELECT DISTINCT
    vendor AS raw_vendor,
    TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(
      ' ' || REGEXP_REPLACE(REPLACE(LOWER(TRIM(vendor)), '&', ' and '),
             '[^a-z0-9 ]', ' ') || ' ',
      ' veg ',  ' vegetation '), ' mgmt ', ' management '),
      ' svc ',  ' service '),    ' (llc|inc) ', ' '),
      '\\s+', ' ')) AS norm_v
  FROM ROW_DB.RAW.ROW_CLEARING_PLAN
  WHERE TRIM(vendor) <> ''
),
scored AS (
  SELECT
    r.raw_vendor,
    c.canonical,
    CASE
      WHEN r.norm_v = c.name_norm THEN 1
      WHEN r.norm_v = c.type_norm THEN 2
      WHEN ARRAY_SIZE(ARRAY_EXCEPT(SPLIT(r.norm_v, ' '), SPLIT(c.name_norm, ' '))) = 0
           AND ARRAY_SIZE(SPLIT(r.norm_v, ' ')) >= ARRAY_SIZE(SPLIT(c.name_norm, ' ')) - 1
        THEN 3
      WHEN EDITDISTANCE(r.norm_v, c.name_norm) <= 2 THEN 4
      ELSE NULL
    END                                AS method_rank,
    EDITDISTANCE(r.norm_v, c.name_norm) AS edit_dist
  FROM raw_cells r
  CROSS JOIN canon c
)
SELECT
  raw_vendor,
  canonical AS canonical_vendor,
  CASE method_rank
    WHEN 1 THEN 'exact' WHEN 2 THEN 'type'
    WHEN 3 THEN 'token_subset' WHEN 4 THEN 'fuzzy'
  END       AS match_method,
  edit_dist
FROM scored
WHERE method_rank IS NOT NULL
QUALIFY ROW_NUMBER() OVER (PARTITION BY raw_vendor ORDER BY method_rank, edit_dist) = 1;

-- ---------------------------------------------------------------------
-- 4. STG_PLAN_RESOLVED: the engine. One row per RAW plan row (all 157),
--    annotated with everything the rules decide. The clean plan and both
--    DQ views are thin selects over this, so the rules live in one place.
--
--    Feeder ID: spaces removed, leading zeros stripped from the circuit
--      number -> std_feeder_id. in_circuits = present in STG_CIRCUITS.
--      Duplicates are kept by highest source_row (the last occurrence);
--      earlier copies are dropped.
--    Dates (same logic for both date columns, driven by the cell type):
--      blank            -> no date, certainty TBD
--      real date cell   -> that date, confirmed
--      text, parseable  -> that date, confirmed            (date_format)
--      text, "d - TBD"  -> recovered date, tentative       (non_date)
--      text, "Next Year"-> no date, next year, planned = as-of year + 1
--      text w/ a year   -> no date, tentative, that year   (quarter/season/"?")
--      anything else    -> no date, TBD                    (non_date)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW ROW_DB.STAGING.STG_PLAN_RESOLVED AS
WITH cfg AS (
  SELECT as_of_date, YEAR(as_of_date) AS as_of_year FROM ROW_DB.STAGING.CLEANING_CONFIG
),
base AS (
  SELECT
    TRY_TO_NUMBER(TRIM(p.source_row))             AS source_row,
    p.feeder_id                                    AS raw_feeder_id,
    SPLIT_PART(REPLACE(p.feeder_id, ' ', ''), '-', 1) || '-' ||
      LTRIM(SPLIT_PART(REPLACE(p.feeder_id, ' ', ''), '-', 2), '0')
                                                   AS std_feeder_id,
    p.last_cleared                                 AS raw_last_cleared,
    LOWER(TRIM(p.last_cleared_celltype))           AS lc_celltype,
    TRIM(p.last_work_done)                         AS last_work_done,
    p.next_clearing                                AS raw_next_clearing,
    LOWER(TRIM(p.next_clearing_celltype))          AS nc_celltype,
    p.vendor                                       AS raw_vendor,
    TRIM(p.notes)                                  AS notes,
    cfg.as_of_year
  FROM ROW_DB.RAW.ROW_CLEARING_PLAN p
  CROSS JOIN cfg
),
joined AS (
  SELECT
    b.*,
    (c.feeder_id IS NOT NULL)                      AS in_circuits,
    vl.canonical_vendor,
    ROW_NUMBER() OVER (PARTITION BY b.std_feeder_id ORDER BY b.source_row DESC) AS occ_rank
  FROM base b
  LEFT JOIN ROW_DB.STAGING.STG_CIRCUITS c      ON c.feeder_id  = b.std_feeder_id
  LEFT JOIN ROW_DB.STAGING.STG_VENDOR_LOOKUP vl ON vl.raw_vendor = b.raw_vendor
)
SELECT
  source_row,
  raw_feeder_id,
  std_feeder_id,
  in_circuits,
  (in_circuits AND occ_rank = 1)  AS is_kept,        -- the surviving plan row
  (in_circuits AND occ_rank > 1)  AS is_duplicate,   -- a dropped copy

  -- Feeder ID formatting problem on the surviving / single row.
  (raw_feeder_id <> std_feeder_id) AS feeder_reformatted,

  -- ---- Last Cleared ----
  raw_last_cleared,
  CASE
    WHEN lc_celltype = 'blank' THEN NULL
    WHEN lc_celltype = 'date'  THEN TRY_TO_DATE(TRIM(raw_last_cleared), 'YYYY-MM-DD')
    ELSE COALESCE(
      TRY_TO_DATE(TRIM(raw_last_cleared), 'YYYY-MM-DD'),
      TRY_TO_DATE(TRIM(raw_last_cleared), 'MM-DD-YYYY'),
      TRY_TO_DATE(TRIM(raw_last_cleared), 'MM/DD/YYYY'),
      TRY_TO_DATE(TRIM(raw_last_cleared), 'MM/DD/YY'),
      TRY_TO_DATE(REGEXP_SUBSTR(TRIM(raw_last_cleared), '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}'), 'MM/DD/YYYY'))
  END AS last_cleared_date,
  CASE
    WHEN lc_celltype = 'blank' THEN 'TBD'
    WHEN lc_celltype = 'date'  THEN 'confirmed'
    WHEN COALESCE(
      TRY_TO_DATE(TRIM(raw_last_cleared), 'YYYY-MM-DD'),
      TRY_TO_DATE(TRIM(raw_last_cleared), 'MM-DD-YYYY'),
      TRY_TO_DATE(TRIM(raw_last_cleared), 'MM/DD/YYYY'),
      TRY_TO_DATE(TRIM(raw_last_cleared), 'MM/DD/YY')) IS NOT NULL THEN 'confirmed'
    WHEN TRY_TO_DATE(REGEXP_SUBSTR(TRIM(raw_last_cleared), '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}'), 'MM/DD/YYYY') IS NOT NULL THEN 'tentative'
    WHEN LOWER(TRIM(raw_last_cleared)) LIKE '%next year%' THEN 'next year'
    WHEN REGEXP_SUBSTR(TRIM(raw_last_cleared), '(19|20)[0-9]{2}') IS NOT NULL THEN 'tentative'
    ELSE 'TBD'
  END AS last_cleared_certainty,
  CASE
    WHEN lc_celltype = 'blank' THEN NULL
    WHEN lc_celltype = 'date'  THEN YEAR(TRY_TO_DATE(TRIM(raw_last_cleared), 'YYYY-MM-DD'))
    WHEN COALESCE(
      TRY_TO_DATE(TRIM(raw_last_cleared), 'YYYY-MM-DD'),
      TRY_TO_DATE(TRIM(raw_last_cleared), 'MM-DD-YYYY'),
      TRY_TO_DATE(TRIM(raw_last_cleared), 'MM/DD/YYYY'),
      TRY_TO_DATE(TRIM(raw_last_cleared), 'MM/DD/YY')) IS NOT NULL
      THEN YEAR(COALESCE(
        TRY_TO_DATE(TRIM(raw_last_cleared), 'YYYY-MM-DD'),
        TRY_TO_DATE(TRIM(raw_last_cleared), 'MM-DD-YYYY'),
        TRY_TO_DATE(TRIM(raw_last_cleared), 'MM/DD/YYYY'),
        TRY_TO_DATE(TRIM(raw_last_cleared), 'MM/DD/YY')))
    WHEN TRY_TO_DATE(REGEXP_SUBSTR(TRIM(raw_last_cleared), '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}'), 'MM/DD/YYYY') IS NOT NULL
      THEN YEAR(TRY_TO_DATE(REGEXP_SUBSTR(TRIM(raw_last_cleared), '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}'), 'MM/DD/YYYY'))
    WHEN LOWER(TRIM(raw_last_cleared)) LIKE '%next year%' THEN as_of_year + 1
    ELSE TRY_TO_NUMBER(REGEXP_SUBSTR(TRIM(raw_last_cleared), '(19|20)[0-9]{2}'))
  END AS last_cleared_planned_year,
  CASE
    WHEN lc_celltype = 'blank' THEN 'blank'
    WHEN lc_celltype = 'date'  THEN NULL
    WHEN COALESCE(
      TRY_TO_DATE(TRIM(raw_last_cleared), 'YYYY-MM-DD'),
      TRY_TO_DATE(TRIM(raw_last_cleared), 'MM-DD-YYYY'),
      TRY_TO_DATE(TRIM(raw_last_cleared), 'MM/DD/YYYY'),
      TRY_TO_DATE(TRIM(raw_last_cleared), 'MM/DD/YY')) IS NOT NULL THEN 'date_format'
    ELSE 'non_date'
  END AS last_cleared_issue,

  -- ---- Next Clearing ----
  raw_next_clearing,
  CASE
    WHEN nc_celltype = 'blank' THEN NULL
    WHEN nc_celltype = 'date'  THEN TRY_TO_DATE(TRIM(raw_next_clearing), 'YYYY-MM-DD')
    ELSE COALESCE(
      TRY_TO_DATE(TRIM(raw_next_clearing), 'YYYY-MM-DD'),
      TRY_TO_DATE(TRIM(raw_next_clearing), 'MM-DD-YYYY'),
      TRY_TO_DATE(TRIM(raw_next_clearing), 'MM/DD/YYYY'),
      TRY_TO_DATE(TRIM(raw_next_clearing), 'MM/DD/YY'),
      TRY_TO_DATE(REGEXP_SUBSTR(TRIM(raw_next_clearing), '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}'), 'MM/DD/YYYY'))
  END AS next_clearing_date,
  CASE
    WHEN nc_celltype = 'blank' THEN 'TBD'
    WHEN nc_celltype = 'date'  THEN 'confirmed'
    WHEN COALESCE(
      TRY_TO_DATE(TRIM(raw_next_clearing), 'YYYY-MM-DD'),
      TRY_TO_DATE(TRIM(raw_next_clearing), 'MM-DD-YYYY'),
      TRY_TO_DATE(TRIM(raw_next_clearing), 'MM/DD/YYYY'),
      TRY_TO_DATE(TRIM(raw_next_clearing), 'MM/DD/YY')) IS NOT NULL THEN 'confirmed'
    WHEN TRY_TO_DATE(REGEXP_SUBSTR(TRIM(raw_next_clearing), '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}'), 'MM/DD/YYYY') IS NOT NULL THEN 'tentative'
    WHEN LOWER(TRIM(raw_next_clearing)) LIKE '%next year%' THEN 'next year'
    WHEN REGEXP_SUBSTR(TRIM(raw_next_clearing), '(19|20)[0-9]{2}') IS NOT NULL THEN 'tentative'
    ELSE 'TBD'
  END AS next_clearing_certainty,
  CASE
    WHEN nc_celltype = 'blank' THEN NULL
    WHEN nc_celltype = 'date'  THEN YEAR(TRY_TO_DATE(TRIM(raw_next_clearing), 'YYYY-MM-DD'))
    WHEN COALESCE(
      TRY_TO_DATE(TRIM(raw_next_clearing), 'YYYY-MM-DD'),
      TRY_TO_DATE(TRIM(raw_next_clearing), 'MM-DD-YYYY'),
      TRY_TO_DATE(TRIM(raw_next_clearing), 'MM/DD/YYYY'),
      TRY_TO_DATE(TRIM(raw_next_clearing), 'MM/DD/YY')) IS NOT NULL
      THEN YEAR(COALESCE(
        TRY_TO_DATE(TRIM(raw_next_clearing), 'YYYY-MM-DD'),
        TRY_TO_DATE(TRIM(raw_next_clearing), 'MM-DD-YYYY'),
        TRY_TO_DATE(TRIM(raw_next_clearing), 'MM/DD/YYYY'),
        TRY_TO_DATE(TRIM(raw_next_clearing), 'MM/DD/YY')))
    WHEN TRY_TO_DATE(REGEXP_SUBSTR(TRIM(raw_next_clearing), '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}'), 'MM/DD/YYYY') IS NOT NULL
      THEN YEAR(TRY_TO_DATE(REGEXP_SUBSTR(TRIM(raw_next_clearing), '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}'), 'MM/DD/YYYY'))
    WHEN LOWER(TRIM(raw_next_clearing)) LIKE '%next year%' THEN as_of_year + 1
    ELSE TRY_TO_NUMBER(REGEXP_SUBSTR(TRIM(raw_next_clearing), '(19|20)[0-9]{2}'))
  END AS next_clearing_planned_year,
  CASE
    WHEN nc_celltype = 'blank' THEN 'blank'
    WHEN nc_celltype = 'date'  THEN NULL
    WHEN COALESCE(
      TRY_TO_DATE(TRIM(raw_next_clearing), 'YYYY-MM-DD'),
      TRY_TO_DATE(TRIM(raw_next_clearing), 'MM-DD-YYYY'),
      TRY_TO_DATE(TRIM(raw_next_clearing), 'MM/DD/YYYY'),
      TRY_TO_DATE(TRIM(raw_next_clearing), 'MM/DD/YY')) IS NOT NULL THEN 'date_format'
    ELSE 'non_date'
  END AS next_clearing_issue,

  -- ---- Vendor ----
  raw_vendor,
  canonical_vendor,
  last_work_done,
  notes
FROM joined;

-- ---------------------------------------------------------------------
-- 5. STG_ROW_CLEARING_PLAN: one clean row per feeder (the surviving row),
--    orphans excluded. Clean columns sit next to the raw values they came
--    from, plus source_row for traceability.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW ROW_DB.STAGING.STG_ROW_CLEARING_PLAN AS
SELECT
  source_row,
  std_feeder_id                 AS feeder_id,
  raw_feeder_id,
  last_cleared_date,
  raw_last_cleared,
  last_work_done,
  next_clearing_date,
  next_clearing_certainty,
  next_clearing_planned_year,
  raw_next_clearing,
  canonical_vendor              AS vendor,
  raw_vendor,
  notes
FROM ROW_DB.STAGING.STG_PLAN_RESOLVED
WHERE is_kept;

-- ---------------------------------------------------------------------
-- 6. STG_DQ_ISSUES: one row per problem the rules found, shaped to compare
--    directly against RAW.ANSWER_KEY (but never reading it). Matched on
--    (source_row, source_column). Issue types mirror the answer key:
--    feeder_format, duplicate_feeder, orphan_feeder, non_date, date_format,
--    blank, vendor_variant.
--
--    Feeder-ID problems are reported per raw row (orphans and dropped
--    duplicate copies included); date and vendor problems are reported only
--    on the surviving row, so a duplicated-and-damaged feeder is not counted
--    twice.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW ROW_DB.STAGING.STG_DQ_ISSUES AS
-- Feeder ID: orphan (not in circuits)
SELECT
  source_row, NULL AS feeder_id, 'Feeder ID' AS source_column,
  raw_feeder_id AS raw_value, NULL AS clean_value,
  'orphan_feeder' AS issue_type, NULL AS date_certainty, NULL AS planned_year
FROM ROW_DB.STAGING.STG_PLAN_RESOLVED
WHERE NOT in_circuits
UNION ALL
-- Feeder ID: duplicate (a dropped copy of a feeder that is in circuits)
SELECT
  source_row, std_feeder_id, 'Feeder ID',
  std_feeder_id, std_feeder_id,
  'duplicate_feeder', NULL, NULL
FROM ROW_DB.STAGING.STG_PLAN_RESOLVED
WHERE is_duplicate
UNION ALL
-- Feeder ID: reformatted (same feeder, different text format)
SELECT
  source_row, std_feeder_id, 'Feeder ID',
  raw_feeder_id, std_feeder_id,
  'feeder_format', NULL, NULL
FROM ROW_DB.STAGING.STG_PLAN_RESOLVED
WHERE in_circuits AND NOT is_duplicate AND feeder_reformatted
UNION ALL
-- Next Clearing problems (surviving row only)
SELECT
  source_row, std_feeder_id, 'Next Clearing',
  raw_next_clearing, COALESCE(TO_CHAR(next_clearing_date, 'YYYY-MM-DD'), ''),
  next_clearing_issue, next_clearing_certainty, next_clearing_planned_year
FROM ROW_DB.STAGING.STG_PLAN_RESOLVED
WHERE is_kept AND next_clearing_issue IS NOT NULL
UNION ALL
-- Last Cleared problems (surviving row only)
SELECT
  source_row, std_feeder_id, 'Last Cleared',
  raw_last_cleared, COALESCE(TO_CHAR(last_cleared_date, 'YYYY-MM-DD'), ''),
  last_cleared_issue, last_cleared_certainty, last_cleared_planned_year
FROM ROW_DB.STAGING.STG_PLAN_RESOLVED
WHERE is_kept AND last_cleared_issue IS NOT NULL
UNION ALL
-- Vendor problems (surviving row only): blank, or a variant that mapped
-- to a canonical name different from the raw cell.
SELECT
  source_row, std_feeder_id, 'Vendor',
  raw_vendor,
  CASE WHEN TRIM(raw_vendor) = '' THEN '' ELSE COALESCE(canonical_vendor, '') END,
  CASE WHEN TRIM(raw_vendor) = '' THEN 'blank' ELSE 'vendor_variant' END,
  NULL, NULL
FROM ROW_DB.STAGING.STG_PLAN_RESOLVED
WHERE is_kept
  AND (TRIM(raw_vendor) = '' OR raw_vendor <> canonical_vendor);

-- ---------------------------------------------------------------------
-- 7. STG_DQ_REVIEW: what the rules could NOT settle on their own and a
--    person should look at. For this dataset: only the orphan feeders.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW ROW_DB.STAGING.STG_DQ_REVIEW AS
-- Orphans: a feeder in the plan with no matching circuit.
SELECT
  source_row,
  raw_feeder_id          AS feeder_id,
  'orphan_feeder'        AS review_reason,
  'Feeder not found in STG_CIRCUITS' AS detail
FROM ROW_DB.STAGING.STG_PLAN_RESOLVED
WHERE NOT in_circuits
UNION ALL
-- Vendors the rules could not confidently map.
SELECT
  source_row,
  std_feeder_id,
  'vendor_no_match',
  'Vendor "' || raw_vendor || '" did not match the canonical list'
FROM ROW_DB.STAGING.STG_PLAN_RESOLVED
WHERE is_kept AND TRIM(raw_vendor) <> '' AND canonical_vendor IS NULL
UNION ALL
-- Duplicated feeders whose copies disagree on a cleaned value.
SELECT
  source_row,
  std_feeder_id,
  'duplicate_values_disagree',
  'Duplicate rows for this feeder hold different cleaned values'
FROM (
  SELECT source_row, std_feeder_id
  FROM ROW_DB.STAGING.STG_PLAN_RESOLVED
  WHERE in_circuits
  QUALIFY COUNT(*)            OVER (PARTITION BY std_feeder_id) > 1
     AND (COUNT(DISTINCT last_cleared_date)          OVER (PARTITION BY std_feeder_id) > 1
       OR COUNT(DISTINCT next_clearing_date)         OVER (PARTITION BY std_feeder_id) > 1
       OR COUNT(DISTINCT next_clearing_certainty)    OVER (PARTITION BY std_feeder_id) > 1
       OR COUNT(DISTINCT canonical_vendor)           OVER (PARTITION BY std_feeder_id) > 1)
);

-- ---------------------------------------------------------------------
-- 8. Quick sanity checks (not the formal test - that is 05_staging_test.sql)
-- ---------------------------------------------------------------------
SELECT 'STG_CIRCUITS' AS object_name, COUNT(*) AS row_count FROM ROW_DB.STAGING.STG_CIRCUITS
UNION ALL SELECT 'STG_ROW_CLEARING_PLAN', COUNT(*) FROM ROW_DB.STAGING.STG_ROW_CLEARING_PLAN
UNION ALL SELECT 'STG_DQ_ISSUES',         COUNT(*) FROM ROW_DB.STAGING.STG_DQ_ISSUES
UNION ALL SELECT 'STG_DQ_REVIEW',         COUNT(*) FROM ROW_DB.STAGING.STG_DQ_REVIEW
ORDER BY object_name;
