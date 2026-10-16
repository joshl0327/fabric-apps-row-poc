 ▐▛███▜▌   Claude Code v2.1.181
▝▜█████▛▘  Opus 4.8 · Claude Pro
  ▘▘ ▝▝    C:\dev\fabric-apps-row-poc

 ▎ Meet Fable 5, our newest model for complex, long-running work. Switch anytime with /model.

❯ /clear                                                                        

❯ Follow prompts/08_clear_date_fix.md                                           

● I'll start by reading the prompt file that defines this task.

  Read 1 file (ctrl+o to expand)

● Let me read the required context files.

  Read 3 files (ctrl+o to expand)

● Let me read the Rayfin skill and the key app source files.

  Read 3 files (ctrl+o to expand)

● Now for Part A, I need to check the Rayfin data docs about field nullability
  on updates, and the generated client types. Let me look.

  Read 2 files, ran 1 shell command (ctrl+o to expand)

● The index doesn't cover update null semantics. Let me search the data docs and
  the generated types.

  Searched for 1 pattern, listed 1 directory (ctrl+o to expand)

● The data docs are thin. Let me inspect the generated client types and the
  rayfin-data source to see how update handles null vs undefined.

  Read 2 files, ran 1 shell command (ctrl+o to expand)

● Key finding so far: UpdateInput<T> = Partial<MutationInput<T>>, and for
  optional primitives the type is value | undefined (no null). The real question
  is runtime behavior. Let me read the compiled JS for how mutations are
  serialized.

  Read 1 file (ctrl+o to expand)

● The serializer skips undefined (confirming the bug) but treats null as a
  primitive and emits it. Let me confirm how formatGraphQLValue renders null.

  Read 1 file (ctrl+o to expand)

● Confirmed: null renders as a GraphQL null literal and is included in the
  mutation (only undefined is skipped). Let me verify against the guide docs
  (DAB update null semantics + known limitations) to be rigorous.

  Searched for 2 patterns, ran 2 shell commands (ctrl+o to expand)

● Let me read the update section of graphql.md directly.

  Read 1 file, ran 1 shell command (ctrl+o to expand)

● Part A is resolved: there is a supported way. The runtime serializer
  deliberately distinguishes null (emits field: null → DAB sets the column NULL)
  from undefined (field omitted → unchanged). It only skips undefined; null is
  a primitive that gets emitted. The optional fields are nullable columns
  (@date/@int/@text({ optional: true })), so null is valid. The TS type says
  value | undefined, so a cast is needed at the call site, but the runtime fully
  supports it. Continuing to Part B.

  Let me read the rest of the relevant source and tests.

  Read 3 files (ctrl+o to expand)

● Let me look at the existing tests and seed to match conventions.
  Read 2 files, ran 1 shell command (ctrl+o to expand)

● Let me check how the GraphQL client surfaces errors, so the friendly mapping
  targets the real shape.

  Searched for 1 pattern, read 2 files (ctrl+o to expand)

● I now have the full picture. Let me check the eslint config (for no-console)
  and the validation test file to match conventions.

  Read 2 files (ctrl+o to expand)

● No no-console rule. Now I'll implement. First, the friendly-error module.

● Write(app\row-tracker\src\services\errors.ts)
  ⎿  Wrote 33 lines to app\row-tracker\src\services\errors.ts
      1 // Turn a thrown value into a short, plain message safe to show i
      2 // keeping the full technical detail in the browser console for d
        ebugging.
      4 // The Rayfin data client surfaces server-side failures as
        n-data
      6 // GraphQLClient). Showing that raw text in the UI is what prompt
      7 // e.g. "The field `createClearingPlan` does not exist on the typ
        e `Mutation`".
        elves
        nd pass through.
     … +33 lines (ctrl+o to expand)

● Now update clearingPlans.ts — explicit-null clear, full read-back, and
  mismatch check.

