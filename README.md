# fabric-apps-row-poc

A proof of concept showing that a BI team can build analytic apps safely with
Power BI, Snowflake and Fabric Apps — an AI coding agent does the build and a
human reviews every change. The domain is a right-of-way (vegetation) clearing
tracker for an electric cooperative's distribution feeders, replacing an
error-prone shared Excel spreadsheet. At its centre is a **Power BI report** on
a semantic model, with **two Fabric Apps** (Rayfin SDK/CLI, TypeScript) over the
same data. Everything here runs on synthetic data only — no real cooperative,
people, places or account numbers.

## Two apps

Both apps read the **same published semantic model** and write the **same Fabric
SQL database**; they share the `ClearingPlans` / `ChangeLogs` tables and their
write rules.

- **`app/row-tracker`** — the first app and the end-to-end POC: synthetic data →
  Snowflake → semantic model → report → editor app → a prod deploy gated by a
  human approval (GitHub Actions). This is the app most of the docs describe.
- **`app/row-command-center`** — the second app, built in one session: an analyst
  front end that reads every number and status from the semantic model (DAX, via
  the `fabric-semanticmodel` connector) and writes edits to the SQL database (via
  the `fabric-sqldatabase` connector). **Dev only** (`ROW-POC-Dev`), deployed by
  hand; it has no prod workspace and no Actions job.

## Environment ladder

Data flows down from the operational systems through an automated daily clone;
the agent works only in the BI dev workspace; and nothing reaches the BI prod
workspace without a human approval.

1. **Operational systems** — the utility's systems of record. **Never touched**
   by this project.
2. **Snowflake** — the analytics database. Synthetic data in this POC; at work
   it would be a **daily clone** of operational data, never the live system.
3. **BI dev workspace** (`ROW-POC-Dev`) — where the agent and developer build
   and test. The agent only ever works here.
4. **BI prod workspace** (`ROW-POC-Prod`) — **approved deploys only**, reached
   solely through the GitHub Actions deploy job after a human approval. The
   agent never touches it.

## Start here (reading order for a reviewer)

### The first app (`app/row-tracker`) and report, from the data model outward:

1. [`app/row-tracker/rayfin/data/ClearingPlan.ts`](app/row-tracker/rayfin/data/ClearingPlan.ts)
   and [`ChangeLog.ts`](app/row-tracker/rayfin/data/ChangeLog.ts) — the entities
   (columns, permissions, the append-only audit log).
2. [`app/row-tracker/rayfin/rayfin.yml`](app/row-tracker/rayfin/rayfin.yml) —
   the Fabric service config (auth, data dialect, static hosting).
3. [`app/row-tracker/src/services/clearingPlans.ts`](app/row-tracker/src/services/clearingPlans.ts)
   — how data is read and written (in-memory locally; the typed Rayfin client
   against Fabric).
4. [`app/row-tracker/src/services/validation.ts`](app/row-tracker/src/services/validation.ts)
   — the field and cross-field rules enforced in the edit form.
5. [`app/row-tracker/src/pages/HomePage.tsx`](app/row-tracker/src/pages/HomePage.tsx)
   — the UI: feeder list, edit form, change history, import panel.
6. [`powerbi/row_pbi_poc.SemanticModel/definition/tables/FACT_ROW_PLAN.tmdl`](powerbi/row_pbi_poc.SemanticModel/definition/tables/FACT_ROW_PLAN.tmdl)
   — how the report reads the app's data (DirectQuery; the rest of the model is
   Import from Snowflake, so the model is composite).
7. [`.github/workflows/`](.github/workflows/) — [`ci.yml`](.github/workflows/ci.yml)
   (checks on every PR) and [`deploy-prod.yml`](.github/workflows/deploy-prod.yml)
   (the only path to prod, gated by a human approval).

### The second app (`app/row-command-center`), from the connectors inward:

1. [`app/row-command-center/rayfin/rayfin.yml`](app/row-command-center/rayfin/rayfin.yml)
   — the two connectors (`fabric-semanticmodel` for DAX, `fabric-sqldatabase` for
   edits).
2. [`app/row-command-center/rayfin/connectors/row-tracker/`](app/row-command-center/rayfin/connectors/row-tracker/)
   — the SQL entities and their `@role` policies (the same grants as the first
   app, including the server-pinned `changed_by`).
3. [`app/row-command-center/src/lib/dax/`](app/row-command-center/src/lib/dax/)
   — the safe DAX queries (allowlists and a feeder-id pattern; no user text
   interpolated).
4. [`app/row-command-center/src/pages/`](app/row-command-center/src/pages/) — the
   UI (Today, Feeders, Schedule, Activity).
5. [`app/row-command-center/README.md`](app/row-command-center/README.md) — the
   full write-up.

## Run it locally (no Fabric)

Needs Node 24 (matches `.github/workflows/ci.yml`).

```bash
cd app/row-tracker
npm ci                 # first time only (uses the committed lockfile, like CI)
npm run dev:frontend   # plain Vite: frontend only, synthetic auth, in-memory data
```

Open http://localhost:5173. This never contacts Fabric. (`npm run dev` /
`npx rayfin dev` provisions a Fabric backend — treat it as a deploy and ask
first.)

## Where the docs live

- **`AGENTS.md`** — the rules every coding agent follows (hard rules, data
  boundary, stack, model map, conventions). `CLAUDE.md` imports it.
- **`docs/governance.md`** — ownership, the tier boundary, data rules for AI
  tools, the dependency footprint and the supply-chain posture.
- **`docs/`** — [`data-model.md`](docs/data-model.md), [`measures.md`](docs/measures.md),
  [`cleaning-rules.md`](docs/cleaning-rules.md), [`app-notes.md`](docs/app-notes.md),
  [`ci.md`](docs/ci.md), [`deploy.md`](docs/deploy.md), [`decisions.md`](docs/decisions.md)
  (the running decision log) and [`poc-log.md`](docs/poc-log.md).
- **`snowflake/`**, **`data/`**, **`themes/`**, **`prompts/`** each have their
  own README or are self-describing; `prompts/` is the historical record of
  every prompt given to the agent.
