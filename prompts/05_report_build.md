# Prompt 05: measures, report spec and report build (R2–R4)

Given to Claude Code on branch `report/v1-poc`, with Power BI Desktop open on
`powerbi/row_pbi_poc.pbip`. Kept here as a record of exactly what the agent
was asked to do.

---

Read `AGENTS.md`, `docs/decisions.md`, `docs/report-requirements.md` and
`docs/poc-run-sheet.md` first, and follow them. R0 and R1 are done.

This is one long run covering R2, R3 and R4. It has exactly **two checkpoints**
where you stop and wait for me. Between them, keep going without asking.

## Decisions already made (don't ask about these)

- **Feeders in Plan:** distinct feeders with a plan row.
- **Line Miles in Plan:** `DIM_CIRCUIT[LINE_MILES]` summed over `FACT_ROW_PLAN`
  rows (one row per feeder), so it responds to vendor and certainty filters.
- **% Plan Date Confirmed:** certainty "confirmed" only ÷ Feeders in Plan.
- **Overdue:** `NEXT_CLEARING_DATE` not blank, before `TODAY()`, certainty
  confirmed or tentative.
- **Due Soon:** `NEXT_CLEARING_DATE` from today through today + 90 days.
- **DQ Issues:** rows in `FACT_DQ_ISSUE` (69, including the 2 orphans).
  **Feeders with DQ Issues:** distinct feeders in the plan with at least one
  issue (orphans excluded). **% Feeders with DQ Issues:** ÷ Feeders in Plan.
  **Orphans to Review:** issues of type `orphan_feeder`.
- **Pages:** Plan Overview, Clearing Plan, Vendors and Districts, Data Quality,
  plus the Feeder Detail drillthrough. Add an About page only if the standards
  require it.
- **Global slicers:** District (`DIM_DISTRICT[DISTRICT_NAME]`), Vendor, Date
  Certainty.
- **Theme:** `themes/BrilliT-da2828ff.json`. **Delivery:** local PBIP only.

If something else is ambiguous, choose the most reasonable option, record it
in `docs/decisions.md` under a heading "Assumed during R2–R4 (to review)", and
continue. Only stop early if continuing would break a hard rule or the data
boundary in `AGENTS.md`.

## Part A: measures (R2), with the semantic-model-authoring skill

1. Build every measure in `docs/report-requirements.md` into `@Measures`,
   following the `AGENTS.md` conventions: base measures first, then the rest
   built on them; each with a description, format string and display folder.
2. Write `tests/dax/10_measures.dax`: one validation query per measure. Run
   each, and record the result as a comment under the query.
3. Run these checks and report them:
   - Feeders in Plan = 153.
   - DQ Issues = 69; Orphans to Review = 2.
   - Line Miles in Plan = `SUM(DIM_CIRCUIT[LINE_MILES])` with no filters.
   - Feeders by certainty add up to 153.
   - Feeders Overdue + Due Soon ≤ feeders with a next clearing date (142).
4. Set `DIM_CIRCUIT[LINE_MILES]` to don't summarize (best-practice item 3 from
   R1).
5. Write `docs/measures.md`: one table with folder, measure, plain-English
   definition, format and the checked result.

**CHECKPOINT 1:** stop and ask me to save in Desktop. After I confirm, show a
short TMDL diff summary and propose one commit for R2. Then continue straight
to Part B.

## Part B: report spec (R3), with the powerbi-report-cli skill in planning mode

Plan a new report from the local semantic model in `powerbi/`. Inputs:
`docs/report-requirements.md`, `AGENTS.md`, `docs/decisions.md`,
`docs/measures.md` and the `brillit-report-standards` skill. Treat the
standards as the design identity, page framework, navigation model and theme.
Answer the skill's questions yourself from the decisions above; ask me only
about a gap they don't cover. Write the locked spec to `_brief/report-spec.md`.

**CHECKPOINT 2:** stop for my approval. Give me a one-screen summary: each
page with its visuals and the measure behind each, the navigation model, and
any deviations from the standards. After I approve, propose one commit for the
spec, then continue straight to Part C without further stops.

## Part C: build (R4), with the powerbi-report-cli skill in authoring mode

1. Register `themes/BrilliT-da2828ff.json` as the report theme.
2. Build every page in the spec's order. For each page, run the full loop:
   validate → reload → screenshot → review against `references/checklist.md`
   in the standards skill → fix. Don't stop between pages. Keep a running
   list of anything you weren't sure about.
3. When all pages are built, capture retained screenshots of every page into
   `review/screenshots/`. Then have the `pbi-report-reviewer` subagent review
   the whole report. Fix the findings it marks agent-fixable, then re-validate
   and re-screenshot.
4. Fill in the R2, R3 and R4 rows of `docs/poc-log.md` with agent time (leave
   review time blank) and the tool versions you used.

## When done

Stop and give me:
- A summary per phase: what was built, check results, validation status.
- The reviewer's remaining findings (not agent-fixable), and your list of
  uncertainties and assumptions.
- What I should check first in Desktop.
- Proposed commits, in order: one per page, then one for the review fixes, the
  docs and the log. Name the paths to stage for each.
- A PR description I can paste: pages built, measure list with business
  definitions, decisions, open questions, known gaps.

## Do not

- Publish, deploy, or call Fabric write APIs. Delivery is local only.
- Change relationships, Power Query, partitions, parameters or data sources,
  or refresh data.
- Rename or delete existing tables, columns or measures.
- Edit `.tmdl` files directly while Desktop is open; model changes go through
  the MCP server.
- Push or open a pull request.
