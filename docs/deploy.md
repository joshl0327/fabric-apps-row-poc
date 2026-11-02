# Prod deploy: how the app reaches ROW-POC-Prod

`.github/workflows/deploy-prod.yml` is the **only** path the Fabric App takes to
production. Nobody deploys to prod from a laptop, and the coding agent never
deploys. This is the direct answer to the ops team's concern about automated
pushes to production: a deploy runs from `main`, in GitHub Actions, and **waits
for a person to approve it** before it touches Fabric.

This is Phase 5, part 2. Part 1 (`docs/ci.md`) added the read-only PR checks.

## How a prod deploy happens

1. **Merge to `main`.** A pull request that changes `app/row-tracker/**` is
   reviewed and merged (the PR itself already passed the CI checks from part 1).
2. **The job starts and waits.** The push to `main` triggers `deploy-prod.yml`.
   The job declares `environment: prod`, whose **required reviewer** is
   `joshl0327`, so it pauses at the approval gate — nothing has touched Fabric
   yet.
3. **Approve.** The reviewer approves the deployment in the run's page (or in the
   repo's **Environments → prod** deployment history). Only then does the job
   continue.
4. **Deploy.** The job builds and tests the app, signs in to Azure with OIDC,
   gets a Fabric API token, and runs `rayfin up` against **ROW-POC-Prod**. The
   job summary shows the commit, who triggered it, whether this build enabled
   the feeder import (see "Feeder-import deploys" below), and the app URL.

**The app URL in the summary** is read from `rayfin up`'s `--output json`
(never from any `.env` file): the summary step recursively picks the first
string that is a Fabric hosting URL (`*.webapp.fabricapps.net`), so it doesn't
depend on where Rayfin nests the field. The first prod deploy's fixed-path
lookup missed it and printed "App URL: not reported by this run". If the JSON
still carries no hosting URL (e.g. a `rayfin up status --output json` shape
without one), the summary falls back to **"not reported by this run — see the
App item in ROW-POC-Prod"**: open the App item in that workspace to get its
address.

You can also start a deploy by hand from the **Actions** tab (**Run workflow** /
`workflow_dispatch`) — it still stops at the same approval gate.

## What the job can and can't do

**Can:**

- Build (`npm run build`) and test (`npm test`) the app — deploy only what passes.
- Sign in to Azure as the **`gh-row-poc-deploy`** Entra app through a GitHub OIDC
  **federated credential** (no client secret), and mint a Fabric API token.
- Run `rayfin up` to deploy the static app and apply schema to **ROW-POC-Prod
  only** (the app is Contributor on that workspace, not on ROW-POC-Dev).

**Can't:**

- Deploy anywhere except the workspace in `vars.FABRIC_WORKSPACE_ID`
  (ROW-POC-Prod). Targeting is by workspace ID passed on the command line and in
  `RAYFIN_WORKSPACE_ID`; nothing committed selects a workspace, so Josh's local
  `rayfin up` still goes to ROW-POC-Dev.
- Write to the repository. `permissions:` is `id-token: write` (for OIDC) and
  `contents: read` — nothing else.
- Use a secret. There are **no secrets**; everything it needs is in the `prod`
  environment's **variables** (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
  `FABRIC_WORKSPACE_ID`).

## Auth: OIDC, no client secret

```
GitHub OIDC token  ──►  azure/login (federated credential, allow-no-subscriptions)
                        │
                        ▼
                   az account get-access-token --resource https://api.fabric.microsoft.com
                        │
                        ▼
                   RAYFIN_TOKEN  ──►  rayfin up  ──►  Fabric REST API
```

- The token's audience is the **Fabric API** (`https://api.fabric.microsoft.com`),
  which is what `rayfin up` calls to create the item, sync settings, apply the
  schema and upload the static bundle. It is **not** a Power BI token — that
  scope is only needed by the `fabric-semanticmodel` connector path, which a
  deploy never uses. Rayfin decodes the token's audience locally and fails fast
  with a clear message if it's wrong.
