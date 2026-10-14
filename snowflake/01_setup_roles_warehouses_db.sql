-- =====================================================================
-- Fabric Apps POC - Snowflake setup (Phase 1, step 1)
-- Run in a Snowsight worksheet as ACCOUNTADMIN. Safe to re-run.
-- Mirrors the work pattern: per-purpose roles, each role allowed only
-- the warehouses and schemas it needs, plus a hard credit cap.
-- Synthetic data only. Never put real work data in this account.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Confirm where we are (expect AZURE_EASTUS2)
-- ---------------------------------------------------------------------
USE ROLE ACCOUNTADMIN;
SELECT CURRENT_ACCOUNT(), CURRENT_REGION(), CURRENT_USER();

-- ---------------------------------------------------------------------
-- 1. Cost guardrail: monthly credit cap for every POC warehouse
--    20 credits/month; email at 50% and 80%; suspend at 100%.
-- ---------------------------------------------------------------------
CREATE RESOURCE MONITOR IF NOT EXISTS RM_POC_MONTHLY
  WITH CREDIT_QUOTA = 20
       FREQUENCY = MONTHLY
       START_TIMESTAMP = IMMEDIATELY
       TRIGGERS ON 50 PERCENT DO NOTIFY
                ON 80 PERCENT DO NOTIFY
                ON 100 PERCENT DO SUSPEND;

-- ---------------------------------------------------------------------
-- 2. Warehouses: X-Small, suspend after 60 seconds idle
--    WH_TRANSFORM_XS = loads and transforms (like ADF + dbt at work)
--    WH_REPORTING_XS = Power BI and app sync
-- ---------------------------------------------------------------------
USE ROLE SYSADMIN;

CREATE WAREHOUSE IF NOT EXISTS WH_TRANSFORM_XS
  WITH WAREHOUSE_SIZE = 'XSMALL'
       AUTO_SUSPEND = 60
       AUTO_RESUME = TRUE
       INITIALLY_SUSPENDED = TRUE
       COMMENT = 'POC: loads and transforms';

CREATE WAREHOUSE IF NOT EXISTS WH_REPORTING_XS
  WITH WAREHOUSE_SIZE = 'XSMALL'
       AUTO_SUSPEND = 60
       AUTO_RESUME = TRUE
       INITIALLY_SUSPENDED = TRUE
       COMMENT = 'POC: Power BI queries and app sync';

USE ROLE ACCOUNTADMIN;
ALTER WAREHOUSE WH_TRANSFORM_XS SET RESOURCE_MONITOR = RM_POC_MONTHLY;
ALTER WAREHOUSE WH_REPORTING_XS SET RESOURCE_MONITOR = RM_POC_MONTHLY;

-- ---------------------------------------------------------------------
-- 3. Database and schemas
--    RAW       = landing zone (synthetic extracts, the messy Excel)
--    STAGING   = cleaned and typed
--    ANALYTICS = dimensions and facts that Power BI reads
--    APP_SYNC  = data coming back from the Fabric App (Phase 4)
-- ---------------------------------------------------------------------
USE ROLE SYSADMIN;

CREATE DATABASE IF NOT EXISTS ROW_DB
  COMMENT = 'Fabric Apps POC: synthetic right-of-way clearing data';
CREATE SCHEMA IF NOT EXISTS ROW_DB.RAW       COMMENT = 'Landing zone';
CREATE SCHEMA IF NOT EXISTS ROW_DB.STAGING   COMMENT = 'Cleaned and typed';
CREATE SCHEMA IF NOT EXISTS ROW_DB.ANALYTICS COMMENT = 'Model-ready dims and facts for Power BI';
CREATE SCHEMA IF NOT EXISTS ROW_DB.APP_SYNC  COMMENT = 'Records synced back from the Fabric App';

-- ---------------------------------------------------------------------
-- 4. Functional roles (mirrors per-purpose roles at work)
-- ---------------------------------------------------------------------
USE ROLE USERADMIN;

CREATE ROLE IF NOT EXISTS ROLE_LOADER       COMMENT = 'Ingestion identity (like ADF): writes RAW only';
CREATE ROLE IF NOT EXISTS ROLE_BI_DEVELOPER COMMENT = 'Reads RAW and APP_SYNC; builds STAGING and ANALYTICS';
CREATE ROLE IF NOT EXISTS ROLE_REPORTER     COMMENT = 'Read-only ANALYTICS for Power BI';
CREATE ROLE IF NOT EXISTS ROLE_APP_SYNC     COMMENT = 'Writes APP_SYNC only (Fabric App data coming back)';

-- ---------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------
USE ROLE SECURITYADMIN;

-- Roll every custom role up to SYSADMIN (Snowflake best practice)
GRANT ROLE ROLE_LOADER       TO ROLE SYSADMIN;
GRANT ROLE ROLE_BI_DEVELOPER TO ROLE SYSADMIN;
GRANT ROLE ROLE_REPORTER     TO ROLE SYSADMIN;
GRANT ROLE ROLE_APP_SYNC     TO ROLE SYSADMIN;

