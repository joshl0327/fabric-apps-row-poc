# Prompt 18b: bring the entry docs up to date for the second app

Given to Claude Code on branch `docs/second-app`, made from a freshly pulled
`main`. Docs only.

---

Read `AGENTS.md` first and follow it. A review of `main` after prompt 18 found
that the deep docs cover the second app (`app-notes`, `governance`,
`measures`, `AGENTS.md`, the skill and the app's README), but the entry docs
don't. Fix these four:

1. **`README.md`** (the reviewer entry point) never mentions
   `app/row-command-center`. Add a short "Two apps" section near the top:
   - `app/row-tracker`: the end-to-end POC (synthetic data → Snowflake →
     report → app → gated prod deploy).
   - `app/row-command-center`: the second app, built in one session over the
     same semantic model (DAX via the semantic model connector) and the same SQL
     database (SQL database connector). Dev only, deployed by hand.

   Add a short start-here list for the second app:
   1. `rayfin/rayfin.yml` (the two connectors)
   2. `rayfin/connectors/row-tracker/*.ts` (entities and policies)
   3. `src/lib/dax/` (safe queries)
   4. `src/pages/`
   5. `app/row-command-center/README.md`

   Keep the README under about 110 lines.

2. **`docs/ci.md`** describes only the first app's job. Add the "Command Center
   build, test, lint" job:
   - its steps, including the `node --check` bundle parse step and why it
     exists;
   - that it's a required check.

   Update the test counts so they match today's suite in each app (run the
   tests to get them).

3. **`docs/deploy.md`** covers only the prod path. Add a short section: the
   second app is dev only (`ROW-POC-Dev`), deployed by a person with
   `npx rayfin up` from `app/row-command-center` after review. It has no prod
   workspace and no Actions job; `deploy-prod.yml` watches only
   `app/row-tracker/**`.

4. **`docs/app-notes.md`:** the second-app section says 149 tests; use the
   current count.

**Checks:**
- Every relative link in the touched files resolves (a throwaway script
  outside the repo).
- `git diff --stat main -- app/ .github/` is empty.

**CHECKPOINT:** stop and give me the diff summary, the check results, and one
proposed commit with the paths to stage. Leave the prompt file out.

## Do not

- Touch anything under `app/`, `.github/`, `powerbi/` or `prompts/`.
- Deploy, install packages, push, open a pull request, or use `--force`.
