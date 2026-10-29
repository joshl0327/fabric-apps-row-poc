# Prompt 12: CI on every pull request (Phase 5, part 1)

Given to Claude Code on branch `feat/ci`. Kept here as a record of exactly what
the agent was asked to do.

---

Read `AGENTS.md`, `docs/decisions.md` and `docs/app-notes.md` first and follow
them. For Rayfin questions, use `app/row-tracker/.agents/skills/rayfin/SKILL.md`
first, then `npx rayfin docs ...` from `app/row-tracker` (I approve each call).

## Why

Phase 5 answers the ops team's concern about automated pushes to production.
Part 1: every pull request runs the same checks the agent runs locally, and I'll
make them required in the "Protect main" ruleset, so a failing PR can't merge.
Later parts add a prod workspace and a deploy job that only runs after my
approval; this task also answers the one question that decides how those parts
go.

## Part A: research only (no changes)

**Can `rayfin up` run unattended as a service principal?** From the installed
Rayfin docs and CLI help, find out whether `rayfin login` / `rayfin up` support a
non-interactive sign-in: service principal with a secret or certificate,
federated credentials (GitHub OIDC), environment variables, an Azure CLI token,
or anything else. Quote the exact docs and commands. Don't try any of them.

Include the answer in your final summary. Don't stop for it.

## Part B: build the CI workflow

1. Add `.github/workflows/ci.yml`, triggered on pull requests to `main` (and
   runnable by hand with `workflow_dispatch`), with:
   - **App job** (in `app/row-tracker`): `npm ci`, `npm run build`, the tests,
     the linter. Build runs before the tests (the append-only permission test
     reads the build output). Use the Node version the project uses locally.
     Set `RAYFIN_TELEMETRY_OPTOUT=1`. Confirm the build's prebuild step needs no
     Fabric sign-in.
   - **Report job**: install `@microsoft/powerbi-report-authoring-cli@0.5.0`
     and run `powerbi-report-author validate "powerbi/row_pbi_poc.Report"`. If
     the CLI needs Windows, use a Windows runner; say which you chose and why.
2. Guardrails for the workflow itself, each one defensible in front of ops:
   - `permissions: contents: read` at the top. No secrets, no tokens, no
     deploy steps, no writes to the repo.
   - Pin every third-party action to a full commit SHA, with the version in a
     comment. Check the SHAs with `gh api` (I approve each call), or tell me
     which ones you couldn't verify.
   - Clear job names, because I'll select them as required checks.
3. Add `docs/ci.md`: what runs, why each check matters, how to read a failure,
   and the exact ruleset change I need to make (the job names to require).
4. Add rows to `docs/decisions.md` and `docs/poc-log.md` (agent time; leave
   review time blank).

**CHECKPOINT:** stop and give me: the workflow summary, the service-principal
answer from Part A, which action SHAs you verified, my steps (merge, make the
checks required in the ruleset, then a "break it" PR with a deliberately failing
test that must be blocked), and the proposed commits with the paths to stage.

## Do not

- Add any deploy, publish or `rayfin up` step, or any secret.
- Change the app, the report, the model, or anything in `snowflake/` or `data/`.
- Change `.claude/settings.json` or the GitHub ruleset (I change the ruleset).
- Read any `.env` file.
- Push, open a pull request, or use `--force`.