- The token is **masked** (`::add-mask::`) and passed to the deploy step through
  the job env; it is never printed.
- `azure/login` runs with `allow-no-subscriptions: true` and no subscription —
  the app is only a Fabric Contributor, with no Azure subscription role.

## What Rayfin writes during a deploy (and how the runner handles it)

`rayfin up` writes several files, almost all **gitignored** and discarded when
the runner is torn down:

| File | Gitignored? | On the runner |
|---|---|---|
| `rayfin/.deployments.json` | yes | written then discarded; targeting comes from `--workspace-id`, not this file |
| `rayfin/.env`, `.env.local` | yes | written then discarded |
| `rayfin.config.json` (in the built bundle) | yes | generated fresh for this stage; not promoted |
| `rayfin/rayfin.yml` | **no (committed)** | the deploy appends the live hosting URL to `allowedRedirectUris`; this write is lost on the runner — see below |

## Sign-in on the prod app, and the `allowedRedirectUris` gap

Deployed Fabric apps use **Fabric SSO (Entra ID)** only. The allowed sign-in
redirects come from `allowedRedirectUris` in the committed `rayfin.yml`. The prod
static app gets its **own** hosting URL, different from the Dev one already in
that file.

On each deploy `rayfin up` appends the live hosting URL to `allowedRedirectUris`,
but on the runner that write-back is thrown away. In Dev, sign-in worked right
after the first `rayfin up` (the service registers its own hosting origin during
the deploy), so the first prod deploy is expected to sign in too.

**Hardening (done, prompt 14).** The prod hosting URL
(`https://hale-robin-0921441f70-westus3.webapp.fabricapps.net`) is now committed
into `rayfin.yml`'s `allowedRedirectUris`. From here on every deploy's
settings-sync keeps the prod redirect registered, independent of the per-run
write-back.

### Known gap: `allowedRedirectUris` is a shared list

`rayfin.yml` is a single committed file, so its `allowedRedirectUris` is shared
across every environment this project deploys to. It already contains the Dev
hosting URL and `localhost` redirects, and the prod app will therefore also
*allow* those Dev/localhost redirects (and, once the hardening PR lands, Dev will
allow the prod URL). This is harmless for a synthetic-data POC but is not what
production should do: a real deployment wants a **per-environment allow-list** so
prod only trusts prod's own origin. Recorded in `docs/decisions.md`.

## How to read a failure

Open the failed run from the **Actions** tab and expand the failed step.

