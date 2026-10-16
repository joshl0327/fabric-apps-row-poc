# AI-assisted Power BI starter kit

Merged into the Fabric Apps POC repo (`fabric-apps-row-poc`). Works with Claude Code and GitHub Copilot CLI alongside Microsoft's `powerbi-authoring` plugin. The internal governance discussion doc that came with the original kit is kept out of this public repo.

| Path | What it is |
|---|---|
| `AGENTS.md` | Project instructions for any agent: hard rules, data boundary, stack, model map, conventions, guardrails |
| `CLAUDE.md` | Claude Code entry point (imports AGENTS.md, adds Claude Code notes) |
| `.claude/settings.json` | Claude Code plugin settings and the POC's allow / ask / deny permissions |
| `.claude/agents/pbi-report-reviewer.md` | Independent reviewer subagent |
| `.claude/skills/brillit-report-standards/` | BrilliT house report standards: page framework, visuals, KPI cards, color, navigation, bookmarks, checklist (Copilot CLI also loads skills from `.claude/skills/`) |
| `themes/brand-tokens.json` | Brand values (placeholders until BrilliT/client values are supplied) |
| `themes/build-theme.mjs` | Builds a validated Power BI theme from the tokens |
| `docs/ai-workflow.md` | The end-to-end workflow and setup |
| `docs/poc-run-sheet.md` | Step-by-step POC run with exact prompts |
| `docs/poc-log.md` | Log template for the POC results |
| `docs/report-requirements.md` | Requirements input for the report planner |
| `docs/handoff-fabric-apps-poc.md` | Lessons learned and phase plan for the Fabric Apps POC project |
| `docs/brand-template-preview.png` | Static preview of the brand page template (sample values) |
| `themes/assets/brillit-logo.png` | Logo for the brand bar (crop from the website; replace with the official file) |
| `docs/decisions.md` | Decision and assumption log |
| `tests/dax/00_profile.dax` | Model profiling queries |