-- Warehouse access: each role only gets the warehouse it needs
GRANT USAGE ON WAREHOUSE WH_TRANSFORM_XS TO ROLE ROLE_LOADER;
GRANT USAGE ON WAREHOUSE WH_TRANSFORM_XS TO ROLE ROLE_BI_DEVELOPER;
GRANT USAGE ON WAREHOUSE WH_REPORTING_XS TO ROLE ROLE_BI_DEVELOPER;  -- to test what reports see
GRANT USAGE ON WAREHOUSE WH_REPORTING_XS TO ROLE ROLE_REPORTER;
GRANT USAGE ON WAREHOUSE WH_REPORTING_XS TO ROLE ROLE_APP_SYNC;

-- Database usage for all four roles
GRANT USAGE ON DATABASE ROW_DB TO ROLE ROLE_LOADER;
GRANT USAGE ON DATABASE ROW_DB TO ROLE ROLE_BI_DEVELOPER;
GRANT USAGE ON DATABASE ROW_DB TO ROLE ROLE_REPORTER;
GRANT USAGE ON DATABASE ROW_DB TO ROLE ROLE_APP_SYNC;

-- LOADER: create and write tables, stages, and file formats in RAW
GRANT USAGE, CREATE TABLE, CREATE STAGE, CREATE FILE FORMAT
  ON SCHEMA ROW_DB.RAW TO ROLE ROLE_LOADER;

-- BI DEVELOPER: read RAW, build STAGING and ANALYTICS, read APP_SYNC
GRANT USAGE ON SCHEMA ROW_DB.RAW TO ROLE ROLE_BI_DEVELOPER;
GRANT SELECT ON ALL TABLES    IN SCHEMA ROW_DB.RAW TO ROLE ROLE_BI_DEVELOPER;
GRANT SELECT ON FUTURE TABLES IN SCHEMA ROW_DB.RAW TO ROLE ROLE_BI_DEVELOPER;
GRANT USAGE, CREATE TABLE, CREATE VIEW ON SCHEMA ROW_DB.STAGING   TO ROLE ROLE_BI_DEVELOPER;
GRANT USAGE, CREATE TABLE, CREATE VIEW ON SCHEMA ROW_DB.ANALYTICS TO ROLE ROLE_BI_DEVELOPER;
GRANT USAGE ON SCHEMA ROW_DB.APP_SYNC TO ROLE ROLE_BI_DEVELOPER;
GRANT SELECT ON ALL TABLES    IN SCHEMA ROW_DB.APP_SYNC TO ROLE ROLE_BI_DEVELOPER;
GRANT SELECT ON FUTURE TABLES IN SCHEMA ROW_DB.APP_SYNC TO ROLE ROLE_BI_DEVELOPER;

-- REPORTER: read-only on ANALYTICS, nothing else
GRANT USAGE ON SCHEMA ROW_DB.ANALYTICS TO ROLE ROLE_REPORTER;
GRANT SELECT ON ALL TABLES    IN SCHEMA ROW_DB.ANALYTICS TO ROLE ROLE_REPORTER;
GRANT SELECT ON FUTURE TABLES IN SCHEMA ROW_DB.ANALYTICS TO ROLE ROLE_REPORTER;
GRANT SELECT ON ALL VIEWS     IN SCHEMA ROW_DB.ANALYTICS TO ROLE ROLE_REPORTER;
GRANT SELECT ON FUTURE VIEWS  IN SCHEMA ROW_DB.ANALYTICS TO ROLE ROLE_REPORTER;

-- APP_SYNC: create and write tables in APP_SYNC only
GRANT USAGE, CREATE TABLE ON SCHEMA ROW_DB.APP_SYNC TO ROLE ROLE_APP_SYNC;

-- Give yourself every role so you can switch, like per-member roles at work
GRANT ROLE ROLE_LOADER       TO USER JLUGO;
GRANT ROLE ROLE_BI_DEVELOPER TO USER JLUGO;
GRANT ROLE ROLE_REPORTER     TO USER JLUGO;
GRANT ROLE ROLE_APP_SYNC     TO USER JLUGO;

-- ---------------------------------------------------------------------
-- 6. Day-to-day defaults: work as BI developer, not ACCOUNTADMIN
-- ---------------------------------------------------------------------
USE ROLE ACCOUNTADMIN;
ALTER USER JLUGO SET
  DEFAULT_ROLE = ROLE_BI_DEVELOPER
  DEFAULT_WAREHOUSE = WH_TRANSFORM_XS
  DEFAULT_NAMESPACE = ROW_DB.STAGING;

-- ---------------------------------------------------------------------
-- 7. Verify
-- ---------------------------------------------------------------------
SHOW RESOURCE MONITORS LIKE 'RM_POC%';
SHOW WAREHOUSES LIKE 'WH_%';
SHOW SCHEMAS IN DATABASE ROW_DB;
SHOW GRANTS TO USER JLUGO;

-- ---------------------------------------------------------------------
-- 8. Least-privilege check (run these lines one at a time, by hand)
--    Each should FAIL with an "insufficient privileges" or
--    "does not exist or not authorized" error. That's the point.
-- ---------------------------------------------------------------------
-- USE ROLE ROLE_REPORTER;
-- USE WAREHOUSE WH_TRANSFORM_XS;                  -- reporter can't use the transform warehouse
-- CREATE TABLE ROW_DB.ANALYTICS.SHOULD_FAIL (x INT); -- reporter can't create tables
-- USE ROLE ROLE_APP_SYNC;
-- SELECT * FROM ROW_DB.RAW.ANYTHING;              -- app sync can't see RAW