| Step | A failure usually means |
|---|---|
| Install dependencies (`npm ci`) | `package-lock.json` out of sync with `package.json`. |
| Build / Test | A compile, Vite or Vitest failure — the same gate as CI. The deploy never ran. |
| Azure login (OIDC) | OIDC trust problem — most often a **federated credential subject mismatch** (see below), or the wrong `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` variable. |
| Acquire Fabric API token | Login succeeded but the token request failed — e.g. the app lacks consent for the Fabric API, or the tenant setting "Service principals can call Fabric public APIs" doesn't cover the app. |
| Deploy (`rayfin up`) | A `401`/`403` means the token was rejected (audience or the app's workspace role); a schema error means a destructive change the CLI refused (it will not drop/alter without `--force`, which this job never passes). |

### Federated credential subject mismatch

OIDC works only when the **subject** in the token GitHub sends exactly matches a
federated credential on `gh-row-poc-deploy`. This project uses the subject tied
to the `prod` **environment**. If `azure/login` fails with something like
`AADSTS70021: No matching federated identity record found`, the subject GitHub
sent doesn't match any credential on the app.

**See the subject GitHub sent.** The claim is
`repo:<owner>/<repo>:environment:<name>`. For this repo and the `prod`
environment it is:

```
repo:joshl0327/fabric-apps-row-poc:environment:prod
```

The configured credential uses the newer subject format with GitHub's **numeric**
owner and repo IDs; confirm the app's federated credential matches the triggering
repo, environment, and those IDs. (To inspect the raw token claims in a run, the
OIDC subject can be dumped from the Actions OIDC endpoint in a debug step, but
don't log the token itself.)

## Client-secret fallback (documented, not built)

Rayfin also supports a non-interactive **service-principal login with a client
secret**:

```bash
npx rayfin login --service-principal \
  --client-id <id> --client-secret <secret> --tenant <id>
```

We deliberately **do not** use this: it needs a stored secret, which is exactly
what OIDC + a federated credential avoids. It's recorded here only as the
fallback if OIDC ever can't be used. If it were ever adopted, the secret would
live in the `prod` environment's **secrets** (not variables), and the workflow's
`permissions` would no longer need `id-token: write`.

## Feeder-import deploys (the one switch for the migration)

The app ships with the **feeder Import panel** (and the empty-state "Load sample
data" button) **off**: both sit behind the build flag `VITE_ENABLE_FEEDER_IMPORT`
(`src/services/featureFlags.ts`). The gate is a **runtime** check —
`isFeederImportEnabled()` returns `false` when the inlined flag isn't `"true"`,
and the panel is not rendered. (The flag is a build-time constant Vite inlines;
the panel's code is *not* actually tree-shaken out of the bundle — see "What
actually shipped" below.) A deployed prod app therefore shows **no load
controls**; an empty table just reads "No feeders loaded yet".

The deploy workflow decides that flag per run:

- **Push-triggered deploys always build with import OFF.** A merge to `main`
  never turns it on, so a routine deploy can't expose the import panel.
- **A manual run can turn it on for that one build.** `workflow_dispatch` has a
  boolean input **`enable_feeder_import`** (default **false**). Tick it in
  **Actions → Deploy to prod → Run workflow** and that single build sets
  `VITE_ENABLE_FEEDER_IMPORT=true`. The job summary records the requested value
  ("Feeder import requested: `true`/`false`"), so the run history shows who
  asked for import switched on.

### The flag must be set on the *deploy* step, not only the Build gate

`rayfin/rayfin.yml` sets `staticHosting.buildCommand: npm run build:fabric`, and
the Rayfin guide confirms `rayfin up` *"runs your configured `buildCommand`,
packages the output, and uploads it to the remote service"*
(`app-backend/deploy.md`, `cli/quickstart.md`). So **`rayfin up` runs its own
build and ships that bundle** — the workflow's earlier "Build" step is only the
pass/fail gate, and the `dist/` it produced is discarded. Setting
`VITE_ENABLE_FEEDER_IMPORT` only on the Build step therefore has no effect on
what reaches prod. The flag is set from the **same resolved `steps.flag`
output** on the **Deploy to ROW-POC-Prod** step as well, so the bundle `rayfin
up` builds carries it. Push deploys still resolve to `false`.

This is the bug behind run #6 (2026-10-30): the box was ticked and the summary
said `true`, but the shipped build had the flag off, so prod showed no Import
panel. **The summary reported the requested input, not the shipped build** — now
corrected by the check below.

### What actually shipped: the bundle check

`rayfin up` leaves the bundle it uploaded in `dist/`, so the **Verify the shipped
bundle matches the flag** step inspects that same `dist/` after the deploy. The
Import panel is *not* tree-shaken out when the flag is off (the gate is a runtime
call Rollup can't fold), so the string that only appears when the shipped build
had import ON is the **inlined env literal `VITE_ENABLE_FEEDER_IMPORT:"true"`**.
The step greps `dist/` for it and records the result in the summary as **"Import
panel in deployed bundle: yes/no"**. If that doesn't match the requested flag,
the step **fails the run** — the upload has already happened, but the run goes
red so the mismatch can't be missed. A green run with "deployed bundle: yes"
after a ticked manual run is the signal the Import panel really shipped.

This is **only the UI switch**. The server-side create permission
(`@authenticated('create')` on `ClearingPlan`) is a **separate** gate, flipped
in its own PRs (below) — turning the UI on without create still can't write
rows (the API exposes no create mutation).

## Migration runbook: load the 153 feeders into prod

> **Status: completed 2026-11-01.** The in-app import reported **Created 153 ·
> Updated 0 · Skipped 0**, and the reconciliation matched the expected counts:
> **153** feeders in plan; certainty **142 / 1 / 2 / 8** (confirmed / tentative /
> next year / TBD); **143** with a next clearing date. Both gates are closed
> again: the UI gate by the next push deploy (push builds always ship import
> off), the server `create` gate by PR B (prompt 16 — re-comments
> `@authenticated('create')`).

Exact steps to populate the empty prod app once. Two code gates must both be
open during the load — the server `create` permission (PRs) and the UI import
panel (the manual deploy input) — and both are closed again afterwards.

1. **PR A — open create.** In `rayfin/data/ClearingPlan.ts`, uncomment
   `// @authenticated('create')`. Open the PR, let CI pass, and **merge** to
   `main`.
2. **Approve the push-triggered deploy.** The merge triggers "Deploy to prod".
   **Approve** it at the `prod` gate. (This is a push deploy, so it builds with
   import **off** — it only applies the create permission to the schema.)
3. **Manual import deploy.** In **Actions → Deploy to prod → Run workflow**
   (from `main`), tick **`enable_feeder_import`** and start it. **Approve** it at
   the gate. This build has the Import panel on **and** create is now granted.
4. **Export the CSV.** In Snowsight, run `snowflake/08_app_load_export.sql` as
   `ROLE_REPORTER`; download the grid as CSV (expect **153 rows**).
5. **Import in prod.** Sign in to the prod app, open the **Import feeders**
   panel, choose the CSV, and check the reconciliation against the expected
   counts: **153** feeders in plan; certainty **142 / 1 / 2 / 8** (confirmed /
   tentative / next year / TBD); **143** with a next clearing date. Any mismatch
   shows in red. (Then clean up the leftover seed rows per `docs/app-notes.md`.)
6. **PR B — close create.** Re-comment `@authenticated('create')`. Open the PR,
   let CI pass, and **merge**.
7. **Approve the normal deploy.** Approve the push-triggered "Deploy to prod".
   It builds with import **off** again and locks creates back down.
8. **Confirm.** Open the prod app: the **Import panel is gone** and creates are
   rejected by the API. The 153 feeders remain.

### What went wrong during the migration

The load itself reconciled cleanly, but it took two attempts to get the Import
panel into prod:

- **Run #6 (first import deploy, 2026-10-30) shipped with the panel off.** The
  `enable_feeder_import` box was ticked and the summary said `true`, but prod
  showed no Import panel. Cause: `rayfin up` runs its **own** build (its
  configured `buildCommand`) and ships *that* bundle, so setting
  `VITE_ENABLE_FEEDER_IMPORT` only on the workflow's earlier "Build" gate had no
  effect on what reached prod. Fixed in **prompt 15**: the flag is now set on the
  **deploy** step too, plus a bundle check that fails the run if the shipped
  `dist/` doesn't match the requested flag. The successful import deploy was the
  re-run after that fix.
- **An unticked manual run (#5) would also have redeployed without the panel.**
  `workflow_dispatch` defaults `enable_feeder_import` to **false**, so a manual
  run started without ticking the box deploys import-off — the same visible
  result as run #6, but for a different reason (nothing requested, not a build
  bug). Only a manual run with the box ticked, after the prompt-15 fix, ships the
  panel.

## Rollback

There is no separate rollback job — a deploy is forward-only. To roll back:

1. **Revert the PR** that introduced the bad change (open a revert PR, let CI
   pass, merge it to `main`).
2. The merge triggers `deploy-prod.yml` again; **approve** the run.
3. `rayfin up` redeploys the reverted (good) state to ROW-POC-Prod.

Because `rayfin up` reuses the same Fabric item (targeted by workspace ID and
`--item-name row-tracker`), the redeploy updates the existing app in place.
