# Report requirements: ROW Clearing Plan

Input for the report planner (R3); it only asks about the gaps. *Proposed*
items came from reading the model and still need confirmation; *decided* items
are settled (see `docs/decisions.md`). The report is built on the synthetic
dev model; definitions must hold for real data too.

## Audience and purpose

- Primary audience (*proposed*): vegetation management lead, district
  managers, operations leadership.
- Decisions this report supports: which feeders are overdue or due soon and who
  owns them; how firm the clearing plan is; where the source spreadsheet was
  unreliable.
- How it's consumed: Power BI Desktop for the POC; later a Power BI report in
  the `ROW-POC-Dev` workspace, alongside the Fabric App that replaces the
  spreadsheet.
- Refresh: Import from Snowflake `ROW_DB.ANALYTICS`, refreshed by hand for the
  POC (the synthetic data is static). A later phase adds DirectQuery to the
  app's data so edits show within a minute.

## Questions the report must answer (*proposed*)

1. How many feeders and line miles are in the plan, by district and certainty?
2. Which feeders are overdue or due soon for clearing, and which vendor has
   them?
3. How firm is the schedule (date-certainty mix)?
4. How is the work split across vendors and districts?
5. Where were the data-quality problems in the source spreadsheet, and which
   feeders do they affect?

## KPIs and measure definitions

| Measure | Business definition | Folder | Status |
|---|---|---|---|
| Feeders in Plan | Distinct feeders with a plan row in the current filter context | 10 - Plan | *proposed* |
| Line Miles in Plan | LINE_MILES of feeders in the plan, each feeder counted once; responds to vendor and certainty filters | 10 - Plan | *proposed*; depends on R1 grain check |
| % Plan Date Confirmed | Feeders with certainty "confirmed" ÷ Feeders in Plan | 10 - Plan | *proposed*: confirmed only |
| Feeders Next Year | Feeders with certainty "next year" | 10 - Plan | *proposed* |
| Feeders TBD | Feeders with certainty "TBD" | 10 - Plan | *proposed* |
| Feeders Overdue | NEXT_CLEARING_DATE before today; confirmed or tentative only | 20 - Clearing Cycle | *decided* |
| Line Miles Overdue | Line miles on overdue feeders | 20 - Clearing Cycle | *decided* (follows Feeders Overdue) |
| Feeders Due Soon | NEXT_CLEARING_DATE from today through the window | 20 - Clearing Cycle | *proposed*: 90 days |
| Avg Years Since Last Clearing | Average years from LAST_CLEARED_DATE to today, per feeder, blanks excluded | 20 - Clearing Cycle | *proposed* |
| Feeders Not Cleared 5+ Years | LAST_CLEARED_DATE more than 5 years before today; blanks counted separately | 20 - Clearing Cycle | *proposed* |
| Line Miles by Vendor | Line Miles in Plan sliced by vendor (reuses the base measure) | 30 - Vendors | *proposed* |
| DQ Issues | Count of data-quality issues | 40 - Data Quality | Decide in R1: FACT_DQ_ISSUE rows (69, incl. 2 orphans) or SUM of DQ_ISSUE_COUNT (expected 67) |
| Feeders with DQ Issues | Distinct feeders in the plan with at least one issue | 40 - Data Quality | *proposed* |
| % Feeders with DQ Issues | Feeders with DQ Issues ÷ Feeders in Plan | 40 - Data Quality | *proposed* |
| Orphans to Review | Issues of type `orphan_feeder` (feeders in the spreadsheet with no matching circuit) | 40 - Data Quality | *proposed* |

"Today" is `TODAY()` (*decided*).

## Pages

The four content pages are *decided* for the prototype; the standards may add
the drillthrough and About pages (confirm in R3).

1. **Plan Overview:** KPI cards; next clearings by month, stacked by
   certainty; feeders by district.
2. **Clearing Plan:** overdue and due-soon feeders; one row per feeder with
   district, vendor, last cleared, next clearing, certainty and notes;
   overdue rows highlighted.
3. **Vendors and Districts:** workload (feeders, line miles) by vendor and
   vendor type; district by certainty.
4. **Data Quality:** issues by type and source column; raw vs clean values;
   affected feeders; orphans to review. This page is the "before and after"
   in the recording.
5. **Feeder Detail** (drillthrough, *proposed by the standards*): one feeder's
   circuit, substation, district, plan, last work done, notes and DQ issues.

## Filters and slicers

- Global (*proposed*): District, Vendor, Date Certainty.
- Page-specific: Clearing Plan adds an Overdue / Due Soon toggle.

## Look and feel

Defaults come from the `brillit-report-standards` skill (page framework, KPI
cards, navigation, bookmarks, color and shading). Only what differs is noted
here.

- Brand: BrilliT house brand (tokens in `themes/brand-tokens.json`)
- Logo file: `themes/assets/brillit-logo.png`
- Navigation: page navigator (standard)
- Density: overview pages for leadership, one detail page for analysts
- Deviations from the standards, and why: none yet

## Out of scope

- Write-back (a later phase: User Data Function and `DataFunction` button)
- Row-level security, mobile layout, publishing
