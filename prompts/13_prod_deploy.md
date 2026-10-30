# Prompt 13: approved deploy to ROW-POC-Prod (Phase 5, part 2)

Given to Claude Code on branch `feat/prod-deploy`. Kept here as a record of
exactly what the agent was asked to do.

---

Read `AGENTS.md`, `docs/decisions.md`, `docs/app-notes.md` and `docs/ci.md`
first and follow them. For Rayfin questions, use
`app/row-tracker/.agents/skills/rayfin/SKILL.md` first, then
`npx rayfin docs ...` from `app/row-tracker` (I approve each call).

## Why

This is the direct answer to the ops team's concern about automated pushes to
production: the app reaches production **only** through a GitHub Actions job
that runs from `main` and waits for a person's approval. Nobody deploys to prod
from a laptop, and the agent never deploys.

## Already set up by me (don't ask about these)

- Fabric workspace **ROW-POC-Prod** on the F2 capacity.
- Entra app **`gh-row-poc-deploy`**, with **no client secret**. It has a
  federated credential for GitHub Actions: repo `joshl0327/fabric-apps-row-poc`,
  environment `prod`, using the newer subject format with GitHub's numeric
  owner and repo IDs.
- Fabric tenant setting "Service principals can call Fabric public APIs" is
  enabled for the security group `sg-fabric-deployers` only; the app is in it.
- The app is **Contributor on ROW-POC-Prod only** (not on ROW-POC-Dev).
- GitHub environment **`prod`**: required reviewer `joshl0327`, admin bypass
  off, deployments from `main` only. Environment **variables** (not secrets):
  `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `FABRIC_WORKSPACE_ID`. There are no
  secrets.

From prompt 12's research: Rayfin supports `rayfin login --service-principal`
with a client secret, and a pre-acquired token via `RAYFIN_TOKEN` (with
`RAYFIN_WORKSPACE_ID` and `RAYFIN_TENANT_ID`), e.g. from
`az account get-access-token`. Deploy flags include `--workspace-id`,
`--item-name`, `--yes` and `--output json`.

## Part A: plan (no changes)

Answer from the docs and the code, then propose the workflow:

1. **Token.** Which resource or scope must the `az account get-access-token`
   token have for `RAYFIN_TOKEN` (Fabric API, Power BI, or both)? Plan: GitHub
   OIDC → `azure/login` (no subscription, `allow-no-subscriptions`) → `az`
   token → `RAYFIN_TOKEN`. The token must never be printed; mask it.
2. **Targeting.** How does `rayfin up` pick the workspace and item? Make sure a
   CI deploy targets ROW-POC-Prod by its ID, and that nothing committed changes,
   so my local `rayfin up` still deploys to ROW-POC-Dev. Say what Rayfin writes
   to disk during a deploy (for example `rayfin.yml` redirect URIs, a deployment
   registry) and how that's handled on the runner.
3. **Sign-in on the prod app.** The prod static app gets its own URL. Does Fabric
   SSO need that URL registered (the `allowedRedirectUris` that `rayfin up` wrote
   for Dev)? If it does and the runner's write-back is lost, what's the right
   fix (for example, committing the prod URL after the first deploy)?
4. **The workflow** you'll write, step by step.

**CHECKPOINT 1:** stop with the answers, the planned workflow, and anything
you're unsure about. Wait for my approval.

## Part B: build (after I approve)

1. Add `.github/workflows/deploy-prod.yml`:
   - Triggers: push to `main` when `app/row-tracker/**` changes, plus
     `workflow_dispatch`. **Never** on pull requests.
   - One job, `environment: prod` (this is the approval gate), with a
     `concurrency` group so two deploys can't overlap.
   - `permissions: id-token: write, contents: read` and nothing else.
   - Steps: checkout, Node, `npm ci`, build, tests (deploy only what passes),
     `azure/login` with the environment variables, get the token, then
     `rayfin up` targeting `vars.FABRIC_WORKSPACE_ID` non-interactively.
     Set `RAYFIN_TELEMETRY_OPTOUT=1`. Write a short job summary: commit,
     approver, and the app URL if Rayfin returns one.
   - Pin every third-party action to a verified full commit SHA (`gh api`, I
     approve each call), as in `ci.yml`.
   - Don't print tokens, IDs beyond what the logs already show, or `.env`
     contents.
2. Add `docs/deploy.md`: how a prod deploy happens (merge → job waits →
   approve → deploy), what the job can and can't do, how to read a failure
   (including a federated credential subject mismatch, and how to see the
   subject GitHub sent), the client-secret fallback (documented only, not
   built), and how rollback works (revert the PR, approve the redeploy).
3. Update `docs/ci.md`, `docs/decisions.md` and `docs/poc-log.md` (agent time;
   leave review time blank). Update `AGENTS.md`'s data boundary: ROW-POC-Prod
   exists, and only the deploy workflow touches it.

**CHECKPOINT 2:** stop and give me: what changed, the action SHAs you verified,
my test steps (merge; run the workflow by hand; approve; what success looks
like; what to check in ROW-POC-Prod; what to do if sign-in fails), and the
proposed commits with the paths to stage.

## Do not

- Deploy, run `npx rayfin up`, `rayfin login`, `az login`, or any Fabric or
  Azure command yourself.
- Add secrets, or a client secret path in the workflow.
- Change the app's code or entities, CI's required checks, `.claude/`, or
  anything in `powerbi/`, `snowflake/` or `data/`.
- Read any `.env` file.
- Push, open a pull request, or use `--force`.
