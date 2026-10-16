 ▐▛███▜▌   Claude Code v2.1.181
▝▜█████▛▘  Opus 4.8 · Claude Pro
  ▘▘ ▝▝    C:\dev\fabric-apps-row-poc

 ▎ Meet Fable 5, our newest model for complex, long-running work. Switch anytime with /model.

❯ /clear                                                                        

❯ Follow prompts/07_app_sclice.md                                               

● I'll read the prompt file to see what you want me to do.

  Read 1 file (ctrl+o to expand)

● This is Part A — understand the template, then plan (no code changes), ending
  at Checkpoint 1. Let me read the required context first.

  Read 4 files (ctrl+o to expand)

● Now let me explore the template structure.

  Ran 1 shell command (ctrl+o to expand)

● I'll read the core template files in parallel.

  Read 6 files (ctrl+o to expand)

● Let me read the auth services, UI, and tests.

  Read 5 files (ctrl+o to expand)

● Now the UI pages and tests.

  Read 5 files (ctrl+o to expand)

● Now let me read the Rayfin package docs (decorators, permissions, known
  limitations) and the canonical vendor list.

  Read 3 files (ctrl+o to expand)

● Let me look at the guide docs for validation/unique, claims/groups, seeding,
  and local dev.

  Read 3 files, ran 1 shell command (ctrl+o to expand)

● Let me check field options (unique), the data client API, local dev DB
  behavior, and Fabric claims/groups.

  Read 3 files (ctrl+o to expand)

● Let me check the vite config, local-dev doc, and the canonical vendor list in
  the generator.

  Searched for 3 patterns, read 3 files (ctrl+o to expand)

