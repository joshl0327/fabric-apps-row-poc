---
name: fabric-app-standards
description: House practices for a BI-owned Fabric App (Rayfin SDK/CLI, TypeScript) in app/row-tracker — entity permissions, append-only audit, form-side cross-field rules, save read-back, feature-flag gating, the import/migration pattern, a PR footprint line, and the data boundary. Load only for Fabric App work in app/row-tracker; for Power BI reports use brillit-report-standards, for the semantic model use semantic-model-authoring.
---

# Fabric App standards (BI-owned)

House practices for the ROW clearing Fabric App, drawn from this build. They sit
on top of Rayfin's own template skill (`app/row-tracker/.agents/skills/rayfin/`)
and the repo-root `AGENTS.md` ("Fabric App" section), which wins where they
disagree. Read Rayfin specifics there; this file is only the house rules, not a
Rayfin tutorial.

## Permissions

- **Fewest operations.** An entity grants only the operations it needs. Default
  to `read` + `update`; add nothing speculatively.
- **No `delete`.** One-off cleanups go through a direct, auditable SQL statement
  in the Fabric SQL query editor, not an app delete grant.
- **`create` only through a gated PR pair.** If a one-time load needs create,
  open it in one PR, run the load, then close it in a follow-up PR — never leave
  it on. With no create grant, DAB exposes no `create*` mutation at all.
- **A permission change updates its test in the same PR.** The permission test
  reads the generated DAB config from the `tsc`-compiled decorators (run
  `npm run build` first), so it must move with any decorator change.

## Audit trail

- Keep an **append-only audit entity** (`read` + `create` only, no update/delete)
  — DAB then exposes no mutation that could alter or remove a log row.
- **Pin the identity server-side.** The "who" field uses a create policy tying
  it to a claim (e.g. `@claims.email eq @item.changed_by`) so the browser can't
  forge it. Client-set fields (like `updated_by`) are **not** audit-grade; say so.

## Validation

- **Cross-field rules live in the edit form** (one place) until a server-side
  Rayfin **Function** exists. Rayfin schema validation and DAB are per-field
  only, so a direct API write can still store an inconsistent row — record that
  as a known gap, don't pretend the form is enforcement.
- **Read back after every save.** Re-read the saved row and compare field by
  field; error on any field the server kept differently. Clearing a field needs
  an explicit `null` (not `undefined`, which means "leave unchanged").

## Feature flags

- Gate one-time / risky UI behind a `VITE_*` build flag, **off by default**.
- The gate is a **runtime** check — the gated code is **not** tree-shaken out, so
  verify what shipped by grepping the built bundle for the inlined literal
  (`VITE_...:"true"`), not by assuming absence. `rayfin up` runs its own build
  via `staticHosting.buildCommand`, so set the flag on the **deploy** step, not
  just a prior build gate.

## Import / migration

- Load data through an **in-app import** (file picker) that **upserts by a
  natural key**, validates every row with the form rules, and reports
  created / updated / skipped against expected counts — not a bundled data file
  (the repo forbids committing data) and not a build-time seed.
- Keep synthetic export headers in mind: **Snowflake exports UPPERCASE columns**.

## Every PR

- Put a **footprint line** in the PR description: bundle size (raw + gzip),
  direct-dependency and installed-package counts, and — if dependencies changed
  — the before/after. See `docs/governance.md` for the current numbers and how
  they were measured.

## Data boundary

- Synthetic data only. Local run is **plain Vite** (`npm run dev:frontend`) and
  must not touch Fabric.

## Don't

- Don't run `npx rayfin dev` / `npm run dev` for a local check — it provisions a
  Fabric AppBackend by default; treat it as a deploy and ask first.
- Don't deploy, apply a DB schema, or install an npm package without being asked.
- Don't register or start the Rayfin **MCP server**, and don't edit `.mcp.json`.
- Don't read `.env` files.