● Update(app\row-tracker\src\services\clearingPlans.ts)
  ⎿  Added 61 lines, removed 4 lines
       85  }
       86  
       87  // The Rayfin mutation type takes `T | undefined` for optional
            fields, not
       88 -// `null`. NOTE: this means "clear this date" is sent as undef
          -ined, which the                                               
       89 -// data API treats as "leave unchanged" rather than "set to nu
          -ll" — a known gap                                             
       90 -// for the Fabric path, recorded in docs/app-notes.md. The in-
          -memory local path                                             
       91 -// clears correctly. Fixing clear-to-null on Fabric is a later
          - step.                                                        
       88 +// `null`. For CREATE, "no value" and "null" are equivalent, s
          +o collapse null to                                            
       89 +// undefined and let the column default to null.              
       90  const nullToUndef = <T>(v: T | null): T | undefined => v ?? un
           defined;
       91  
       92 +// For UPDATE, null and undefined are NOT equivalent. The inst
          +alled                                                         
       93 +// @microsoft/rayfin-data client serialises an explicit `null`
          + to a GraphQL                                                 
       94 +// `null` literal — which DAB applies as "set this column to n
          +ull" — but OMITS an                                           
       95 +// `undefined` field entirely, leaving the stored value unchan
          +ged                                                           
       96 +// (formatMutationInput skips only undefined; formatGraphQLVal
          +ue renders null as                                            
       97 +// `null`). So clearing a field on update means sending a runt
          +ime `null`. The                                               
       98 +// generated `UpdateInput` type has no `null` in it, so the ca
          +st carries the null                                           
       99 +// through without changing it. See docs/app-notes.md "Clear-t
          +o-null on Fabric".                                            
      100 +const clearable = <T>(v: T | null): T | undefined => v as unkn
          +own as T | undefined;                                         
      101 +                                                              
      102 +// The optional fields the edit form can clear, verified on re
          +ad-back below.                                                
      103 +const VERIFIED_FIELDS = [                                     
      104 +  'vendor',                                                   
      105 +  'date_certainty',                                           
      106 +  'last_cleared_date',                                        
      107 +  'last_work_done',                                           
      108 +  'next_clearing_date',                                       
      109 +  'planned_year',                                             
      110 +  'notes',                                                    
      111 +  'updated_by',                                               
      112 +] as const;                                                   
      113 +                                                              
      114 +type SubmittedWrite = ReturnType<typeof toWrite>;             
      115 +                                                              
      116 +const valuesEqual = (a: unknown, b: unknown): boolean => {    
      117 +  if (a instanceof Date && b instanceof Date) return a.getTime
          +() === b.getTime();                                           
      118 +  if (a instanceof Date || b instanceof Date) return false;   
      119 +  return (a ?? null) === (b ?? null);                         
      120 +};                                                            
      121 +                                                              
      122 +const display = (v: unknown): string => {                     
      123 +  if (v == null) return '(cleared)';                          
      124 +  if (v instanceof Date) return v.toISOString().slice(0, 10); 
      125 +  return String(v);                                           
      126 +};                                                            
      127 +                                                              
      128 +/**                                                           
      129 + * Compare what we submitted against the row the server actual
          +ly kept. Returns a                                            
      130 + * human-readable description of each field whose stored value
          + differs, naming                                              
      131 + * the value the server kept. `updated_at` is intentionally no
          +t verified: a                                                 
      132 + * datetime can lose sub-second precision on the round trip.  
      133 + */                                                           
      134 +export function diffSavedRow(                                 
      135 +  submitted: SubmittedWrite,                                  
      136 +  saved: ClearingPlanRow                                      
      137 +): string[] {                                                 
      138 +  const mismatches: string[] = [];                            
      139 +  for (const field of VERIFIED_FIELDS) {                      
      140 +    const sent = submitted[field];                            
      141 +    const kept = saved[field];                                
      142 +    if (!valuesEqual(sent, kept)) {                           
      143 +      mismatches.push(                                        
      144 +        `${field} (sent ${display(sent)}, server kept ${displa
          +y(kept)})`                                                    
      145 +      );                                                      
      146 +    }                                                         
      147 +  }                                                           
      148 +  return mismatches;                                          
      149 +}                                                             
      150 +                                                              
      151  export async function updateClearingPlan(
      152    id: string,
      153    edit: ClearingPlanEdit,

● Update(app\row-tracker\src\services\clearingPlans.ts)
  ⎿  Added 28 lines, removed 7 lines
      168      {
      169        vendor: write.vendor,
      170        date_certainty: write.date_certainty,
      171 -      last_cleared_date: nullToUndef(write.last_cleared_date),
      172 -      last_work_done: nullToUndef(write.last_work_done),      
      173 -      next_clearing_date: nullToUndef(write.next_clearing_date
          -),                                                            
      174 -      planned_year: nullToUndef(write.planned_year),          
      175 -      notes: nullToUndef(write.notes),                        
      171 +      // Cleared optional fields go as explicit null (set to n
          +ull), not undefined                                           
      172 +      // (leave unchanged) — see `clearable` above. Fixes the 
          +prompt-08 bug where                                           
      173 +      // clearing a date silently kept the old value.         
      174 +      last_cleared_date: clearable(write.last_cleared_date),  
      175 +      last_work_done: clearable(write.last_work_done),        
      176 +      next_clearing_date: clearable(write.next_clearing_date),
      177 +      planned_year: clearable(write.planned_year),            
      178 +      notes: clearable(write.notes),                          
      179        updated_by: write.updated_by,
      180        updated_at: write.updated_at,
      181      }
      182    );
      180 -  const updated = await client.data.ClearingPlan.findById(id);
      181 -  return fromApi(updated as unknown as Record<string, unknown>
          -);                                                            
      183 +                                                              
      184 +  // Read the full row back and confirm the server kept what w
          +e submitted. A                                                
      185 +  // silent mismatch (e.g. a cleared field the API left unchan
          +ged) must surface                                             
      186 +  // as an error, not bad data. `findById` only selects the ke
          +y, so select the                                              
      187 +  // display fields explicitly.                               
      188 +  const rows = (await client.data.ClearingPlan.select([...FIEL
          +DS])                                                          
      189 +    .where({ id: { eq: id } })                                
      190 +    .execute()) as unknown as Record<string, unknown>[];      
      191 +  if (rows.length === 0) {                                    
      192 +    throw new Error('Saved feeder could not be read back to co
          +nfirm the change.');                                          
      193 +  }                                                           
      194 +  const saved = fromApi(rows[0]);                             
      195 +                                                              
      196 +  const mismatches = diffSavedRow(write, saved);              
      197 +  if (mismatches.length > 0) {                                
      198 +    throw new Error(                                          
      199 +      `The save did not fully apply — the server kept differen
          +t values for: ${mismatches.join('; ')}.`                      
      200 +    );                                                        
      201 +  }                                                           
      202 +  return saved;                                               
      203  }
      204  
      205  /**

● Now wire the friendly error into HomePage (two catch sites).

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 1 line
      14    seedFabric,
      15    updateClearingPlan,
      16  } from '@/services/clearingPlans';
      17 +import { toUserMessage } from '@/services/errors';             
      18  import { isLocalBackend } from '@/services/rayfinClient';
      19  import {
      20    hasErrors,

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 1 line, removed 1 line
      62        await seedFabric(user?.email ?? user?.id ?? 'unknown');
      63        await fetchRows();
      64      } catch (err) {
      65 -      setSeedError(err instanceof Error ? err.message : 'Failed
         - to load data.');                                              
      65 +      setSeedError(toUserMessage(err, 'Failed to load data.'));
      66      } finally {
      67        setSeeding(false);
      68      }

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 1 line, removed 1 line
      232        await updateClearingPlan(row.id, edit, updatedBy);
      233        await onSaved();
      234      } catch (err) {
      235 -      setSaveError(err instanceof Error ? err.message : 'Faile
          -d to save.');                                                 
      235 +      setSaveError(toUserMessage(err, 'Failed to save.'));    
      236      } finally {
      237        setSaving(false);
      238      }

● Now the tests. A Fabric-path test (payload + mismatch) and a friendly-error
  test.

● Write(app\row-tracker\src\__tests__\clearingPlansFabric.test.ts)
  ⎿  Wrote 110 lines to
     app\row-tracker\src\__tests__\clearingPlansFabric.test.ts
       1 import { beforeEach, describe, expect, it, vi } from 'vitest';
       2 
       3 // Fabric-backend path: isLocalBackend() is false, so updateClea
       4 // through the mocked Rayfin client. The mock records the update
          payload and
       5 // returns a controllable read-back row.
       6 const mocks = vi.hoisted(() => {
       7   const update = vi.fn().mockResolvedValue({});
       9   const where = vi.fn(() => ({ execute }));
      10   const select = vi.fn(() => ({ where }));
     … +113 lines (ctrl+o to expand)

● Write(app\row-tracker\src\__tests__\errors.test.ts)
  ⎿  Wrote 39 lines to app\row-tracker\src\__tests__\errors.test.ts
       1 import { afterEach, describe, expect, it, vi } from 'vitest';
       2 
       3 import { toUserMessage } from '@/services/errors';
       4 
       5 afterEach(() => {
       7 });
       8 
       9 describe('toUserMessage', () => {
      10   it('replaces a raw GraphQL error with a short, plain message',
          () => {
     … +37 lines (ctrl+o to expand)

● Now run build, tests, and lint.

  Ran 2 shell commands (ctrl+o to expand)

● Build and tests pass; the single lint warning is pre-existing in
  AuthContext.tsx (untouched). Let me check .env.local is gitignored, and read
  the poc-log format.

  Read 1 file, ran 1 shell command (ctrl+o to expand)

● All three new files are untracked; the powerbi/* changes are pre-existing and
  out of my scope. Now the docs. First, app-notes.md: add the "Deployed results"
  section and resolve the clear-to-null open question.

● Update(docs\app-notes.md)
  ⎿  Added 56 lines, removed 8 lines
      100  clean long-term answer is a seed Function or a per-row create 
           policy, with the
      101  role rules.
      102  
      103 +## Deployed results (2026-10-16)                              
      104 +                                                              
      105 +First deploy of the slice to `ROW-POC-Dev`, after seeding. Obs
          +ervations and the                                             
      106 +one bug found, with its fix. All of this is **only fully verif
          +iable on the                                                  
      107 +deployed app** — local mode uses the in-memory store, which ha
          +s none of these                                               
      108 +behaviours (it clears correctly, has no GraphQL layer, and run
          +s a synthetic                                                 
      109 +local user).                                                  
      110 +                                                              
      111 +Observations (recorded, no code change):                      
      112 +                                                              
      113 +- **Claims panel shows only `id` and `email`** — no name, role
          + or groups. This                                              
      114 +  is the Finding 2 experiment answer in the live environment: 
          +plan the role                                                 
      115 +  model around what actually arrives (confirms the groups-clai
          +m gap).                                                       
      116 +- **"Load sample data" with create disabled failed** with `The
          + field                                                        
      117 +  `createClearingPlan` does not exist on the type `Mutation``.
          + With no role                                                 
      118 +  granting create, the API exposes no create operation at all 
          +— so the seed                                                 
      119 +  button only works during the gated create-enabled window (as
          + designed).                                                   
      120 +- **Errors showed as raw GraphQL text** in the UI — fixed belo
          +w (observation 3).                                            
      121 +                                                              
      122 +**Bug — clearing a field kept the old value.** Editing feeder 
          +101-1 from                                                    
      123 +confirmed (2026-11-15) to TBD with the next clearing date clea
          +red saved                                                     
      124 +"successfully" but the row still showed 2026-11-15; feeder 533
          +-1 did the same.                                              
      125 +Setting values worked, clearing them didn't. Root cause: the u
          +pdate sent a                                                  
      126 +cleared field as `undefined`, which the data API treats as "le
          +ave unchanged".                                               
      127 +The form passed its own rules (TBD with no date), so the resul
          +t was silent bad                                              
      128 +data that broke our own cross-field rule.                     
      129 +                                                              
      130 +**Fix (this change):**                                        
      131 +                                                              
      132 +1. **Explicit clear.** Cleared optional fields (`next_clearing
          +_date`,                                                       
      133 +   `planned_year`, `last_cleared_date`, `last_work_done`, `not
          +es`) are now sent                                             
      134 +   as an explicit `null`, which the installed `@microsoft/rayf
          +in-data` client                                               
      135 +   serialises to a GraphQL `null` literal (DAB applies it as "
          +set to null").                                                
      136 +   `undefined` is still used only for fields the edit never to
          +uches. The                                                    
      137 +   generated `UpdateInput` type is `value | undefined` with no
          + `null`, so the                                               
      138 +   null is carried through a cast (`clearable`) — the runtime 
          +behaviour is the                                              
      139 +   supported mechanism, confirmed by reading the client source
      140 +   (`formatMutationInput` skips only `undefined`; `formatGraph
          +QLValue` renders                                              
      141 +   `null`).                                                   
      142 +2. **Read-back guard.** After every save the full row is read 
          +back and compared                                             
      143 +   with what was submitted (`diffSavedRow`). Any field the ser
          +ver kept differently                                          
      144 +   throws a clear error naming the field and the value the ser
          +ver kept, so a                                                
      145 +   silent mismatch can't recur. (`updated_at` is not compared 
          +— a datetime can                                              
      146 +   lose sub-second precision on the round trip.)              
      147 +3. **Friendly errors.** Raw GraphQL text is replaced in the UI
          + with a short                                                 
      148 +   plain message; the full error still goes to the browser con
          +sole                                                          
      149 +   (`src/services/errors.ts`, `toUserMessage`).               
      150 +                                                              
      151  ## Open questions
      152  
      105 -- **Entra groups / roles** (Finding 2): confirm with the claim
          -s panel after                                                 
      106 -  deploy; then choose the fallback for the role rules.        
      153 +- **Entra groups / roles** (Finding 2): the deployed claims pa
          +nel shows only                                                
      154 +  `id` and `email` (no groups/role) — choose the fallback for 
          +the role rules                                                
      155 +  (mapped `role` claim, lookup table, or a Function).         
      156  - **Server-side cross-field enforcement** (Finding 1): add a R
           ayfin Function on
      108 -  write.                                                      
      109 -- **Clear-to-null on Fabric:** the generated mutation type tak
          -es                                                            
      110 -  `value | undefined`, not `null`, so "clear this date" is sen
          -t as `undefined`                                              
      111 -  (interpreted as "leave unchanged") on the Fabric path. The i
          -n-memory local                                                
      112 -  path clears correctly. Needs a Fabric-path fix (confirm whet
          -her the client                                                
      113 -  supports an explicit null, or clear via a Function).        
      157 +  write. The read-back guard catches an inconsistent save afte
          +r the fact, but                                               
      158 +  the rules are still only enforced client-side.              
      159 +- **Clear-to-null on Fabric: resolved.** The client does suppo
          +rt clearing via an                                            
      160 +  explicit `null` (see "Deployed results" above). A Rayfin Fun
          +ction is no longer                                            
      161 +  required for this; it stays on the list only for cross-field
          + enforcement.                                                 
      162  - **Audit fields:** replace client-set `updated_by` with a ser
           ver-stamped value
      163    in the change-log step.
● Let me fix the nested-backtick markdown issue in that section.

● Update(docs\app-notes.md)
  ⎿  Added 2 lines, removed 2 lines
      113  - **Claims panel shows only `id` and `email`** — no name, role
            or groups. This
      114    is the Finding 2 experiment answer in the live environment: 
           plan the role
      115    model around what actually arrives (confirms the groups-clai
           m gap).
      116 -- **"Load sample data" with create disabled failed** with `The
          - field                                                        
      117 -  `createClearingPlan` does not exist on the type `Mutation``.
          - With no role                                                 
      116 +- **"Load sample data" with create disabled failed** with "The
          + field                                                        
      117 +  `createClearingPlan` does not exist on the type `Mutation`".
          + With no role                                                 
      118    granting create, the API exposes no create operation at all 
           — so the seed
      119    button only works during the gated create-enabled window (as
            designed).
      120  - **Errors showed as raw GraphQL text** in the UI — fixed belo
           w (observation 3).

● Now add the decisions.md row and the poc-log.md row.

● Update(docs\decisions.md)
  ⎿  Added 1 line
      37  | 2026-10-16 | Fabric seeding method chosen: temporarily enable
           `@authenticated('create')` + a "Load sample data" button shown
           only when the deployed table is empty, run once, then remove c
          reate and redeploy. Built but not run against Fabric. | Smalles
          t gated way to populate the empty deployed DB. Trade-off: creat
          e is briefly open to any signed-in user; mitigated by dev-only 
          synthetic data and immediate removal. Long-term: a seed Functio
          n or per-row create policy. | Josh | Deployed app, `ClearingPla
          n` entity |
      38  | 2026-10-16 | `updated_by` is client-set (from the session) an
          d explicitly **not** audit-grade; `updated_at` uses the `@date`
           datetime type. A server-stamped audit field comes with the cha
          nge-log step. | The SDK provides no automatic audit columns; a 
          client controls the value it sends. | Josh | `ClearingPlan` ent
          ity |
      39  | 2026-10-16 | Findings recorded for the role-model design: (1)
           cross-field rules are form-only until a Rayfin Function exists
          ; (2) the policy DSL has no groups claim (only `sub`/`email`/`r
          ole`) and the session is opaque, so Entra-group roles likely ne
          ed a fallback — the claims panel confirms what actually arrives
           after deploy. | Answers the open design question the slice was
           meant to probe. | Agent (prompt 07) — Josh to confirm post-dep
          loy | Later role-rules step |
      40 +| 2026-10-16 | Clear-a-field fix (prompt 08): send cleared opti
         +onal fields as an explicit `null` on update (not `undefined`), 
         +carried through a cast because the generated `UpdateInput` type
         + is `value \| undefined`. The installed `@microsoft/rayfin-data
         +` client serialises `null` to a GraphQL `null` literal (DAB set
         +s the column null) and omits `undefined` (leaves it unchanged) 
         +— verified in the client source, so this is the supported mecha
         +nism, not a workaround. Plus a read-back guard that re-reads th
         +e saved row and errors on any field the server kept differently
         +, and friendly UI errors (raw GraphQL kept in the console only)
         +. | The deployed app stored silent bad data: clearing a date sa
         +ved as `undefined` = "leave unchanged", so TBD feeders kept the
         +ir old date, breaking the cross-field rule. Only verifiable on 
         +Fabric (local mode is in-memory). | Josh (prompt 08) | `app/row
         +-tracker` update path, edit form errors |                      
      41  
      42  ## R1 profile findings (2026-10-15)
      43  

● Update(docs\poc-log.md)
  ⎿  Added 1 line
      12  | 2026-10-16 | R3. Spec | Claude Code (Opus 4.8); powerbi-repor
          t-cli (planning) + brillit-report-standards | ~20 | | Pass: loc
          ked `_brief/report-spec.md` (6 pages, canonical Design Brief, p
          asses acceptance checks); approved by Josh | None | yes | Suffi
          cient-input fast path; 3 deviations recorded (KPI comparison, o
          verdue status column, no tooltip) |
      13  | 2026-10-16 | R4. Build (6 pages) | Claude Code (Opus 4.8); po
          werbi-report-cli (authoring) + powerbi-report-author 0.5.0; Nod
          e 24.20 generator | ~60 | | Pass: all 6 pages built via `powerb
          i/build-report.mjs`; `validate` clean (0 content errors); self-
          review loop fixed 3 items (legend/blank-month/labels on Overvie
          w, Back-button overlap) | Two Desktop reopens needed (live relo
          ad won't register wholesale page-set/ID changes); 2 helper meas
          ures added + saved | partial | 2 deferrals: Overdue/Due-soon bo
          okmark toggle, dynamic drillthrough title. Theme + logo registe
          red |
      14  | 2026-10-16 | R4. Independent review | pbi-report-reviewer sub
          agent | ~10 | | Verdict "close, not yet signed off": 1 blocker 
          (no alt text) + majors (raw field-name subtitles). Agent fixed 
          alt text, chart subtitles, About glossary; re-validated + re-sc
          reenshot | Reviewer ran as subagent; agent-fixable items resolv
          ed; hex-to-theme + status-cell background left for the develope
          r | partial | Accepted: ALL-CAPS headers (naming decision), gre
          en KPI accent (house standard), "(Blank)" vendor (real data). S
          ee decisions.md |
      15 +| 2026-10-16 | R7. App clear-date fix (prompt 08) | Claude Code
         + (Opus 4.8); Rayfin SDK/CLI 1.36.2 client source + docs read fr
         +om `node_modules`; no MCP | ~25 | | Part A: confirmed from the 
         +installed client source that an explicit `null` clears a field 
         +(serialised to a GraphQL `null`; `undefined` is omitted) — a su
         +pported mechanism, so continued to Part B. Part B: update now s
         +ends cleared optional fields as `null`; read-back guard (`diffS
         +avedRow`) re-reads the saved row and errors on any field the se
         +rver kept differently; raw GraphQL errors replaced with a frien
         +dly message (console keeps the detail). 3 new tests (clear payl
         +oad, read-back mismatch, error mapping); `build`, 17 tests, lin
         +t all pass. Recorded the deploy observations (claims = id+email
         + only, create-disabled seed error, raw errors) in app-notes. | 
         +| yes | Only fully verifiable on the deployed app (local mode i
         +s in-memory). Also fixed a latent issue: the read-back used `fi
         +ndById`, which selects only the PK — switched to a full-field `
         +select().where().execute()`. Lint warning in AuthContext.tsx is
         + pre-existing |                                                
      16  | | R4. PR | | | | | | | Josh opens the PR (agent never pushes)
           |
      17  | 2026-10-16 | R5. Report follow-ups (prompt 06) | Claude Code 
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
      18  | 2026-10-16 | R6. App thin slice (prompt 07) | Claude Code (Op
          us 4.8); Rayfin SDK/CLI 1.36.2 docs read from `node_modules`; n
          o MCP | ~55 | | Part A: explained the template + planned the sl
          ice (Checkpoint 1). Part B: replaced Todo with `ClearingPlan` (
          read+update, no create/delete), feeder list + edit form with th
          e cross-field rules, diagnostic claims panel, 15-row synthetic 
          seed, backend-free local auth; `build`, 11 tests, lint all pass
          . Two findings recorded (cross-field = form-only; no groups cla
          im). Fabric seed path built but not run. | | yes | No Fabric co
          ntact: local run is plain Vite; `rayfin dev`/`up` treated as de
          ploys (gated). Build caught the Rayfin mutation type taking `va
          lue \| undefined` not `null` → clear-to-null on Fabric is an op
          en gap (noted in app-notes) |

● Let me verify the final state of the key edited section in clearingPlans.ts.

  Read 1 file (ctrl+o to expand)

● Everything is coherent and verified (build, 17 tests, lint all pass;
  nullToUndef is still used by the seed/create path). Here's the wrap-up.

  What changed

  Part A — can a field be cleared? Yes, a supported way exists.
  I read the installed @microsoft/rayfin-data client source. On an update:
  - formatMutationInput skips only undefined fields (→ omitted from the mutation
  → DAB "leave unchanged"), but includes null as a primitive.
  - formatGraphQLValue(null) renders a GraphQL null literal → DAB applies it as
  "set this column to null".

  So sending an explicit null is the supported clear mechanism. The generated
  UpdateInput type is value | undefined (no null), so the null is carried
  through a cast — the runtime behaviour, not a sentinel or delete-and-recreate.
  The optional fields are nullable columns (@date/@int/@text({ optional: true 
  })), so null is valid. Per the prompt, I continued to Part B.

  Part B — fix:
  1. src/services/clearingPlans.ts — cleared optional fields now go as explicit
  null via a clearable() cast (was nullToUndef, which caused the bug).
  nullToUndef is kept for the create/seed path, where null and undefined are
  equivalent.
  2. Read-back guard — after save I re-read the full row (switched from
  findById, which selects only the PK, to
  select([...FIELDS]).where(...).execute()) and compare it to what was submitted
  via the new exported diffSavedRow. Any field the server kept differently
  throws an error naming the field and the kept value. (updated_at excluded —
  datetime round-trip precision.)
  3. Friendly errors — new src/services/errors.ts (toUserMessage): raw GraphQL 
  errors: … are replaced with a short plain line; the full error still goes to
  console.error. Wired into both catch sites in HomePage.tsx (save + seed).
  4. Tests — clearingPlansFabric.test.ts (cleared payload is explicit null;
  read-back mismatch throws a field-named error; matching read-back returns the
  row) and errors.test.ts (GraphQL replaced, own messages pass through,
  non-Error fallback).
  5. Docs — app-notes.md "Deployed results (2026-10-16)" section (3
  observations, the bug, the fix, local-only verification caveat) and resolved
  the clear-to-null open question; a row in decisions.md; a row in poc-log.md.

  Check results

  - npm run build — passes (tsc + vite).
  - npm run test — 17 passed (5 files).
  - npm run lint — 0 errors; 1 warning in AuthContext.tsx, pre-existing and
  untouched.

  How to verify on the deployed app (after merge)

  This bug only reproduces on Fabric (local mode is in-memory). After you
  deploy:
  1. Edit feeder 101-1: change certainty confirmed → TBD and clear the next
  clearing date; Save. The row should now show TBD with no date (previously
  stuck at 2026-11-15). Repeat for 533-1.
  2. Clear notes / last work done on a feeder — they should persist as empty.
  3. To exercise the read-back guard / friendly errors, trigger a server
  rejection (e.g. the create-disabled "Load sample data") — you should see a
  short plain message in the UI and the raw GraphQL text only in the browser
  console.

  Proposed commit

  Branch fix/clear-date (already on it). Stage explicitly:

  git add app/row-tracker/src/services/clearingPlans.ts \
          app/row-tracker/src/services/errors.ts \
          app/row-tracker/src/pages/HomePage.tsx \
          app/row-tracker/src/__tests__/clearingPlansFabric.test.ts \
          app/row-tracker/src/__tests__/errors.test.ts \
          docs/app-notes.md docs/decisions.md docs/poc-log.md \
          prompts/08_clear_date_fix.md

  Message:
  fix(row-tracker): clear fields with explicit null and guard the save

  Cleared optional fields were sent as undefined, which DAB treats as
  "leave unchanged", so clearing a date silently kept the old value.
  Send an explicit null instead, read the saved row back and error on any
  mismatch, and replace raw GraphQL errors with a friendly message.

  Closes #<clear-date issue>
  Closes #<raw-error issue>

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

  I left the pre-existing powerbi/* working-tree changes alone (out of scope).
  Suggested PR body draft (with the Closes # placeholders above) is ready
  whenever you want it — say the word and I'll write the full description. I
  won't commit, push, or open the PR without your go-ahead.

  Two notes worth surfacing:
  - I did not run anything against Fabric; npm run build ran prebuild (rayfin 
  env --framework vite) which regenerated the gitignored
  app/row-tracker/.env.local — no Fabric contact, nothing to stage.
  - I fixed a latent issue in passing: the old read-back used findById, which
  selects only the PK, so the Fabric-path return value was essentially blank
  (the UI re-lists, so it never showed). The full-field read-back fixes that
  too.

✻ Cogitated for 6m 34s

※ recap: Fixed the row-tracker clear-date bug: cleared fields now send explicit null, with a read-back guard and friendly errors. Build, 17 tests, and lint all pass. Next: you review and approve the proposed commit on branch fix/clear-date.

❯ Approved. Commit exactly the paths you listed and nothing under powerbi/.     
  Replace the placeholders with "Closes #15" and "Closes #17". Leave #16 open,  
  since this fix doesn't add server-side validation. Then show me git log -1    
  --stat.                                                                       

  Ran 1 shell command (ctrl+o to expand)

● Staging is exactly the 9 listed paths; nothing under powerbi/ is staged. Now
  commit.

  Committed bd29898, ran 1 shell command (ctrl+o to expand)

● Committed on fix/clear-date as bd29898.

  - 9 files, exactly the paths you listed — nothing under powerbi/ (those
  changes remain unstaged in the working tree).
  - Commit message closes #15 and #17; #16 left untouched (this fix doesn't add
  server-side cross-field validation — that still needs a Rayfin Function).

  No push or PR, per the hard rules — that's yours when you're ready.

✻ Cooked for 12s