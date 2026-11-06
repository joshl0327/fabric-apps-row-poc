# ROW Command Center

A **second** Fabric App in this repo (after `app/row-tracker`), built to show what
a BI team can stand up quickly once the guardrails are in place. It is the
"analyst front end" over the **same data as the Power BI report**:

> **One set of data, one semantic model, two front ends.** Every number and
> status comes from the **same published semantic model** as the report
> (`row_pbi_poc` in `ROW-POC-Dev`), queried with DAX through the **semantic model
> connector**. Edits go to the **same Fabric SQL database** the first app uses
> (`row-tracker`, `dbo.ClearingPlans` / `dbo.ChangeLogs`) through a **SQL database
> connector**. The app calculates nothing itself, so it can't disagree with the
> report. An edit here shows up in the first app's history, in the report, and
> back on this app's landing page.

Synthetic data only. Dev workspace `ROW-POC-Dev` only.

## Pages

| Page | What it shows | Source |
|---|---|---|
| **Today** | KPI cards — Feeders in Plan, Coverage (`% Plan Date Scheduled`), Overdue, Due Soon, Without a Date, DQ Issues. Each card opens the matching feeders. | Model measures (DAX). Card lists come from DAX by `Clearing Status` / certainty, never TS filtering. |
| **Feeders** | Every feeder in one grid (`fabric-datagrid`) — feeder, circuit, substation, district, vendor, certainty, next date, planned year, line miles, status. Slicers + text search + sort in the browser. Row opens the side panel. | One DAX query joining the dimensions. |
| **Activity** | Every `ChangeLogs` row, newest first, filterable by person, date range and feeder; each change as *field: old → new*. | SQL connector. Includes edits made in the first app (shared table). |
| **Schedule** | Next 12 months of clearing, by month and vendor (`fabric-visuals` Vega stacked bar), plus a clickable upcoming-feeders list. | DAX (month×vendor and a per-feeder upcoming query). |

Clicking a feeder anywhere opens a **side panel**: details, the **edit form**
(same field + cross-field rules as the first app), and that feeder's **history**.
A save runs the read-back guard, writes one `ChangeLog` row, and refreshes the
grid and KPIs.

## The two connectors

Declared in `rayfin/rayfin.yml`, both scoped to `ROW-POC-Dev`:

- **`row_pbi_poc`** — `fabric-semanticmodel` (Category B), `executeQuery` only,
  **delegated** auth. DAX built by `src/lib/dax/queries.ts` (safe DAX only).
- **`row-tracker`** — `fabric-sqldatabase` (Category A), **delegated** auth,
  operations narrowed to `read, create, update` (no delete). Entities generated
  for `ClearingPlans` (read + update) and `ChangeLogs` (read + create, with a
  create policy pinning `changed_by` to the caller's email). `Users` and
  `storage.objects` are deliberately not generated.

## Local run (no Fabric)

```bash
cd app/row-command-center
npm install        # first time
npm run dev:frontend
```

Plain Vite — no Fabric, no backend. A DEV-only stand-in sign-in
(`LocalAuthService`) resolves instantly to a synthetic user, and the data comes
from in-memory synthetic fixtures (`src/services/local-backend.ts`,
`src/lib/analytics-fixture.ts`). Both are gated behind `isLocalBackend()` and
tree-shaken from production builds.

**Only verifiable after a dev deploy:** real DAX against the published model,
real SQL reads/writes, the live edit→report loop, and Fabric SSO. Locally the
DAX-side numbers are **static fixtures** (they do not recompute when you edit a
feeder — the app holds no business logic to recompute them); the SQL-side feeder
list, edit and history **are** live in memory.

## Deep links

`?feeder=<id>` opens that feeder's panel on load. The id is validated against the
feeder pattern (`^[0-9]{1,5}-[0-9]{1,3}$`) before use, so a crafted URL can't
reach a query.

```
https://<app-host>/?feeder=214-1
```

A Power BI button (Web URL action) can link straight to a feeder with this
format. (The report is not changed by this app.)

## Known gaps / rough edges (first iteration)

- **Duplicated rules.** `src/services/validation.ts`, `errors.ts` and
  `changeLogModel.ts` are copied from `app/row-tracker` — two apps can't share
  code without a shared package (out of scope). A rule change must be made in
  both apps in the same PR. See `docs/governance.md`.
- **Cross-field rules are form-only** (same finding as the first app): a direct
  API write could still store an inconsistent row until a server-side Function
  exists.
- **Local DAX fixtures are static** — a local edit updates the SQL store and the
  panel/history but not the fixture KPIs/status. The live recompute is a Fabric
  behaviour.
- **Per-locale chunks still ship.** The app loads only `en` at runtime, but
  `@microsoft/fabric-visuals-core` still code-splits ~45 per-locale chunks into
  `dist/` from its own dynamic imports; dropping them would mean overriding the
  vendor's imports, so they're left (lazy, never fetched in this English app).
- **Schedule bar chart isn't click-wired** (it's aggregated by month/vendor); the
  per-feeder list beneath it is the drill-to-panel path.
- **The scaffold shipped `.github/workflows/codeql.yml`** inside the app folder;
  nested workflows are inert (GitHub only runs repo-root workflows). Left as a
  template artifact; a candidate to remove.
