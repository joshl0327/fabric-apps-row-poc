# ROW Clearing Tracker (Fabric App)

The data-editing half of the ROW clearing POC, built on the Rayfin "Basic Todo
App" template. One feeder-plan entity (`ClearingPlan`) with a list + edit form,
a certainty picklist, a vendor dropdown and the cross-field cleaning rules; an
append-only `ChangeLog` audit entity; a one-time feeder-import path; and a
diagnostic claims panel. It is deployed to `ROW-POC-Prod` with the 153 feeders
loaded, and the Power BI report reads its SQL database over DirectQuery.
**Synthetic data only.**

Build notes, findings and open questions are in `docs/app-notes.md` (repo
root). Governance (ownership, tier boundary, footprint) is in
`docs/governance.md`. Project rules are in the repo-root `AGENTS.md` ("Fabric
App" section), which wins over this project's `AGENTS.md`.

## Getting started (local, no Fabric)

```bash
npm install            # first time only
npm run dev:frontend   # plain Vite: frontend only, synthetic auth, in-memory data
```

Open [http://localhost:5173](http://localhost:5173). Local mode serves a small
in-memory synthetic feeder list; edit one and try a rule violation (e.g.
"confirmed" with no next clearing date — the form blocks the save). It never
contacts Fabric.

> **Do not run `npm run dev` / `npx rayfin dev` for a local check.** Bare
> `rayfin dev` provisions a Fabric AppBackend by default — treat it as a deploy
> and ask first. See `docs/app-notes.md`.

## Permissions and gates

- `ClearingPlan`: `read` + `update` for any signed-in user. **No create, no
  delete.** Create is enabled only briefly, through a gated PR pair, for a
  one-time feeder load (see `docs/deploy.md`); it is off now.
- `ChangeLog`: `read` + `create` only — **append-only** (no update/delete
  mutation exists). `changed_by` is server-pinned to the caller's email.
- The feeder **Import panel** (and the empty-state load button) are behind the
  build flag `VITE_ENABLE_FEEDER_IMPORT` (off by default; runtime-gated).

## Project structure

```text
├── rayfin/
│   ├── rayfin.yml          # Fabric service configuration
│   └── data/
│       ├── ClearingPlan.ts # Feeder-plan entity (read + update; create gated/off)
│       ├── ChangeLog.ts    # Append-only audit entity (read + create only)
│       └── schema.ts        # Schema export consumed by the typed client
├── src/
│   ├── main.tsx            # Entry point + Rayfin client bootstrap
│   ├── App.tsx             # Routes and auth gate
│   ├── hooks/AuthContext.tsx      # Auth helpers + claims context
│   ├── components/
│   │   ├── AuthPage.tsx           # Sign-in UI
│   │   └── ClaimsPanel.tsx        # Diagnostic "Who am I" card
│   ├── pages/HomePage.tsx         # Feeder list, edit form, history, import panel
│   └── services/
│       ├── IAuthService.ts / LocalAuthService.ts / RayfinAuthService.ts  # auth
│       ├── rayfinClient.ts / bootstrap.ts   # client singleton + env wiring
│       ├── clearingPlanModel.ts   # Shared constants + row/edit types
│       ├── clearingPlans.ts       # List/update/seed (in-memory in local dev)
│       ├── validation.ts          # Field + cross-field rules (form-side)
│       ├── changeLog.ts / changeLogModel.ts  # Audit diff + log write
│       ├── import.ts / csv.ts      # One-time feeder import (upsert by feeder_id)
│       ├── seed.ts                 # Synthetic seed rows for local dev
│       ├── featureFlags.ts         # VITE_ENABLE_FEEDER_IMPORT gate
│       └── errors.ts               # Friendly error messages
└── package.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:frontend` | **Local run.** Plain Vite — frontend only, no Fabric, no backend |
| `npm run dev` | `rayfin dev` — provisions a Fabric backend (deploy-like; ask first) |
| `npm run build` | Production build (`tsc -b && vite build`) |
| `npm run build:fabric` | Build for Fabric deployment |
| `npm run lint` | Lint with ESLint |
| `npm run test` | Run unit tests with Vitest |
| `npm run rayfin:db` | Apply database migrations (Fabric; ask first) |
