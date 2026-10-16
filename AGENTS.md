# AGENTS.md: Fabric Apps POC, ROW clearing tracker

Shared instructions for any coding agent in this repo. Claude Code reads this
file through `CLAUDE.md`; GitHub Copilot CLI and VS Code Copilot read it
directly. Keep it current: it is the biggest single lever on output quality.
When an agent gets the same thing wrong twice, fix this file or the standards
skill, not just the output.

## What this repo is

A proof of concept showing that a BI team can build analytic apps safely with
Power BI, Snowflake and Fabric Apps, with an AI coding agent doing the build
and a human reviewing every change. Built on personal devices with synthetic
data only.

| Path | What's there |
|---|---|
| `snowflake/` | Numbered, re-runnable SQL scripts (`01_…` to `07_…`). A human runs them in Snowsight. |
| `data/` | Synthetic data generator; output goes to `data/out/` (gitignored) |
| `prompts/` | Every prompt given to the agent, plus session transcripts, kept as a record |
| `powerbi/row_pbi_poc.SemanticModel/` | Semantic model (TMDL) |
| `powerbi/row_pbi_poc.Report/` | Report (PBIR) |
| `themes/` | BrilliT brand tokens, theme builder, built theme, logo |
| `docs/` | Decisions, cleaning rules, requirements, POC log, run sheet |
| `tests/dax/` | DAX profiling and measure validation queries |
| `_brief/` | Report spec written by the report planner |
| `app/` | Fabric App (later phase) |

For Power BI, the agent takes the semantic model to a **draft** report. A
Power BI developer (me) reviews, adjusts and signs off.

## Hard rules (never break these)

- **Synthetic data only.** No real cooperative, client, person or employee
  names. No real addresses or account numbers.
- **Never push.** Work on a branch (`feat/…`, `fix/…`, `report/…`). The human
  pushes, opens the pull request and merges.
- **Never commit without approval.** After each completed step, propose the
  commit: the paths to stage, named explicitly (never `git add -A` or
  `git add .`), and the message. The human approves each commit.
- **Never use `--force`** with git or any CLI.
- **Never deploy or publish.** Only the dev workspace `ROW-POC-Dev` exists.
  Ask before any `npx rayfin up`, any Power BI management/publish mode, or any
  Fabric write API, and only when I ask in that session.
- **Never read or print secrets.** Don't open `.env*`, `*.p8`, `*.pem`,
  `secrets/`, or `~/.snowflake/`. Use placeholders in committed files.
- **No Snowflake access.** Write SQL; the human runs it in Snowsight.
- **Business logic lives in Snowflake or the semantic model**, not in report
  visuals or app code. Measures and definitions are written once and reused.
- When finished with a task: stop, show a short diff summary, and list how I
  can verify the result. Don't move on to the next task unasked.

## Data boundary: read first

This project runs only against dev environments that hold synthetic data.

Approved connection targets:

- Power BI Desktop with `powerbi/row_pbi_poc.pbip` open. It imports synthetic
  data from Snowflake `ROW_DB.ANALYTICS` through `ROLE_REPORTER`.
- Fabric workspace `ROW-POC-Dev`, only in a later phase and only when I ask.
- Snowflake: none for the agent (see the hard rules).

Rules:

- Never connect to, query or screenshot anything not on the list above. If a
  target isn't listed, stop and ask.
- Don't copy data values into commits, docs or PR descriptions beyond what a
  decision needs. Synthetic data is fine; keep the habit anyway.
- The Microsoft report skill samples rows and screenshots pages by design.
  That is safe here only because the data is synthetic.

## Stack

- Snowflake (Azure East US 2), database `ROW_DB`: schemas RAW, STAGING,
  ANALYTICS, APP_SYNC. Warehouses `WH_TRANSFORM_XS`, `WH_REPORTING_XS`.
- Roles: `ROLE_LOADER` writes RAW; `ROLE_BI_DEVELOPER` builds STAGING and
  ANALYTICS; `ROLE_REPORTER` reads ANALYTICS (Power BI, through the
  `SVC_POWERBI` key-pair user); `ROLE_APP_SYNC` writes APP_SYNC.
- Power BI: PBIP with TMDL and PBIR. Server and warehouse are the Power Query
  parameters `Snowflake_Server` and `WH`. No credentials in the PBIP.
