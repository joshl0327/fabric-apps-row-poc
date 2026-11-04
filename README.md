# fabric-apps-row-poc

A proof of concept showing that a BI team can build analytic apps safely with
Power BI, Snowflake and Fabric Apps — an AI coding agent does the build and a
human reviews every change. The domain is a right-of-way (vegetation) clearing
tracker for an electric cooperative's distribution feeders, replacing an
error-prone shared Excel spreadsheet. It has two halves: a **Power BI report**
on a semantic model, and a **Fabric App** (`app/row-tracker`, Rayfin SDK/CLI,
TypeScript) that handles the data edits the report can't. Everything here runs
on synthetic data only — no real cooperative, people, places or account numbers.

## Environment ladder

Each tier is more trusted than the one below, and nothing crosses a boundary
without a human:

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

The app and report, from the data model outward:

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

## Run it locally (no Fabric)

```bash
cd app/row-tracker
npm install            # first time only
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
