# Handoff: AI-assisted Power BI report generation → Fabric Apps POC

Context to add to the Fabric Apps POC project. It carries the lessons from a separate working session on AI-assisted Power BI development into the POC's next step: generating the Power BI report from the existing PBIP (ROW clearing tracker, synthetic data, semantic model already built).

---

## Status (2026-10-15)

- The kit is merged into the POC repo on branch `report/v1-poc`. `AGENTS.md` now carries the POC's hard rules (never push, commit only with approval, synthetic data only, no Snowflake access for the agent) alongside the kit's Power BI guidance; `CLAUDE.md` imports it; `.claude/settings.json` merges the kit's plugin settings with the POC's allow / ask / deny lists.
- BrilliT brand and standards are OK in the public repo (internal demo, synthetic data). `docs/ai-governance-options.md` stays out (gitignored).
- The PBIP is on `main` under `powerbi/` (`row_pbi_poc`). The `powerbi-authoring` plugin and its MCP server are installed in Claude Code; the old user-level MCP entry is removed.
- The run sheet (`docs/poc-run-sheet.md`) and phases below are adapted to this repo. Expected answers to the open model questions (from the Snowflake build) are in `AGENTS.md`.

## What already exists

- **PBIP** with the semantic model: `FACT_ROW_PLAN`, `FACT_DQ_ISSUE`, `DIM_CIRCUIT`, `DIM_DISTRICT`, `DIM_VENDOR`, `DIM_DATE_CERTAINTY`, an `@Measures` table with a `00 - Base` folder and one placeholder measure. Synthetic data.
- **Starter kit** (`pbi-ai-starter.zip`) to drop into the repo root:
  - `AGENTS.md` / `CLAUDE.md` — project instructions, data boundary, model map, guardrails
  - `.claude/skills/brillit-report-standards/` — BrilliT report standards (page framework, visuals, KPI cards, color, navigation, bookmarks, write-back buttons, checklist)
  - `themes/` — BrilliT brand tokens from brillit.com (navy `#002f6e`, logo blue `#015a9c`, green `#00c18c`, Arial), theme builder, validated theme file, logo
  - `.claude/agents/pbi-report-reviewer.md` — independent reviewer
  - `docs/` — workflow, run sheet with exact prompts, POC log, requirements, decisions, template preview image
  - `tests/dax/00_profile.dax` — model profiling queries

## Tooling (as of Oct 2026)

| Piece | What it is |
|---|---|
| `powerbi-authoring` plugin | Microsoft's plugin from the `microsoft/skills-for-fabric` marketplace. Install: `/plugin marketplace add microsoft/skills-for-fabric`, then `/plugin install powerbi-authoring@fabric-collection` (same commands with `copilot plugin` in Copilot CLI) |
| `semantic-model-authoring` skill | Model and DAX work |
| `powerbi-report-cli` skill | One skill, four modes: planning → design → authoring → management (publish). Planning writes `_brief/report-spec.md` and stops for approval |
| Power BI Authoring MCP server | Bundled with the plugin (local, `@microsoft/powerbi-modeling-mcp`). Register it once — not also via the VS Code extension or `claude mcp add` |
| `powerbi-report-author` CLI | `npm install -g @microsoft/powerbi-report-authoring-cli@latest`. Validates PBIR, inspects visual properties, drives Desktop preview and screenshots. `powerbi-report-author doctor` checks setup |

Runs on Windows with Power BI Desktop open; run the agent natively (not WSL).

## Lessons learned

