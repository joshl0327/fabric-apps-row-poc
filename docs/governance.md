# Governance: ownership, boundaries, data and supply chain

How this BI-owned Fabric App is owned, monitored and changed, what data may be
used with AI tools, and the dependency and supply-chain posture. Items marked
**(proposed)** are not yet agreed with the app development team.

## Ownership and monitoring (proposed)

- **Builds, deploys and maintains:** the **BI team**. All code changes go
  through a reviewed pull request; production is reached only through the
  approved deploy job (see `docs/deploy.md`).
- **The service principal is the only identity that deploys to prod.** The
  `gh-row-poc-deploy` Entra app, via a GitHub OIDC federated credential (no
  stored secret), is what `rayfin up` runs as against `ROW-POC-Prod`. No person
  deploys to prod from a laptop.
- **Monitors freely (read-only):** the **app development team**, **Cyber** and
  the **cloud/Fabric admin**, through:
  - GitHub **read** access and the repository **Security** tab (secret
    scanning, Dependabot alerts);
  - **Fabric workspace Viewer** on `ROW-POC-Prod`;
  - **Fabric audit logs** and **capacity monitoring**.

## Tier boundary (proposed)

A change needs an **app-team review** when it crosses the tier boundary:

- enabling a new service in `rayfin.yml`;
- adding **create** or **delete** to an entity;
- a new **runtime** dependency;
- any change to `.github/workflows/` or the branch ruleset;
- a new **external endpoint**;
- a change to the **agent guardrails** (the hard rules in `AGENTS.md`, and
  `.claude/settings.json`).

Everything inside the boundary — report and measure changes, UI, validation,
dev-only tooling, docs — is **BI-team review only**.

The boundary is a **policy; nothing enforces it yet**. A `CODEOWNERS` file
covering the boundary paths, plus "require review from code owners" in the
ruleset, would enforce it once the app team has access to the repo.

## Data for AI tools

**Current rule: synthetic data only.** What may be referenced in a CLI coding
agent versus a web chat is **Cyber's call**, and the answer may differ between
the two.

| Data | CLI coding agent | Web chat |
|---|---|---|
| Synthetic data | allowed (this POC) | allowed (this POC) |
| Schema and metadata | Cyber to decide | Cyber to decide |
| Cloned rows (daily clone at work) | Cyber to decide | Cyber to decide |
| Report screenshots | Cyber to decide | Cyber to decide |
| Credentials | never | never |

Two facts that matter for that decision:

- A **CLI coding agent can read any file on disk** that its deny list doesn't
  block and can **run commands**; a **web chat** sees only what is pasted,
  uploaded or reached through a connector.
- The **Power BI report skill samples rows from every table and screenshots
  every page by design** — safe here only because the data is synthetic.

## Dependency footprint

Measured in `app/row-tracker` on **2026-11-04**, at commit **`54c492e`**, on
Windows with Node v24.20.0 / npm 11.19.0, after `npm ci` then `npm run build`.

- **Bundle (`dist/`):** `index.js` 381 kB (117 kB gzip), `index.css` 23 kB
  (5 kB gzip), `index.html` 0.7 kB.
- **Direct dependencies:** 8 runtime, 19 dev (`package.json`).
- **Installed packages:** 626 (`npm ls --all`, excluding the root project). The
  count can vary by platform — the win32 optional binaries (`@rollup/*-win32-*`,
  `@swc/core-win32-*`, `lightningcss-win32-*`, `@tailwindcss/oxide-win32-*`)
  stand in for their Linux counterparts.
- **Bundle share by package** (source-map attribution): `react-dom` ~55%,
  `react-router` ~10%, app source ~10%, the `@microsoft/rayfin-*` packages
  ~19% combined, the rest <2% each.
- **Lines of hand-written code** vs the unmodified template commit `61c3371`
  (`src/` + `rayfin/`, excluding `.temp/` and the generated `tsconfig.json` /
  `.project.json` / `.lockfile.json` / `.gitignore`): template ≈ 1,067 lines;
  `git diff 61c3371 → HEAD` is **+3,095 / −374**, of which **859 added lines
  are tests**.

## Supply chain

**In place:**

- A committed `package-lock.json` and **`npm ci`** (clean, reproducible installs)
  in CI and the deploy job.
- GitHub Actions **pinned to full commit SHAs**, version in a trailing comment.
- GitHub **secret scanning + push protection**.
- **Required status checks** on `main` (`App build, test, lint` and
  `Report PBIR validate`) behind a required pull request.
- The **dependency graph** and **Dependabot alerts** (enabled 2026-11-05).
  Alerts are grouped **one per advisory, not one per package**, so their count
  won't match the `npm audit` package counts one for one.

**Not in place (follow-ups):**

- a **dependency audit in CI**;
- **Dependabot version updates and security update PRs** (a later prompt).

**Audit findings (same run as the footprint).** `npm audit`:

| Scope | critical | high | moderate |
|---|---|---|---|
| runtime (`--omit=dev`) | 0 | 9 | 6 |
| whole tree | 2 | 9 | 18 |

- The **9 high** (runtime) are all in the **Rayfin CLI/SDK tooling chain**. Two
  advisories carry them: `@azure/msal-node` (auth-code flow may disclose
  parameters) and `zod` (memory exhaustion on oversized collections); the other
  flagged `@azure/*` / `@microsoft/rayfin-*` packages are flagged only because
  they depend on those.
- The **2 critical** are **dev-only**: `tinypool` (prototype-pollution → RCE)
  and `vitest` (path traversal via `@vitest/mocker`) — the test runner.

**Why they don't reach the browser.** A source-map analysis of the shipped
bundle shows **no package carrying an advisory reaches the browser**; two
bundled Rayfin packages (`@microsoft/rayfin-client`, `@microsoft/rayfin-local-dev`)
are flagged **only because they depend on that chain**, and the vulnerable code
itself (`@azure/msal-node`, `zod`, the connectors, the test runner) is not in
`dist/`. The CLI/SDK tooling and the test runner run only on a developer machine
or the CI/deploy runner, never in the user's browser.

## Follow-ups

- a **dependency audit in CI** and **Dependabot version updates and security
  update PRs** (a later prompt);
- turn **password sign-in off** in `rayfin.yml` (the template default; the Rayfin
  docs say only Fabric sign-in works once the app is deployed);
- a **per-environment `allowedRedirectUris`** list (the shared redirect URIs are
  a documented known gap — see `docs/deploy.md`);
- **issue #16** — server-side (cross-field) validation via a Rayfin Function;
- a **published prod report** and its service credential (the report runs in
  Desktop only today);
- **syncing edits back to Snowflake** (`APP_SYNC`), cut from this POC;
- the **agent deny list does not cover the data folders** — fine while the data
  is synthetic, but it should before any real/cloned data is present.
