# Prompt 17b: fixes from the post-merge review of prompt 17

Given to Claude Code on branch `docs/post-review-fixes`, made from a freshly
pulled `main`. Kept here as a record of exactly what the agent was asked to do.

---

Read `AGENTS.md` and `docs/governance.md` first and follow them.

## Where we are

Prompt 17 merged (PR #33). A review of `main` found six small accuracy issues
in the files that PR added or changed. On 2026-11-05 I also turned on the
dependency graph and Dependabot alerts, and left Dependabot security updates
off, so `docs/governance.md` needs to reflect that too.

This is docs only: no code, no comments in `app/row-tracker/`, and no change
to the app's README. Leaving `app/row-tracker/` alone means merging won't start
a prod deploy.

## Do these

1. **`README.md`, "Environment ladder":** the intro line is wrong. "Each tier
   is more trusted than the one below, and nothing crosses a boundary without a
   human" isn't true, because the daily clone into Snowflake is automated.
   Replace it with: data flows down from the operational systems through an
   automated daily clone, the agent works only in the BI dev workspace, and
   nothing reaches the BI prod workspace without a human approval.

2. **`README.md`, "Run it locally":** use `npm ci`, not `npm install`. The
   lockfile is committed and CI uses `npm ci`. Also say it needs Node 24 (match
   the version in `.github/workflows/ci.yml`).

3. **`docs/governance.md`, ownership:**
   - "No person deploys from a laptop" is true only for prod. Make it "No
     person deploys to prod from a laptop."
   - Code scanning isn't set up, so don't list it under the Security tab.
     Instead, add an optional follow-up: "code scanning (CodeQL), if the app
     team wants it."

4. **`docs/governance.md`, bundle share:** your own figures put the
   `@microsoft/rayfin-*` packages at about 19% combined (8.1 + 4.8 + 2.6 + 2.5
   + 0.8 + local-dev), not ~22%. Recheck against the source-map numbers from
   prompt 17 and correct it.

5. **`docs/governance.md`, tier boundary:**
   - Add one bullet: changes to the agent guardrails (the hard rules in
     `AGENTS.md`, and `.claude/settings.json`).
   - Add a follow-up: the boundary is a policy and nothing enforces it yet. A
     `CODEOWNERS` file covering the boundary paths, plus "require review from
     code owners" in the ruleset, would enforce it once the app team has
     access to the repo.

6. **`fabric-app-standards` skill, "No `delete`" bullet:** a one-off SQL
   statement in the query editor bypasses the app's ChangeLog. Add that it
   must be recorded in `docs/decisions.md` with the statement, the row count
   and the reason, because the ChangeLog won't show it. Bump the skill's
   CHANGELOG only if the skill has one; otherwise leave it.

7. **`docs/governance.md`, Dependabot:** the dependency graph and Dependabot
   alerts are now on (enabled 2026-11-05). Dependabot security updates (the
   automatic fix PRs) are deliberately off: most findings come from Rayfin's
   own dependencies and Rayfin has no newer release yet, so those PRs would
   mostly be noise. Make these changes:
   - Move "Dependabot alerts" to **In place**.
   - Under **Not in place**, keep "a dependency audit in CI" and replace
     "Dependabot" with "Dependabot version updates and security update PRs (a
     later prompt)".
   - Update the follow-ups list the same way.
   - Drop "once enabled" from the Security tab line.
   - Note that alerts are grouped one per advisory, not one per package, so
     they won't match the `npm audit` package counts one for one.

Add rows to `docs/decisions.md`:
- the boundary addition (proposed, 2026-11-05, Josh);
- Dependabot alerts on and security updates off, with the reason (2026-11-05,
  Josh).

Add agent time to `docs/poc-log.md` (leave review time blank).

**Checks:**
- Every relative link in the touched files resolves (a throwaway script
  outside the repo; no new dependency).
- `git diff --stat main -- app/` is empty.

**CHECKPOINT:** stop and give me the diff, the check results, and the
proposed commit with the paths to stage.

## Do not

- Touch anything under `app/`, `.github/`, `powerbi/` or `prompts/`.
- Change `.claude/settings.json` itself; only document it.
- Change any GitHub setting, or add `.github/dependabot.yml`.
- Install packages, deploy, or run `rayfin`, `az`, `fab` or `snow`.
- Read any `.env` file.
- Push, open a pull request, or use `--force`.
