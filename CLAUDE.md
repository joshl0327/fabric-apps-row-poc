# Fabric Apps POC: right-of-way (ROW) clearing tracker

Proof of concept showing that a BI team can build analytic apps safely with
Power BI + Snowflake + Fabric Apps, guided by an AI coding agent with a human
reviewing every change. This file is the agent's standing instructions.

## Hard rules (never break these)
- **Synthetic data only.** No real company, cooperative, client, person, or
  employee names. No real addresses or account numbers. Invent everything.
- **Never push.** Work on a branch named `feat/<topic>` or `fix/<topic>`. The
  human pushes, and merges pull requests after review.
- **Never use `--force`** with git or the Rayfin CLI.
- **Never deploy to production.** Only the dev workspace `ROW-POC-Dev` exists
  today. Ask before any `npx rayfin up`.
- **Never read or print secrets.** Don't open `.env*`, `*.p8`, `*.pem`,
  `secrets/`, or `~/.snowflake/`. Use placeholders like `<ACCOUNT_IDENTIFIER>`
  in committed files.
- **Business logic lives in Snowflake or the semantic model, not app code.**
  Measures and definitions are written once and reused.
- **Never commit without approval.** Propose the commit: the files to stage,
  named one by one (never `git add -A` or `git add .`), and the message. The
  human approves each commit.
- When finished with a task: stop, show a short diff summary, and list how the
  human can verify the result. Don't move on to the next task unasked.

## Stack
- Snowflake (Azure East US 2), database `ROW_DB`, schemas RAW, STAGING,
  ANALYTICS, APP_SYNC. Warehouses `WH_TRANSFORM_XS`, `WH_REPORTING_XS`.
- Roles: `ROLE_LOADER` writes RAW; `ROLE_BI_DEVELOPER` builds STAGING and
  ANALYTICS; `ROLE_REPORTER` reads ANALYTICS (Power BI); `ROLE_APP_SYNC` writes
  APP_SYNC. Use the least-privileged role that can do the job.
- Power BI: PBIP + TMDL (no .pbix files in the repo).
- Fabric Apps: Rayfin SDK/CLI, TypeScript. Dev workspace `ROW-POC-Dev`.
- Python 3.12 in a local `.venv`; dependencies pinned in `requirements.txt`.
- Windows machine; prefer commands that work in both PowerShell and Git Bash.
- Coding agent: Claude Code CLI for this POC. At work the same workflow runs on
  GitHub Copilot CLI, so keep it portable: rules live in this file (it maps to
  `AGENTS.md` / `.github/copilot-instructions.md`), real enforcement lives in
  GitHub (branch rulesets, PR review, secret scanning), and nothing the
  workflow depends on should require a Claude-only feature.

## Repo layout (grows by phase)
- `snowflake/`  numbered SQL scripts (`01_...sql`, `02_...sql`), re-runnable
- `data/`       synthetic data generator; output goes to `data/out/` (gitignored)
- `prompts/`    the prompts given to the agent, kept as a record
- `powerbi/`    PBIP project (Phase 2)
- `app/`        Fabric App (Phase 3)

## Domain notes
- Two core datasets joined on `feeder_id` (`substation_num + "-" + circuit_num`):
  1. Circuit details (clean, system of record): circuit_num, circuit_name,
     substation_num, substation_name, feeder_id, line miles, and
     ROW_RESPONSIBILITY (the district responsible for clearing the ROW).
  2. ROW clearing plan (hand-maintained shared spreadsheet), one row per
     feeder_id: last cleared date, last work done, next clearing, vendor, notes.
- Data quality problems in the clearing plan are the point of the POC:
  - Text in date columns ("Next Year", "10/20/2027 - TBD", "TBD").
  - Free-typed vendor names ("ABC Tree Service" vs "ABC Tree").
- The clean target: a real date plus a date certainty (confirmed, tentative,
  next year, TBD) and an optional planned year; vendors mapped to one
  canonical vendor list. Cleaning rules live in Snowflake, not app code.
