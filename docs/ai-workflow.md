# AI-assisted Power BI workflow: semantic model → draft report

The agent drafts on **fake data in a dev environment**; a Power BI developer promotes, vets on real data, and finishes. Each phase ends in a commit you can review or revert, and each prompt has a clear stopping point. Governance background is in an internal BrilliT discussion doc, kept out of this public repo.

```
Fake-data dev env ─► Context ─► Profile ─► Harden model ─► Measures ─► Plan (approve) ─► Build ─► Independent review ─► PR ─► Promote + vet on real data
                      AGENTS.md  00_profile   BPA pass      + DAX tests   _brief/report-spec  validate+reload  reviewer         hand-off   deployment pipeline
                                                                                              +screenshot      subagent
```

---

## One-time setup

### Machine
- Windows with a current Power BI Desktop. Run the agent natively on Windows, not WSL: Desktop preview uses a local named pipe, and the local Authoring MCP server doesn't run on macOS.
- Node.js 20+ (the report CLI needs it), Git, VS Code.
- Power BI Desktop → File → Options → Security → **Desktop Bridge**: external tool access enabled (on by default).

### Dev environment with fake data
- The PBIP's semantic model loads from a synthetic dataset with the same table and column names as the real source (Snowflake dev schema, Fabric dev lakehouse, or local files for a POC).
- Source server/database are Power Query parameters, so a deployment pipeline can switch them on promotion.
- List the approved connection targets in `AGENTS.md` → Data boundary.

### Project format
- PBIP with TMDL (`*.SemanticModel/definition/*.tmdl`) and PBIR (`*.Report/definition/pages/…`). The report skill doesn't support PBIR-Legacy.
- Copy this kit into the project root, `git init`, commit the untouched baseline, push to GitHub. Desktop writes its own `.gitignore`; add `review/screenshots/` to it.

### Claude Code (home)
```text
/plugin marketplace add microsoft/skills-for-fabric
/plugin install powerbi-authoring@fabric-collection
```
Quit and restart. `/skills` should list `powerbi-authoring:powerbi-report-cli`, `powerbi-authoring:semantic-model-authoring` and the project skill `brillit-report-standards`; `/mcp` should show `plugin:powerbi-authoring:powerbi-modeling-mcp` connected and no second copy.

### GitHub Copilot CLI (work)
```bash
copilot plugin marketplace add microsoft/skills-for-fabric
copilot plugin install powerbi-authoring@fabric-collection
```
Restart, then `/skills` and `/mcp show`. Copilot reads `AGENTS.md` and loads project skills from `.claude/skills/` (also `.github/skills/` and `.agents/skills/`). On enterprise accounts an admin may need to enable Copilot CLI and **MCP servers in Copilot**.

### Report authoring CLI
```bash
npm install -g @microsoft/powerbi-report-authoring-cli@latest
powerbi-report-author --version
powerbi-report-author doctor
```
`powerbi-report-author` validates PBIR, inspects visual roles and formatting properties, and drives Desktop preview (open, reload, screenshot). The skill uses it for everything; you only install it.

### VS Code extensions
- Claude Code (home) / GitHub Copilot Chat (work)
- TMDL — readable diffs of model changes
- GitHub Pull Requests — review agent branches without leaving VS Code
- Not the standalone Power BI Authoring MCP extension when the plugin is installed — one registration per client.

---

## Phase 0 — Context and profiling · branch `setup`

1. Fill in the `<!-- -->` blanks in `AGENTS.md` (data boundary, audience, client brand) and as much of `docs/report-requirements.md` as you can.
2. Open the .pbip in Desktop (fake-data source), start the agent in the repo folder:
   ```
   /semantic-model-authoring Connect to the semantic model open in Power BI Desktop. List tables, relationships and measures. Change nothing.
   ```
3. ```
   Run each query in tests/dax/00_profile.dax. Explain what the results say about the grain of FACT_ROW_PLAN, the two DQ counts, district names, and missing keys or dates. Write the findings into docs/decisions.md. Change nothing in the model.
   ```
4. Answer the open model questions in `AGENTS.md`. Commit.

## Phase 1 — Harden the model · branch `model/hardening`

```
/semantic-model-authoring Analyze the model against best practices and the conventions in AGENTS.md. Group findings by severity and tag each one agent-applicable or needs-my-decision. Apply nothing yet.
```
Then choose: `Apply 1, 2, 4 and 6. Skip 3.`

Settle the date-table approach here. Save in Desktop, review the `.tmdl` diff, commit, PR. **Lock names now** — renames after the report exists break visual bindings.

## Phase 2 — Measures · branch `model/measures`

```
Build the measures in docs/report-requirements.md into @Measures following AGENTS.md, base measures first. For each measure add a validation query to tests/dax/10_measures.dax, run it, and show the result next to its business definition. Stop and ask where a definition is ambiguous.
```
Check the numbers against an independent calculation on the same fake data (a SQL query or spreadsheet). The agent can prove a measure runs, not that it's right. Save, diff, commit.

## Phase 3 — Plan the report · branch `report/v1`

```
/powerbi-report-cli Plan a new report from the local semantic model in this repo. Use docs/report-requirements.md, AGENTS.md and the brillit-report-standards skill as inputs and only ask me about gaps. Design identity: Brand-Forward using the brand tokens in themes/. Write the locked spec to _brief/report-spec.md and wait for my approval.
```
The skill runs up to 3–5 short question rounds, inspects the model, writes `_brief/report-spec.md` with a `Design Brief:` contract (pages, archetypes, a layout grid per page, navigation model, color map), and stops. Review it like a spec: every visual's question and measure, the regions, the navigation. Edit the file directly if that's faster. Commit.

## Phase 4 — Build

```
Approved. Build page 1 only, following _brief/report-spec.md and the brillit-report-standards skill. Run the full validate → reload → screenshot → review loop, fix what's off, and commit.
```
Repeat per page. One page per turn keeps diffs reviewable and mistakes local. Before every turn, save or discard manual edits in Desktop — the agent works from the files on disk.

## Phase 5 — Independent review

```
Use the pbi-report-reviewer subagent to review every page. Fix the findings it marks agent-fixable, re-validate, re-screenshot and commit. List the remaining findings for me.
```
Copilot CLI: run the reviewer instructions (`.claude/agents/pbi-report-reviewer.md`) in a fresh session so the reviewer hasn't seen the build.

## Phase 6 — Hand-off to the developer

```
Open a PR for report/v1. Description: pages built, measure list with business definitions, decisions from docs/decisions.md, open questions, known gaps, and what to check first in Desktop.
```

## Phase 7 — Promote and vet on real data (developer, no agent)

Deploy through the Fabric deployment pipeline; parameter/data-source rules switch the model to the client source. The developer checks numbers against source, interactions, mobile layout, performance (Performance Analyzer) and RLS. Final tweaks are committed on top.

---

## Habits that make this work

- Small prompts with a clear stopping point beat one giant prompt.
- Commit after every phase; revert freely.
- When the agent repeats a mistake, fix `AGENTS.md` or the standards skill.
- Use the strongest reasoning model available for model and DAX work.
- Keep agents inside the data boundary in `AGENTS.md`.
