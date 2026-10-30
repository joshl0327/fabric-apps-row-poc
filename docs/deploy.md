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
   job summary shows the commit, who triggered it, and the app URL if Rayfin
   returned one.

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

**Hardening (small follow-up PR after the first prod deploy):** take the prod
hosting URL from the job summary (or `rayfin up`'s JSON) and commit it into
`rayfin.yml`'s `allowedRedirectUris`. From then on every deploy's settings-sync
keeps the prod redirect registered, independent of the per-run write-back.

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

## Rollback

There is no separate rollback job — a deploy is forward-only. To roll back:

1. **Revert the PR** that introduced the bad change (open a revert PR, let CI
   pass, merge it to `main`).
2. The merge triggers `deploy-prod.yml` again; **approve** the run.
3. `rayfin up` redeploys the reverted (good) state to ROW-POC-Prod.

Because `rayfin up` reuses the same Fabric item (targeted by workspace ID and
`--item-name row-tracker`), the redeploy updates the existing app in place.
