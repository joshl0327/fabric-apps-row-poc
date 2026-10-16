# ROW Clearing Tracker (Fabric App)

The first thin slice of the right-of-way clearing tracker, built on the Rayfin
"Basic Todo App" template. One feeder-plan entity (`ClearingPlan`) with a list +
edit form, a certainty picklist, a vendor dropdown, the cross-field cleaning
rules, and a diagnostic claims panel. **Synthetic data only.**

Build notes, findings, and open questions are in `docs/app-notes.md` (repo
root). Project rules are in the repo-root `AGENTS.md` ("Fabric App" section),
which wins over this project's `AGENTS.md`.

## Getting started (local, no Fabric)

```bash
npm install            # first time only
npm run dev:frontend   # plain Vite: frontend only, synthetic auth, in-memory seed
```

Open [http://localhost:5173](http://localhost:5173). The list shows 15 seeded
feeders; edit one and try a rule violation (e.g. "confirmed" with no next
clearing date — the form blocks the save).

> **Do not run `npm run dev` / `npx rayfin dev` for a local check.** Bare
> `rayfin dev` provisions a Fabric AppBackend by default — treat it as a deploy
> and ask first. See `docs/app-notes.md`.

## Project structure

```text
├── rayfin/
│   ├── rayfin.yml          # Fabric service configuration
│   └── data/
│       ├── ClearingPlan.ts # Feeder-plan entity (read+update; create gated for seeding)
│       └── schema.ts       # Schema export consumed by the typed client
├── src/
│   ├── main.tsx            # Entry point + Rayfin client bootstrap
│   ├── App.tsx             # Routes and auth gate
│   ├── hooks/
│   │   └── AuthContext.tsx # React context wrapping the auth helpers + claims
│   ├── components/
│   │   ├── AuthPage.tsx    # Sign-in UI
│   │   └── ClaimsPanel.tsx # Diagnostic "Who am I" card
│   ├── pages/
│   │   └── HomePage.tsx    # Feeder list + edit form + seed button
│   └── services/
│       ├── IAuthService.ts        # Auth service contract + AuthUser type
│       ├── LocalAuthService.ts    # Backend-free local auth (DEV-only)
│       ├── RayfinAuthService.ts   # Production impl (Fabric brokered auth)
│       ├── rayfinClient.ts        # Typed Rayfin client singleton
│       ├── bootstrap.ts           # Reads env, picks the right auth service
│       ├── clearingPlanModel.ts   # Shared constants + row/edit types
│       ├── clearingPlans.ts        # List/update/seed (in-memory in local dev)
│       ├── validation.ts           # Field + cross-field rules (form-side)
│       └── seed.ts                 # 15 synthetic feeder rows
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
