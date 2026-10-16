@AGENTS.md

## Claude Code notes

- `AGENTS.md` holds the rules for every agent. `.claude/settings.json`
  enforces the hard ones for Claude Code: push, merge, force and secret reads
  are denied; commits, pull requests, deploys and deletes ask first.
- Run Claude Code natively on Windows (PowerShell or the VS Code terminal), not
  in WSL. Desktop preview goes through a local named pipe, and the local Power
  BI Authoring MCP server needs Windows.
- One Power BI MCP server only: `plugin:powerbi-authoring:powerbi-modeling-mcp`
  from the plugin. Don't register another copy (no `claude mcp add`, no
  `.mcp.json` entry).
- Plugin skills appear namespaced: `/powerbi-authoring:powerbi-report-cli` and
  `/powerbi-authoring:semantic-model-authoring`. The project skill is
  `/brillit-report-standards`.
- For the independent review pass, delegate to the `pbi-report-reviewer`
  subagent instead of reviewing your own build in the same context.
- Retained review screenshots go in `review/screenshots/` (gitignored). The
  report skill's own validation screenshots stay in its temporary folder and
  are cleaned up automatically.
