# Prompt 14: prod hardening and migration plumbing (Phase 5, part 3)

Given to Claude Code on branch `feat/prod-hardening`. Kept here as a record of
exactly what the agent was asked to do.

---

Read `AGENTS.md`, `docs/decisions.md`, `docs/app-notes.md`, `docs/ci.md` and
`docs/deploy.md` first and follow them.

## Where we are

The first prod deploy worked on 2026-10-29 (Deploy to prod #1): started by hand
from `main`, held at the `prod` gate until I approved, signed in to Azure with
the federated credential (no secret), and `rayfin up` created the app, its SQL
database and SQL endpoint in ROW-POC-Prod, all owned by `gh-row-poc-deploy`.
Sign-in on the prod app works. Findings from that run:

- The job summary said "App URL: not reported by this run". The prod app is
  `https://hale-robin-0921441f70-westus3.webapp.fabricapps.net`.
- A runner notice: `ubuntu-latest` is moving to Ubuntu 26.
- The empty prod app still shows the old "Load sample data" seed button.
- Fabric Apps has no setting for a custom app URL or domain (the hosting docs
  have none; a public feature request exists, microsoft/rayfin issue #17).

Next I'll load the 153 clean feeders into prod through the same gated path. This
task builds the plumbing for that; it doesn't load anything.

## Do these

1. **Register the prod URL for sign-in.** Add the prod app's address to
   `allowedRedirectUris` in `app/row-tracker/rayfin/rayfin.yml`, in the same
   format as the existing Dev entry. Leave the Dev and localhost entries; the
   shared list stays a documented known gap.
2. **Report the app URL in the job summary.** Get it from Rayfin's
   `--output json` (or `rayfin up status --output json`), not from any `.env`
   file. If no field carries it, fall back to "see the App item in
   ROW-POC-Prod" and say so in `docs/deploy.md`.
3. **Pin the runner** to `ubuntu-24.04` in both `ci.yml` and
   `deploy-prod.yml`, so a platform change can't surprise a deploy.
4. **One switch for data loading in the UI.** Put the empty-state "Load sample
   data" button behind the same off-by-default build flag as the Import panel
   (`VITE_ENABLE_FEEDER_IMPORT`). With the flag off, an empty table shows a
   plain message ("No feeders loaded yet") and no load controls.
5. **A deploy-time input for the migration.** Add a `workflow_dispatch` boolean
   input to `deploy-prod.yml`, `enable_feeder_import`, default **false**. When
   it's true, that one build sets `VITE_ENABLE_FEEDER_IMPORT=true`. Push-
   triggered deploys always build with it off. Show the value in the job summary
   so it's visible in the run history who deployed with import switched on.
   Server-side create permission stays off in this PR; I switch it in separate
   PRs.
6. **Write the migration runbook** in `docs/deploy.md`, as exact steps:
   PR A switches `@authenticated('create')` on → merge → approve the
   push-triggered deploy → run "Deploy to prod" by hand with
   `enable_feeder_import` ticked → approve → import the CSV in prod and check
   the reconciliation (153; 142 / 1 / 2 / 8; 143) → PR B switches create off →
   merge → approve the normal deploy → confirm the Import panel is gone.
7. Tests for the flag behavior (both buttons hidden when off, shown when on).
   `npm run build`, the tests and the linter must pass; validate the workflow
   YAML.
8. Update `docs/app-notes.md` (prod URL; no custom URL, with the feature request
   link), `docs/decisions.md` and `docs/poc-log.md` (agent time; leave review
   time blank).

**CHECKPOINT:** stop and give me: what changed, check results, what will happen
when I merge (this PR touches `app/row-tracker/`, so the deploy starts by itself
and waits for my approval), my steps to verify after that deploy, and the
proposed commits with the paths to stage.

## Do not

- Deploy, run `rayfin`, `az` or any Fabric or Azure command.
- Switch create permission on, or load or delete any data.
- Add secrets, change the federated sign-in, the `prod` environment or the
  ruleset.
- Read any `.env` file, including `.env.fabric-*`.
- Change anything in `powerbi/`, `snowflake/` or `data/`.
- Push, open a pull request, or use `--force`.
