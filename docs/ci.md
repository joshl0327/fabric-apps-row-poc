# CI: checks on every pull request

`.github/workflows/ci.yml` runs the same checks the coding agent runs locally,
on every pull request to `main` (and on demand via **Run workflow** /
`workflow_dispatch`). Once the job names below are **required** in the "Protect
main" ruleset, a pull request cannot merge until they pass.

This is Phase 5, part 1. It is deliberately read-only: `permissions:
contents: read`, no secrets, no tokens, no deploy or publish step, and no
contact with Fabric or Snowflake. Part 2 adds the prod workspace and the deploy
job that runs from `main` and only after a human approval — see `docs/deploy.md`
(`.github/workflows/deploy-prod.yml`).

## What runs

Two independent jobs:

### `App build, test, lint` (Ubuntu)

Runs in `app/row-tracker`:

1. `npm ci` — clean install from the committed `package-lock.json`.
2. `npm run build` — `rayfin env --framework vite` (prebuild) then
   `tsc -b && vite build`.
3. `npm test` — the Vitest suite (49 tests).
4. `npm run lint` — ESLint.

**Build runs before the tests on purpose.** The append-only `ChangeLog`
permission test (`src/__tests__/changeLogPermissions.test.ts`) imports the
`tsc`-compiled entities from `rayfin/.temp/compiled/`, which only exist after
`npm run build`. This is the same order the Definition of Done requires.

Node is pinned to **24**, the version the project uses locally (v24.20).
`RAYFIN_TELEMETRY_OPTOUT=1` is set so the Rayfin CLI collects nothing in CI.

**No Fabric sign-in.** The only Rayfin command the build runs is `rayfin env
--framework vite`, whose entire job is to map `RAYFIN_PUBLIC_*` variables into a
`.env.local`. It makes no Fabric API call and needs no `rayfin login`. The
gitignored `rayfin/.env` is absent in CI; the build tolerates that (Vite only
fails the build when a *remote* `VITE_RAYFIN_API_URL` is set without a
publishable key, which never happens here), and `rayfin env` just writes a
`.env.local` from whatever `RAYFIN_PUBLIC_*` it finds. Verified by running the
full `build → test → lint` chain locally with no `rayfin/.env` present.

### `Report PBIR validate` (Ubuntu)

1. `npm install -g @microsoft/powerbi-report-authoring-cli@0.5.0`.
2. `powerbi-report-author validate "powerbi/row_pbi_poc.Report"`.

`validate` is a full PBIR conformance check — JSON Schema, object IDs,
formatting, theme, layout — that reads the report files on disk. It exits
non-zero on any error.

**Why Ubuntu, not Windows.** The CLI is a cross-platform Node package
(`engines.node >= 20`, no `os` restriction) and `validate` is pure in-process
validation (`ajv`). Only the CLI's `preview --host desktop` path needs Windows,
because it drives Power BI Desktop over a named pipe — and CI never previews.
Running the check on Linux is faster and cheaper. `PLAYWRIGHT_SKIP_BROWSER_
DOWNLOAD=1` is set so installing the CLI does not pull Playwright's browsers,
which `validate` never uses.

## Guardrails on the workflow itself

- **`permissions: contents: read`** at the top — the workflow can read the
  repo and nothing else. No write, no token minting, no deploy.
- **Third-party actions pinned to a full commit SHA**, with the version in a
  trailing comment, so a moved tag cannot change what runs:
  - `actions/checkout` → `3d3c42e5aac5ba805825da76410c181273ba90b1` (v7.0.1)
  - `actions/setup-node` → `949feb2413d6458794dcd2491c4babbbce0c15c1` (v7.1.0)

  Both SHAs were resolved from the actions' latest release tags with `gh api`.
- **Clear, stable job names** (`App build, test, lint`, `Report PBIR validate`)
  so they can be selected as required checks.

## How to read a failure

Open the failed run from the PR's **Checks** tab and expand the failed step.

| Step | A failure usually means |
|---|---|
| Install dependencies (`npm ci`) | `package-lock.json` is out of sync with `package.json`. Run `npm install` in `app/row-tracker` and commit the updated lockfile. |
| Build | A TypeScript compile error (`tsc -b`) or a Vite build error. The log names the file and line. |
| Test | A Vitest assertion failed. If it is `changeLogPermissions.test.ts`, the build output is missing or an entity's permissions changed — check the decorators in `rayfin/data/`. |
| Lint | An ESLint error. (Warnings, like the known one in `AuthContext.tsx`, do not fail the job.) |
| Validate report | PBIR conformance error. The JSON diagnostic names the code and object; fix the report files and re-run. |

## Ruleset change (do this after merge)

In the GitHub **"Protect main"** ruleset, under **Require status checks to
pass**, add these two checks (type the exact names):

- `App build, test, lint`
- `Report PBIR validate`

Then confirm **"Require a pull request before merging"** is on so the checks
are actually gated. After this, a PR whose CI fails cannot be merged.
