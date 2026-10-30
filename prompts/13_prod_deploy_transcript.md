 ▐▛███▜▌   Claude Code v2.1.181
▝▜█████▛▘  Opus 4.8 · Claude Pro
  ▘▘ ▝▝    C:\dev\fabric-apps-row-poc

 ▎ Meet Fable 5, our newest model for complex, long-running work. Switch anytime with /model.

❯ /clear                                                                        

❯ Read prompts/13_prod_deploy.md and carry out the task described below its     
  "---" line, following AGENTS.md. Do Part A and stop at CHECKPOINT 1.          

  Read 1 file (ctrl+o to expand)

● I'll read the required docs first.

  Read 3 files (ctrl+o to expand)

● Now the decisions doc and the existing CI workflow for patterns.

  Read 3 files (ctrl+o to expand)

● Let me read the specific Rayfin docs on environment variables and deployment
  to nail down the token scope and write-back behavior.

  Read 2 files, ran 1 shell command (ctrl+o to expand)

● Let me nail down the exact token scope/resource for RAYFIN_TOKEN.

  Searched for 1 pattern (ctrl+o to expand)

● deployment-pipelines.md is directly on point — let me read it.

  Read 1 file (ctrl+o to expand)

● I have what I need from the docs. Let me do two quick confirmations: the
  connector invoke doc's scope note, and that no deploy workflow exists yet.

  Read 1 file, ran 1 shell command (ctrl+o to expand)

● Both confirmed: deploy hits the Fabric REST API (so the token audience is
  Fabric, not Power BI), and .env* / .deployments.json / rayfin.config.json are
  gitignored while rayfin.yml is committed. Let me check the app's npm scripts
  so the workflow steps are accurate.

  Ran 1 shell command (ctrl+o to expand)

