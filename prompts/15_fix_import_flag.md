# Prompt 15: the deployed build ignores the import flag (Phase 5, part 4)

Given to Claude Code on branch `fix/deploy-import-flag`. Kept here as a record of
exactly what the agent was asked to do.

---

Read `AGENTS.md`, `docs/deploy.md`, `docs/ci.md` and `docs/decisions.md` first
and follow them.

## What happened

Migration runbook, step 3: I ran "Deploy to prod" by hand with
`enable_feeder_import` ticked (run #6, 2026-10-30). The job succeeded and its
summary says "Feeder import this build: `true`". But the prod app shows "No
feeders loaded yet" with **no Import panel**, after a hard refresh and in a
private window.

## Likely cause (confirm it)

`app/row-tracker/rayfin/rayfin.yml` has
`staticHosting.buildCommand: npm run build:fabric`, so `rayfin up` seems to run
its **own** build inside the "Deploy to ROW-POC-Prod" step. The workflow only
sets `VITE_ENABLE_FEEDER_IMPORT` on the earlier "Build" step. If so, the bundle
that ships is a second build with the flag off, and the job summary reports the
input, not what was deployed.

Confirm this from the Rayfin docs or skill (`app/row-tracker/.agents/skills/rayfin/SKILL.md`
first, then `npx rayfin docs ...`; I approve each call). Quote what you find.

## Do these

1. **Fix it so the flag reaches the build that ships.** Set
   `VITE_ENABLE_FEEDER_IMPORT` from the same resolved flag on the deploy step
   too (or at job level, if that's cleaner). Push deploys must still always be
   `false`.
2. **Report what actually shipped.** After `rayfin up`, check the `dist/` that
   was deployed for a string that only exists when the Import panel is built in,
   and add a summary line such as "Import panel in deployed bundle: yes/no". If
   it doesn't match the requested flag, fail the job with a clear message (the
   upload has already happened, but the run goes red so I notice).
3. Validate the workflow YAML. No app code changes are needed; the build, tests
   and linter must still pass.
4. Update `docs/deploy.md` (why the flag must be on the deploy step; what the
   new summary line means), `docs/decisions.md`, and `docs/poc-log.md` (agent
   time; leave review time blank). Add the finding: the job summary reported the
   requested input, not the shipped build.

**CHECKPOINT:** stop and give me: the confirmed cause with the quote, what
changed, check results, what happens when I merge (this PR changes only
`.github/` and `docs/`, so no deploy should start), my steps after merging (run
"Deploy to prod" by hand with the box ticked, approve, check the new summary
line, Ctrl+F5), and the proposed commits with the paths to stage.

## Do not

- Deploy, run `rayfin up`, `az` or any Fabric or Azure command.
- Change the app's code, entities or `rayfin.yml`.
- Add secrets, change the federated sign-in, the `prod` environment or the
  ruleset.
- Read any `.env` file.
- Change anything in `powerbi/`, `snowflake/` or `data/`.
- Push, open a pull request, or use `--force`.
