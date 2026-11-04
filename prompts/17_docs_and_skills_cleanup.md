# Prompt 17: bring every doc and skill up to date before the app-team review

Given to Claude Code on branch `docs/post-poc-cleanup`, made from a freshly
pulled `main`. Kept here as a record of exactly what the agent was asked to do.

---

Read `AGENTS.md`, `docs/decisions.md`, `docs/app-notes.md`, `docs/deploy.md`
and `docs/ci.md` first and follow them.

## Where we are

The core POC is complete (2026-11-02): CI is required on every PR, ROW-POC-Prod
deploys only through the approved "Deploy to prod" job, and the 153 feeders
were migrated through that gated path. The repo now goes to the app
development team for review. Their questions are:

- what the Fabric App and its code look like;
- how it works with data (retrieval, processing, display, editing) and how it
  connects to Power BI;
- the dependency footprint.

Several docs still describe earlier states of the repo. This PR brings every
documentation-style file and the project skills up to date with what the repo
does today, and records the guardrail lessons. **Docs and comments only: no
behavior change.**

Decisions to record (2026-11-03, Josh):

- **Ownership (proposed, pending agreement with the app team):** the BI team
  builds, deploys and maintains the app. The app team, Cyber and the
  cloud/Fabric admin can monitor it freely. Changes that cross the tier
  boundary (listed in step 5) get an app-team review.
