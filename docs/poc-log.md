# POC log: AI-assisted report build

One row per step. This is the evidence for the findings summary and the
recording: what the agent did well, where a person had to step in, and how
long it took. Record agent time and review time separately.

| Date | Phase | Tool / model | Agent time (min) | Review time (min) | Result | Human fixes needed | Standards followed? | Notes |
|---|---|---|---|---|---|---|---|---|
| 2026-10-15 | R0. Setup | Claude Code 2.1.181 (Opus 4.8); powerbi-authoring plugin <version>, MCP server bundled (unpinned, pulls latest); powerbi-report-author 0.5.0; Node 24.20 | 0 | 10 | Pass: 1 Power BI MCP server, 3 skills loaded, doctor OK, Desktop bridge ready, theme builds | Report CLI installed separately (not bundled with the plugin); removed old user-level MCP entry; theme "modified" flag was line endings only | — | Kit merged with POC guardrails (AGENTS.md, CLAUDE.md, settings.json) |
| | R1. Profile and settle the model | | | | | | — | |
| | R2. Measures | | | | | | — | |
| | R3. Spec | | | | | | | |
| | R4. Page 1 | | | | | | | |
| | R4. Page 2 | | | | | | | |
| | R4. Page 3 | | | | | | | |
| | R4. Page 4 | | | | | | | |
| | R4. Independent review | | | | | | | |
| | R4. PR | | | | | | | |

## Observations

- What the agent got right without help:
- Where it needed correction (and whether a standards or AGENTS.md change fixed it for next time):
- Validation or tooling problems:
- Estimated time vs. building by hand:

## Changes made to the standards or AGENTS.md during the POC

-