● I've read the root AGENTS.md + docs/decisions.md, the app's AGENTS.md + rayfin
  SKILL.md, the template source, and the version-locked Rayfin package docs
  (decorators, permissions, validation, auth, known-limitations, CLI). No code
  changed. Here's Part A.

  ---
  CHECKPOINT 1 — how the template works, and the proposed slice

  How the template works

  Entity + @role. rayfin/data/Todo.ts is one entity: id (uuid), title,
  isCompleted, createdAt, user_id. Its permission is @role('authenticated', '*',
  { policy: (claims, item) => claims.sub.eq(item.user_id) }) — any signed-in
  user gets full CRUD but only on rows where user_id equals their own claims.sub
  (per-user row-level security, compiled to a DAB policy string @claims.sub eq 
  @item.user_id). schema.ts registers the class; an unregistered entity doesn't
  exist to the client.

  Auth (two modes, chosen at startup). bootstrapAuth() reads
  VITE_RAYFIN_API_URL. localhost → MockAuthService (signs into the bundled
  backend with a fixed dev email/password, creating the account on first run).
  Anything else → RayfinAuthService (Fabric SSO / Entra via
  @microsoft/rayfin-auth-provider-fabric, popup + embedded-iframe flows).
  AuthContext/AuthProvider expose {user, isAuthenticated, signIn, signOut} to
  React; AuthGuard in App.tsx gates routes. The session is opaque; the UI only
  ever sees {id, email, name}.

  Client services. rayfinClient.ts holds the singleton RayfinClient +
  isLocalBackend(). todos.ts does CRUD through client.data.Todo.*, with an 
  in-memory array fallback whenever isLocalBackend() is true — so the sample
  runs fully without any database.

  Tests. vitest: todos.test.ts (in-memory CRUD round-trip) and
  AuthProvider.test.tsx (renders children after the auth check). npm run build =
  tsc -b && vite build; npm run lint = eslint.

  Running locally / the CLI. npx rayfin dev (= npm run dev): per the guide it
  "uses the Fabric backend provider by default and provisions a missing
  AppBackend," applies runtime+schema, then starts Vite (and Functions if
  enabled). So the database is in Fabric, not local — there is no local SQL
  engine. The template sidesteps this with the in-memory fallback + Mock
  email/password auth, which is what runs when the API URL is localhost. (I have
  not run rayfin dev here, so which path activates in this repo is something
  I'd confirm on first run.) npx rayfin up = deploy static app and apply pending
  schema migrations (the canonical "make my change live"); rayfin up db apply =
  schema-only. Both are deploy actions and are gated by the hard rules.

  Key findings that shape the slice

  1. Picklists → @set('a','b',...) (string enum; validated server-side and in
  the generated schema validator). Good for vendor and date_certainty.
  2. Field constraints are server-enforced via decorator options: required
  (non-nullable default), {max:500} on notes, {unique:true} on feeder_id, enum
  membership via @set. These land in the DB/DAB layer.
  3. Cross-field rules are NOT server-enforceable in Rayfin's model. The schema
  validator (toStandardSchema) and DAB only do per-field checks — there is no
  cross-field rule surface. So "confirmed→date required", "next
  year→planned_year required & no date", "TBD→no date" can be enforced in the 
  form only, unless we add a server-side Rayfin Function (out of scope for a
  thin slice). This is the finding the prompt asks for.
  4. Entra groups — the open design question. The policy DSL exposes only
  claims.sub, claims.email, claims.role. There is no groups claim, and the
  client session is opaque (id/email/name). rayfin.yml has a static customClaims
  block (not dynamic group membership). So from the docs, group membership does
  not reach the app as a usable claim today — which is exactly what the claims
  panel will let us verify empirically when signed in through Fabric. I can't
  fully answer this from docs; the panel is the experiment.
  5. Decorator + SWC gotcha. toStandardSchema/getFieldConstraints need the
  entity class at runtime, and the validation doc states
  @vitejs/plugin-react-swc (what this template uses) does not support these
  decorators — you'd have to swap to @vitejs/plugin-react. Today the client only
  imports the schema as a type, so there's no runtime decorator eval and no
  problem. This forces a validation decision (below).

  Proposed slice

  - Entity ClearingPlan (replaces Todo, which I'll remove — entity, UI, tests):
  feeder_id @text({max, unique}) required; district_name @text required (@set of
  the 5 districts — North Ridge, Pine Hollow, Cedar Valley, Stone Creek, Elk
  Meadow); vendor @set(...6 canonical + 'Unassigned'); last_cleared_date @date 
  optional; last_work_done @text optional; next_clearing_date @date optional;
  date_certainty @set('confirmed','tentative','next year','TBD'); planned_year 
  @int optional; notes @text({max:500}) optional; updated_by @text + updated_at 
  @date (no evidence the SDK auto-stamps these, so add them).
  - Permissions: @authenticated('read') + @authenticated('update') — no create,
  no delete. All signed-in users read+update all rows (no row policy yet; proper
  district/Entra-group rules are a later step).
  - Validation / where each rule lives:
    - Field rules (required, enum, max-500, unique feeder_id): form + server
  (decorators do both).
    - Cross-field rules: form only — hand-written in the edit form; report says
  the server does not enforce them.
    - Recommendation: hand-write the form validation in plain TS (covers both
  field and cross-field rules in one place), so we add no new dependency and
  don't touch the Vite plugin. The alternative — toStandardSchema for field
  rules — buys "written once from the entity" but requires swapping
  @vitejs/plugin-react-swc → @vitejs/plugin-react (a devDependency change). I
  lean against it for a thin slice.
  - Claims panel: a small, clearly-labelled "Who am I (diagnostic)" card showing
  every claim the app actually receives (user id, email, name, and anything
  else present on the session — role/groups if they arrive). Display-only.
  - Screens: one feeder list (feeder, district, vendor, next clearing,
  certainty) + an edit form. Plain Tailwind (already in the template; no new UI 
  library).
  - Seed: 15 synthetic ClearingPlan rows (hand-built from the generator's
  canonical vendors/districts and substation-circuit id format), each certainty
  ≥2×, ≥1 "Unassigned", mixed districts, clean values. Loaded into the in-memory
  store for local-backend mode so the slice runs with no deploy and no DB
  write. Seeding a real Fabric DB would be a separate, gated post-deploy step.
  - Files: add rayfin/data/ClearingPlan.ts, src/services/clearingPlans.ts,
  src/services/seed.ts, a ClaimsPanel component, new validation module + its
  test; rewrite schema.ts, HomePage.tsx, rayfinClient.ts (type import), auth
  page/header strings; remove Todo.ts + todos.ts + todos.test.ts. Update root
  AGENTS.md (app/ row + a short "Fabric App" section).
  - Tests: unit-test each cross-field rule + the field rules; in-memory
  clearingPlans list/update/seed; keep AuthProvider.test.tsx.
  - New npm dependencies: none under the recommended validation approach. (Only
  candidate, if you prefer toStandardSchema: devDep @vitejs/plugin-react
  replacing -swc.)

  What I'm unsure about / want your call

  1. Validation approach — my recommendation is hand-written (no new dep).
  Confirm, or say you want the toStandardSchema route (which means approving the
  Vite plugin swap).
  2. Local run / seed path — I haven't run rayfin dev; I'm assuming the
  in-memory local-backend path is active so the seed + slice run without a
  deploy. I'll verify on first run in Part B and adjust if dev forces a Fabric
  backend.

  Stopping here for your approval before any code changes.

✻ Worked for 3m 23s

※ recap: Goal: turn the row-tracker template into the first thin slice of the ROW clearing app. I've finished Part A (template analysis and plan) and stopped at Checkpoint 1. Next: await your approval, then build Part B.

❯ Approved with these changes:                                                  
  1. Validation: hand-written, no new dependency. Agreed.                       
  2. Local run must not touch Fabric. From the docs only (don't run it),        
  confirm whether `npx rayfin dev` / `npm run dev` provisions or changes        
  anything in Fabric. If it can, give me a purely local way to run the slice    
  (e.g. running Vite directly against the in-memory backend and mock auth) and  
  treat `rayfin dev` like a deploy: ask first.                                  
  3. updated_at: use a date-time type if the SDK has one. In app-notes, state   
  that updated_by is set by the client and is not audit-grade; the change-log   
  step will fix that.                                                           
  4. Seeding Fabric: the deployed app would start empty. Propose the smallest   
  gated way to load the 15 seed rows into the Fabric database after the first   
  deploy (for example, temporarily allowing create plus a "Load sample data"    
  button shown only when the table is empty, or a CLI step). Build it, but      
  don't run it against Fabric until I ask. Record the choice and its trade-off  
  in docs/decisions.md.                                                         
  5. In app-notes, record the two findings: cross-field rules are form-only     
  (server-side needs a Rayfin Function, a later step), and no groups claim      
  exists in the policy model, so Entra-group roles likely need a fallback; the  
  claims panel confirms it after deploy.                                        
  Then continue with Part B.                                                    
● Point #2 needs a documentation check before I build. Let me read the
  local-dev-docker preview and the CLI/getting-started docs to confirm exactly
  what rayfin dev touches.

  Read 3 files (ctrl+o to expand)

● Confirmed from the installed docs (point #2):

  - Bare npx rayfin dev / npm run dev uses the Fabric provider by default and 
  provisions a missing AppBackend in Fabric (cli/index.md, cli/quickstart.md,
  create-app-with-cli.md). So it can create/change Fabric state → I'll treat it 
  as a deploy and ask first.
  - Fabric-free alternatives: rayfin dev --provider docker (preview, flag-gated,
  needs Docker + a real local DB), or plain vite (npm run dev:frontend), which
  starts only the frontend and never contacts Fabric. That's the one I'll make
  the supported local path — but it needs backend-free auth + in-memory data
  (the template's MockAuthService expects a local backend at :5168, which plain
  Vite doesn't start).

  Let me read the remaining wiring files before building.

  Read 6 files (ctrl+o to expand)

● Let me verify the exact @microsoft/rayfin-core exports (so the entity
  compiles) and the data-client method surface before writing code.

  Ran 2 shell commands (ctrl+o to expand)

● All the decorators I need exist (authenticated, int, set, date, text, uuid,
  entity). Now building Part B. Let me set up a task list and start with the
  data layer.

● Starting with the data layer. The entity:

● Write(app\row-tracker\rayfin\data\ClearingPlan.ts)
  ⎿  Wrote 72 lines to app\row-tracker\rayfin\data\ClearingPlan.ts
       1 import { entity, authenticated, uuid, text, int, date, set } fro
       2 
         ad: a real date,
       4 // a certainty picklist, a vendor dropdown, and a canonical dist
       5 // names mirror the Snowflake ANALYTICS layer (see root AGENTS.m
       6 //
         and UPDATE every
       8 // feeder. No create (rows arrive through the seed) and no delet
       9 // — district managers edit their own district, an approved Entr
      10 // — come in a later step; see docs/app-notes.md.
     … +85 lines (ctrl+o to expand)

● Write(app\row-tracker\rayfin\data\schema.ts)
  ⎿  Added 4 lines, removed 4 lines
      1 -import { Todo } from './Todo.js';                               
      1 +import { ClearingPlan } from './ClearingPlan.js';               
      2  
      3 -export type TodoAppSchema = {                                   
      4 -  Todo: Todo;                                                   
      3 +export type ClearingPlanAppSchema = {                           
      4 +  ClearingPlan: ClearingPlan;                                   
      5  };
      6  
      7 -export const schema = [Todo];                                   
      7 +export const schema = [ClearingPlan];                           

  Ran 1 shell command (ctrl+o to expand)

● Now the shared model module (client-side constants/types):

● Write(app\row-tracker\src\services\clearingPlanModel.ts)
  ⎿  Wrote 67 lines to app\row-tracker\src\services\clearingPlanModel.ts
       1 // Shared constants and types for the ClearingPlan slice, used b
         y the data
         ty decorators in
       3 // rayfin/data/ClearingPlan.ts carry their own literal lists (a 
         decorator needs
       5 
       6 export const VENDORS = [
       7   'Summit Vegetation Management',
       9   'Greenway Land and Timber',
      10   'Ironwood Forestry',
     … +66 lines (ctrl+o to expand)

● Now the seed (15 synthetic rows):

● Write(app\row-tracker\src\services\seed.ts)
  ⎿  Wrote 191 lines to app\row-tracker\src\services\seed.ts
       1 import type { ClearingPlanRow } from './clearingPlanModel';
       3 // 15 synthetic feeder rows. Entirely invented — no real coopera
       4 // vendor, or district. Vendors and districts are the canonical 
         values from
         t.
       7 // Coverage (matches the slice decisions): every certainty at le
       8 // (confirmed 6, tentative 3, next year 3, TBD 3), at least one 
         "Unassigned"
         eady clean and
         dation errors.
     … +187 lines (ctrl+o to expand)
● Now the validation rules (field + cross-field, pure functions):

● Write(app\row-tracker\src\services\validation.ts)
  ⎿  Wrote 83 lines to app\row-tracker\src\services\validation.ts
       1 import {
       2   DATE_CERTAINTIES,
       3   NOTES_MAX,
       4   VENDORS,
       5   type ClearingPlanEdit,
       6 } from './clearingPlanModel';
       7 
       8 export type ClearingPlanErrors = Partial<
       9   Record<keyof ClearingPlanEdit, string>
      10 >;
     … +84 lines (ctrl+o to expand)

● Now update rayfinClient.ts to the new schema type:

● Update(app\row-tracker\src\services\rayfinClient.ts)
  ⎿  Added 1 line, removed 1 line
       4    type RayfinRuntimeConfig,
       5  } from '@microsoft/rayfin-client';
       6  
       7 -import type { TodoAppSchema } from '../../rayfin/data/schema'; 
       7 +import type { ClearingPlanAppSchema } from '../../rayfin/data/s
         +chema';                                                        
       8  
       9  export interface RayfinClientConfig {
      10    baseUrl: string;

  Searched for 1 pattern, ran 1 shell command (ctrl+o to expand)

● Now the clearingPlans.ts service (list / update / Fabric seed, with in-memory
  local store):

● Write(app\row-tracker\src\services\clearingPlans.ts)
  ⎿  Wrote 137 lines to app\row-tracker\src\services\clearingPlans.ts
       1 import type { ClearingPlanEdit, ClearingPlanRow } from './cleari
         ngPlanModel';
         ;
       3 import { SEED_ROWS } from './seed';
       4 
         y order.
       6 const FIELDS = [
       7   'id',
       9   'district_name',
      10   'vendor',
     … +145 lines (ctrl+o to expand)

● Now the auth layer. Add getDiagnosticClaims to the interface:

● Update(app\row-tracker\src\services\IAuthService.ts)
  ⎿  Added 10 lines
      40     * any UI. Returns `null` when not running inside a Fabric if
          rame.
      41     */
      42    initEmbeddedAuth(): Promise<AuthUser | null>;
      43 +                                                               
      44 +  /**                                                          
      45 +   * Return every claim the app can read for the signed-in user
         +, for the                                                      
      46 +   * diagnostic "Who am I" panel. The Rayfin session is opaque,
         + so in practice                                                
      47 +   * this is whatever the session `user` exposes (id, email, na
         +me). It answers                                                
      48 +   * the open design question — do Entra groups/roles reach the
         + app — once the                                                
      49 +   * app is deployed and signed in through Fabric. Locally the 
         +values are                                                     
      50 +   * synthetic. Display only; never gate logic on these.       
      51 +   */                                                          
      52 +  getDiagnosticClaims(): Promise<Record<string, unknown>>;     
      53  }
      54  
      55  /** Map the raw session user shape to the trimmed view used in 
          the UI. */

● Now add getDiagnosticClaims to RayfinAuthService:

● Update(app\row-tracker\src\services\RayfinAuthService.ts)
  ⎿  Added 7 lines
      56      if (!session?.isAuthenticated || !session.user) return null
          ;
      57      return toAuthUser(session.user);
      58    }
      59 +                                                               
      60 +  async getDiagnosticClaims(): Promise<Record<string, unknown>>
         + {                                                             
      61 +    const session = this.client.auth.getSession();             
      62 +    // The session is opaque; surface exactly what the user obj
         +ect carries. If                                                
      63 +    // Entra role/group claims ever reach the client, they appe
         +ar here.                                                       
      64 +    return session.user ? { ...session.user } : {};            
      65 +  }                                                            
      66  }

● Now the backend-free local stub auth service:

● Write(app\row-tracker\src\services\LocalAuthService.ts)
  ⎿  Wrote 43 lines to app\row-tracker\src\services\LocalAuthService.ts
       1 import { type AuthUser, type IAuthService } from './IAuthService
       2 
         is plain Vite
       4 // (`npm run dev:frontend`), which never starts a Rayfin backend
       5 // touches Fabric — so local auth cannot call a server. This stu
       6 // instantly to a synthetic developer identity and keeps the Aut
       7 //
       8 // DEV-only: bootstrap loads it through a dynamic import guarded
       9 // `import.meta.env.DEV`, so it is not in production bundles. Th
      10 // uses RayfinAuthService (Fabric SSO) instead.
     … +39 lines (ctrl+o to expand)

● Now wire bootstrap.ts to use the local stub (DEV-only dynamic import):

● Update(app\row-tracker\src\services\bootstrap.ts)
  ⎿  Removed 1 line
      1  import { resolveRayfinFunctionsBaseUrl } from '@microsoft/rayfin
         -local-dev';
      2  
      3  import type { IAuthService } from './IAuthService';
      4 -import { MockAuthService } from './MockAuthService';            
      4  import { RayfinAuthService } from './RayfinAuthService';
      5  import { initRayfinClient } from './rayfinClient';
      6  

● Update(app\row-tracker\src\services\bootstrap.ts)
  ⎿  Added 1 line, removed 1 line
      17   * Read VITE_* env vars, initialize the Rayfin client, and retu
          rn the right
      18   * auth service for the target backend.
      19   *
      20 - * - Localhost API URL → {@link MockAuthService}               
      20 + * - Localhost API URL → backend-free LocalAuthService (DEV-onl
         +y)                                                             
      21   * - Anything else     → {@link RayfinAuthService} (requires VI
          TE_FABRIC_* vars)
      22   */
      23  export async function bootstrapAuth(): Promise<IAuthService> {

● Update(app\row-tracker\src\services\bootstrap.ts)
  ⎿  Added 4 lines, removed 2 lines
      43      },
      44    });
      45  
      46 -  if (localDev) {                                              
      47 -    return new MockAuthService(client);                        
      46 +  if (localDev && import.meta.env.DEV) {                       
      47 +    // Load the local stub only in dev so it stays out of produ
         +ction bundles.                                                 
      48 +    const { LocalAuthService } = await import('./LocalAuthServi
         +ce');                                                          
      49 +    return new LocalAuthService();                             
      50    }
      51  
      52    const {

● Now expose claims in AuthContext:

● Update(app\row-tracker\src\hooks\AuthContext.tsx)
  ⎿  Added 2 lines
      12  
      13  interface AuthContextValue {
      14    user: AuthUser | null;
      15 +  /** Diagnostic: every claim the app can read for the user. Di
         +splay only. */                                                 
      16 +  claims: Record<string, unknown> | null;                      
      17    loading: boolean;
      18    error: string | null;
      19    signIn: () => Promise<AuthUser>;

● Update(app\row-tracker\src\hooks\AuthContext.tsx)
  ⎿  Added 14 lines, removed 2 lines
      31  
      32  export function AuthProvider({ children, authService }: AuthPro
          viderProps) {
      33    const [user, setUser] = useState<AuthUser | null>(null);
      34 +  const [claims, setClaims] = useState<Record<string, unknown> 
         +| null>(null);                                                 
      35    const [loading, setLoading] = useState(true);
      36    const [error, setError] = useState<string | null>(null);
      37  
      38 +  const refreshClaims = useCallback(async () => {              
      39 +    try {                                                      
      40 +      setClaims(await authService.getDiagnosticClaims());      
      41 +    } catch {                                                  
      42 +      setClaims(null);                                         
      43 +    }                                                          
      44 +  }, [authService]);                                           
      45 +                                                               
      46    useEffect(() => {
      47      let cancelled = false;
      48      authService
      49        .initEmbeddedAuth()
      50        .then((embedded) => embedded ?? authService.getCurrentUse
          r())
      51        .then((current) => {
      43 -        if (!cancelled && current) setUser(current);           
      52 +        if (!cancelled && current) {                           
      53 +          setUser(current);                                    
      54 +          void refreshClaims();                                
      55 +        }                                                      
      56        })
      57        .catch(() => {
      58          if (!cancelled) setUser(null);
     ...
      63      return () => {
      64        cancelled = true;
      65      };
      54 -  }, [authService]);                                           
      66 +  }, [authService, refreshClaims]);                            
      67  
      68    const signIn = useCallback(async () => {
      69      setError(null);

● Update(app\row-tracker\src\hooks\AuthContext.tsx)
  ⎿  Added 1 line
      71      try {
      72        const loggedInUser = await authService.signIn();
      73        setUser(loggedInUser);
      74 +      void refreshClaims();                                    
      75        return loggedInUser;
      76      } catch (err) {
      77        const message = err instanceof Error ? err.message : 'Log
          in failed';

● Update(app\row-tracker\src\hooks\AuthContext.tsx)
  ⎿  Added 1 line, removed 1 line
      80      } finally {
      81        setLoading(false);
      82      }
      83 -  }, [authService]);                                           
      83 +  }, [authService, refreshClaims]);                            
      84  
      85    const signOut = useCallback(async () => {
      86      try {

● Update(app\row-tracker\src\hooks\AuthContext.tsx)
  ⎿  Added 2 lines, removed 1 line
       94    const value = useMemo<AuthContextValue>(
       95      () => ({
       96        user,
       97 +      claims,                                                 
       98        loading,
       99        error,
      100        signIn,
     ...
      102        isAuthenticated: !!user,
      103        fabricAuthEnabled: authService.fabricAuthEnabled,
      104      }),
      104 -    [user, loading, error, signIn, signOut, authService]      
      105 +    [user, claims, loading, error, signIn, signOut, authServic
          +e]                                                            
      106    );
      107  
      108    return <AuthContext.Provider value={value}>{children}</AuthC
           ontext.Provider>;
● Now the UI. The ClaimsPanel first:

● Write(app\row-tracker\src\components\ClaimsPanel.tsx)
  ⎿  Wrote 46 lines to app\row-tracker\src\components\ClaimsPanel.tsx
       1 import { useAuth } from '@/hooks/AuthContext';
       2 
       4  * Diagnostic "Who am I" card. Shows every claim the app can rea
         d for the
       5  * signed-in user. It exists to answer the open design question 
       6  * groups/roles reach the app so role rules can use them? — once
          the app is
       7  * deployed and signed in through Fabric. Display only.
       9 export function ClaimsPanel() {
      10   const { claims } = useAuth();
     … +46 lines (ctrl+o to expand)

● Now the HomePage — feeder list, edit form with validation, claims panel, and
  the gated Fabric seed button:

● Write(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 321 lines, removed 156 lines
       1  import { useCallback, useEffect, useState } from 'react';
       2  
       3 +import { ClaimsPanel } from '@/components/ClaimsPanel';        
       4  import { useAuth } from '@/hooks/AuthContext';
       5  import {
       5 -  createTodo,                                                  
       6 -  deleteTodo,                                                  
       7 -  getTodos,                                                    
       8 -  updateTodo,                                                  
       9 -  type TodoItem,                                               
      10 -} from '@/services/todos';                                     
       6 +  DATE_CERTAINTIES,                                            
       7 +  DISTRICTS,                                                   
       8 +  NOTES_MAX,                                                   
       9 +  VENDORS,                                                     
      10 +  type ClearingPlanEdit,                                       
      11 +  type ClearingPlanRow,                                        
      12 +} from '@/services/clearingPlanModel';                         
      13 +import {                                                       
      14 +  listClearingPlans,                                           
      15 +  seedFabric,                                                  
      16 +  updateClearingPlan,                                          
      17 +} from '@/services/clearingPlans';                             
      18 +import { isLocalBackend } from '@/services/rayfinClient';      
      19 +import {                                                       
      20 +  hasErrors,                                                   
      21 +  validateClearingPlan,                                        
      22 +  type ClearingPlanErrors,                                     
      23 +} from '@/services/validation';                                
      24  
      25 +/** Format a Date as `yyyy-mm-dd` for display and date inputs; 
         +'' when null. */                                               
      26 +const toInputDate = (d: Date | null): string =>                
      27 +  d ? d.toISOString().slice(0, 10) : '';                       
      28 +                                                               
      29 +function editFromRow(row: ClearingPlanRow): ClearingPlanEdit { 
      30 +  return {                                                     
      31 +    vendor: row.vendor,                                        
      32 +    date_certainty: row.date_certainty,                        
      33 +    last_cleared_date: toInputDate(row.last_cleared_date),     
      34 +    last_work_done: row.last_work_done ?? '',                  
      35 +    next_clearing_date: toInputDate(row.next_clearing_date),   
      36 +    planned_year: row.planned_year != null ? String(row.planned
         +_year) : '',                                                   
      37 +    notes: row.notes ?? '',                                    
      38 +  };                                                           
      39 +}                                                              
      40 +                                                               
      41  export function HomePage() {
      42    const { signOut, user } = useAuth();
      14 -  const [todos, setTodos] = useState<TodoItem[]>([]);          
      15 -  const [newTodoTitle, setNewTodoTitle] = useState('');        
      43 +  const [rows, setRows] = useState<ClearingPlanRow[]>([]);     
      44    const [loading, setLoading] = useState(true);
      45 +  const [editingId, setEditingId] = useState<string | null>(nul
         +l);                                                            
      46 +  const [seeding, setSeeding] = useState(false);               
      47 +  const [seedError, setSeedError] = useState<string | null>(nul
         +l);                                                            
      48  
      18 -  const fetchTodos = useCallback(async () => {                 
      19 -    const data = await getTodos();                             
      20 -    setTodos(data);                                            
      49 +  const fetchRows = useCallback(async () => {                  
      50 +    setRows(await listClearingPlans());                        
      51      setLoading(false);
      52    }, []);
      53  
      54    useEffect(() => {
      25 -    void fetchTodos();                                         
      26 -  }, [fetchTodos]);                                            
      55 +    void fetchRows();                                          
      56 +  }, [fetchRows]);                                             
      57  
      28 -  const handleAddTodo = async (e: React.FormEvent) => {        
      29 -    e.preventDefault();                                        
      30 -    const title = newTodoTitle.trim();                         
      31 -    if (!title) return;                                        
      32 -    setNewTodoTitle('');                                       
      33 -    await createTodo(title);                                   
      34 -    await fetchTodos();                                        
      58 +  const handleSeed = async () => {                             
      59 +    setSeedError(null);                                        
      60 +    setSeeding(true);                                          
      61 +    try {                                                      
      62 +      await seedFabric(user?.email ?? user?.id ?? 'unknown');  
      63 +      await fetchRows();                                       
      64 +    } catch (err) {                                            
      65 +      setSeedError(err instanceof Error ? err.message : 'Failed
         + to load data.');                                              
      66 +    } finally {                                                
      67 +      setSeeding(false);                                       
      68 +    }                                                          
      69    };
      70  
      37 -  const handleToggle = async (id: string, isCompleted: boolean)
         - => {                                                          
      38 -    await updateTodo(id, { isCompleted: !isCompleted });       
      39 -    await fetchTodos();                                        
      40 -  };                                                           
      71 +  // The gated Fabric seed: offered only against a real backend
         + when empty.                                                   
      72 +  const showSeed = !isLocalBackend() && !loading && rows.length
         + === 0;                                                        
      73  
      42 -  const handleDelete = async (id: string) => {                 
      43 -    await deleteTodo(id);                                      
      44 -    await fetchTodos();                                        
      45 -  };                                                           
      46 -                                                               
      47 -  const pending = todos.filter((t) => !t.isCompleted);         
      48 -  const completed = todos.filter((t) => t.isCompleted);        
      49 -                                                               
      74    return (
      51 -    <div className="bg-gray-50 min-h-screen">                  
      52 -      <header className="flex items-center justify-between px-8
         - py-5 bg-white border-b border-gray-200">                      
      53 -        <h1 className="text-xl font-bold text-gray-900">Todo Ap
         -p</h1>                                                         
      75 +    <div className="min-h-screen bg-gray-50">                  
      76 +      <header className="flex items-center justify-between bord
         +er-b border-gray-200 bg-white px-8 py-5">                      
      77 +        <h1 className="text-xl font-bold text-gray-900">ROW Cle
         +aring Tracker</h1>                                             
      78          <div className="flex items-center gap-4">
      79            {user?.email && (
      80              <span className="text-sm text-gray-600" title={user
          .email}>
     ...
      83            )}
      84            <button
      85              onClick={() => void signOut()}
      62 -            className="text-gray-400 hover:text-gray-600 transi
         -tion-colors text-sm"                                           
      86 +            className="text-sm text-gray-400 transition-colors 
         +hover:text-gray-600"                                           
      87              aria-label="Sign out"
      88            >
      89              Sign out
     ...
       91          </div>
       92        </header>
       93  
       70 -      <main className="max-w-xl mx-auto px-4 py-10">          
       71 -        <form                                                 
       72 -          onSubmit={(e) => void handleAddTodo(e)}             
       73 -          className="flex gap-3 mb-8"                         
       74 -        >                                                     
       75 -          <input                                              
       76 -            type="text"                                       
       77 -            value={newTodoTitle}                              
       78 -            onChange={(e) => setNewTodoTitle(e.target.value)} 
       79 -            placeholder="What needs to be done?"              
       80 -            className="flex-1 rounded-xl border border-gray-30
          -0 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-40
          -0 shadow-sm focus:border-blue-500 focus:outline-none focus:rin
          -g-1 focus:ring-blue-500"                                      
       81 -          />                                                  
       82 -          <button                                             
       83 -            type="submit"                                     
       84 -            disabled={!newTodoTitle.trim()}                   
       85 -            className="rounded-xl bg-blue-600 px-5 py-3 text-s
          -m font-medium text-white shadow-sm transition-all hover:bg-blu
          -e-700 disabled:opacity-40"                                    
       86 -          >                                                   
       87 -            Add                                               
       88 -          </button>                                           
       89 -        </form>                                               
       94 +      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
       95 +        <ClaimsPanel />                                       
       96  
       97          {loading ? (
       92 -          <p className="text-center text-gray-400 text-sm">Loa
          -ding...</p>                                                   
       93 -        ) : todos.length === 0 ? (                            
       94 -          <div className="text-center py-16">                 
       95 -            <p className="text-gray-400 text-sm">             
       96 -              No todos yet. Add one above!                    
       98 +          <p className="text-center text-sm text-gray-400">Loa
          +ding…</p>                                                     
       99 +        ) : showSeed ? (                                      
      100 +          <div className="rounded-xl border border-gray-200 bg
          +-white px-6 py-10 text-center">                               
      101 +            <p className="mb-4 text-sm text-gray-500">        
      102 +              No feeders yet. Load the 15 synthetic sample row
          +s to get started.                                             
      103              </p>
       98 -          </div>                                              
       99 -        ) : (                                                 
      100 -          <div className="space-y-6">                         
      101 -            {pending.length > 0 && (                          
      102 -              <section>                                       
      103 -                <h2 className="text-xs font-semibold uppercase
          - tracking-wider text-gray-400 mb-3">                          
      104 -                  To Do ({pending.length})                    
      105 -                </h2>                                         
      106 -                <ul className="space-y-2">                    
      107 -                  {pending.map((todo) => (                    
      108 -                    <TodoRow                                  
      109 -                      key={todo.id}                           
      110 -                      todo={todo}                             
      111 -                      onToggle={handleToggle}                 
      112 -                      onDelete={handleDelete}                 
      113 -                    />                                        
      114 -                  ))}                                         
      115 -                </ul>                                         
      116 -              </section>                                      
      104 +            <button                                           
      105 +              onClick={() => void handleSeed()}               
      106 +              disabled={seeding}                              
      107 +              className="rounded-xl bg-blue-600 px-5 py-3 text
          +-sm font-medium text-white shadow-sm transition-colors hover:b
          +g-blue-700 disabled:opacity-40"                               
      108 +            >                                                 
      109 +              {seeding ? 'Loading…' : 'Load sample data'}     
      110 +            </button>                                         
      111 +            {seedError && (                                   
      112 +              <p className="mt-3 text-sm text-red-600">{seedEr
          +ror}</p>                                                      
      113              )}
      118 -                                                              
      119 -            {completed.length > 0 && (                        
      120 -              <section>                                       
      121 -                <h2 className="text-xs font-semibold uppercase
          - tracking-wider text-gray-400 mb-3">                          
      122 -                  Completed ({completed.length})              
      123 -                </h2>                                         
      124 -                <ul className="space-y-2">                    
      125 -                  {completed.map((todo) => (                  
      126 -                    <TodoRow                                  
      127 -                      key={todo.id}                           
      128 -                      todo={todo}                             
      129 -                      onToggle={handleToggle}                 
      130 -                      onDelete={handleDelete}                 
      131 -                    />                                        
      132 -                  ))}                                         
      133 -                </ul>                                         
      134 -              </section>                                      
      135 -            )}                                                
      114            </div>
      115 +        ) : (                                                 
      116 +          <FeederTable                                        
      117 +            rows={rows}                                       
      118 +            editingId={editingId}                             
      119 +            onEdit={setEditingId}                             
      120 +            onCancel={() => setEditingId(null)}               
      121 +            onSaved={async () => {                            
      122 +              setEditingId(null);                             
      123 +              await fetchRows();                              
      124 +            }}                                                
      125 +            updatedBy={user?.email ?? user?.id ?? 'unknown'}  
      126 +          />                                                  
      127          )}
      128        </main>
      129      </div>
      130    );
      131  }
      132  
      143 -function TodoRow({                                            
      144 -  todo,                                                       
      145 -  onToggle,                                                   
      146 -  onDelete,                                                   
      133 +function FeederTable({                                        
      134 +  rows,                                                       
      135 +  editingId,                                                  
      136 +  onEdit,                                                     
      137 +  onCancel,                                                   
      138 +  onSaved,                                                    
      139 +  updatedBy,                                                  
      140  }: {
      148 -  todo: TodoItem;                                             
      149 -  onToggle: (id: string, isCompleted: boolean) => void;       
      150 -  onDelete: (id: string) => void;                             
      141 +  rows: ClearingPlanRow[];                                    
      142 +  editingId: string | null;                                   
      143 +  onEdit: (id: string) => void;                               
      144 +  onCancel: () => void;                                       
      145 +  onSaved: () => Promise<void>;                               
      146 +  updatedBy: string;                                          
      147  }) {
      148    return (
      153 -    <li className="group flex items-center gap-3 rounded-xl bg
          --white px-4 py-3 shadow-sm border border-gray-100">           
      154 -      <button                                                 
      155 -        onClick={() => onToggle(todo.id, todo.isCompleted)}   
      156 -        className={`flex h-5 w-5 shrink-0 items-center justify
          --center rounded-full border-2 transition-colors ${            
      157 -          todo.isCompleted                                    
      158 -            ? 'border-blue-500 bg-blue-500 text-white'        
      159 -            : 'border-gray-300 hover:border-blue-400'         
      160 -        }`}                                                   
      161 -        aria-label={todo.isCompleted ? 'Mark incomplete' : 'Ma
          -rk complete'}                                                 
      162 -      >                                                       
      163 -        {todo.isCompleted && (                                
      164 -          <svg                                                
      165 -            className="h-3 w-3"                               
      166 -            fill="none"                                       
      167 -            viewBox="0 0 24 24"                               
      168 -            stroke="currentColor"                             
      169 -            strokeWidth={3}                                   
      149 +    <div className="overflow-hidden rounded-xl border border-g
          +ray-200 bg-white">                                            
      150 +      <table className="w-full text-left text-sm">            
      151 +        <thead className="border-b border-gray-200 bg-gray-50 
          +text-xs uppercase tracking-wider text-gray-500">              
      152 +          <tr>                                                
      153 +            <th className="px-4 py-3">Feeder</th>             
      154 +            <th className="px-4 py-3">District</th>           
      155 +            <th className="px-4 py-3">Vendor</th>             
      156 +            <th className="px-4 py-3">Next clearing</th>      
      157 +            <th className="px-4 py-3">Certainty</th>          
      158 +            <th className="px-4 py-3" />                      
      159 +          </tr>                                               
      160 +        </thead>                                              
      161 +        <tbody className="divide-y divide-gray-100">          
      162 +          {rows.map((row) =>                                  
      163 +            row.id === editingId ? (                          
      164 +              <tr key={row.id}>                               
      165 +                <td colSpan={6} className="bg-blue-50/40 px-4 
          +py-4">                                                        
      166 +                  <EditForm                                   
      167 +                    row={row}                                 
      168 +                    updatedBy={updatedBy}                     
      169 +                    onCancel={onCancel}                       
      170 +                    onSaved={onSaved}                         
      171 +                  />                                          
      172 +                </td>                                         
      173 +              </tr>                                           
      174 +            ) : (                                             
      175 +              <tr key={row.id} className="hover:bg-gray-50">  
      176 +                <td className="px-4 py-3 font-medium text-gray
          +-900">                                                        
      177 +                  {row.feeder_id}                             
      178 +                </td>                                         
      179 +                <td className="px-4 py-3 text-gray-700">{row.d
          +istrict_name}</td>                                            
      180 +                <td className="px-4 py-3 text-gray-700">{row.v
          +endor}</td>                                                   
      181 +                <td className="px-4 py-3 text-gray-700">      
      182 +                  {toInputDate(row.next_clearing_date) || '—'}
      183 +                </td>                                         
      184 +                <td className="px-4 py-3 text-gray-700">{row.d
          +ate_certainty}</td>                                           
      185 +                <td className="px-4 py-3 text-right">         
      186 +                  <button                                     
      187 +                    onClick={() => onEdit(row.id)}            
      188 +                    className="text-sm font-medium text-blue-6
          +00 hover:text-blue-800"                                       
      189 +                  >                                           
      190 +                    Edit                                      
      191 +                  </button>                                   
      192 +                </td>                                         
      193 +              </tr>                                           
      194 +            )                                                 
      195 +          )}                                                  
      196 +        </tbody>                                              
      197 +      </table>                                                
      198 +    </div>                                                    
      199 +  );                                                          
      200 +}                                                             
      201 +                                                              
      202 +function EditForm({                                           
      203 +  row,                                                        
      204 +  updatedBy,                                                  
      205 +  onCancel,                                                   
      206 +  onSaved,                                                    
      207 +}: {                                                          
      208 +  row: ClearingPlanRow;                                       
      209 +  updatedBy: string;                                          
      210 +  onCancel: () => void;                                       
      211 +  onSaved: () => Promise<void>;                               
      212 +}) {                                                          
      213 +  const [edit, setEdit] = useState<ClearingPlanEdit>(() => edi
          +tFromRow(row));                                               
      214 +  const [errors, setErrors] = useState<ClearingPlanErrors>({})
          +;                                                             
      215 +  const [saving, setSaving] = useState(false);                
      216 +  const [saveError, setSaveError] = useState<string | null>(nu
          +ll);                                                          
      217 +                                                              
      218 +  const set = <K extends keyof ClearingPlanEdit>(             
      219 +    key: K,                                                   
      220 +    value: ClearingPlanEdit[K]                                
      221 +  ) => setEdit((prev) => ({ ...prev, [key]: value }));        
      222 +                                                              
      223 +  const handleSubmit = async (e: React.FormEvent) => {        
      224 +    e.preventDefault();                                       
      225 +    const found = validateClearingPlan(edit);                 
      226 +    setErrors(found);                                         
      227 +    if (hasErrors(found)) return;                             
      228 +                                                              
      229 +    setSaveError(null);                                       
      230 +    setSaving(true);                                          
      231 +    try {                                                     
      232 +      await updateClearingPlan(row.id, edit, updatedBy);      
      233 +      await onSaved();                                        
      234 +    } catch (err) {                                           
      235 +      setSaveError(err instanceof Error ? err.message : 'Faile
          +d to save.');                                                 
      236 +    } finally {                                               
      237 +      setSaving(false);                                       
      238 +    }                                                         
      239 +  };                                                          
      240 +                                                              
      241 +  return (                                                    
      242 +    <form onSubmit={(e) => void handleSubmit(e)} className="sp
          +ace-y-4">                                                     
      243 +      <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm t
          +ext-gray-700">                                                
      244 +        <span>                                                
      245 +          <span className="text-gray-400">Feeder</span>{' '}  
      246 +          <span className="font-medium text-gray-900">{row.fee
          +der_id}</span>                                                
      247 +        </span>                                               
      248 +        <span>                                                
      249 +          <span className="text-gray-400">District</span>{' '}
      250 +          <span className="font-medium text-gray-900">{row.dis
          +trict_name}</span>                                            
      251 +        </span>                                               
      252 +      </div>                                                  
      253 +                                                              
      254 +      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"> 
      255 +        <Field label="Vendor" error={errors.vendor}>          
      256 +          <select                                             
      257 +            value={edit.vendor}                               
      258 +            onChange={(e) => set('vendor', e.target.value as C
          +learingPlanEdit['vendor'])}                                   
      259 +            className="w-full rounded-lg border border-gray-30
          +0 bg-white px-3 py-2"                                         
      260            >
      171 -            <path                                             
      172 -              strokeLinecap="round"                           
      173 -              strokeLinejoin="round"                          
      174 -              d="M5 13l4 4L19 7"                              
      175 -            />                                                
      176 -          </svg>                                              
      177 -        )}                                                    
      178 -      </button>                                               
      179 -      <span                                                   
      180 -        className={`flex-1 text-sm ${                         
      181 -          todo.isCompleted ? 'text-gray-400 line-through' : 't
          -ext-gray-900'                                                 
      182 -        }`}                                                   
      183 -      >                                                       
      184 -        {todo.title}                                          
      185 -      </span>                                                 
      186 -      <button                                                 
      187 -        onClick={() => onDelete(todo.id)}                     
      188 -        className="text-gray-300 hover:text-red-500 transition
          --colors opacity-0 group-hover:opacity-100"                    
      189 -        aria-label="Delete todo"                              
      190 -      >                                                       
      191 -        <svg                                                  
      192 -          className="h-4 w-4"                                 
      193 -          fill="none"                                         
      194 -          viewBox="0 0 24 24"                                 
      195 -          stroke="currentColor"                               
      196 -          strokeWidth={2}                                     
      197 -        >                                                     
      198 -          <path                                               
      199 -            strokeLinecap="round"                             
      200 -            strokeLinejoin="round"                            
      201 -            d="M6 18L18 6M6 6l12 12"                          
      261 +            {VENDORS.map((v) => (                             
      262 +              <option key={v} value={v}>                      
      263 +                {v}                                           
      264 +              </option>                                       
      265 +            ))}                                               
      266 +          </select>                                           
      267 +        </Field>                                              
      268 +                                                              
      269 +        <Field label="Date certainty" error={errors.date_certa
          +inty}>                                                        
      270 +          <select                                             
      271 +            value={edit.date_certainty}                       
      272 +            onChange={(e) =>                                  
      273 +              set('date_certainty', e.target.value as Clearing
          +PlanEdit['date_certainty'])                                   
      274 +            }                                                 
      275 +            className="w-full rounded-lg border border-gray-30
          +0 bg-white px-3 py-2"                                         
      276 +          >                                                   
      277 +            {DATE_CERTAINTIES.map((c) => (                    
      278 +              <option key={c} value={c}>                      
      279 +                {c}                                           
      280 +              </option>                                       
      281 +            ))}                                               
      282 +          </select>                                           
      283 +        </Field>                                              
      284 +                                                              
      285 +        <Field label="Next clearing date" error={errors.next_c
          +learing_date}>                                                
      286 +          <input                                              
      287 +            type="date"                                       
      288 +            value={edit.next_clearing_date}                   
      289 +            onChange={(e) => set('next_clearing_date', e.targe
          +t.value)}                                                     
      290 +            className="w-full rounded-lg border border-gray-30
          +0 bg-white px-3 py-2"                                         
      291            />
      203 -        </svg>                                                
      204 -      </button>                                               
      205 -    </li>                                                     
      292 +        </Field>                                              
      293 +                                                              
      294 +        <Field label="Planned year" error={errors.planned_year
          +}>                                                            
      295 +          <input                                              
      296 +            type="number"                                     
      297 +            value={edit.planned_year}                         
      298 +            onChange={(e) => set('planned_year', e.target.valu
          +e)}                                                           
      299 +            placeholder="e.g. 2027"                           
      300 +            className="w-full rounded-lg border border-gray-30
          +0 bg-white px-3 py-2"                                         
      301 +          />                                                  
      302 +        </Field>                                              
      303 +                                                              
      304 +        <Field label="Last cleared date" error={errors.last_cl
          +eared_date}>                                                  
      305 +          <input                                              
      306 +            type="date"                                       
      307 +            value={edit.last_cleared_date}                    
      308 +            onChange={(e) => set('last_cleared_date', e.target
          +.value)}                                                      
      309 +            className="w-full rounded-lg border border-gray-30
          +0 bg-white px-3 py-2"                                         
      310 +          />                                                  
      311 +        </Field>                                              
      312 +                                                              
      313 +        <Field label="Last work done" error={errors.last_work_
          +done}>                                                        
      314 +          <input                                              
      315 +            type="text"                                       
      316 +            value={edit.last_work_done}                       
      317 +            onChange={(e) => set('last_work_done', e.target.va
          +lue)}                                                         
      318 +            className="w-full rounded-lg border border-gray-30
          +0 bg-white px-3 py-2"                                         
      319 +          />                                                  
      320 +        </Field>                                              
      321 +      </div>                                                  
      322 +                                                              
      323 +      <Field label={`Notes (${edit.notes.length}/${NOTES_MAX})
          +`} error={errors.notes}>                                      
      324 +        <textarea                                             
      325 +          value={edit.notes}                                  
      326 +          onChange={(e) => set('notes', e.target.value)}      
      327 +          rows={2}                                            
      328 +          className="w-full rounded-lg border border-gray-300 
          +bg-white px-3 py-2"                                           
      329 +        />                                                    
      330 +      </Field>                                                
      331 +                                                              
      332 +      {saveError && <p className="text-sm text-red-600">{saveE
          +rror}</p>}                                                    
      333 +                                                              
      334 +      <div className="flex gap-3">                            
      335 +        <button                                               
      336 +          type="submit"                                       
      337 +          disabled={saving}                                   
      338 +          className="rounded-lg bg-blue-600 px-4 py-2 text-sm 
          +font-medium text-white hover:bg-blue-700 disabled:opacity-40" 
      339 +        >                                                     
      340 +          {saving ? 'Saving…' : 'Save'}                       
      341 +        </button>                                             
      342 +        <button                                               
      343 +          type="button"                                       
      344 +          onClick={onCancel}                                  
      345 +          className="rounded-lg border border-gray-300 px-4 py
          +-2 text-sm font-medium text-gray-700 hover:bg-gray-50"        
      346 +        >                                                     
      347 +          Cancel                                              
      348 +        </button>                                             
      349 +      </div>                                                  
      350 +    </form>                                                   
      351    );
      352  }
      353 +                                                              
      354 +function Field({                                              
      355 +  label,                                                      
      356 +  error,                                                      
      357 +  children,                                                   
      358 +}: {                                                          
      359 +  label: string;                                              
      360 +  error?: string;                                             
      361 +  children: React.ReactNode;                                  
      362 +}) {                                                          
      363 +  return (                                                    
      364 +    <label className="block">                                 
      365 +      <span className="mb-1 block text-xs font-medium text-gra
          +y-600">                                                       
      366 +        {label}                                               
      367 +      </span>                                                 
      368 +      {children}                                              
      369 +      {error && <span className="mt-1 block text-xs text-red-6
          +00">{error}</span>}                                           
      370 +    </label>                                                  
      371 +  );                                                          
      372 +}                                                             

● Now update the AuthPage title string:

● Update(app\row-tracker\src\components\AuthPage.tsx)
  ⎿  Added 3 lines, removed 1 line
      51          <div className="w-full max-w-sm">
      52            <div className="rounded-3xl border border-white/60 bg
          -white/80 p-8 shadow-xl backdrop-blur-sm">
      53              <div className="mb-8 text-center">
      54 -              <h1 className="text-2xl font-bold text-gray-900">
         -Todo App</h1>                                                  
      54 +              <h1 className="text-2xl font-bold text-gray-900">
      55 +                ROW Clearing Tracker                           
      56 +              </h1>                                            
      57                <p className="mt-2 text-sm text-gray-500">
      58                  Sign in to get started.
      59                </p>

● Let me check index.html and manifest.json for leftover "Todo" branding:

  Searched for 1 pattern (ctrl+o to expand)

● Update(app\row-tracker\index.html)
  ⎿  File must be read first

  Read 1 file (ctrl+o to expand)

● Update(app\row-tracker\index.html)
  ⎿  Added 1 line, removed 1 line
      3    <head>
      4      <meta charset="UTF-8" />
      5      <meta name="viewport" content="width=device-width, initial-s
         cale=1.0" />
      6 -    <title>Todo App</title>                                     
      6 +    <title>ROW Clearing Tracker</title>                         
      7      <link rel="preconnect" href="https://fonts.googleapis.com" /
         >
      8      <link rel="preconnect" href="https://fonts.gstatic.com" cros
         sorigin />
      9      <link

● Now tests. Remove the old todos test, add two new tests, and fix the
  AuthProvider test stub:

  Ran 1 shell command (ctrl+o to expand)

● Write(app\row-tracker\src\__tests__\validation.test.ts)
  ⎿  Wrote 91 lines to app\row-tracker\src\__tests__\validation.test.ts
       1 import { describe, expect, it } from 'vitest';
       2 
       3 import type { ClearingPlanEdit } from '@/services/clearingPlanMo
       4 import { hasErrors, validateClearingPlan } from '@/services/vali
         dation';
       5 
       6 const base: ClearingPlanEdit = {
       7   vendor: 'Summit Vegetation Management',
       9   last_cleared_date: '',
      10   last_work_done: '',
     … +93 lines (ctrl+o to expand)

● Write(app\row-tracker\src\__tests__\clearingPlans.test.ts)
  ⎿  Wrote 49 lines to app\row-tracker\src\__tests__\clearingPlans.test.ts
       1 import { describe, expect, it, vi } from 'vitest';
       2 
       3 // Force the in-memory (local backend) path; never touches the R
       4 vi.mock('@/services/rayfinClient', () => ({
       5   isLocalBackend: () => true,
       6   getRayfinClient: vi.fn(),
       7 }));
       8 
         del';
      10 import {
     … +46 lines (ctrl+o to expand)

● Now fix the AuthProvider test stub to implement the new getDiagnosticClaims:

● Update(app\row-tracker\src\__tests__\AuthProvider.test.tsx)
  ⎿  Added 3 lines
      16    async initEmbeddedAuth() {
      17      return null;
      18    },
      19 +  async getDiagnosticClaims() {                                
      20 +    return {};                                                 
      21 +  },                                                           
      22  };
      23  
      24  describe('AuthProvider', () => {

● Now run the checks: build, test, lint.

  Ran 1 shell command (ctrl+o to expand)
● Type errors to fix: the generated MutationInput wants Date | undefined (not
  null) for optional fields, and the typed results need an unknown cast. Let me
  fix the service and remove the unused import.

● Update(app\row-tracker\src\services\clearingPlans.ts)
  ⎿  Added 24 lines, removed 4 lines
      62    const results = await client.data.ClearingPlan.select([...FIE
          LDS])
      63      .orderBy({ feeder_id: 'asc' })
      64      .execute();
      65 -  return (results as Record<string, unknown>[]).map(fromApi);  
      65 +  return (results as unknown as Record<string, unknown>[]).map(
         +fromApi);                                                      
      66  }
      67  
      68 -/** Translate the form's string fields into a typed write paylo
         -ad. */                                                         
      68 +/** The editable values in domain form (dates as `Date | null`)
         +. */                                                           
      69  function toWrite(edit: ClearingPlanEdit, updatedBy: string) {
      70    return {
      71      vendor: edit.vendor,
     ...
      84    };
      85  }
      86  
      87 +// The Rayfin mutation type takes `T | undefined` for optional 
         +fields, not                                                    
      88 +// `null`. NOTE: this means "clear this date" is sent as undefi
         +ned, which the                                                 
      89 +// data API treats as "leave unchanged" rather than "set to nul
         +l" — a known gap                                               
      90 +// for the Fabric path, recorded in docs/app-notes.md. The in-m
         +emory local path                                               
      91 +// clears correctly. Fixing clear-to-null on Fabric is a later 
         +step.                                                          
      92 +const nullToUndef = <T>(v: T | null): T | undefined => v ?? und
         +efined;                                                        
      93 +                                                               
      94  export async function updateClearingPlan(
      95    id: string,
      96    edit: ClearingPlanEdit,
     ...
      106    }
      107  
      108    const client = getRayfinClient();
      102 -  await client.data.ClearingPlan.update({ id }, write);       
      109 +  await client.data.ClearingPlan.update(                      
      110 +    { id },                                                   
      111 +    {                                                         
      112 +      vendor: write.vendor,                                   
      113 +      date_certainty: write.date_certainty,                   
      114 +      last_cleared_date: nullToUndef(write.last_cleared_date),
      115 +      last_work_done: nullToUndef(write.last_work_done),      
      116 +      next_clearing_date: nullToUndef(write.next_clearing_date
          +),                                                            
      117 +      planned_year: nullToUndef(write.planned_year),          
      118 +      notes: nullToUndef(write.notes),                        
      119 +      updated_by: write.updated_by,                           
      120 +      updated_at: write.updated_at,                           
      121 +    }                                                         
      122 +  );                                                          
      123    const updated = await client.data.ClearingPlan.findById(id);
      104 -  return fromApi(updated as Record<string, unknown>);         
      124 +  return fromApi(updated as unknown as Record<string, unknown>
          +);                                                            
      125  }
      126  
      127  /**

● Update(app\row-tracker\src\services\clearingPlans.ts)
  ⎿  Added 5 lines, removed 5 lines
      143        feeder_id: r.feeder_id,
      144        district_name: r.district_name,
      145        vendor: r.vendor,
      146 -      last_cleared_date: r.last_cleared_date,                 
      147 -      last_work_done: r.last_work_done,                       
      148 -      next_clearing_date: r.next_clearing_date,               
      146 +      last_cleared_date: nullToUndef(r.last_cleared_date),    
      147 +      last_work_done: nullToUndef(r.last_work_done),          
      148 +      next_clearing_date: nullToUndef(r.next_clearing_date),  
      149        date_certainty: r.date_certainty,
      150 -      planned_year: r.planned_year,                           
      151 -      notes: r.notes,                                         
      150 +      planned_year: nullToUndef(r.planned_year),              
      151 +      notes: nullToUndef(r.notes),                            
      152        updated_by: updatedBy,
      153        updated_at: new Date(),
      154      });

● Now remove the unused DISTRICTS import from HomePage:

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Removed 1 line
       4  import { useAuth } from '@/hooks/AuthContext';
       5  import {
       6    DATE_CERTAINTIES,
       7 -  DISTRICTS,                                                   
       7    NOTES_MAX,
       8    VENDORS,
       9    type ClearingPlanEdit,

  Ran 1 shell command (ctrl+o to expand)

● Build passes. Now tests and lint:

  Ran 2 shell commands (ctrl+o to expand)

● All three checks pass (build ✓, 11 tests ✓, lint 0 errors — the single warning
  is pre-existing in the template's AuthContext.tsx). Let me confirm exit codes
  and that no stray Todo references remain:

  Ran 1 shell command (ctrl+o to expand)

● Only a descriptive comment remains. Now the docs. Let me read poc-log.md to
  match its format.

  Read 1 file (ctrl+o to expand)

● Now docs/app-notes.md:

● Write(docs\app-notes.md)
  ⎿  Wrote 115 lines to docs\app-notes.md
      1 # Fabric App notes: ROW clearing tracker (thin slice)
      2 
        racker`
      4 (Microsoft "Basic Todo App" template, create-rayfin 1.36.2). It r
        eplaces the
        a certainty
      6 picklist and vendor dropdown, the cross-field rules from
      7 `docs/cleaning-rules.md`, and a diagnostic claims panel. Syntheti
      8 
      9 ## How the slice is built
     … +170 lines (ctrl+o to expand)

● Now append decision rows and the POC-log row:

● Update(docs\decisions.md)
  ⎿  Added 6 lines
      31  | 2026-10-16 | Table/matrix visuals carry visual-level display 
          names for each field (e.g. `FEEDER_ID` → "Feeder", `RAW_VALUE` 
          → "Raw value"). Model table/column names are unchanged. | Frien
          dly captions on the report without renaming model columns (whic
          h PBIR binds by name); replaces the R4 "ALL-CAPS headers accept
          ed" note | Josh | All report tables |
      32  | 2026-10-16 | Generator now cycles every Next Clearing text pa
          ttern and ages 3 feeders' last-cleared to 6-8 years before as-o
          f. Result: Feeders Next Year 2 (was 0), Feeders Not Cleared 5+ 
          Years 3 (was 0), Feeders TBD 5 (was 7), feeders with a next dat
          e 143 (was 142). Feeders in Plan 153, DQ Issues 69, Orphans 2 u
          nchanged; all issue-type counts unchanged (69). | Ops team's "N
          ext Year" / "<date> - TBD" examples and the 5+-year signal neve
          r appeared in the synthetic draw | Josh | Measures, report KPIs
           |
      33  | 2026-10-16 | The R1 Int64 key/year types are now enforced in 
          Power Query: each partition query gets a `Table.TransformColumn
          Types(..., Int64.Type)` step — `VENDOR_ID` (DIM_VENDOR, FACT_RO
          W_PLAN), `DISTRICT_ID` (DIM_DISTRICT), `RESPONSIBLE_DISTRICT_ID
          ` (DIM_CIRCUIT), `PLANNED_YEAR` (FACT_ROW_PLAN). | A data refre
          sh re-inferred these columns as `double` (Snowflake `NUMBER(38,
          0)`), reverting the TOM-only R1 types and flipping `PLANNED_YEA
          R` to summarizeBy=sum; a Snowflake cast can't help (INT is `NUM
          BER(38,0)`), so the fix belongs in PQ. Verified the types survi
          ve a save+refresh. | Josh | Model types, refresh stability |
      34 +| 2026-10-16 | App slice (prompt 07): validation is hand-writte
         +n in the edit form, no new dependency. Cross-field rules can't 
         +be enforced by Rayfin's per-field schema/DAB, so they live only
         + in the form; field rules are mirrored by the entity decorators
         + (server-enforced). | Avoids swapping the Vite React plugin to 
         +`@vitejs/plugin-react` (which `toStandardSchema` would require)
         + for a thin slice. Server-side cross-field enforcement is a lat
         +er Rayfin Function. | Josh | `app/row-tracker` validation |    
      35 +| 2026-10-16 | App slice local run = plain Vite (`npm run dev:f
         +rontend`): backend-free synthetic auth + in-memory pre-seeded s
         +tore, never contacts Fabric. Bare `npx rayfin dev` is treated a
         +s a deploy (provisions a Fabric AppBackend by default per the i
         +nstalled docs) and needs Josh's ask. | The POC must not touch F
         +abric unasked; the docs confirm `rayfin dev` defaults to the Fa
         +bric provider. | Josh | `app/row-tracker` run workflow |       
      36 +| 2026-10-16 | App slice permissions: `@authenticated('read')` 
         ++ `@authenticated('update')` for all signed-in users; no delete
         +; no create (committed state). No row-level policy yet — per-di
         +strict / per-Entra-group rules are a later step. | Thin slice; 
         +proper role rules depend on confirming which claims reach the a
         +pp (claims panel, post-deploy). | Josh | `ClearingPlan` entity 
         +|                                                              
      37 +| 2026-10-16 | Fabric seeding method chosen: temporarily enable
         + `@authenticated('create')` + a "Load sample data" button shown
         + only when the deployed table is empty, run once, then remove c
         +reate and redeploy. Built but not run against Fabric. | Smalles
         +t gated way to populate the empty deployed DB. Trade-off: creat
         +e is briefly open to any signed-in user; mitigated by dev-only 
         +synthetic data and immediate removal. Long-term: a seed Functio
         +n or per-row create policy. | Josh | Deployed app, `ClearingPla
         +n` entity |                                                    
      38 +| 2026-10-16 | `updated_by` is client-set (from the session) an
         +d explicitly **not** audit-grade; `updated_at` uses the `@date`
         + datetime type. A server-stamped audit field comes with the cha
         +nge-log step. | The SDK provides no automatic audit columns; a 
         +client controls the value it sends. | Josh | `ClearingPlan` ent
         +ity |                                                          
      39 +| 2026-10-16 | Findings recorded for the role-model design: (1)
         + cross-field rules are form-only until a Rayfin Function exists
         +; (2) the policy DSL has no groups claim (only `sub`/`email`/`r
         +ole`) and the session is opaque, so Entra-group roles likely ne
         +ed a fallback — the claims panel confirms what actually arrives
         + after deploy. | Answers the open design question the slice was
         + meant to probe. | Agent (prompt 07) — Josh to confirm post-dep
         +loy | Later role-rules step |                                  
      40  
      41  ## R1 profile findings (2026-10-15)
      42  

● Update(docs\poc-log.md)
  ⎿  Added 1 line
      14  | 2026-10-16 | R4. Independent review | pbi-report-reviewer sub
          agent | ~10 | | Verdict "close, not yet signed off": 1 blocker 
          (no alt text) + majors (raw field-name subtitles). Agent fixed 
          alt text, chart subtitles, About glossary; re-validated + re-sc
          reenshot | Reviewer ran as subagent; agent-fixable items resolv
          ed; hex-to-theme + status-cell background left for the develope
          r | partial | Accepted: ALL-CAPS headers (naming decision), gre
          en KPI accent (house standard), "(Blank)" vendor (real data). S
          ee decisions.md |
      15  | | R4. PR | | | | | | | Josh opens the PR (agent never pushes)
           |
      16  | 2026-10-16 | R5. Report follow-ups (prompt 06) | Claude Code 
          (Opus 4.8); generator + plugin MCP (DAX) + powerbi-report-cli (
          authoring) | ~40 | | Part A: generator cycles every Next Cleari
          ng text pattern + ages 3 feeders to 6-8 yrs (counts unchanged, 
          deterministic verified); ANALYTICS Unassigned vendor. Part B: D
          AX re-validated (Feeders Next Year 2, Not Cleared 5+ 3, TBD 5, 
          next-date 143; 153/69/2 unchanged); visual-level display names 
          on the 4 tableEx visuals (3 pages), all rendered + reviewed; "U
          nassigned" confirmed on Vendors page | | yes | Checkpoint after
           Part A; Desktop save gate hit twice (before PBIR edits; before
           re-applying Int64). Refresh reverted 4 keys + PLANNED_YEAR to 
          double — re-applied Int64/summarizeBy via MCP, Josh saved (fixe
          d "2,026.00" → 2026). Desktop auto-generated Q&A synonyms in en
          -US.tmdl from the visual renames |
      17 +| 2026-10-16 | R6. App thin slice (prompt 07) | Claude Code (Op
         +us 4.8); Rayfin SDK/CLI 1.36.2 docs read from `node_modules`; n
         +o MCP | ~55 | | Part A: explained the template + planned the sl
         +ice (Checkpoint 1). Part B: replaced Todo with `ClearingPlan` (
         +read+update, no create/delete), feeder list + edit form with th
         +e cross-field rules, diagnostic claims panel, 15-row synthetic 
         +seed, backend-free local auth; `build`, 11 tests, lint all pass
         +. Two findings recorded (cross-field = form-only; no groups cla
         +im). Fabric seed path built but not run. | | yes | No Fabric co
         +ntact: local run is plain Vite; `rayfin dev`/`up` treated as de
         +ploys (gated). Build caught the Rayfin mutation type taking `va
         +lue \| undefined` not `null` → clear-to-null on Fabric is an op
         +en gap (noted in app-notes) |                                  
      18  
      19  ## Observations
      20  

● Now update the root AGENTS.md — the app/ row and a new "Fabric App" section:

● Update(AGENTS.md)
  ⎿  File must be read first

  Read 1 file (ctrl+o to expand)

● Update(AGENTS.md)
  ⎿  Added 1 line, removed 1 line
      24  | `docs/` | Decisions, cleaning rules, requirements, POC log, r
          un sheet |
      25  | `tests/dax/` | DAX profiling and measure validation queries |
      26  | `_brief/` | Report spec written by the report planner |
      27 -| `app/` | Fabric App (later phase) |                          
      27 +| `app/row-tracker/` | Fabric App (Rayfin SDK/CLI, TypeScript).
         + ROW clearing tracker slice — see the "Fabric App" section belo
         +w and `docs/app-notes.md`. |                                   
      28  
      29  For Power BI, the agent takes the semantic model to a **draft**
           report. A
      30  Power BI developer (me) reviews, adjusts and signs off.

● Update(AGENTS.md)
  ⎿  Added 22 lines
      203  
      204  The report spec lives in `_brief/report-spec.md`.
      205  
      206 +## Fabric App                                                 
      207 +                                                              
      208 +The app lives in `app/row-tracker` (Rayfin SDK/CLI, TypeScript
          +). Work there, and                                            
      209 +read `app/row-tracker/AGENTS.md` and `app/row-tracker/.agents/
          +skills/rayfin/`                                               
      210 +for Rayfin specifics. **Where the app's `AGENTS.md` and this r
          +oot file disagree,                                            
      211 +this file wins.** `docs/app-notes.md` is the slice's build not
          +es and open                                                   
      212 +questions.                                                    
      213 +                                                              
      214 +- **Rayfin docs:** read them from `node_modules` first (the sk
          +ill files point                                               
      215 +  the way); if a lookup is still needed, run `npx rayfin docs 
          +...` from                                                     
      216 +  `app/row-tracker` and I approve each call. Don't register or
          + start the Rayfin                                             
      217 +  MCP server or edit `.mcp.json`.                             
      218 +- **Local run must not touch Fabric.** Use plain Vite —       
      219 +  `cd app/row-tracker && npm run dev:frontend` — which starts 
          +only the frontend                                             
      220 +  (backend-free synthetic auth, in-memory seeded data). **`npx
          + rayfin dev` /                                                
      221 +  `npm run dev` provisions a Fabric AppBackend by default, so 
          +treat it like a                                               
      222 +  deploy: ask first.**                                        
      223 +- **No deploy, no Fabric `db` command, no new dependency witho
          +ut my ask.**                                                  
      224 +  `npx rayfin up`, `rayfin up db apply`, and `rayfin dev` all 
          +require my ask in                                             
      225 +  that session. Don't install an npm package without approval.
      226 +- **Never read `.env` files**, including `app/row-tracker/rayf
          +in/.env`.                                                     
      227 +                                                              
      228  ## Guardrails for Power BI work
      229  
      230  - Before editing PBIR or TMDL, check Desktop with

● Let me update the template README so it no longer describes a Todo app, then
  do a final verification and git status.

  Read 1 file (ctrl+o to expand)

● Write(app\row-tracker\README.md)  ⎿  Added 34 lines, removed 21 lines
       1 -# Basic Todo App                                               
       1 +# ROW Clearing Tracker (Fabric App)                            
       2  
       3 -End-to-end Fabric-authenticated todo CRUD with a Rayfin data mo
         -del and per-user row-level security.                           
       4 -A working starter that exercises the full data path — sign in, 
         -create todos, toggle them, delete them.                        
       3 +The first thin slice of the right-of-way clearing tracker, buil
         +t on the Rayfin                                                
       4 +"Basic Todo App" template. One feeder-plan entity (`ClearingPla
         +n`) with a list +                                              
       5 +edit form, a certainty picklist, a vendor dropdown, the cross-f
         +ield cleaning                                                  
       6 +rules, and a diagnostic claims panel. **Synthetic data only.** 
       7  
       6 -## Getting started                                             
       8 +Build notes, findings, and open questions are in `docs/app-note
         +s.md` (repo                                                    
       9 +root). Project rules are in the repo-root `AGENTS.md` ("Fabric 
         +App" section),                                                 
      10 +which wins over this project's `AGENTS.md`.                    
      11  
       8 -```bash                                                        
       9 -# Provision the Fabric backend and start the local dev server  
      10 -npm run dev                                                    
      12 +## Getting started (local, no Fabric)                          
      13  
      12 -# As needed, apply database migrations (one time, when running 
         -locally)                                                       
      13 -npm run rayfin:db                                              
      14 +```bash                                                        
      15 +npm install            # first time only                       
      16 +npm run dev:frontend   # plain Vite: frontend only, synthetic a
         +uth, in-memory seed                                            
      17  ```
      18  
      16 -Open [http://localhost:5173](http://localhost:5173) to view the
         - app.                                                          
      19 +Open [http://localhost:5173](http://localhost:5173). The list s
         +hows 15 seeded                                                 
      20 +feeders; edit one and try a rule violation (e.g. "confirmed" wi
         +th no next                                                     
      21 +clearing date — the form blocks the save).                     
      22  
      23 +> **Do not run `npm run dev` / `npx rayfin dev` for a local che
         +ck.** Bare                                                     
      24 +> `rayfin dev` provisions a Fabric AppBackend by default — trea
         +t it as a deploy                                               
      25 +> and ask first. See `docs/app-notes.md`.                      
      26 +                                                               
      27  ## Project structure
      28  
      29  ```text
      30  ├── rayfin/
      31  │   ├── rayfin.yml          # Fabric service configuration
      32  │   └── data/
      24 -│       ├── Todo.ts         # Todo entity with @role-based per-
         -user access                                                    
      33 +│       ├── ClearingPlan.ts # Feeder-plan entity (read+update; 
         +create gated for seeding)                                      
      34  │       └── schema.ts       # Schema export consumed by the typ
          ed client
      35  ├── src/
      36  │   ├── main.tsx            # Entry point + Rayfin client boots
          trap
      37  │   ├── App.tsx             # Routes and auth gate
      38  │   ├── hooks/
      30 -│   │   └── AuthContext.tsx # React context wrapping the auth h
         -elpers                                                         
      39 +│   │   └── AuthContext.tsx # React context wrapping the auth h
         +elpers + claims                                                
      40  │   ├── components/
      32 -│   │   └── AuthPage.tsx    # Sign-in UI                       
      41 +│   │   ├── AuthPage.tsx    # Sign-in UI                       
      42 +│   │   └── ClaimsPanel.tsx # Diagnostic "Who am I" card       
      43  │   ├── pages/
      34 -│   │   └── HomePage.tsx    # Todo list UI                     
      44 +│   │   └── HomePage.tsx    # Feeder list + edit form + seed bu
         +tton                                                           
      45  │   └── services/
      46  │       ├── IAuthService.ts        # Auth service contract + Au
          thUser type
      37 -│       ├── MockAuthService.ts     # Local-dev impl (email/pass
         -word)                                                          
      47 +│       ├── LocalAuthService.ts    # Backend-free local auth (D
         +EV-only)                                                       
      48  │       ├── RayfinAuthService.ts   # Production impl (Fabric br
          okered auth)
      49  │       ├── rayfinClient.ts        # Typed Rayfin client single
          ton
      50  │       ├── bootstrap.ts           # Reads env, picks the right
           auth service
      41 -│       └── todos.ts               # Todo CRUD wrappers (in-mem
         -ory in local dev)                                              
      51 +│       ├── clearingPlanModel.ts   # Shared constants + row/edi
         +t types                                                        
      52 +│       ├── clearingPlans.ts        # List/update/seed (in-memo
         +ry in local dev)                                               
      53 +│       ├── validation.ts           # Field + cross-field rules
         + (form-side)                                                   
      54 +│       └── seed.ts                 # 15 synthetic feeder rows 
      55  └── package.json
      56  ```
      57  
     ...
      59  
      60  | Command | Description |
      61  |---------|-------------|
      49 -| `npm run dev` | Provision or reuse the Fabric backend and sta
         -rt local frontend/Functions code |                             
      50 -| `npm run build` | Production build |                         
      51 -| `npm run build:fabric` | Build for Fabric deployment (entrypo
         -int for `rayfin up staticapp deploy`) |                        
      62 +| `npm run dev:frontend` | **Local run.** Plain Vite — frontend
         + only, no Fabric, no backend |                                 
      63 +| `npm run dev` | `rayfin dev` — provisions a Fabric backend (d
         +eploy-like; ask first) |                                       
      64 +| `npm run build` | Production build (`tsc -b && vite build`) |
      65 +| `npm run build:fabric` | Build for Fabric deployment |       
      66  | `npm run lint` | Lint with ESLint |
      67  | `npm run test` | Run unit tests with Vitest |
      54 -| `npm run rayfin:up` | Deploy app to Fabric (no local dev serv
         -er) |                                                          
      55 -| `npm run rayfin:db` | Apply database migrations |            
      68 +| `npm run rayfin:db` | Apply database migrations (Fabric; ask 
         +first) |                                                       

● Final check — git status and a diff summary for the commit proposal:

  Ran 2 shell commands (ctrl+o to expand)

● All done. Mark the final task complete.

● CHECKPOINT 2 — Part B complete

  What changed

  App (app/row-tracker) — turned the Todo template into the ROW slice:
  - Entity rayfin/data/ClearingPlan.ts (replaces Todo.ts): one row per feeder,
  Snowflake-aligned columns, feeder_id unique, vendor & certainty as @set
  picklists, notes max 500, updated_by/updated_at (@date datetime). Permissions
  @authenticated('read') + ('update') — no create/delete.
  @authenticated('create') committed commented-out for the gated Fabric seed.
  schema.ts rewritten.
  - Services: clearingPlanModel.ts (shared constants/types), clearingPlans.ts
  (list/update/seedFabric, in-memory pre-seeded when local), validation.ts
  (field + the three cross-field rules), seed.ts (15 synthetic rows),
  LocalAuthService.ts (backend-free, DEV-only). MockAuthService.ts/todos.ts
  removed; rayfinClient.ts/RayfinAuthService.ts/bootstrap.ts/IAuthService.ts
  updated; getDiagnosticClaims added through to AuthContext.
  - UI: HomePage.tsx (feeder list + inline edit form + gated "Load sample data"
  button), ClaimsPanel.tsx ("Who am I" diagnostic), title strings in
  AuthPage.tsx/index.html, README.md.
  - Tests: validation.test.ts (7), clearingPlans.test.ts (3);
  AuthProvider.test.tsx stub updated; todos.test.ts removed.

  Docs: new docs/app-notes.md; rows added to docs/decisions.md and
  docs/poc-log.md; root AGENTS.md app/ row updated + new "Fabric App" section.

  Check results

  - npm run build (tsc -b && vite build) — pass (the build caught a real gap:
  the Rayfin mutation type takes value | undefined, not null, so clear-to-null
  on the Fabric path is an open item, noted in app-notes).
  - npm run test — 11/11 pass.
  - npm run lint — 0 errors (1 warning, pre-existing in the template's
  AuthContext.tsx).

  Run it locally (no Fabric)

  cd app/row-tracker
  npm install            # first time only
  npm run dev:frontend   # plain Vite — frontend only, no Fabric, no backend
  Open http://localhost:5173. You'll see 15 feeders. Things to try:
  - Edit a feeder, change vendor/certainty, Save → the row updates.
  - Rule violation: set certainty to confirmed and clear Next clearing date →
  Save is blocked with "A confirmed or tentative feeder needs a next clearing
  date." Also try TBD with a date (blocked), and next year with no planned year
  (blocked).
  - Claims panel at the top shows the synthetic local claims (labelled
  diagnostic); after a real Fabric deploy it shows what Entra actually sends.

  ▎ Not npm run dev / npx rayfin dev — per the docs that provisions a Fabric 
  ▎ AppBackend. Treated as a deploy; I'll ask first.

  Findings (the point of the slice)

  1. Cross-field rules are form-only — Rayfin schema/DAB validate per-field
  only; server-side needs a Rayfin Function (later).
  2. No groups claim — policy DSL exposes only sub/email/role, session is
  opaque; Entra-group roles likely need a fallback. The claims panel confirms it
  post-deploy.

  Proposed commits (paths named explicitly; nothing staged yet)

  Commit 1 — "Build ROW clearing app thin slice (row-tracker)"
  app/row-tracker/rayfin/data/ClearingPlan.ts
  app/row-tracker/rayfin/data/schema.ts
  app/row-tracker/rayfin/data/Todo.ts            (deletion)
  app/row-tracker/src/services/clearingPlanModel.ts
  app/row-tracker/src/services/clearingPlans.ts
  app/row-tracker/src/services/validation.ts
  app/row-tracker/src/services/seed.ts
  app/row-tracker/src/services/LocalAuthService.ts
  app/row-tracker/src/services/MockAuthService.ts   (deletion)
  app/row-tracker/src/services/todos.ts             (deletion)
  app/row-tracker/src/services/rayfinClient.ts
  app/row-tracker/src/services/RayfinAuthService.ts
  app/row-tracker/src/services/IAuthService.ts
  app/row-tracker/src/services/bootstrap.ts
  app/row-tracker/src/hooks/AuthContext.tsx
  app/row-tracker/src/pages/HomePage.tsx
  app/row-tracker/src/components/ClaimsPanel.tsx
  app/row-tracker/src/components/AuthPage.tsx
  app/row-tracker/src/__tests__/clearingPlans.test.ts
  app/row-tracker/src/__tests__/validation.test.ts
  app/row-tracker/src/__tests__/todos.test.ts       (deletion)
  app/row-tracker/src/__tests__/AuthProvider.test.tsx
  app/row-tracker/index.html
  app/row-tracker/README.md

  Commit 2 — "Document app slice and add AGENTS Fabric App rules"
  docs/app-notes.md
  docs/decisions.md
  docs/poc-log.md
  AGENTS.md
  prompts/07_app_slice.md

  Note: .gitignore shows as modified but that predates this task (it was dirty
  at session start), so I've left it out — tell me if you want it included.
  dist/, .env.local, and rayfin/.temp are gitignored build artifacts.

  I won't deploy. If you later say "deploy", I'll ask before npx rayfin up, then
  run npx rayfin up status and give you the URL. Want me to make these two
  commits?

✻ Baked for 14m 45s

※ recap: Built the ROW clearing app thin slice in app/row-tracker; build, 11 tests, and lint all pass, and docs are updated. Next action: with your approval, make the two proposed commits.

❯ Before committing: show me exactly how LocalAuthService is gated. Confirm it  
  cannot be selected or bundled in a production build (npm run build / rayfin   
  up), and point me to the line that guarantees it. If it can, fix that first.  

● Good question — let me show you the exact gate and prove it against the actual
  production bundle.

  Read 1 file (ctrl+o to expand)

● The gate is line 46: if (localDev && import.meta.env.DEV), with the
  import('./LocalAuthService') inside that branch. Two independent conditions
  must both hold, and the second is the guarantee. Let me prove it against the
  bundle I just built:

  Ran 1 shell command (ctrl+o to expand)

● Confirmed — it's gated at two levels and cannot reach a production build. No
  fix needed.

  The guarantee — bootstrap.ts:46:
  if (localDev && import.meta.env.DEV) {
    const { LocalAuthService } = await import('./LocalAuthService');
    return new LocalAuthService();
  }

  1. Selection requires both localDev (the API URL is localhost/127.0.0.1) and
  import.meta.env.DEV. In any production build import.meta.env.DEV is statically
  false, so even if someone pointed VITE_RAYFIN_API_URL at localhost in a prod
  build, this branch is never taken — it falls through to RayfinAuthService.

  2. Bundling is the hard guarantee: the import('./LocalAuthService') lives
  inside the import.meta.env.DEV branch. Vite replaces import.meta.env.DEV with
  the literal false at build time, so localDev && false is dead code and the
  dynamic import is tree-shaken out entirely.

  Why it holds for all three prod paths: npm run build and npm run build:fabric
  both run vite build (mode=production → DEV=false), and rayfin up builds static
  content via buildCommand: npm run build:fabric (per rayfin.yml) — so all of
  them are production vite build.

  Empirical proof against the bundle I just built: dist/assets/ contains only
  the single index-*.js chunk (no split chunk for the stub), and grepping the
  whole dist/ for LocalAuthService, local-dev-user, and Synthetic local claims
  returns nothing — the stub is neither inlined nor emitted as a lazy chunk.

  So in production the stub can't be selected and isn't shipped. The deployed
  app only ever uses RayfinAuthService (Fabric SSO). Nothing to fix.

  Awaiting your go-ahead on the two proposed commits (unchanged from Checkpoint
  2).

✻ Brewed for 35s

※ recap: Building the ROW clearing app thin slice in app/row-tracker; Part B is done with build, tests, and lint all passing. Next action: get your go-ahead to make the two proposed commits (app code, then docs).

❯ Approved. Make the two commits as proposed, with one check first: if          
  app/row-tracker/package.json or package-lock.json changed (for example a new  
  dev:frontend script), add them to commit 1. Then show me git log -3 --stat.   

● I'll check whether package.json/package-lock.json changed, then make the two
  commits.

  Ran 1 shell command (ctrl+o to expand)

● No changes to package.json/package-lock.json (the dev:frontend script already
  existed in the template), so commit 1 is as proposed. Making both commits:

  Ran 1 shell command (ctrl+o to expand)

● Commit 1 staged correctly (all app/row-tracker paths, including the three
  deletions; AGENTS.md/docs correctly left unstaged). Now commit it:

  Ran 2 shell commands (ctrl+o to expand)

● Both commits made. Here's git log -3 --stat:

  Ran 1 shell command (ctrl+o to expand)

● Both commits are in on feat/app-slice:

  - 44820e7 — Build ROW clearing app thin slice (row-tracker): 24 files,
  +1213/−400, including the three deletions (Todo.ts, todos.ts,
  MockAuthService.ts) and all new slice files. package.json/package-lock.json
  were unchanged, so nothing extra was added.
  - 30fc030 — Document app slice and add AGENTS Fabric App rules: 5 files
  (AGENTS.md, docs/app-notes.md, docs/decisions.md, docs/poc-log.md,
  prompts/07_app_slice.md).

  Note the third commit shown (2f82e53 "Ignore local Initial_PBI_Reporting.md
  notes") is the pre-existing .gitignore change that was already in your working
  tree at session start — it got committed before this session's work, so it's
  not something I staged. The .gitignore line is unrelated to the app slice.

  Nothing pushed, no PR, no deploy — all yours when ready. The CRLF warnings are
  just Git's normal line-ending notices on Windows; the committed content is
  unaffected.

✻ Sautéed for 41s

※ recap: Built the first thin slice of the ROW clearing Fabric app (feeder list, edit form, validation, claims panel) and committed it in two commits on feat/app-slice. Next action is yours: review, then push and open the PR.