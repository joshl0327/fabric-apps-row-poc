# POC log: AI-assisted report build

One row per step. This is the evidence for the findings summary and the
recording: what the agent did well, where a person had to step in, and how
long it took. Record agent time and review time separately.

| Date | Phase | Tool / model | Agent time (min) | Review time (min) | Result | Human fixes needed | Standards followed? | Notes |
|---|---|---|---|---|---|---|---|---|
| 2026-10-15 | R0. Setup | Claude Code 2.1.181 (Opus 4.8); powerbi-authoring plugin <version>, MCP server bundled (unpinned, pulls latest); powerbi-report-author 0.5.0; Node 24.20 | 0 | 10 | Pass: 1 Power BI MCP server, 3 skills loaded, doctor OK, Desktop bridge ready, theme builds | Report CLI installed separately (not bundled with the plugin); removed old user-level MCP entry; theme "modified" flag was line endings only | — | Kit merged with POC guardrails (AGENTS.md, CLAUDE.md, settings.json) |
| 2026-10-15 | R1. Profile and settle the model | Claude Code 2.1.181 (Opus 4.8); semantic-model-authoring skill + plugin MCP server | <profile + apply + diff, about 4.5 min for apply> | <minutes> | Pass: all profile results matched expectations; DIM_DATE added and marked, auto date/time off, column conventions, Int64 keys | Accepted MCP license by hand; turned off auto date/time by hand (MCP can't); session started on main (agent branched before committing); git branch tidy-up | — | BPA: LINE_MILES summarize → R2. Desktop save artifacts (report.json settings, diagramLayout.json) committed with the model |
| 2026-10-16 | R2. Measures | Claude Code (Opus 4.8); semantic-model-authoring skill + plugin MCP server; DAX validated via dax_query_operations | ~25 | | Pass: 15 measures built (Plan, Clearing Cycle, Vendors, Data Quality), each with description/format/folder; all step-3 checks pass (Feeders 153, DQ 69/orphans 2, Line Miles 4634.7, certainty sums 153, Overdue+Due Soon 24≤142) | None (definitions were pre-decided in prompt 05) | — | `tests/dax/10_measures.dax` + `docs/measures.md` written. `LINE_MILES` → don't summarize |
| 2026-10-16 | R3. Spec | Claude Code (Opus 4.8); powerbi-report-cli (planning) + brillit-report-standards | ~20 | | Pass: locked `_brief/report-spec.md` (6 pages, canonical Design Brief, passes acceptance checks); approved by Josh | None | yes | Sufficient-input fast path; 3 deviations recorded (KPI comparison, overdue status column, no tooltip) |
| 2026-10-16 | R4. Build (6 pages) | Claude Code (Opus 4.8); powerbi-report-cli (authoring) + powerbi-report-author 0.5.0; Node 24.20 generator | ~60 | | Pass: all 6 pages built via `powerbi/build-report.mjs`; `validate` clean (0 content errors); self-review loop fixed 3 items (legend/blank-month/labels on Overview, Back-button overlap) | Two Desktop reopens needed (live reload won't register wholesale page-set/ID changes); 2 helper measures added + saved | partial | 2 deferrals: Overdue/Due-soon bookmark toggle, dynamic drillthrough title. Theme + logo registered |
| 2026-10-16 | R4. Independent review | pbi-report-reviewer subagent | ~10 | | Verdict "close, not yet signed off": 1 blocker (no alt text) + majors (raw field-name subtitles). Agent fixed alt text, chart subtitles, About glossary; re-validated + re-screenshot | Reviewer ran as subagent; agent-fixable items resolved; hex-to-theme + status-cell background left for the developer | partial | Accepted: ALL-CAPS headers (naming decision), green KPI accent (house standard), "(Blank)" vendor (real data). See decisions.md |
| | R4. PR | | | | | | | Josh opens the PR (agent never pushes) |

## Observations

- What the agent got right without help:
- Where it needed correction (and whether a standards or AGENTS.md change fixed it for next time):
- Validation or tooling problems:
- Estimated time vs. building by hand:

## Changes made to the standards or AGENTS.md during the POC

-