● I have everything needed for Part A. No files changed — this is the plan only.

  ---
  CHECKPOINT 1 — Prod deploy plan (Part A)

  I read AGENTS.md, docs/decisions.md, docs/app-notes.md, docs/ci.md, the Rayfin
  skill, and the installed Rayfin docs (cli/environment-variables.md,
  app-backend/deploy.md, app-backend/deployment-pipelines.md,
  cli/connectors/invoke.md). No changes made. Answers below, then the workflow,
  then what I'm unsure about.

  1. Token — which resource/scope for RAYFIN_TOKEN

  Fabric API only, not Power BI.

  rayfin up deploys by calling the Fabric REST API (RAYFIN_FABRIC_API_URL,
  default https://api.fabric.microsoft.com/v1): create/reuse the item, sync
  settings, apply schema, upload the static zip. So the bearer token's audience
  must be the Fabric API:

  az account get-access-token --resource https://api.fabric.microsoft.com
  --query accessToken -o tsv

  (equivalently scope https://api.fabric.microsoft.com/.default).

  The Power BI scope (https://analysis.windows.net/powerbi/api) is a red herring
  here — the docs only need it for the fabric-semanticmodel connector invoke
  path (cli/connectors/invoke.md), which a deploy never touches. Rayfin passes
  RAYFIN_TOKEN through unchanged and decodes its audience locally, so a
  wrong-audience token fails fast with a clear message rather than a confusing
  permission error later — a nice safety net if I've picked the resource wrong.

  Flow: GitHub OIDC → azure/login (federated token, allow-no-subscriptions: 
  true, no subscription id) → az account get-access-token --resource 
  https://api.fabric.microsoft.com → export as RAYFIN_TOKEN, with
  RAYFIN_WORKSPACE_ID and RAYFIN_TENANT_ID set from the env vars. The token is
  captured into GITHUB_OUTPUT/env without ever being echoed, and masked with
  ::add-mask:: as defense-in-depth.

  2. Targeting, and what Rayfin writes to disk

  How rayfin up picks the target: on Josh's machine it reads the active
  deployment in rayfin/.deployments.json (→ ROW-POC-Dev). On a fresh runner that
  file doesn't exist (gitignored), so targeting must be explicit. The job
  passes --workspace-id ${{ vars.FABRIC_WORKSPACE_ID }} (and sets
  RAYFIN_WORKSPACE_ID to the same), plus --item-name row-tracker so the prod
  item has a stable name, --yes and --output json for unattended runs.

  Nothing committed changes targeting, so Josh's local rayfin up still goes to
  Dev: the prod workspace id lives only in the GitHub prod environment variable,
  never in a committed file. rayfin.yml carries no workspace id.

  What a deploy writes to disk (deploy.md, environment-variables.md), all
  gitignored and discarded when the runner is torn down:
  - rayfin/.deployments.json — the per-workspace registry (fabricItemId,
  hostingUrl, publishableKey, workspace/tenant ids).
  - rayfin/.env — merged RAYFIN_PUBLIC_* values; and .env.local — the
  Vite-mapped copy used by the static build.
  - rayfin.config.json under the built static assets — this stage's API URL +
  key, regenerated per stage (not promoted).
  - rayfin.yml — the deploy appends the live hosting URL to allowedRedirectUris.
  This is the one write that lands on a committed file. On the runner it's
  lost; see §3.

  I confirmed .gitignore covers rayfin/.env*, rayfin/.deployments.json, and
  rayfin.config.json; only rayfin.yml is tracked.

  3. Sign-in on the prod app — allowedRedirectUris

  The prod static app gets its own hosting URL, different from Dev's
  https://lyric-vista-…webapp.fabricapps.net that's currently in committed
  rayfin.yml. Deployed apps use Fabric SSO exclusively, and rayfin up syncs
  allowedRedirectUris from rayfin.yml to the remote service — so the prod URL
  needs to be an allowed redirect for sign-in to work.

  Because the runner's write-back to rayfin.yml is thrown away, the committed
  file won't contain the prod URL. The right fix (as the prompt anticipates):
  after the first prod deploy, read the prod hosting URL from rayfin up's 
  --output json (the job summary surfaces it), then commit that URL into 
  rayfin.yml's allowedRedirectUris via a normal reviewed PR. From then on every
  deploy's settings-sync keeps prod's redirect registered. This matches the
  docs' model where rayfin.yml is the committed source of truth for the
  allow-list. (Adding the prod URL to the shared rayfin.yml is harmless for
  Josh's Dev deploys — it just leaves an extra allowed origin in Dev's list.)

  4. The workflow (step by step)

  .github/workflows/deploy-prod.yml:

  - Triggers: push to main filtered to paths: app/row-tracker/**, plus
  workflow_dispatch. Never pull_request.
  - Permissions (top level): id-token: write, contents: read — nothing else.
  - One job, runs-on: ubuntu-latest, environment: prod (this is the approval
  gate — the required reviewer joshl0327 must approve before the job runs),
  concurrency: { group: deploy-prod, cancel-in-progress: false } so two deploys
  can't overlap, defaults.run.working-directory: app/row-tracker, env: 
  RAYFIN_TELEMETRY_OPTOUT: '1'.
  - Steps:
    a. actions/checkout (pinned SHA).
    b. actions/setup-node (pinned SHA), Node 24, npm cache on
  app/row-tracker/package-lock.json.
    c. npm ci.
    d. npm run build — same gate as CI (build before tests).
    e. npm test — deploy only what passes; a failure stops the job before any
  Fabric contact.
    f. azure/login (pinned SHA) with client-id: ${{ vars.AZURE_CLIENT_ID }},
  tenant-id: ${{ vars.AZURE_TENANT_ID }}, allow-no-subscriptions: true (no
  subscription-id, no secret — pure OIDC federated credential).
    g. Get the token: az account get-access-token --resource 
  https://api.fabric.microsoft.com, mask it, expose as a step env var (never
  printed).
    h. Deploy: npx rayfin up --workspace-id ${{ vars.FABRIC_WORKSPACE_ID }} 
  --item-name row-tracker --yes --output json, with RAYFIN_TOKEN,
  RAYFIN_WORKSPACE_ID=${{ vars.FABRIC_WORKSPACE_ID }}, RAYFIN_TENANT_ID=${{ 
  vars.AZURE_TENANT_ID }} in the step env. rayfin up runs the configured
  build:fabric to package the SPA and applies schema in the one step.
    i. Job summary ($GITHUB_STEP_SUMMARY): commit SHA, approver
  (github.actor/the environment reviewer), and the app URL parsed from rayfin 
  up's JSON (deployment.hostingUrl) if present. No tokens, no .env contents, no
  extra ids.
  - Pinning: every third-party action (actions/checkout, actions/setup-node,
  azure/login) pinned to a verified full commit SHA with the version in a
  trailing comment, resolved via gh api (I'll ask before each gh api call),
  exactly as ci.yml does.

  Things I'm unsure about (want your read before Part B)

  1. First-deploy sign-in timing. The docs say the deploy self-appends its
  hosting URL to allowedRedirectUris, which suggests the service registers its
  own origin during the first deploy — so SSO may work immediately even before
  we commit the URL. But I can't prove from the docs that the remote
  registration lands within the same first run rather than on the next deploy.
  Plan assumes it might not, and treats "commit the prod URL after deploy 1,
  then it's durable" as the fix. If you know the self-append is reliable on
  first deploy, we can treat the commit as hardening only.
  2. azure/login without a subscription. I'm relying on allow-no-subscriptions: 
  true so OIDC login succeeds with no Azure subscription (the app is only a
  Fabric Contributor), and then az account get-access-token --resource … works
  tenant-scoped. This is the standard pattern but I haven't run it here.
  3. Item name. I plan --item-name row-tracker (the rayfin.yml project id) so
  the prod item is stable and reused on redeploys. Confirm you want that exact
  display name in ROW-POC-Prod, or prefer something like row-tracker-prod.
  4. resolveRayfinConfig. Since we do a fresh rayfin up on the runner (not a
  Fabric Deployment Pipeline promotion), the prod bundle is built with prod's
  own .env.local, so it points at prod regardless of whether the app calls
  resolveRayfinConfig(). Not blocking for this workflow; flagging only because
  the pipelines doc makes a point of it.

  Waiting for your approval before Part B.

✻ Brewed for 2m 16s

※ recap: Goal: add a human-approved GitHub Actions job that deploys the Fabric app to ROW-POC-Prod. I finished Part A (the deploy plan) and posted CHECKPOINT 1 with four open questions. Next: await your approval before building the workflow in Part B.

❯ Approved. Answers:                                                            
  1. In Dev, sign-in worked right after the first rayfin up, so treat           
  committing the prod URL as hardening: a small follow-up PR after the first    
  prod deploy.                                                                  
  2. Go with allow-no-subscriptions; we'll see the result on the first run.     
  3. Item name: row-tracker.                                                    
  4. Agreed, not blocking.                                                      
  Also: in docs/deploy.md and decisions.md, record as a known gap that          
  rayfin.yml's allowedRedirectUris is shared, so the prod app also allows the   
  Dev URL and localhost redirects; production should use a per-environment      
  allow-list. In the job summary, label github.actor as "triggered by" (the     
  approver shows in the environment's deployment history). Continue with Part B 
  and stop at CHECKPOINT 2.                                                     

● Approved — proceeding with Part B. First I'll verify the azure/login action
  SHA (checkout and setup-node SHAs are already verified in ci.yml and I'll
  reuse them).

  Ran 1 shell command (ctrl+o to expand)

● The tag is annotated, so that's the tag-object SHA. I need the dereferenced
  commit SHA.

  Ran 1 shell command (ctrl+o to expand)
● All three SHAs verified:
  - actions/checkout v7.0.1 → 3d3c42e5aac5ba805825da76410c181273ba90b1
  - actions/setup-node v7.1.0 → 949feb2413d6458794dcd2491c4babbbce0c15c1
  - azure/login v3.1.0 → a641126d1b8aa4d1fa005f4f92df94a3a4c4c906

  Now let me read poc-log.md and the current AGENTS.md data-boundary section to
  match format before writing.

  Read 1 file (ctrl+o to expand)

● Now I'll write the workflow file.

● Write(.github\workflows\deploy-prod.yml)
  ⎿  Wrote 118 lines to .github\workflows\deploy-prod.yml
       1 name: Deploy to prod
       3 # Deploys the Fabric App (app/row-tracker) to the ROW-POC-Prod w
         orkspace.
       5 # The app reaches production ONLY through this job. Nobody deplo
       6 # a laptop, and the coding agent never deploys. The `prod` GitHu
         b environment's
         n approves it.
       8 #
         lient secret) ->
         re no secrets in
     … +138 lines (ctrl+o to expand)

● Now docs/deploy.md.

● Write(docs\deploy.md)
  ⎿  Wrote 174 lines to docs\deploy.md
      1 # Prod deploy: how the app reaches ROW-POC-Prod
      3 `.github/workflows/deploy-prod.yml` is the **only** path the Fabr
        ic App takes to
      4 production. Nobody deploys to prod from a laptop, and the coding 
      5 deploys. This is the direct answer to the ops team's concern abou
        t automated
        s, and **waits
      7 for a person to approve it** before it touches Fabric.
      8 
        y PR checks.
     … +251 lines (ctrl+o to expand)

● Now update docs/ci.md — the forward reference to part 2 is now built.

● Update(docs\ci.md)
  ⎿  Added 3 lines, removed 2 lines
       7  
       8  This is Phase 5, part 1. It is deliberately read-only: `permiss
          ions:
       9  contents: read`, no secrets, no tokens, no deploy or publish st
          ep, and no
      10 -contact with Fabric or Snowflake. A later part adds a prod work
         -space and a                                                    
      11 -deploy job that only runs after a human approval.              
      10 +contact with Fabric or Snowflake. Part 2 adds the prod workspac
         +e and the deploy                                               
      11 +job that runs from `main` and only after a human approval — see
         + `docs/deploy.md`                                              
      12 +(`.github/workflows/deploy-prod.yml`).                         
      13  
      14  ## What runs
      15  

● Now update AGENTS.md's data boundary. Let me read that section exactly.

  Read 1 file (ctrl+o to expand)

● Update(AGENTS.md)
  ⎿  Added 5 lines
      61  - Fabric workspace `ROW-POC-Dev`, only in a later phase and onl
          y when I ask.
      62  - Snowflake: none for the agent (see the hard rules).
      63  
      64 +The production workspace **ROW-POC-Prod** also exists, but it i
         +s **off limits to                                              
      65 +the agent entirely**. Nothing the agent runs connects to it. Th
         +e app reaches                                                  
      66 +prod only through `.github/workflows/deploy-prod.yml` (GitHub A
         +ctions, from                                                   
      67 +`main`, after a human approval) — see `docs/deploy.md`. The age
         +nt never deploys.                                              
      68 +                                                               
      69  Rules:
      70  
      71  - Never connect to, query or screenshot anything not on the lis
          t above. If a

● Now the decisions log (two rows at the bottom) and the poc-log row.

● Update(docs\decisions.md)
  ⎿  Added 4 lines
      59  | 2026-10-29 | **Report `validate` runs on Ubuntu, not Windows.
          ** `@microsoft/powerbi-report-authoring-cli` is cross-platform 
          Node (`engines.node >= 20`, no `os` restriction) and `validate`
           is pure in-process JSON-Schema/layout validation (`ajv`) that 
          reads files on disk. Only the CLI's `preview --host desktop` pa
          th needs Windows (it drives Desktop over a named pipe), and CI 
          never previews. Set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` so ins
          talling the CLI doesn't pull Playwright browsers (a transitive 
          dep `validate` never uses). | Linux is faster/cheaper and the s
          tatic check doesn't need Desktop. | Agent (prompt 12) | CI repo
          rt job |
      60  | 2026-10-29 | **Actions pinned to full commit SHAs**, version 
          in a trailing comment: `actions/checkout` → `3d3c42e5aac5ba8058
          25da76410c181273ba90b1` (v7.0.1), `actions/setup-node` → `949fe
          b2413d6458794dcd2491c4babbbce0c15c1` (v7.1.0). Both resolved fr
          om the latest release tag with `gh api`. Node pinned to **24** 
          (matches local v24.20). | A moved tag can't change what runs in
           CI; defensible to ops. | Agent (prompt 12) | CI workflow |
      61  | 2026-10-29 | **Build's prebuild needs no Fabric sign-in (Part
           A context).** The only Rayfin command in `npm run build` is `r
          ayfin env --framework vite`, which just maps `RAYFIN_PUBLIC_*` 
          into `.env.local` — no Fabric API call, no `rayfin login`. The 
          gitignored `rayfin/.env` is absent in CI and the build tolerate
          s that (Vite only fails on a *remote* `VITE_RAYFIN_API_URL` wit
          h no key). Verified by running `build → test → lint` locally wi
          th no `rayfin/.env`. | Confirms the app job runs unauthenticate
          d, as required. | Agent (prompt 12) | CI app job |
      62 +| 2026-10-29 | **Prod deploy workflow (Phase 5, part 2, prompt 
         +13).** Added `.github/workflows/deploy-prod.yml`: triggers on `
         +push` to `main` under `paths: app/row-tracker/**` + `workflow_d
         +ispatch` (**never** on PRs); one job, `environment: prod` (the 
         +approval gate — required reviewer `joshl0327`), `concurrency: d
         +eploy-prod` (`cancel-in-progress: false`), `permissions: id-tok
         +en: write` + `contents: read` only. Steps: checkout → Node 24 →
         + `npm ci` → `npm run build` → `npm test` (deploy only what pass
         +es) → `azure/login` (OIDC) → acquire Fabric token → `rayfin up`
         + → job summary. Targets ROW-POC-Prod by `vars.FABRIC_WORKSPACE_
         +ID` (CLI `--workspace-id` + `RAYFIN_WORKSPACE_ID`) with `--item
         +-name row-tracker --yes --output json`. No secrets; the three `
         +AZURE_CLIENT_ID`/`AZURE_TENANT_ID`/`FABRIC_WORKSPACE_ID` are en
         +vironment **variables**. The agent never deploys. | Ops concern
         +: production is reached only through a reviewed, approved GitHu
         +b Actions job from `main`, never from a laptop. | Josh (prompt 
         +13) | CI, prod deploy, `docs/deploy.md` |                      
      63 +| 2026-10-29 | **Prod deploy auth = GitHub OIDC → `azure/login`
         + → Fabric API token → `RAYFIN_TOKEN`.** The token's audience is
         + the **Fabric API** (`az account get-access-token --resource ht
         +tps://api.fabric.microsoft.com`), not Power BI — `rayfin up` ca
         +lls the Fabric REST API; the Power BI scope is only for the `fa
         +bric-semanticmodel` connector path (unused). `azure/login` runs
         + with `allow-no-subscriptions: true` and no client secret (fede
         +rated credential on `gh-row-poc-deploy`). The token is masked (
         +`::add-mask::`) and passed via job env, never printed. Verified
         + the three action SHAs with `gh api`: `actions/checkout` v7.0.1
         + `3d3c42e5…`, `actions/setup-node` v7.1.0 `949feb24…`, `azure/l
         +ogin` v3.1.0 `a641126d1b8aa4d1fa005f4f92df94a3a4c4c906`. | A fe
         +derated credential avoids storing any secret; the Fabric audien
         +ce is what the deploy API needs (Rayfin fails fast on a wrong-a
         +udience token). | Josh (prompt 13) | Deploy workflow auth |    
      64 +| 2026-10-29 | **First prod sign-in + the `allowedRedirectUris`
         + write-back.** `rayfin up` appends the live hosting URL to `ray
         +fin.yml`'s `allowedRedirectUris`, but the runner discards that 
         +write (the file change isn't committed). In Dev, sign-in worked
         + right after the first `rayfin up` (the service registers its o
         +wn hosting origin), so committing the prod URL is **hardening, 
         +not a blocker**: a small follow-up PR after the first prod depl
         +oy adds the prod URL to `rayfin.yml` so every later settings-sy
         +nc keeps it registered. | Confirmed from Dev behaviour (Josh); 
         +keeps the committed allow-list durable without relying on the p
         +er-run write-back. | Josh (prompt 13) | `rayfin.yml`, prod sign
         +-in |                                                          
      65 +| 2026-10-29 | **Known gap: `rayfin.yml`'s `allowedRedirectUris
         +` is a single shared list** across every environment this proje
         +ct deploys to. It already holds the Dev hosting URL + `localhos
         +t` redirects, so the prod app also *allows* the Dev/localhost r
         +edirects (and, after the hardening PR, Dev allows the prod URL)
         +. Harmless for a synthetic-data POC, but **production should us
         +e a per-environment allow-list** so prod trusts only its own or
         +igin. Recorded, not fixed. | One committed `rayfin.yml` can't h
         +old per-stage allow-lists; the clean fix (per-environment confi
         +g) is out of scope for the POC. | Josh (prompt 13) | `rayfin.ym
         +l`, `docs/deploy.md` |                                         
      66  | 2026-10-29 | **Can `rayfin up` run unattended as a service pr
          incipal? Yes (Part A finding).** The installed Rayfin docs docu
          ment two non-interactive sign-ins: (1) `rayfin login --service-
          principal --client-id <id> --client-secret <secret> --tenant <i
          d>` — **client secret only**, credentials persisted to `~/.rayf
          in/` so later pipeline commands authenticate automatically (`ap
          p-backend/deploy.md`, `cli/index.md`, `cli/quickstart.md`); (2)
           `RAYFIN_TOKEN` env var holding a pre-acquired Bearer token (e.
          g. from `az account get-access-token`), with `RAYFIN_WORKSPACE_
          ID` / `RAYFIN_TENANT_ID`, bypassing MSAL (`cli/environment-vari
          ables.md` "Shell-only variables"). `rayfin up` supports `--work
          space-id`, `--item-name`, `--yes`, `--output json` for unattend
          ed runs. **No certificate credential and no GitHub-OIDC / feder
          ated-credential flow are documented** (searched the installed g
          uide — only the client-secret SP and `RAYFIN_TOKEN` appear). No
          t tried; research only. | Decides how the later deploy part (pa
          rt 2) authenticates in CI. | Agent (prompt 12) | Phase 5 part 2
           (deploy) |
      67  
      68  ## R1 profile findings (2026-10-15)

● Update(docs\poc-log.md)
  ⎿  Added 2 lines
      22  
      23  | 2026-10-29 | Phase 5, part 1. CI on every PR (prompt 12) | Cl
          aude Code (Opus 4.8); Rayfin docs read from `node_modules`; `gh
           api` for action SHAs; no MCP | ~30 | | Part A (research only):
           confirmed from the installed Rayfin docs that `rayfin up` can 
          run unattended two ways — `rayfin login --service-principal` (c
          lient secret only) and the `RAYFIN_TOKEN` Bearer-token env var 
          (e.g. from `az account get-access-token`); **no certificate and
           no GitHub-OIDC/federated flow are documented**. Part B: added 
          `.github/workflows/ci.yml` (PR→main + `workflow_dispatch`, `per
          missions: contents: read`) with an **App build/test/lint** job 
          (Ubuntu, `app/row-tracker`, build before tests, Node 24, teleme
          try off) and a **Report PBIR validate** job (Ubuntu — validate 
          is a static ajv check, Desktop not needed; Playwright browser d
          ownload skipped). Pinned both actions to full SHAs resolved wit
          h `gh api` (checkout v7.0.1, setup-node v7.1.0). Verified the w
          hole app chain (49 tests) and `validate` pass locally with no `
          rayfin/.env`. Wrote `docs/ci.md`. | | yes | No changes to app/r
          eport/model/snowflake/data or the ruleset. Josh merges, then ma
          kes the two job names required in "Protect main" and files a de
          liberately-failing "break it" PR to confirm the gate blocks it.
           Lint warning in AuthContext.tsx still pre-existing |
      24  
      25 +| 2026-10-29 | Phase 5, part 2. Approved deploy to prod (prompt
         + 13) | Claude Code (Opus 4.8); Rayfin docs read from `node_modu
         +les`; `gh api` for action SHAs; no MCP | ~30 | | Part A (plan):
         + from the installed Rayfin docs, confirmed the `RAYFIN_TOKEN` a
         +udience must be the **Fabric API** (`https://api.fabric.microso
         +ft.com`), not Power BI (`rayfin up` calls the Fabric REST API; 
         +the Power BI scope is only the `fabric-semanticmodel` connector
         + path); that `rayfin up` targets by `--workspace-id` and writes
         + `.deployments.json` / `.env` / `rayfin.config.json` (all gitig
         +nored, discarded on the runner) plus appends the hosting URL to
         + the committed `rayfin.yml` (write-back lost on the runner); an
         +d the Fabric-SSO `allowedRedirectUris` story — Checkpoint 1. Pa
         +rt B: added `.github/workflows/deploy-prod.yml` (push→main on `
         +app/row-tracker/**` + `workflow_dispatch`, never on PRs; one jo
         +b `environment: prod` as the approval gate; `concurrency: deplo
         +y-prod`; `permissions: id-token: write` + `contents: read`; che
         +ckout → Node 24 → `npm ci` → build → test → `azure/login` OIDC 
         +→ Fabric token (masked) → `rayfin up --workspace-id … --item-na
         +me row-tracker --yes --output json` → job summary). Pinned thre
         +e actions to SHAs verified with `gh api` (checkout v7.0.1, setu
         +p-node v7.1.0, azure/login v3.1.0). Wrote `docs/deploy.md`; upd
         +ated `docs/ci.md`, `AGENTS.md` (data boundary: ROW-POC-Prod off
         + limits to the agent). | | yes | No secrets (OIDC federated cre
         +dential, no client secret). The agent never deploys. Per Josh's
         + Checkpoint-1 answers: committing the prod URL to `allowedRedir
         +ectUris` is a hardening follow-up PR (Dev signed in on first `r
         +ayfin up`); recorded the shared-allow-list known gap; job summa
         +ry labels `github.actor` as "triggered by". Client-secret SP lo
         +gin documented as a fallback, not built. |                     
      26 +                                                               
      27  ## Observations
      28  
      29  - What the agent got right without help:

● Let me validate the workflow YAML parses cleanly.

  Ran 1 shell command (ctrl+o to expand)

● The app has js-yaml as a dependency — let me use it from there.

  Ran 1 shell command (ctrl+o to expand)

● Valid and correct. Let me produce the diff summary for the checkpoint.

  Ran 1 shell command (ctrl+o to expand)

● Part B is done. Stopping at CHECKPOINT 2.

  ---
  CHECKPOINT 2 — Prod deploy built

  What changed

  New
  - .github/workflows/deploy-prod.yml — the deploy job. Triggers: push to main
  filtered to app/row-tracker/**, plus workflow_dispatch; never on pull
  requests. One job, environment: prod (the approval gate), concurrency: 
  deploy-prod with cancel-in-progress: false, permissions: id-token: write +
  contents: read. Steps: checkout → Node 24 (npm cache) → npm ci → npm run build
  → npm test (deploy only what passes) → azure/login (OIDC,
  allow-no-subscriptions, no secret) → acquire Fabric API token (masked, never
  printed) → rayfin up --workspace-id ${{ vars.FABRIC_WORKSPACE_ID }} 
  --item-name row-tracker --yes --output json → job summary. YAML validated.
  - docs/deploy.md — how a prod deploy happens (merge → job waits → approve →
  deploy), what the job can/can't do, the OIDC→Fabric-token auth chain, what
  Rayfin writes to disk and how the runner handles it, the allowedRedirectUris
  gap + hardening PR, how to read a failure (incl. federated-credential subject
  mismatch and how to see the subject GitHub sent), the client-secret fallback
  (documented only), and rollback (revert PR → approve redeploy).

  Edited
  - AGENTS.md — data boundary now states ROW-POC-Prod exists but is off limits
  to the agent; only deploy-prod.yml touches it.
  - docs/ci.md — part-2 forward reference now points at the built workflow and
  docs/deploy.md.
  - docs/decisions.md — four rows (workflow; OIDC/Fabric-token auth + verified
  SHAs; first-sign-in/write-back hardening; shared-allow-list known gap).
  - docs/poc-log.md — one row, agent time ~30 min, review time left blank.

  Action SHAs I verified (via gh api)

  ┌────────────────────┬─────────┬───────────────────────────────────────────┐
  │       Action       │ Version │                Commit SHA                 │
  ├────────────────────┼─────────┼───────────────────────────────────────────┤
  │ actions/checkout   │ v7.0.1  │ 3d3c42e5aac5ba805825da76410c181273ba90b1  │
  ├────────────────────┼─────────┼───────────────────────────────────────────┤
  │ actions/setup-node │ v7.1.0  │ 949feb2413d6458794dcd2491c4babbbce0c15c1  │
  ├────────────────────┼─────────┼───────────────────────────────────────────┤
  │                    │         │ a641126d1b8aa4d1fa005f4f92df94a3a4c4c906  │
  │ azure/login        │ v3.1.0  │ (annotated tag dereferenced to the        │
  │                    │         │ commit)                                   │
  └────────────────────┴─────────┴───────────────────────────────────────────┘

  Your test steps

  1. Merge this branch to main (you push/PR/merge — I don't).
  2. Run the workflow by hand first: Actions → Deploy to prod → Run workflow on
  main. It should start and immediately pause at the prod approval gate before
  any Azure/Fabric contact.
  3. Approve in the run (or Environments → prod history).
  4. Success looks like: build + test pass, azure/login succeeds, the token step
  shows a masked value, rayfin up completes, and the job summary shows the
  commit, "triggered by" you, workspace ROW-POC-Prod, and the app URL.
  5. Check in ROW-POC-Prod: a row-tracker AppBackend item exists; open its app
  URL and confirm Fabric SSO sign-in works and the (empty — no create permission
  committed) feeder list loads. The claims panel should show id + email.
  6. If sign-in fails (redirect not allowed): that's the allowedRedirectUris gap
  — take the prod hosting URL from the job summary and I'll prep the small
  hardening PR adding it to rayfin.yml. If azure/login fails with AADSTS70021,
  it's a federated-credential subject mismatch — the subject GitHub sends is
  repo:joshl0327/fabric-apps-row-poc:environment:prod (see docs/deploy.md).

  Proposed commit

  Stage exactly:
  - .github/workflows/deploy-prod.yml
  - docs/deploy.md
  - docs/ci.md
  - docs/decisions.md
  - docs/poc-log.md
  - AGENTS.md
  - prompts/13_prod_deploy.md

  (prompts/12_ci_on_prs_transcript.md is unrelated to this task — leave it out
  unless you want it in its own commit.)

  Message:
  ci: approved deploy to ROW-POC-Prod via GitHub Actions (Phase 5, part 2)

  Add .github/workflows/deploy-prod.yml: push to main (app/row-tracker/**) or
  workflow_dispatch, one job gated by the `prod` environment's required
  reviewer.
  OIDC -> azure/login (no secret) -> Fabric API token -> rayfin up, targeting
  ROW-POC-Prod by workspace ID. permissions: id-token+contents:read only.

  Add docs/deploy.md; note ROW-POC-Prod as agent-off-limits in AGENTS.md; update
  docs/ci.md, decisions.md, poc-log.md.

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

  I did not deploy, run any Rayfin/Azure command, add secrets, touch
  app/report/model code, or push. Waiting for your approval to commit.

✻ Brewed for 3m 39s

❯ Approved. Make the commit with exactly the seven paths you listed. Then make  
  a second commit with prompts/12_ci_on_prs_transcript.md alone ("Add prompt 12 
  transcript"). Don't push.                                                     

  Ran 1 shell command (ctrl+o to expand)

● Exactly the seven paths staged. Now the first commit.

  Committed 5d76b58, 25b8f2d (ctrl+o to expand)

● Both commits made on feat/prod-deploy, nothing pushed:

  - 5d76b58 — ci: approved deploy to ROW-POC-Prod via GitHub Actions (Phase 5, 
  part 2) — the 7 paths (workflow + docs).
  - 25b8f2d — Add prompt 12 transcript — prompts/12_ci_on_prs_transcript.md
  alone.

  Working tree is clean. Push, PR and merge are yours whenever you're ready.
✻ Crunched for 13s