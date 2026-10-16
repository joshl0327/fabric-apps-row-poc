# Prompt 08: clearing a date keeps the old value (row-tracker)

Given to Claude Code on branch `fix/clear-date`. Kept here as a record of
exactly what the agent was asked to do.

---

Read `AGENTS.md`, `docs/decisions.md` and `docs/app-notes.md` first and follow
them. For Rayfin questions, use `app/row-tracker/.agents/skills/rayfin/SKILL.md`
first, then `npx rayfin docs ...` from `app/row-tracker` (I approve each call).

## What happened (found after the prompt 07 deploy)

In the deployed app, I edited feeder 101-1 from confirmed (2026-11-15) to TBD,
cleared the next clearing date, and saved. The save succeeded, but the row now
shows **TBD with 2026-11-15**. Feeder 533-1 did the same. Setting values works;
clearing them doesn't. The form passed its own rules (TBD with no date), but
the update you send uses `undefined` for a cleared field, which the API treats
as "leave unchanged". The result is silent bad data that breaks our own rule.
You flagged this as an open item in Part B of prompt 07; it's now confirmed.

Also observed on the deployed app (record these; no change needed):
- The claims panel shows only `id` and `email`: no name, role or groups.
- With create disabled, "Load sample data" failed with "The field
  `createClearingPlan` does not exist on the type `Mutation`": the API has no
  create operation at all when no role allows it.
- Errors show as raw GraphQL text in the UI.

## Part A: find out whether a field can be cleared (docs and code only)

Using the Rayfin docs and the generated client types, find out whether an
update can set a nullable field to null (for example, sending explicit `null`
even if the TypeScript type says `value | undefined`), or whether Rayfin offers
another supported way to clear a field.

- **If there is a supported way:** continue to Part B without stopping.
- **If there isn't:** stop and give me the options with their trade-offs.
  Don't build a workaround (no sentinel values, no delete-and-recreate).

## Part B: fix (only if Part A found a supported way)

1. Send cleared optional fields (`next_clearing_date`, `planned_year`,
   `last_cleared_date`, `last_work_done`, `notes`) as an explicit clear on
   update. Keep "not touched" fields unchanged.
2. After every save, read the row back and compare it with what was submitted.
   If anything differs, show a clear error naming the field and the value the
   server kept. A silent mismatch must not be possible again.
3. Replace raw GraphQL errors in the UI with a short, plain message (keep the
   technical detail in the browser console).
4. Tests: the update payload for a cleared field, the read-back mismatch error,
   and the friendly error mapping. `npm run build`, the tests and the linter
   must pass.
5. Update `docs/app-notes.md` with a "Deployed results (2026-10-16)" section:
   the three observations above, this bug, its fix, and the fact that it can
   only be fully verified on the deployed app (local mode uses the in-memory
   store). Add a row to `docs/decisions.md` for the fix approach and a row to
   `docs/poc-log.md` for this task (agent time; leave review time blank).

## When done

Stop and give me: what changed, check results, the steps for me to verify it
on the deployed app after merging, and the proposed commits with the paths to
stage. In the PR description draft, include "Closes #<issue>" placeholders for
the clear-date and raw-error issues; I'll fill in the numbers.

## Do not

- Deploy, run `npx rayfin up`, or run any `db` command against Fabric.
- Change permissions, entities or the schema.
- Install new npm dependencies.
- Read any `.env` file.
- Change anything outside `app/row-tracker`, `docs/` and `prompts/`.
- Push, open a pull request, or use `--force`.