- **Scope of the app:** analytics stay in Power BI; the app handles data
  edits. Fabric Apps on semantic models (the semantic model connector, DAX
  queries under the signed-in user's identity) is a pattern to explore, not a
  decision.
- **Data for AI tools:** synthetic only for now. What may be referenced in a
  CLI coding agent versus a web chat is Cyber's call, and the answer may
  differ between the two.
- **Supply-chain gap (found 2026-11-03 by the review chat):** CI has no
  dependency audit and Dependabot is not set up. `npm audit` reports findings
  in Rayfin's tooling chain and the test runner. Fixing this is a follow-up
  prompt, not this PR.

Don't put the names of real people other than me in any committed file
(AGENTS.md hard rule). Refer to "the app development team", "Cyber" and "the
cloud/Fabric admin".

## Part A: inventory and measurements (no edits yet)

1. **Inventory every documentation-style file.** For each one, list what it
   says that is no longer true (quote the line), and the fix you propose.

   In scope:
   - `README.md`, `AGENTS.md`, `CLAUDE.md`
   - every file in `docs/`
   - `data/README.md`, `snowflake/README.md`
   - `app/row-tracker/README.md`
   - comments in `app/row-tracker/rayfin/data/*.ts` and
     `app/row-tracker/rayfin/rayfin.yml` (read only; see "Do not")
   - `.claude/skills/brillit-report-standards/**` (`SKILL.md`, `references/`,
     `CHANGELOG.md`)
   - `.claude/agents/pbi-report-reviewer.md`

   Out of scope (don't edit):
   - `prompts/`, which is the historical record (I add this prompt and its
     transcript myself)
   - `app/row-tracker/AGENTS.md` and `app/row-tracker/.agents/skills/**`,
     which are template files locked to Rayfin 1.36.2 (the root `AGENTS.md`
     wins where they differ)
   - LICENSE files, themes and any data files

   Known stale items to confirm (the list may not be complete):
   - `AGENTS.md` says only `ROW-POC-Dev` exists, and that `snowflake/` holds
     scripts `01_…` to `07_…`. The repo has `01`–`06` and `08`. Find out from
     `docs/decisions.md` or `git log` why `07` (the SVC_POWERBI service user)
     isn't in the repo, and say so. Don't create it.
   - The `AGENTS.md` data boundary doesn't mention that `FACT_ROW_PLAN` is now
     DirectQuery against the app's Fabric SQL database.
   - The root `README.md` is one line.
   - `app/row-tracker/README.md` describes the first slice: 15 seed rows, no
     ChangeLog, and a seed button.
   - The comment in `ClearingPlan.ts` says create is "temporarily enabled".
     Create has been off since PR #32.
   - `rayfin.yml` has `password: enabled: true`, the template default. Don't
     change it. Record it as a follow-up, citing the Rayfin doc in
     `node_modules` that says only Fabric sign-in works once deployed.
   - `docs/handoff-fabric-apps-poc.md` and `_brief/report-spec.md` are
     historical. Add one line at the top of each saying so and where the
     current information lives. Don't rewrite them.
   - `docs/poc-run-sheet.md` and any doc that still plans Phases 6 and 7: mark
     them cut (2026-10-28).

2. **Measure the footprint** so the docs carry real numbers. In
   `app/row-tracker`:
   - `npm ci`, then `npm run build`. Record the `dist/` file sizes and their
     gzip sizes.
   - Count the direct dependencies in `package.json` (runtime and dev).
   - Count the installed packages, and note that the count depends on the
     platform.
   - Run `npm audit --omit=dev --json` and `npm audit --json`. Give counts by
     severity, and for each high or critical finding, the package and the
     path it comes in through.
   - Build once with `--sourcemap` into a temp folder outside the repo. Use
     the source map to (a) give the share of the bundle by package and (b)
     check whether any package flagged by the audit ends up in the bundle.
     Write the analysis as a throwaway script in that temp folder; don't add a
     dependency.
   - Count the lines in `src/` and `rayfin/` compared with the unmodified
     template commit `61c3371`, with tests counted separately.

   Cross-check against the review chat's numbers from 2026-11-03:
   - bundle: 380 kB JS (117 kB gzipped) + 23 kB CSS
   - direct dependencies: 8 runtime, 19 dev
   - installed packages: 626 on Linux
   - audit, runtime tree: 9 high and 6 moderate; whole tree: 2 critical (in
     Vitest)
   - no flagged package in the bundle
   - template: about 1,127 lines; about 3,100 lines added, of which about 860
     are tests

   Report any differences. Don't force agreement.

**CHECKPOINT 1:** stop and give me the inventory as a table (file, stale
claim, proposed fix) and the measurements. I'll confirm the scope before you
edit anything.

## Part B: update the docs

3. Fix each confirmed stale item.

4. **Root `README.md`**: the entry point for a reviewer from the app team.
   Include:
   - what this is, in one paragraph;
   - the environment ladder: operational systems (never touched) → Snowflake
     (synthetic here; a daily clone at work) → BI dev workspace → BI prod
     workspace (approved deploys only);
   - a start-here reading order with links: entity files → `rayfin.yml` →
     `clearingPlans.ts` → `validation.ts` → `HomePage.tsx` →
     `FACT_ROW_PLAN.tmdl` → `.github/workflows/`;
   - how to run it locally;
   - where the docs live.

   Keep it to about 80 lines, in plain words, with no marketing.

5. **New `docs/governance.md`** with these sections. Mark proposals as
   proposals.
   - **Ownership and monitoring (proposed):** who builds, deploys and
     maintains; who monitors, and through what (GitHub read access and the
     security tab, Fabric workspace Viewer, Fabric audit and capacity
     monitoring). The service principal is the only identity that deploys to
     prod.
   - **Tier boundary (proposed):** changes that need an app-team review:
     - enabling a new service in `rayfin.yml`;
     - adding create or delete to an entity;
     - a new runtime dependency;
     - any change to `.github/workflows/` or the ruleset;
     - a new external endpoint.

     Everything inside the boundary is BI-team review only.
   - **Data for AI tools:** current rule (synthetic only), then a table with
     rows (synthetic data, schema and metadata, cloned rows, report
     screenshots, credentials) and columns (CLI agent, web chat), with "Cyber
     to decide" where nothing is decided. Note two facts that matter for
     Cyber:
     - a CLI agent can read any file on disk that its deny list doesn't block
       and can run commands, while a web chat sees only what is pasted,
       uploaded or reached through a connector;
     - the Power BI report skill samples rows from every table and
       screenshots every page by design.
   - **Dependency footprint:** the numbers from step 2, how they were
     measured, the date and the commit.
   - **Supply chain:** what is in place (lockfile + `npm ci`, actions pinned
     to SHAs, secret scanning and push protection, the required checks) and
     what isn't (dependency audit in CI, Dependabot), with the audit findings
     and why they don't reach the browser.
   - **Follow-ups:**
     - audit and Dependabot;
     - password sign-in off in `rayfin.yml`;
     - the shared redirect URIs;
     - issue #16 (server-side validation);
     - a prod report and its service credential;
     - syncing edits back to Snowflake;
     - the agent deny list not covering data folders (fine while data is
       synthetic).

6. **`AGENTS.md`:**
   - Extend the existing dependency rule. Any package added, removed or
     upgraded is listed in the PR with the reason and the bundle size before
     and after. No `npm audit fix` without my ask, and never with `--force`.
   - Point to `docs/governance.md`.
   - In the Fabric App section, add a short rule for each lesson below that
     would stop a repeat mistake, unless a rule already covers it. Rules, not
     history.
     - `rayfin up` runs `staticHosting.buildCommand` itself, so any `VITE_`
       flag must be set on the deploy step, and the shipped bundle is checked.
     - Clearing a field needs an explicit `null`, and saves are read back.
     - Tests that build the data API config need `npm run build` first.
     - A permission change updates the permission test's expectation in the
       same PR.
     - Snowflake exports UPPERCASE headers.
     - Snowsight worksheets are copies: paste the repo version before
       running.

7. **Skills:**
   - `brillit-report-standards`: add what the report work taught, where it is
     a standard rather than an agent rule (you decide, and explain each
     placement). For example:
     - in a composite model, `RELATED` fails across a limited relationship,
       so use `TREATAS`;
     - a TOM-only Int64 type reverts on refresh, so it needs a Power Query
       type step;
     - Desktop writes the `$schema` lines;
     - DirectQuery datetime columns are cast to date at the source.

     Bump `CHANGELOG.md`.
   - `pbi-report-reviewer.md`: add composite-model checks: storage mode per
     table, relationships that cross sources, and measures that rely on
     `RELATED`.
   - **New `.claude/skills/fabric-app-standards/SKILL.md`:** practices for a
     BI-owned Fabric App, taken from this build. Cover:
     - permissions in the entity decorators (fewest operations; no delete;
       create only through a gated PR pair);
     - an append-only audit entity with the identity pinned by the server;
     - cross-field rules in the form until there is a server Function;
     - read-back after each save;
     - feature flags checked in the shipped bundle;
     - the import and migration pattern;
     - a footprint line in every PR description;
     - the data boundary;
     - what not to do (`rayfin dev` provisions Fabric; don't register the
       Rayfin MCP server).

     Point to Rayfin's template skill rather than repeating it. Write the
     `description` so the skill loads for Fabric App work only. Under 150
     lines.

8. `ClearingPlan.ts`: fix the comment only. `app/row-tracker/README.md`:
   rewrite it for the current app.

9. Add rows to `docs/decisions.md` (the four decisions above, plus any you
   made) and add agent time to `docs/poc-log.md` (leave review time blank).

10. **Checks:**
    - `npm run build`, the tests and the linter pass.
    - The `dist/` bundle is byte-identical before and after the comment
      change: compare file hashes. This proves no behavior change.
    - `powerbi-report-author validate` is unchanged.
    - Every relative link in the files you touched resolves (a throwaway
      script outside the repo; no new dependency).
    - A grep for the stale phrases finds nothing ("Only the dev workspace",
      "15 seeded", "TEMPORARILY ENABLED").

**CHECKPOINT 2:** stop and give me:
- a diff summary per file;
- the check results, including the bundle hash comparison;
- what happens when I merge: this touches `app/row-tracker/`, so a push
  deploy starts and waits for my approval, and the bundle is identical;
- the proposed commits, with the paths to stage, grouped as docs, skills, and
  the app comment plus README.

## Do not

- Change code behavior, `rayfin.yml`, the workflows, `.claude/settings.json`,
  the ruleset or the PBIP.
- Edit `prompts/`, the Rayfin template skills or the LICENSE files.
- Deploy, or run `rayfin up`, `rayfin dev`, `az`, `fab` or `snow`.
- Install packages or run `npm audit fix`.
- Read any `.env` file.
- Push, open a pull request, or use `--force`.
