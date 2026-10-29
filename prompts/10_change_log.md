# Prompt 10: change log (audit trail) for row-tracker

Given to Claude Code on branch `feat/change-log`. Kept here as a record of
exactly what the agent was asked to do.

---

Read `AGENTS.md`, `docs/decisions.md` and `docs/app-notes.md` first and follow
them. For Rayfin questions, use `app/row-tracker/.agents/skills/rayfin/SKILL.md`
first, then `npx rayfin docs ...` from `app/row-tracker` (I approve each call).

## Why

Phase 3's exit test is: "typing 'Next Year' into a date is impossible, and
every edit produces an audit row." The first half is done. This task does the
second: an append-only change log that no user can edit or delete, showing who
changed what and when.

The app now holds the 153 clean feeders. Create is switched off for
`ClearingPlan`; the "Import feeders" panel still shows even though the server
would reject an import.

## Decisions already made (don't ask about these)

- **New entity `ChangeLog`**, one row per saved change: the feeder's
  `feeder_id`, `action` (picklist: create, update; only update is used for
  now), `changed_by`, `changed_at` (date-time), `before_json`, `after_json`
  (only the fields that changed), and optional `reason` (text, 250 max).
- **Append-only:** role rules allow create and read only. No update, no delete.
  We already know Rayfin generates no API operation that no role allows, so the
  log cannot be changed through the API at all. Prove that from the generated
  client types or schema.
- **Who made the change must not be up to the browser.** Find out from the
  docs whether a create rule can require that the row's user field matches the
  signed-in user (for example a policy like `claims.email.eq(item.changed_by)`).
  If it can, apply it to `ChangeLog` create, and also to `ClearingPlan` update
  for `updated_by`. If it can't, say so; that's a finding.
- **Written after each successful save,** using the verified row from prompt
  08's read-back. If writing the log row fails, show a clear error saying the
  edit was saved but not logged. Don't hide it. Doing both in one server-side
  transaction would need a Rayfin Function; that's a later step, so record it
  as a known gap.
- **The import isn't logged.** The 153-feeder load is the baseline.
- **Screens:** a "History" section in each feeder's edit view (newest first:
  when, who, field, old value → new value), and a small "Recent changes" panel
  (last 20 across all feeders). Plain and readable; no new UI library.
- **Hide the Import panel** unless it's explicitly enabled for a load (for
  example a build-time flag that's off by default). Propose the simplest way.

## Part A: plan (no code changes)

1. Answer the "who made the change" question from the docs, with the exact
   rule syntax if it exists.
2. Propose the entity definition, the role rules, the write sequence, the
   screens and the Import-panel switch.
3. Say exactly what the deploy will change: **a new `ChangeLog` table** in the
   app database, new permissions, any change to `ClearingPlan`'s rules, and the
   UI. Nothing should change for existing feeder rows.

**CHECKPOINT 1:** stop with the plan and anything you're unsure about. Wait for
my approval.

## Part B: build (after I approve)

1. Build the approved plan.
2. Tests: the changed-fields diff (only changed fields, cleared values as
   null), the log entry built from a save, the "saved but not logged" error,
   history ordering, and the Import-panel switch. `npm run build`, the tests and
   the linter must pass.
3. Update `docs/app-notes.md` (how the log works, what it proves, known gaps),
   `docs/decisions.md` and `docs/poc-log.md` (agent time; leave review time
   blank).

**CHECKPOINT 2:** stop and give me: what changed, check results, the proof that
`ChangeLog` has no update or delete operations, my steps to verify after
deploy (an edit shows in History and Recent changes; a SQL query in the Fabric
SQL database shows the row; the who-field matches me), and the proposed commits
with the paths to stage.

## Do not

- Deploy, run `npx rayfin up`, or run any `db` command against Fabric.
- Change existing `ClearingPlan` fields, or add delete permission anywhere.
- Install new npm dependencies.
- Read any `.env` file, or change anything in `powerbi/`, `snowflake/` or
  `data/`.
- Push, open a pull request, or use `--force`.
