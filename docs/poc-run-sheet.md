# POC run sheet: generate the ROW Clearing Plan report with the Power BI skills

Run this in Claude Code from the repo folder (`C:\dev\fabric-apps-row-poc`),
on the synthetic-data model. One phase at a time; each has a done check.
Human gates: the spec approval (R3) and the per-page review (R4). Keep
`docs/poc-log.md` updated as you go: it's the evidence for the findings
summary and the recording.

Paths below assume the project lives in `powerbi/`
(`powerbi/row_pbi_poc.pbip`).

## R0. Setup

1. Branch from an up-to-date `main`: `git switch main`, `git pull`,
   `git switch -c report/v1-poc`.
2. If the PBIP folder on `main` is still `PBIP/`, rename it with Desktop
   closed: `git mv PBIP powerbi`.
3. Copy this kit into the repo root. `AGENTS.md`, `CLAUDE.md` and
   `.claude/settings.json` replace the old versions (they carry the old rules
   forward). The kit's readme is `docs/pbi-kit-readme.md`, so the repo's own
   `README.md` isn't touched. Add to `.gitignore`: `review/screenshots/` and
   `docs/ai-governance-options.md`.
4. Check the report CLI (install it pinned if it's missing):
   ```powershell
   powerbi-report-author --version
   powerbi-report-author doctor
   ```
5. Keep one Power BI MCP server: remove the old, disabled user-level copy with
   `claude mcp remove powerbi-modeling-mcp -s user`.
6. Build the theme: `node themes/build-theme.mjs`. Note the file name it
   prints (`themes/BrilliT-da2828ff.json`).
7. Open `powerbi/row_pbi_poc.pbip` in Power BI Desktop and save. Check the
   bridge sees it:
   ```powershell
   powerbi-report-author preview "powerbi/row_pbi_poc.Report" --host desktop --status
   ```
8. Start `claude` in the repo. Check `/skills`, `/mcp` and `/permissions`.
9. Log R0 in `docs/poc-log.md` (time, versions). Commit and open a PR.

**Done when:** `/skills` lists `powerbi-authoring:powerbi-report-cli`,
`powerbi-authoring:semantic-model-authoring` and `brillit-report-standards`;
`/mcp` shows exactly one Power BI server, connected; `/permissions` still
denies `git push`; `doctor` passes; the theme builds; the preview status sees
Desktop with no unsaved changes.

## R1. Profile and settle the model

```
/powerbi-authoring:semantic-model-authoring Connect to the semantic model open in Power BI Desktop. Run each query in tests/dax/00_profile.dax and explain what the results say about the open model questions in AGENTS.md: grain of FACT_ROW_PLAN, date table, the two DQ counts, district names, and the FACT_ROW_PLAN to DIM_CIRCUIT relationship. Compare each result with the expected answer in AGENTS.md. Write the findings into docs/decisions.md. Change nothing in the model.
```

Decide the four questions (and the relationship), then:

```
Apply these model decisions: <your answers>. Add DIM_DATE as described in AGENTS.md, apply the column conventions (hide fact keys, SummarizeBy None, sort DATE_CERTAINTY), and run a best-practice check, listing findings without applying them. Then stop and ask me to save.
```

**Done when:** `docs/decisions.md` answers all four questions; the TMDL diff is
reviewed and committed.

## R2. Measures

```
Build the measures in docs/report-requirements.md into @Measures following AGENTS.md, base measures first. For each measure add a validation query to tests/dax/10_measures.dax, run it, and show the result next to its business definition. Stop and ask where a definition is ambiguous. When done, ask me to save, then show the TMDL diff.
```

Check a few numbers against Snowflake yourself (a query on
`ROW_DB.ANALYTICS`): the agent can prove a measure runs, not that it's right.

**Done when:** every measure has a description, format, folder and a checked
result.

## R3. Plan the report (stops for approval)

```
/powerbi-authoring:powerbi-report-cli Plan a new report from the local semantic model in powerbi/. Inputs: docs/report-requirements.md, AGENTS.md, docs/decisions.md and the brillit-report-standards skill. Treat the standards as the design identity, page framework, navigation model and theme, and only ask me about real gaps. Theme: themes/BrilliT-da2828ff.json. Delivery: local PBIP only. Write the locked spec to _brief/report-spec.md and stop for my approval.
```

Review `_brief/report-spec.md` before approving:

- [ ] Pages follow the standard set (Overview, analysis pages, Detail, hidden
      drillthrough/tooltip, About).
- [ ] Each page's `layout_contract` uses the standard regions (header, nav,
      filters, kpis, body).
- [ ] KPI cards: 3–5 per strip, each with a comparison.
- [ ] Every visual has one question and a named measure; chart types match
      `visual-standards.md`.
- [ ] `navigation_model: page_navigator`; drillthrough has a Back button;
      bookmarks only for view toggles.
- [ ] `color_map` uses token colors; `deviations` lists anything off-standard
      with a reason.
- [ ] Every measure the spec uses exists from R2 (or is listed as model work).

**Done when:** the spec is approved and committed.

## R4. Build, one page per turn

```
Approved with these changes: <your edits, or "none">. Register themes/BrilliT-da2828ff.json as the report theme, then build page 1 only, with the full validate → reload → screenshot → review loop, checked against references/checklist.md in the standards skill. Stop after page 1 and propose the commit.
```

Look at page 1 in Desktop. Note what you'd change and whether the standards
were followed, then:

```
Page 1 feedback: <notes>. Fix those, then build page 2 the same way and stop.
```

Repeat per page. If the agent repeats a mistake, fix the standards skill or
`AGENTS.md` and note it in the log. Then the independent review:

```
Capture retained screenshots of every page into review/screenshots/, then use the pbi-report-reviewer subagent to review the whole report. Fix the findings it marks agent-fixable, re-validate and propose the commit. List the remaining findings for me.
```

Ask for a PR description (you open the PR yourself):

```
Write a PR description for report/v1-poc: pages built, measure list with business definitions, decisions from docs/decisions.md, open questions, known gaps, and what to check first in Desktop.
```

**Done when:** `validate` passes; every page is reviewed; the PR is open.

## R5. Findings

Fill in `docs/poc-log.md` (times, human fixes, observations) and capture the
screenshots the recording needs.

## Later: write-back

Publish a User Data Function to `ROW-POC-Dev`, then add a `DataFunction`
button through authoring mode. Its own phase, after the report exists.

## Known issue

Microsoft's base theme fails `powerbi-report-author validate` 0.5.0 on three
card properties (`border.radius`, `spacing.customizeSpacing`, padding sides).
`themes/build-theme.mjs` removes them, and its output validates cleanly. If the
agent starts adapting Microsoft's base theme itself, point it back to the
generated theme.
