# Prompt 18: ROW Command Center, a second Fabric App (first iteration)

Given to Claude Code on branch `feat/command-center`, made from a freshly
pulled `main`. Kept here as a record of exactly what the agent was asked to do.

---

Read `AGENTS.md`, `docs/governance.md`, `docs/measures.md`,
`docs/data-model.md`, `docs/app-notes.md` and the `fabric-app-standards` skill
first, and follow them. Every rule written for `app/row-tracker` applies to
the new app as well.

## The goal

Build a **second** Fabric App in this repo, `app/row-command-center`, in **one
session**. It shows what a BI team can build quickly once the guardrails are
in place.

The first app (`app/row-tracker`) stays exactly as it is: **don't change
anything under `app/row-tracker/`.**

This is a first iteration. Favour breadth over polish: get every page working
end to end, then list the rough edges at the checkpoint instead of polishing
them.

**The selling point: one set of data, one semantic model, two front ends.**
- Every number and every status in the new app comes from the **same published
  semantic model as the Power BI report** (`row_pbi_poc` in `ROW-POC-Dev`),
  queried through the **semantic model connector** with DAX.
- Edits go to the **same Fabric SQL database** the first app uses (the
  `row-tracker` database in `ROW-POC-Dev`), through a **SQL database
  connector**.

So an edit made in the new app shows up in the first app's history, in the
report, and back on the new app's landing page. The app and the report can't
disagree, because the app calculates nothing itself.

## Hard limits for this work

- **No business logic in TypeScript.** Overdue, due soon, no date, coverage and
  status all come from model measures. The app only displays, filters, sorts and
  edits. If a number needs a definition that isn't in the model, add a measure
  (Part A, step 6). Don't compute it in the app.
- **Same write rules as the first app:**
  - `ClearingPlans`: read and update only; no create, no delete.
  - `ChangeLogs`: read and create only. Every edit writes one change-log row,
    so the first app's History shows edits made in the new app too.
  - Saves are read back and compared, and clearing a field sends an explicit
    `null`.
  - The edit form uses the same field and cross-field rules as
    `app/row-tracker/src/services/validation.ts`. Copy the rules (two apps can't
    share code without a shared package, which is out of scope) and note the
    duplication as a known gap.
- **Safe DAX.** Never put user-typed text into a DAX string. Any value in a
  query (a feeder ID for a deep link, for example) is checked against a fixed
  pattern or allowlist first, and that check has tests. Filters and slicers act
  on the rows already returned, in the browser.
- **Footprint budget:**
  - No runtime dependencies beyond what the template ships with and the
    connector packages `rayfin connector add` asks for.
  - No charting or UI libraries; charts are hand-written SVG or CSS.
  - Report the bundle size (raw and gzip) and the direct and installed package
    counts at both checkpoints, compared with the first app.
- **Dev only.**
  - The new app deploys only to `ROW-POC-Dev`, and only when I run it myself
    after review.
  - No prod workspace, no change to `deploy-prod.yml`.
  - Synthetic data only.

## Part A: scaffold, connect, prove it works (stop at Checkpoint 1)

1. **Pick the template.** Show me the available `create-rayfin` templates
   (pinned to the Rayfin version the first app uses, 1.36.2, unless a newer one
   is required for connectors). Recommend one: the Fabric data apps template if
   it's offered, otherwise the template closest to ours. Then give me the exact
   command and **wait for my approval** before running it. Scaffold into
   `app/row-command-center`.
2. **Commit the scaffold unmodified** as its own commit, so it becomes the
   baseline for the footprint comparison. Propose the paths and message; I
   approve.
3. **Find the sources.** I'll run `npx rayfin login` myself when you ask. Then
   use `npx rayfin connector search` to find the `row_pbi_poc` semantic model
   and the `row-tracker` SQL database in `ROW-POC-Dev`. Show me the IDs you'll
   use.
4. **Add the connectors.**
   - `fabric-semanticmodel` for `row_pbi_poc`: `executeQuery`, delegated auth.
   - `fabric-sqldatabase` for the `row-tracker` database: **delegated** auth (it
     defaults to application identity; change it before anything deploys), with
     operations narrowed as far as the connector allows.

   Read the connector package docs (`rayfin docs search`, or the package's
   `assets/docs/`) and answer two questions:
   - Can per-entity operations and `@role` policies enforce
     ClearingPlans = read + update and ChangeLogs = read + create?
   - Can a policy pin `changed_by` to the signed-in user's email, the way the
     first app does?

   If either answer is no, say exactly what can't be enforced and propose the
   fallback. Don't hide it.
5. **Install** the version-pinned packages that `connector add` prints. Ask
   first, and list each package with its reason.
6. **Add two measures to the model** (TMDL, in `@Measures`, folder
   `10 - Plan`), each with a validation query in `tests/dax/` and a row in
   `docs/measures.md`:
   - `Feeders Without a Date`: certainty "next year" or "TBD". Expected 10
     (2 + 8) on the original load; today's value may differ because of edits.
   - `% Plan Date Scheduled`: certainty confirmed or tentative, divided by
     Feeders in Plan. Expected 93.5% (143 / 153) on the original load.

   `powerbi-report-author validate` must pass. I'll open Desktop, check the
   values and republish to `ROW-POC-Dev` before Part B.
