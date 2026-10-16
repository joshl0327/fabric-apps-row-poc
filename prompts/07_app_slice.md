# Prompt 07: Fabric App thin slice (row-tracker)

Given to Claude Code on branch `feat/app-slice`. Kept here as a record of
exactly what the agent was asked to do.

---

Read `AGENTS.md` and `docs/decisions.md` first and follow them. Then read the
app's own agent context: `app/row-tracker/AGENTS.md` and
`app/row-tracker/.agents/skills/rayfin/SKILL.md` (and the `rayfin-functions` or
`rayfin-connectors` skill only if a step needs it). **Where the two disagree,
the root `AGENTS.md` wins.**

`app/row-tracker` is Microsoft's "Basic Todo App" template (create-rayfin
1.36.2), committed unmodified. This task turns it into the first thin slice of
the ROW clearing app. It has **two checkpoints**. Between them, keep going
without asking.

For Rayfin API questions, use the skill files first. If they don't cover it,
run `npx rayfin docs ...` from `app/row-tracker` (I approve each call). Don't
register or start the Rayfin MCP server in `.mcp.json`.

## Why

The spreadsheet lets people type "Next Year" or "10/20/2027 - TBD" into a date
column and free-type vendor names. This slice shows the fix: a real date, a
certainty picklist, a vendor dropdown and a rule that ties them together. It
also answers one open design question: do Microsoft Entra groups reach the app,
so role rules can use them? (Decided: everyone signed in reads; district
managers edit their own district's feeders; an approved Entra group edits all.
Role rules themselves are a later step.)

## Part A: understand the template, then plan (no code changes)

1. Explain, briefly, how the template works: the Todo entity and its
   `@role` rules (including the per-user row-level policy), auth (Fabric SSO
   vs local email/password), the client services, the tests, how it runs
   locally (`npx rayfin dev`: what it needs, and whether the database runs
   locally or in Fabric), and what `npx rayfin up` and any `db` command do.
2. Propose the slice, using the decisions below: entity definition, validation
   (and where each rule is enforced: form, schema, server), permissions for
   this slice, the claims panel, the seed approach, files to change or remove,
   and tests.
3. List any new npm dependency you think you need, with the reason. Don't
   install any yet.

**CHECKPOINT 1:** stop. Give me the explanation and the plan on one screen,
plus anything you're unsure about. Wait for my approval.

### Decisions already made (don't ask about these)

- **Entity `ClearingPlan`**, one row per feeder (it replaces Todo; remove the
  Todo entity, UI and tests):
  - `feeder_id`: text, required, unique (format `substation_num-circuit_num`)
  - `district_name`: text, required
  - `vendor`: picklist of the canonical vendors in `data/generate.py`, plus
    "Unassigned"
  - `last_cleared_date`: optional date; `last_work_done`: optional text
  - `next_clearing_date`: optional date
  - `date_certainty`: picklist: confirmed, tentative, next year, TBD
  - `planned_year`: optional integer
  - `notes`: optional text, 500 characters maximum
  - who last changed it and when, if the SDK provides that; otherwise add
    `updated_by` and `updated_at`
- **Cross-field rules** (same meaning as `docs/cleaning-rules.md`):
  - confirmed or tentative → `next_clearing_date` required
  - next year → `planned_year` required, `next_clearing_date` empty
  - TBD → `next_clearing_date` empty
  Enforce in the form for instant feedback, and on the server if Rayfin
  supports it. Report exactly where each rule is enforced; that's a finding.
- **Permissions for this slice:** signed-in users can read and update. No
  delete. Create only through the seed. Proper role rules come later.
- **Claims panel:** a small "Who am I" section that shows every claim the app
  receives for the signed-in user (user ID, email, role, any group
  information). Display only; label it as a diagnostic.
- **Screens:** one list of feeders (feeder, district, vendor, next clearing,
  certainty) with an edit form. Plain and readable; no new UI library.
- **Seed:** 15 synthetic rows from the circuits in the generator's output or
  code. Cover every certainty value at least twice, at least one "Unassigned"
  vendor, and a mix of districts. Use the clean form of each value. Synthetic
  only.
- **Root `AGENTS.md`:** update the `app/` row and add a short "Fabric App"
  section: work in `app/row-tracker`; root rules win over the app's
  `AGENTS.md`; Rayfin docs via the skill files or `npx rayfin docs`; no
  deploy, `db` command against Fabric, or new dependency without asking.

## Part B: build (after I approve)

1. Make the changes in the approved plan.
2. Run the template's checks: `npm run build`, the tests and the linter. All
   must pass.
3. Write `docs/app-notes.md`: how the slice is built, where each rule is
   enforced, how to run it locally, and open questions (especially anything
   about Entra groups or roles).
4. Add rows to `docs/decisions.md` for anything you decided, and a row to
   `docs/poc-log.md` for this task (agent time; leave review time blank).

**CHECKPOINT 2:** stop. Give me: what changed, check results, the exact steps
for me to run it locally and what to try (including a rule violation, e.g.
"confirmed" with no date), and the proposed commits in order with the paths to
stage. Don't deploy. If I later say "deploy", ask before running
`npx rayfin up`, then run `npx rayfin up status` and give me the app URL.

## Do not

- Read any `.env` file, including `app/row-tracker/rayfin/.env`.
- Deploy, run `npx rayfin up`, or run a `db` command against Fabric unless I
  ask in this session.
- Install new npm dependencies without my approval.
- Register MCP servers or edit `.mcp.json`.
- Change anything in `powerbi/`, `snowflake/` or `data/`.
- Use real names, addresses or organizations. Synthetic data only.
- Push, open a pull request, or use `--force`.
