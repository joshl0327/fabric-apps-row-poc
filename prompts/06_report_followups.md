# Prompt 06: report follow-ups (data coverage, Unassigned vendor, display names)

Given to Claude Code on branch `fix/report-followups`. Kept here as a record of
exactly what the agent was asked to do.

---

Read `AGENTS.md` and `docs/decisions.md` first and follow them. Report v1 is
merged. Power BI Desktop is the source of truth for the report:
`powerbi/build-report.mjs` is a record of the v1 build and must not be rerun.

This task has **two parts with one checkpoint** between them. Between the
checkpoint and the end, keep going without asking.

## Why

1. The synthetic data never drew "Next Year" or a "date - TBD" value for
   Next Clearing, so the report shows Feeders Next Year = 0 and the two
   examples from the ops team never appear. Fix the generator so every text
   pattern appears.
2. No feeder was last cleared more than 5 years ago, so Feeders Not Cleared
   5+ Years = 0. Add a few.
3. Four feeders have no vendor and show as "(Blank)". Show them as
   "Unassigned", decided in Snowflake (business logic lives there).
4. Table visuals show the model's ALL-CAPS column names. Give them friendly
   names on the visuals only. Model names stay as they are (decided).

## Part A: data and SQL (no Power BI changes)

1. `data/generate.py`:
   - The 12 non-date injections keep the same rows and the same split
     between Next Clearing and Last Cleared. Only the text values change:
     assign them by cycling through every pattern ("Next Year",
     "<date> - TBD", "TBD", "Q3 <year>", "Spring <year>", "per vendor",
     "<year>?"), so each Next Clearing pattern appears at least once.
   - Make 3 to 5 feeders' true last-cleared date 6 to 8 years before
     `--as-of`.
   - Use a separate random generator, or a fixed cycle, for these changes, so
     every other draw stays the same. **Every issue-type count must stay
     identical**: non_date 12, date_format 5, blank 7, vendor_variant 38,
     duplicate_feeder 2, orphan_feeder 2, feeder_format 3 (69 in total).
     Circuits, districts and vendors are unchanged.
   - Still deterministic with `--seed 42 --as-of 2026-10-14`.
2. `snowflake/06_analytics_views.sql`:
   - Add an "Unassigned" member to `DIM_VENDOR` (vendor_id 0, vendor_type
     "unassigned").
   - In `FACT_ROW_PLAN`, map a missing vendor to 0. STAGING and the DQ
     issue records don't change: the blank is still logged as a data quality
     issue.
3. Update the docs that state counts or rules affected by this: `DIM_VENDOR`
   becomes 7 rows; `docs/cleaning-rules.md` gets one line about Unassigned.
4. Run the generator twice to confirm it's deterministic, and print the issue
   counts by type.

**CHECKPOINT:** stop. Give me the issue counts (they must match the list
above), a short diff summary, and the exact steps for me to reload Snowflake
and refresh Power BI. Propose one commit for Part A. Wait until I confirm
the reload and refresh are done.

## Part B: model results and report (after I confirm)

1. Through the MCP server, re-run every query in `tests/dax/10_measures.dax`
   and update the recorded results. Update `docs/measures.md` to match.
   Expect Feeders Next Year > 0 and Feeders Not Cleared 5+ Years > 0;
   Feeders in Plan 153, DQ Issues 69 and Orphans to Review 2 unchanged.
2. Report, with the powerbi-report-cli skill in authoring mode (edit the PBIR
   files; first check that Desktop has no unsaved changes):
   - On every table and matrix visual, set a display name for each field,
     e.g. `FEEDER_ID` → "Feeder", `RAW_VALUE` → "Raw value",
     `NEXT_CLEARING_DATE` → "Next clearing". Visual-level names only; no
     model renames.
   - Confirm "Unassigned" appears wherever vendors are listed.
   - For each changed page, run the full validate → reload → screenshot →
     review loop.
3. Add a row to `docs/decisions.md` for the Unassigned vendor, and a row to
   `docs/poc-log.md` for this task (agent time; leave review time blank).

## When done

Stop and give me: what changed, the updated measure results, validation
status, the pages you changed, and the proposed commits with the paths to
stage.

## Do not

- Rerun `powerbi/build-report.mjs`.
- Change relationships, Power Query, partitions, parameters or data sources,
  or refresh data (I refresh).
- Rename or delete model tables, columns or measures.
- Change any issue-type count or the circuits, districts or vendors.
- Publish, push or open a pull request.