- Fabric Apps: Rayfin SDK/CLI, TypeScript. Dev workspace `ROW-POC-Dev`.
- Python 3.12 in a local `.venv`; dependencies pinned in `requirements.txt`.
- Windows; prefer commands that work in both PowerShell and Git Bash.
- Coding agent: Claude Code for this POC; at work the same workflow runs on
  GitHub Copilot CLI. Keep it portable: rules live in this file, real
  enforcement lives in GitHub (branch rulesets, pull request review, secret
  scanning), and nothing the workflow depends on should need a Claude-only
  feature.

## Domain

Right-of-way (vegetation) clearing tracker for an electric cooperative's
distribution feeders, replacing an error-prone shared Excel tracker: which
feeders are due for clearing and when, how firm that date is, which vendor
does the work, and when each feeder was last cleared. All data is synthetic.

- Two source datasets joined on `FEEDER_ID` (`substation_num-circuit_num`):
  circuit details (clean, system of record) and the clearing plan (the messy
  spreadsheet, one row per feeder).
- The spreadsheet's problems are the point of the POC: text in date columns
  ("Next Year", "10/20/2027 - TBD"), free-typed vendor names, duplicate and
  mistyped feeder IDs. Snowflake STAGING cleans them; all 69 planted problems
  are caught. `FACT_DQ_ISSUE` logs each one (raw vs clean value, by source
  column).
- Clean target: a real date plus a date certainty (confirmed, tentative, next
  year, TBD) and an optional planned year; vendors mapped to one canonical list.
- Primary audience: vegetation management lead, district managers, operations
  leadership.
- Decisions the report supports: which feeders are overdue or due soon and who
  owns them; how firm the clearing plan is; where the source data was unreliable.

Business definitions (decided):

- "Today" is `TODAY()`.
- **Overdue:** `NEXT_CLEARING_DATE` before today, counting only feeders with a
  real date (certainty confirmed or tentative).

## Model map

| Table | Role | Keys and notes |
|---|---|---|
| `FACT_ROW_PLAN` | Fact: clearing plan | `FEEDER_ID` → DIM_CIRCUIT, `VENDOR_ID` → DIM_VENDOR, `DATE_CERTAINTY` → DIM_DATE_CERTAINTY. Dates: `LAST_CLEARED_DATE`, `NEXT_CLEARING_DATE`. Also `PLANNED_YEAR`, `LAST_WORK_DONE`, `NOTES`, `DQ_ISSUE_COUNT`. Expected grain: one row per feeder (confirm in R1). |
| `FACT_DQ_ISSUE` | Fact: data-quality issues, one row per issue | `FEEDER_ID` → DIM_CIRCUIT (2 orphan feeders have no match, by design). `ISSUE_TYPE`, `SOURCE_COLUMN`, `RAW_VALUE`, `CLEAN_VALUE`. |
| `DIM_CIRCUIT` | Dimension: feeder / circuit | `FEEDER_ID` (one side). `CIRCUIT_NAME`, `CIRCUIT_NUM`, `SUBSTATION_NAME`, `SUBSTATION_NUM`, `LINE_MILES`, `RESPONSIBLE_DISTRICT_ID` → DIM_DISTRICT, `RESPONSIBLE_DISTRICT_NAME` (duplicates DIM_DISTRICT). |
| `DIM_DISTRICT` | Dimension | `DISTRICT_ID`, `DISTRICT_NAME`. Snowflaked off DIM_CIRCUIT. |
| `DIM_VENDOR` | Dimension | `VENDOR_ID`, `VENDOR_NAME`, `VENDOR_TYPE`. |
| `DIM_DATE_CERTAINTY` | Dimension | `DATE_CERTAINTY`, `SORT_ORDER` (use as sort-by column). |
| `@Measures` | Measure table | All measures live here. Leave the placeholder `Ex_Measure` alone. |

Target: every relationship one-to-many, single direction. Filter paths:
DIM_DISTRICT → DIM_CIRCUIT → FACT_ROW_PLAN and FACT_DQ_ISSUE; DIM_VENDOR and
DIM_DATE_CERTAINTY → FACT_ROW_PLAN. Known gap: `FACT_ROW_PLAN` ↔ `DIM_CIRCUIT`
was created one-to-one, both directions (both sides have 153 unique feeders).
Raise it in R1; don't change it without asking.

Table and column names stay as they are (`DIM_` / `FACT_` naming).

## Open model questions: resolve in R1, before writing measures

Run `tests/dax/00_profile.dax` and record the answers in `docs/decisions.md`.
The expected answers come from the Snowflake build; confirm them, don't assume.

1. **Grain of FACT_ROW_PLAN.** Expected: one row per feeder, 153 rows.
   `LINE_MILES` lives on DIM_CIRCUIT, so miles measures must count each feeder
   once and still respond to vendor and certainty filters.