7. **Prove the DAX path.** Use `npx rayfin connector invoke` to run one DAX
   query against the published model that returns Feeders in Plan, Feeders
   Overdue, Feeders Due Soon, Feeders TBD, Feeders Next Year and
   `% Plan Date Confirmed`. Use only measures that exist in the published model
   now; the new ones arrive after I republish. Then run a second query that
   returns per-feeder rows with `Clearing Status`. Show both results. Also
   inspect the SQL connector's entities.
8. **Footprint after Part A:** bundle size, direct and installed package
   counts, and `npm audit --omit=dev` counts, each compared with the first app.

**CHECKPOINT 1.** Stop and give me:
- the template choice and why;
- the two connector configs;
- the enforcement answers from step 4 and any fallback;
- the DAX results;
- the measure diff and validate result;
- the footprint numbers;
- a one-screen build plan for Part B (pages, components, files);
- the proposed commits with the paths to stage.

Don't start Part B until I say go.

## Part B: build the first iteration (stop at Checkpoint 2)

Build these pages, sharing one layout and navigation.

**1. Today (landing page)**
- KPI cards from model measures: Feeders in Plan, Feeders Without a Date,
  Feeders Due Soon, Feeders Overdue, `% Plan Date Scheduled` (label it
  "Coverage"), and DQ Issues.
- Each card is clickable and opens the matching feeders. The feeder lists come
  from DAX using `Clearing Status` or the matching measure per feeder, not from
  filtering in TypeScript.
- Show a "data as of" line: the plan is live (DirectQuery); the dimensions are
  imported.

**2. Feeders (explorer)**
- Every feeder in one grid: feeder, circuit, substation, district, vendor,
  certainty, next clearing date, planned year, line miles, status.
- The rows come from one DAX query that joins the dimensions.
- Slicers for district, vendor, certainty, status and planned year; text
  search on feeder or circuit (in the browser); sortable columns.
- Clicking a row opens a side panel with the feeder's details, the **edit
  form**, and that feeder's history from `ChangeLogs`.
- After a save, the read-back runs, the DAX queries re-run, and the grid and
  KPIs update.

**3. Activity (all edits)**
- Every `ChangeLogs` row, newest first, filterable by person, date range and
  feeder. Show each change as field: old → new.

**4. Schedule**
- Upcoming next-clearing dates by month for the next 12 months, as a month
  grid or timeline, grouped or coloured by vendor.
- Hand-written SVG or CSS.
- Clicking an item opens the same feeder panel.

**5. Deep links**
- `?feeder=<id>` opens that feeder's panel. Validate the ID against the feeder
  pattern before using it.
- Write the URL format in the README, so a Power BI button (Web URL action) can
  link to it later. Don't change the report.

**Local run.** `npm run dev:frontend` (plain Vite) must work with no Fabric, as
the first app does:
- a stand-in sign-in, the same pattern as the first app, kept out of the
  production bundle;
- a small synthetic fixture shaped like the DAX and SQL results, in test or
  dev code only, never committed real data.

Say plainly which features can only be tested after a dev deploy.

**Tests:**
- the DAX query builders (no user text reaches a query; the deep-link check);
- the copied form rules;
- the read-back;
- the KPI-card-to-list wiring.

`npm run build`, the tests and the linter must pass.

**CI:** add a job to `.github/workflows/ci.yml` for the new app, the same
steps as the first app's job, with its own job name. This crosses the
governance tier boundary, so say so in the summary. I'll add the new job as a
required check myself.

**Docs:**
- `app/row-command-center/README.md`: what it is, the pages, the two
  connectors, local run, deep-link format, known gaps.
- A "Second app" section in `docs/app-notes.md`.
- Its footprint in `docs/governance.md`, next to the first app's.
- `AGENTS.md`: the repo map and the Fabric App section cover both apps.
- The `fabric-app-standards` skill description covers `app/*`.
- Rows in `docs/decisions.md`.
- `docs/poc-log.md`: record **agent time for each part**. The time is the
  point of this build.

**CHECKPOINT 2.** Stop and give me:
- what was built, page by page;
- screenshots of each page from the local run (synthetic fixture);
- the footprint compared with the first app and with Checkpoint 1, and the
  `npm audit` counts;
- the check results;
- known gaps and rough edges, in priority order;
- what I need to do to deploy it to `ROW-POC-Dev` and test it live;
- the proposed commits, grouped, with the paths to stage.

## Do not

- Change anything under `app/row-tracker/`, `deploy-prod.yml`, the report
  pages, or `.claude/settings.json`.
- Deploy, or run `rayfin up`, `rayfin dev`, `rayfin up db apply`, `az`, `fab`
  or `snow`. I deploy to dev myself after review. `rayfin connector search`,
  `inspect` and `invoke` are allowed, after I've logged in.
- Install any package I haven't approved, or run `npm audit fix`.
- Put user-typed text into DAX, or calculate business rules in TypeScript.
- Commit data files, or read any `.env` file.
- Push, open a pull request, or use `--force`.
