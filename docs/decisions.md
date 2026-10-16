# Decisions and assumptions

Agents append here whenever they make or receive a decision. The developer
reviewing the draft reads this first. Newest at the bottom.

| Date | Decision / finding | Why | Decided by | Affects |
|---|---|---|---|---|
| 2026-10-15 | Keep `DIM_` / `FACT_` table names and the Snowflake column names | PBIR binds visuals by name; the names match ANALYTICS | Josh | Whole model and report |
| 2026-10-15 | "Today" is `TODAY()` | A real report uses the current date; recording numbers may shift slightly | Josh | All date measures |
| 2026-10-15 | Overdue = `NEXT_CLEARING_DATE` before today, only feeders with a real date (confirmed or tentative) | "Next year" and TBD have no date to be late against | Josh | Clearing Cycle measures |
| 2026-10-15 | Snowflake server and warehouse are Power Query parameters; the trial account host is committed to the public repo | Not a credential; key-pair sign-in; trial deleted after the POC | Josh | Model, deployment |
| 2026-10-15 | BrilliT brand and standards may appear in this public repo; `docs/ai-governance-options.md` stays out | Internal demo with synthetic data only; the governance doc is an internal discussion | Josh | Theme, skills, docs |
| 2026-10-15 | One Power BI MCP server: the `powerbi-authoring` plugin's. No `claude mcp add`, no `.mcp.json` | One registration per client avoids two servers on one model | Josh | Tooling |
| | Grain of FACT_ROW_PLAN: | from `tests/dax/00_profile.dax` queries 1–2 | | Miles measures |
| | Date table approach: | | | Clearing Cycle measures |
| | Authoritative DQ count: | from query 4 | | Data Quality page |
| | District name source: | from query 6 | | All district slicers and visuals |
| | FACT_ROW_PLAN → DIM_CIRCUIT relationship: | created one-to-one, both directions | | All filter paths |