2. **No date table.** Propose `DIM_DATE` (following the `DIM_` naming),
   related to `NEXT_CLEARING_DATE` (active) and `LAST_CLEARED_DATE`
   (inactive), with auto date/time off.
3. **Two DQ counts.** Expected: 69 rows in FACT_DQ_ISSUE, 2 of them orphan
   feeders that aren't in the plan, so `SUM(FACT_ROW_PLAN[DQ_ISSUE_COUNT])`
   should be 67. Which one the report uses is my decision.
4. **District duplication.** `DIM_CIRCUIT[RESPONSIBLE_DISTRICT_NAME]` vs
   `DIM_DISTRICT[DISTRICT_NAME]`: the report uses one; hide the other.

## Model conventions

### Measures
- Home table `@Measures`. Every measure has a description, a format string
  and a display folder.
- Display folders: `00 - Base`, `10 - Plan`, `20 - Clearing Cycle`,
  `30 - Vendors`, `40 - Data Quality`, `90 - Helpers` (hidden helpers only).
- Names: Title Case with spaces, unit in the name where it helps
  (`Line Miles in Plan`, `% Feeders Overdue`).
- Base measures first (`00 - Base`); everything else builds on them.
- DAX: `VAR`/`RETURN` beyond one expression; `DIVIDE` instead of `/`; column
  predicates instead of `FILTER` over a whole table where possible; no
  implicit measures: visuals never use auto-summed columns.

### Columns
- Hide foreign keys on fact tables and technical columns the report shouldn't
  show.
- `SummarizeBy = None` on IDs, codes and years (`CIRCUIT_NUM`,
  `SUBSTATION_NUM`, `PLANNED_YEAR`, `SORT_ORDER`).
- Sort `DATE_CERTAINTY` by `SORT_ORDER`.
- Any rename happens **before** report authoring, because PBIR binds visuals
  by name.

## Report standards

Report design follows the **`brillit-report-standards`** skill
(`.claude/skills/brillit-report-standards/`): page framework, KPI cards,
visual choices, color and shading, navigation and bookmarks, theme. Load it
whenever the Power BI report skill is in planning, design or authoring mode.
Where it conflicts with Microsoft's generic design guidance, the standards
skill wins; Microsoft's authoring mechanics, validation and approval gates
always apply.

Brand: BrilliT house brand. Tokens in `themes/brand-tokens.json`, theme
`themes/BrilliT-<hash>.json` (rebuild with `node themes/build-theme.mjs`),
logo `themes/assets/brillit-logo.png`.

## Which tool for which layer

| Layer | Tool |
|---|---|
| Semantic model: tables, columns, measures, DAX validation | Power BI Authoring MCP server (from the `powerbi-authoring` plugin), through the `semantic-model-authoring` skill |
| Report: plan, design, author, validate, preview | `powerbi-report-cli` skill (planning → design → authoring → management) and the `powerbi-report-author` CLI |
| House design standards | `brillit-report-standards` skill |
| Publishing to Fabric | `powerbi-report-cli` management mode: **only when I ask** |

The report spec lives in `_brief/report-spec.md`.

## Guardrails for Power BI work

- Before editing PBIR or TMDL, check Desktop with
  `powerbi-report-author preview "powerbi/row_pbi_poc.Report" --host desktop --status`.
  If it shows unsaved changes, stop and ask me to save: the files on disk are
  the source of truth.
- Don't edit `.tmdl` files directly while Desktop has the project open; model
  changes go through the MCP server.
- Model changes made through the MCP server exist only in Desktop until saved.
  After a model change, ask me to save, then show me the TMDL `git diff`.
- Follow the report skill's completion loop on every report change:
  `validate` → reload → screenshot every affected page → review → fix.
- Do **not** change relationships, Power Query / partitions, parameters, data
  sources, refresh settings or RLS without asking. Don't refresh data.
- Do **not** delete or rename existing measures, columns or tables without
  asking.
- When a business definition is ambiguous, ask rather than guess, and record
  the answer in `docs/decisions.md`.
- Every new measure gets a validation query in `tests/dax/` and a recorded
  result.
- Record each step's time and the human fixes it needed in `docs/poc-log.md`.

## Definition of done (agent draft → developer review)

- `powerbi-report-author validate` passes.
- Every page is screenshotted and reviewed, plus one independent reviewer pass;
  agent-fixable findings are resolved.
- Every measure has a description, format string, display folder, and a
  validation query with its result.
- `docs/decisions.md` lists every assumption and decision.
- The PR description covers what was built, the measure list with business
  definitions, open questions and known gaps.