1. **The report layer only works on PBIP with PBIR** (and TMDL for the model). Save in Desktop before every agent turn: the files on disk are the source of truth, and the skill refuses to reload over unsaved changes.
2. **Settle the model before the report.** PBIR binds visuals by table/column name, so renames after the report exists break visuals. Open questions here: grain of `FACT_ROW_PLAN` (line miles live on `DIM_CIRCUIT`, so miles can double-count), no date table, two data-quality counts, duplicated district name.
3. **The planning gate is real.** The skill asks a few questions, writes the spec and stops. Review the spec like a contract (pages, layout regions, the measure behind every visual), then approve.
4. **Build one page per turn**, with the skill's loop: validate → reload Desktop → screenshot → review → fix. Then an independent reviewer pass (fresh context) before a PR.
5. **The skill reads data on purpose.** Design mode samples rows from every table; authoring requires screenshots of every changed page. Fine on synthetic data — and the reason BrilliT's proposal is fake-data dev environments for any real use.
6. **Layer your standards; don't edit Microsoft's plugin.** It updates itself and pulls `@latest` on every run. House standards live in a project skill (Claude Code and Copilot CLI both load `.claude/skills/`), mapped onto the fields of Microsoft's design brief; brand lives in a tokens file that builds the theme.
7. **Microsoft's base theme fails Microsoft's validator** (CLI 0.5.0) on three card properties, and a theme's `name` must match its file name. `themes/build-theme.mjs` handles both; its output validates with 0 errors.
8. **The web green fails contrast on white** (2.33:1). The standards use it for accents only, and a darker green (`#007f5b`) for any green text. Green on the navy band is fine.
9. **Write-back is supported.** Authoring mode can build a `DataFunction` button that calls a Fabric User Data Function (translytical task flow) — but it needs the UDF published first (workspace ID, item ID, function name, parameters). Treat it as its own phase after the report and the UDF exist.
10. **Keep one MCP registration per client**, and pin tool versions for anything beyond a POC.

## For this POC specifically

- **Public repo.** `docs/ai-governance-options.md` stays out of it (BrilliT-internal; gitignored). BrilliT's brand and standards are OK here (decided 2026-10-15: internal demo, synthetic data). No credentials in the PBIP: the Snowflake server and warehouse are Power Query parameters; the trial host name is committed by decision.
- **Comparison story.** The generated report is the "Power BI" option in the Excel / Power BI / paginated / translytical / Streamlit / Fabric Apps comparison. Record time and human fixes per step in `docs/poc-log.md` — that becomes the findings summary and the talking points for the recording.
- **Fabric trial.** Build and validate locally first. Publish to the trial workspace only with explicit approval (management mode), then use that workspace for the UDF and write-back phase.

## Phase plan for "Generate the Power BI report"

One phase at a time; each has a clear done check.

| Phase | Do | Done when |
|---|---|---|
| R0 — Setup | Kit into repo, branch `report/v1-poc`, plugin + CLI installed, theme built | `/skills` and `/mcp` show the right items (one Power BI server); `powerbi-report-author doctor` passes; theme file builds |
| R1 — Profile and fix the model | Run `00_profile.dax`; decide grain, date table, DQ count, district source; apply fixes | `docs/decisions.md` answers all four; TMDL diff reviewed and committed |
| R2 — Measures | Build the measures the pages need, each with a validation query | Every measure has a description, format, folder and a checked result against the synthetic source |
| R3 — Spec | Planning mode with requirements + standards | `_brief/report-spec.md` approved and committed |
| R4 — Build | Page by page with the validate → screenshot loop; reviewer pass | `validate` passes; every page reviewed; PR open |
| R5 — Findings | Fill `docs/poc-log.md`; capture screenshots for the recording | Log complete; findings ready for the summary |
| Later — Write-back | Publish UDF to the trial workspace; add the `DataFunction` button | Button updates Snowflake (synthetic) and the report shows the change |

Exact prompts for R0–R4 are in `docs/poc-run-sheet.md`.

## Kickoff prompt for the Fabric Apps POC project

> I've attached a handoff from a separate session on AI-assisted Power BI development and the starter kit it produced. We're on the step "Generate the Power BI report" for the Fabric Apps POC, using the PBIP that already has the semantic model. Read the handoff, then walk me through phase R0 only: what to install and verify, and what "done" looks like. We'll confirm each phase before moving on.
