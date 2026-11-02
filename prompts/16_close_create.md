# Prompt 16: switch create off after the prod load (Phase 5, part 5, "PR B")

Given to Claude Code on branch `chore/prod-load-disable-create`, made from a
freshly pulled `main`. Kept here as a record of exactly what the agent was asked
to do.

---

Read `AGENTS.md`, `docs/deploy.md` and `docs/decisions.md` first and follow them.

## Where we are

The 153-feeder migration into ROW-POC-Prod is done (2026-11-01). The manual
import deploy shipped with the Import panel on, and the in-app import showed
"Created 153 · Updated 0 · Skipped 0" with the reconciliation 153; 142 / 1 / 2 /
8; 143. Both migration gates must now close again: the UI gate closes by
itself on the next push deploy (push builds always ship with import off); this
PR closes the server gate.

## Do these

1. **Revert PR #30 exactly.** It changed only two files: it uncommented
   `@authenticated('create')` in `app/row-tracker/rayfin/data/ClearingPlan.ts`
   and changed the expectation in
   `app/row-tracker/src/__tests__/changeLogPermissions.test.ts` to
   `['create', 'read', 'update']`. Use `git revert --no-commit 7d7a852` so the
   result is exactly the pre-#30 state (create commented out; the test expects
   `['read', 'update']` with its original name). Show me the diff; nothing else
   in those files changes.
2. `npm run build`, the tests and the linter must pass. Confirm from the
   generated output that `ClearingPlan` again has no create operation.
3. Update `docs/deploy.md`: mark the migration as completed on 2026-11-01 with
   the result above, and add a short "What went wrong during the migration"
   note: the first import deploy (run #6) shipped with the panel off because
   `rayfin up` rebuilds the app (fixed in prompt 15), and an unticked manual run
   (#5) would also have redeployed without the panel. Update
   `docs/decisions.md` and `docs/poc-log.md` (agent time; leave review time
   blank).

**CHECKPOINT:** stop and give me: the diff, check results, the proof that create
is gone, what happens when I merge (this touches `app/row-tracker/`, so a push
deploy starts and waits for my approval, built with import off), my steps to
verify after that deploy (still 153 feeders, no Import panel, the summary shows
"Import panel in deployed bundle: no", and editing a feeder still works and
logs a History row), and the proposed commits with the paths to stage.

## Do not

- Deploy, run `rayfin up`, `az` or any Fabric or Azure command.
- Change anything beyond the two reverted files and the docs above.
- Load, change or delete any data.
- Read any `.env` file.
- Push, open a pull request, or use `--force`.
