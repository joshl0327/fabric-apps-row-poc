 ▐▛███▜▌   Claude Code v2.1.181
▝▜█████▛▘  Opus 4.8 · Claude Pro
  ▘▘ ▝▝    C:\dev\fabric-apps-row-poc

 ▎ Meet Fable 5, our newest model for complex, long-running work. Switch anytime with /model.

❯ /clear                                                                        

❯ Read prompts/10_change_log.md and carry out the task described below its      
  "---" line, following AGENTS.md. Start with Part A and stop at CHECKPOINT 1.  

  Read 1 file (ctrl+o to expand)

● I'll start by reading the required context docs and the Rayfin skill.

  Read 4 files (ctrl+o to expand)

● Now let me read the existing app files and the Rayfin permissions docs.

  Read 3 files (ctrl+o to expand)

● Now the service and UI files, plus the Rayfin permissions docs.

  Read 2 files (ctrl+o to expand)

● The permissions doc confirms a row-level policy callback. Let me check
  known-limitations, the guide's permissions doc, and what identity value the
  app currently writes.

  Read 2 files (ctrl+o to expand)

● Let me check the guide's data permissions doc for the create-policy nuance
  (whether item-reference policies apply on create).

  Read 1 file, ran 1 shell command (ctrl+o to expand)

● Let me check the client/env helper and the errors service to ground the plan
  details.

  Searched for 1 pattern, read 2 files (ctrl+o to expand)

● I've read the prompt, the two docs, the Rayfin skill/permissions docs, and the
  current app code (entity, schema, data service, HomePage, client/env
  helpers). Here is the Part A plan. No code changed.

  ---
  Part A — Plan for the ChangeLog audit trail

  1. "Who made the change" — can a rule pin it to the signed-in user?

  Yes, for create — and it's documented, not a guess. Rayfin's policy DSL
  (@microsoft/rayfin-guide/assets/docs/data/permissions.md) takes a policy
  callback on any action, including create, and compiles it to a DAB OData check
  expression. The supported claims are exactly claims.sub, claims.email,
  claims.role; the only operator is .eq(), composable with .and()/.or(). The
  docs' own example applies a create policy against a submitted item field:

  @role('authenticated', 'create', {
    policy: (claims, item) => claims.sub.eq(item.createdBy),
  })

  So for ChangeLog the exact rule is:

  @authenticated('create', {
    policy: (claims, item) => claims.email.eq(item.changed_by),
  })

  I key on claims.email (not claims.sub) because the deployed claims panel
  showed only id and email arriving, and the app already writes the email into
  updated_by. DAB compiles this to @claims.email eq @item.changed_by, so the
  server rejects any create whose changed_by ≠ the signed-in email — the browser
  cannot forge who made the change.

  For ClearingPlan.update (updated_by) — supported in syntax, with one caveat I 
  want to flag. I'll add:

  @authenticated('update', {
    policy: (claims, item) => claims.email.eq(item.updated_by),
  })

  The docs show update policies that reference item.<field> (the SecureDocument
  example), but in that example the field is an immutable ownership field.
  updated_by is mutable (it becomes the current editor on every save). DAB
  evaluates @item on create against the submitted payload (what we want);
  whether it evaluates @item on update against the submitted payload vs. the
  stored pre-image is not stated in the installed docs. If it's the payload,
  this works exactly as intended. If it's the pre-image, it would wrongly lock a
  user out of any row last edited by someone else. This is a finding to confirm
  with one test edit post-deploy. Either way the audit trail's trustworthy
  "who" comes from the ChangeLog create policy, which is unambiguous — so the
  integrity of the log doesn't depend on resolving this.

  2. Proposed design

  Entity — rayfin/data/ChangeLog.ts (one row per saved change), registered in
  schema.ts:

  Field: id
  Decorator: @uuid()
  Notes: key
  ────────────────────────────────────────
  Field: feeder_id
  Decorator: @text({ max: 20 })
  Notes: the feeder's business id (e.g. 214-1); not unique — many log rows per
    feeder. Plain text, no relationship (matches the current model; avoids the
  FK
     naming limitation).
  ────────────────────────────────────────
  Field: action
  Decorator: @set('create', 'update')
  Notes: only update is written for now
  ────────────────────────────────────────
  Field: changed_by
  Decorator: @text({ max: 200 })
  Notes: signed-in email; the create policy pins it
  ────────────────────────────────────────
  Field: changed_at
  Decorator: @date()
  Notes: datetime
  ────────────────────────────────────────
  Field: before_json
  Decorator: @text({ max: 2000 })
  Notes: JSON of only the changed fields, old values; cleared values as null.
  max
    set so it isn't NVARCHAR(MAX) (known-limitations).
  ────────────────────────────────────────
  Field: after_json
  Decorator: @text({ max: 2000 })
  Notes: JSON of the same changed fields, new values
  ────────────────────────────────────────
  Field: reason
  Decorator: @text({ max: 250, optional: true })
  Notes: optional free text

  Role rules — ChangeLog: @authenticated('read') + @authenticated('create', { 
  policy: claims.email.eq(item.changed_by) }). No update, no delete decorator at
  all → Rayfin/DAB generate no updateChangeLog/deleteChangeLog mutation, so the
  log is append-only and cannot be altered through the API. (The
  deployed-results note already observed this exact behaviour for ClearingPlan
  create: "createClearingPlan does not exist on the type Mutation" when no role
  grants the action.) I'll prove it in Part B from the generated client types /
  Mutation type, per the prompt.

  Role rules — ClearingPlan: add the update policy above. Create stays off
  (already removed on this branch, commit #22); no delete. No field/column
  changes.

  Write sequence (in the edit-form save path, after the existing
  updateClearingPlan read-back guard returns the server-verified row):
  1. updateClearingPlan(...) saves and returns the verified saved row (unchanged
  from today).
  2. Diff the pre-edit row (before) against saved → keep only fields whose value
  changed; cleared values recorded as null. Build before_json / after_json from
  just those fields. (Reuses the comparison helpers already in
  clearingPlans.ts.)
  3. If nothing changed, write no log row. Otherwise create a ChangeLog row:
  feeder_id, action: 'update', changed_by = session email (the same value as
  updated_by), changed_at = now, the two JSON blobs, optional reason.
  4. If the save succeeds but the log create fails, surface a distinct, visible
  error — "The edit was saved but could not be logged" — separate from a save
  failure. Not hidden.

  Known gap (record, don't fix now): the save and the log are two separate
  writes, not one transaction. If step 3 fails, the feeder edit is already
  persisted. Making both atomic needs a server-side Rayfin Function on write — a
  later step (same place Finding 1 cross-field enforcement lives).

  Screens (plain React + Tailwind, no new library):
  - History inside each feeder's edit view: ChangeLog where feeder_id = this
  feeder, changed_at desc. Each entry: when, who, and per changed field old → 
  new (parsed from the JSON). Newest first.
  - Recent changes panel on the home page: last 20 across all feeders
  (changed_at desc, first 20): when, who, feeder, short summary.
  - Optional small "Reason for change" input (≤ 250) in the edit form, feeding
  reason. (Proposing this — flagging it as the one net-new form field; say the 
  word if you'd rather omit it.)
  - Local (in-memory) mode gets a parallel in-memory ChangeLog store so History
  / Recent work offline.

  Import-panel switch: gate the panel behind a build-time flag, off by default —
  import.meta.env.VITE_ENABLE_FEEDER_IMPORT === 'true' (Vite statically inlines
  it; the established env pattern here). Today it shows whenever
  !isLocalBackend(); the new condition also requires the flag. The 153-feeder
  import stays the baseline and writes no ChangeLog rows.

  3. What the deploy (npx rayfin up) will change — when you ask, not now

  - New ChangeLog table (dbo.ChangeLogs) in the app's Fabric SQL database, with
  the columns above.
  - New permissions: ChangeLog → authenticated read + create (with the
  changed_by == email policy). No update/delete.
  - ClearingPlan rules: adds the update policy (updated_by == email). No column 
  change, no data migration — existing feeder rows are untouched; the policy
  only governs future writes.
  - UI: History section, Recent changes panel, optional reason field, import
  panel behind the off-by-default flag.

  Things I'm unsure about / want your call

  1. The ClearingPlan update-policy semantics on a mutable field (payload vs.
  pre-image) — confirm with one test edit post-deploy; the log's integrity
  doesn't depend on it.
  2. Add the optional "Reason for change" input? (I've assumed yes, optional.)
  3. before_json/after_json max: 2000 — comfortably covers a full-row diff; flag
  if you'd prefer a different cap.
  4. updated_by/changed_by fallback: the code uses email ?? id ?? 'unknown'. If
  a user ever lacks an email claim, the create policy (email based) would reject
  the log row. The deployed claims panel showed email present, so this is an
  edge case — noting it.

  CHECKPOINT 1 — stopping here for your approval before any code changes (Part 
  B).

✻ Worked for 2m 35s

※ recap: Building an append-only ChangeLog audit trail for the row-tracker app so every feeder edit produces a tamper-proof log row. I've finished the Part A plan and stopped at Checkpoint 1. Next: await your approval, then build Part B. (disable recaps in /config)

❯ Approved with these changes:                                                  
  1. Don't add the ClearingPlan update policy in this task. With one user we    
  can't tell whether Rayfin checks the payload or the stored row, and the       
  stored-row case could lock people out. Record it as an open question for the  
  role-rules task (prompt 11). The ChangeLog create policy stays.               
  2. changed_at: check the docs for a server-set timestamp (default value,      
  auto-created field or similar) and use it if it exists. If not, keep the      
  client time and record "changed_at is set by the browser" as a known gap next 
  to the two-writes gap.                                                        
  3. Keep the optional Reason for change field.                                 
  4. No 'unknown' fallback for changed_by: if there's no email, don't attempt   
  the log write; show the "saved but not logged" error.                         
  Then continue with Part B and stop at CHECKPOINT 2.                           

● Approved. Let me first resolve point 2 — check the docs for a server-set
  timestamp option — then build.

  Read 1 file, ran 1 shell command (ctrl+o to expand)

● No server-set timestamp documented — default only takes a static literal. Let
  me confirm against the core type definitions before deciding.

  Read 1 file, ran 1 shell command (ctrl+o to expand)
● Confirmed: DateFieldOptions has no server-default/auto-now — default is a
  static literal only. So changed_at stays client-set and I'll record it as a
  known gap. Now let me look at the existing test setup and import/validation
  services to match conventions before building.

  Read 7 files, ran 2 shell commands (ctrl+o to expand)

● Let me confirm the data client orderBy/select/create surface for the new
  entity before writing code.

  Read 1 file, ran 1 shell command (ctrl+o to expand)

● I have everything I need. Let me build. Starting with the entity and schema.

● Write(app\row-tracker\rayfin\data\ChangeLog.ts)
  ⎿  Wrote 49 lines to app\row-tracker\rayfin\data\ChangeLog.ts
       1 import { entity, authenticated, uuid, text, date, set } from '@m
       2 
       3 // Append-only audit trail: one row per saved feeder change. Thi
       4 // half of Phase 3's exit test — "every edit produces an audit r
         ow" — and the row
       6 //
       7 // Permissions (see docs/app-notes.md):
       9 //   - create : any signed-in user, BUT a row-level policy pins 
         `changed_by` to
         not forge who made
     … +58 lines (ctrl+o to expand)

● Write(app\row-tracker\rayfin\data\schema.ts)
  ⎿  Added 3 lines, removed 1 line
      1 +import { ChangeLog } from './ChangeLog.js';                     
      2  import { ClearingPlan } from './ClearingPlan.js';
      3  
      4  export type ClearingPlanAppSchema = {
      5    ClearingPlan: ClearingPlan;
      6 +  ChangeLog: ChangeLog;                                         
      7  };
      8  
      7 -export const schema = [ClearingPlan];                           
      9 +export const schema = [ClearingPlan, ChangeLog];                

● Now the model types and feature flag:

● Write(app\row-tracker\src\services\changeLogModel.ts)
  ⎿  Wrote 53 lines to app\row-tracker\src\services\changeLogModel.ts
       1 // Shared types for the change-log (audit trail) slice, used by 
       2 // UI and the tests. The entity itself lives in rayfin/data/Chan
         geLog.ts.
       3 
       5 
       6 // The feeder fields whose changes we log. Business-editable fie
       7 // identity (id, feeder_id), district (not editable in the form)
          and audit
       8 // metadata (updated_by/updated_at) are deliberately excluded.
      10   'vendor',
     … +50 lines (ctrl+o to expand)

● Write(app\row-tracker\src\services\featureFlags.ts)
  ⎿  Wrote 18 lines to app\row-tracker\src\services\featureFlags.ts
       1 // Build-time feature switches. Vite statically inlines `import.
       2 // flag that is unset at build time compiles to a constant `fals
         e` and the gated
       4 
       5 type FeederImportEnv = { VITE_ENABLE_FEEDER_IMPORT?: unknown };
       7 /**
       8  * The one-time "Import feeders" panel (prompt 09) is OFF by def
       9  * shown when the app is built with `VITE_ENABLE_FEEDER_IMPORT=t
         rue`, i.e. for a
         et) hides it.
     … +14 lines (ctrl+o to expand)

● Now the change-log service:

● Write(app\row-tracker\src\services\changeLog.ts)
  ⎿  Wrote 222 lines to app\row-tracker\src\services\changeLog.ts
       1 // The change-log (audit trail) service. Pure helpers (diff, ent
         ry assembly) are
         in local mode and
       3 // the typed Rayfin client against Fabric. See docs/app-notes.md
         .
       5 import type { ClearingPlanRow } from './clearingPlanModel';
       6 import {
       7   LOGGED_FIELDS,
       9   type ChangeLogRow,
      10   type FieldChange,
     … +240 lines (ctrl+o to expand)

● Now wire it into the UI. First the imports and the HomePage component:

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 15 lines
       3  import { ClaimsPanel } from '@/components/ClaimsPanel';
       4  import { useAuth } from '@/hooks/AuthContext';
       5  import {
       6 +  listFeederHistory,                                           
       7 +  listRecentChanges,                                           
       8 +  logFeederUpdate,                                             
       9 +} from '@/services/changeLog';                                 
      10 +import {                                                       
      11 +  FIELD_LABELS,                                                
      12 +  type ChangeLogRow,                                           
      13 +  type FieldChange,                                            
      14 +} from '@/services/changeLogModel';                            
      15 +import {                                                       
      16    DATE_CERTAINTIES,
      17    NOTES_MAX,
      18    VENDORS,
     ...
      26    updateClearingPlan,
      27  } from '@/services/clearingPlans';
      28  import { toUserMessage } from '@/services/errors';
      29 +import { isFeederImportEnabled } from '@/services/featureFlags'
         +;                                                              
      30  import type { ImportSummary } from '@/services/import';
      31  import { isLocalBackend } from '@/services/rayfinClient';
      32  import {
     ...
      35    type ClearingPlanErrors,
      36  } from '@/services/validation';
      37  
      38 +/** Reason is logged with a change but is not part of the feede
         +r row, so it is                                                
      39 + * never 'unknown'-filled: the audit row's `changed_by` must be
         + the real email. */                                            
      40 +const REASON_MAX = 250;                                        
      41 +                                                               
      42  /** Format a Date as `yyyy-mm-dd` for display and date inputs; 
          '' when null. */
      43  const toInputDate = (d: Date | null): string =>
      44    d ? d.toISOString().slice(0, 10) : '';

● Now the HomePage component body — add changedBy, notice banner, recent-changes
  panel, and gate the import panel:

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 14 lines, removed 1 line
      58  export function HomePage() {
      59    const { signOut, user } = useAuth();
      60    const [rows, setRows] = useState<ClearingPlanRow[]>([]);
      61 +  const [recent, setRecent] = useState<ChangeLogRow[]>([]);    
      62    const [loading, setLoading] = useState(true);
      63    const [editingId, setEditingId] = useState<string | null>(nul
          l);
      64    const [seeding, setSeeding] = useState(false);
      65    const [seedError, setSeedError] = useState<string | null>(nul
          l);
      66 +  const [notice, setNotice] = useState<string | null>(null);   
      67  
      68 +  // The audit row's author. The email claim only — no id/'unkn
         +own' fallback (a                                               
      69 +  // change-log decision): without an email we don't attempt th
         +e log write.                                                   
      70 +  const changedBy = user?.email ?? null;                       
      71 +  // Who to stamp on the feeder row itself (unchanged, client-s
         +et, not audit-grade).                                          
      72 +  const updatedBy = user?.email ?? user?.id ?? 'unknown';      
      73 +                                                               
      74    const fetchRows = useCallback(async () => {
      67 -    setRows(await listClearingPlans());                        
      75 +    const [feeders, changes] = await Promise.all([             
      76 +      listClearingPlans(),                                     
      77 +      listRecentChanges(20),                                   
      78 +    ]);                                                        
      79 +    setRows(feeders);                                          
      80 +    setRecent(changes);                                        
      81      setLoading(false);
      82    }, []);
      83  

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 9 lines, removed 1 line
      89      setSeedError(null);
      90      setSeeding(true);
      91      try {
      92 -      await seedFabric(user?.email ?? user?.id ?? 'unknown');  
      92 +      await seedFabric(updatedBy);                             
      93        await fetchRows();
      94      } catch (err) {
      95        setSeedError(toUserMessage(err, 'Failed to load data.'));
     ...
       98      }
       99    };
      100  
      101 +  // Called after a feeder save. `notice` carries a "saved but
          + not logged"                                                  
      102 +  // warning when the edit persisted but its audit row did not
          +.                                                             
      103 +  const handleSaved = async (warning?: string) => {           
      104 +    setEditingId(null);                                       
      105 +    setNotice(warning ?? null);                               
      106 +    await fetchRows();                                        
      107 +  };                                                          
      108 +                                                              
      109    // The gated Fabric seed: offered only against a real backen
           d when empty.
      110    const showSeed = !isLocalBackend() && !loading && rows.lengt
           h === 0;
      111  

● Now the JSX: notice banner, gated import panel, recent-changes panel, and pass
  the new props to FeederTable:

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 18 lines, removed 7 lines
      132        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      133          <ClaimsPanel />
      134  
      135 -        {/* The one-time feeder load (prompt 09). Offered on t
          -he Fabric backend;                                            
      136 -            it only succeeds while the gated create permission
          - is enabled. */}                                              
      137 -        {!isLocalBackend() && !loading && (                   
      138 -          <ImportPanel                                        
      139 -            updatedBy={user?.email ?? user?.id ?? 'unknown'}  
      140 -            onImported={fetchRows}                            
      141 -          />                                                  
      135 +        {notice && (                                          
      136 +          <div className="flex items-start justify-between gap
          +-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 te
          +xt-sm text-amber-900">                                        
      137 +            <span>{notice}</span>                             
      138 +            <button                                           
      139 +              onClick={() => setNotice(null)}                 
      140 +              className="text-amber-500 hover:text-amber-700" 
      141 +              aria-label="Dismiss"                            
      142 +            >                                                 
      143 +              ✕                                               
      144 +            </button>                                         
      145 +          </div>                                              
      146          )}
      147  
      148 +        {/* The one-time feeder load (prompt 09). Hidden unles
          +s the app was built                                           
      149 +            with VITE_ENABLE_FEEDER_IMPORT=true (off by defaul
          +t); it only succeeds                                          
      150 +            while the gated create permission is enabled. */} 
      151 +        {isFeederImportEnabled() && !isLocalBackend() && !load
          +ing && (                                                      
      152 +          <ImportPanel updatedBy={updatedBy} onImported={fetch
          +Rows} />                                                      
      153 +        )}                                                    
      154 +                                                              
      155          {loading ? (
      156            <p className="text-center text-sm text-gray-400">Loa
           ding…</p>
      157          ) : showSeed ? (

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 44 lines, removed 11 lines
      171              )}
      172            </div>
      173          ) : (
      174 -          <FeederTable                                        
      175 -            rows={rows}                                       
      176 -            editingId={editingId}                             
      177 -            onEdit={setEditingId}                             
      178 -            onCancel={() => setEditingId(null)}               
      179 -            onSaved={async () => {                            
      180 -              setEditingId(null);                             
      181 -              await fetchRows();                              
      182 -            }}                                                
      183 -            updatedBy={user?.email ?? user?.id ?? 'unknown'}  
      184 -          />                                                  
      174 +          <>                                                  
      175 +            <FeederTable                                      
      176 +              rows={rows}                                     
      177 +              editingId={editingId}                           
      178 +              onEdit={setEditingId}                           
      179 +              onCancel={() => setEditingId(null)}             
      180 +              onSaved={handleSaved}                           
      181 +              updatedBy={updatedBy}                           
      182 +              changedBy={changedBy}                           
      183 +            />                                                
      184 +            <RecentChanges rows={recent} />                   
      185 +          </>                                                 
      186          )}
      187        </main>
      188      </div>
      189    );
      190  }
      191  
      192 +/** The last 20 changes across all feeders, newest first. */  
      193 +function RecentChanges({ rows }: { rows: ChangeLogRow[] }) {  
      194 +  if (rows.length === 0) return null;                         
      195 +  return (                                                    
      196 +    <div className="rounded-xl border border-gray-200 bg-white
          + px-6 py-5">                                                  
      197 +      <h2 className="mb-3 text-sm font-semibold text-gray-900"
          +>                                                             
      198 +        Recent changes                                        
      199 +      </h2>                                                   
      200 +      <ul className="divide-y divide-gray-100 text-sm">       
      201 +        {rows.map((entry) => (                                
      202 +          <li key={entry.id} className="py-2">                
      203 +            <div className="flex flex-wrap items-baseline just
          +ify-between gap-x-3">                                         
      204 +              <span className="font-medium text-gray-900">    
      205 +                {entry.feeder_id}                             
      206 +              </span>                                         
      207 +              <span className="text-xs text-gray-400">        
      208 +                {formatWhen(entry.changed_at)} · {entry.change
          +d_by}                                                         
      209 +              </span>                                         
      210 +            </div>                                            
      211 +            <ChangeList changes={entry.changes} />            
      212 +            {entry.reason && (                                
      213 +              <p className="mt-0.5 text-xs italic text-gray-50
          +0">                                                           
      214 +                “{entry.reason}”                              
      215 +              </p>                                            
      216 +            )}                                                
      217 +          </li>                                               
      218 +        ))}                                                   
      219 +      </ul>                                                   
      220 +    </div>                                                    
      221 +  );                                                          
      222 +}                                                             
      223 +                                                              
      224  function FeederTable({
      225    rows,
      226    editingId,

● Now update FeederTable to thread changedBy and the new onSaved signature:

● Update(app\row-tracker\src\pages\HomePage.tsx)  ⎿  Added 3 lines, removed 1 line
      228    onCancel,
      229    onSaved,
      230    updatedBy,
      231 +  changedBy,                                                  
      232  }: {
      233    rows: ClearingPlanRow[];
      234    editingId: string | null;
      235    onEdit: (id: string) => void;
      236    onCancel: () => void;
      236 -  onSaved: () => Promise<void>;                               
      237 +  onSaved: (warning?: string) => Promise<void>;               
      238    updatedBy: string;
      239 +  changedBy: string | null;                                   
      240  }) {
      241    return (
      242      <div className="overflow-hidden rounded-xl border border-g
           ray-200 bg-white">

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 1 line
      259                    <EditForm
      260                      row={row}
      261                      updatedBy={updatedBy}
      262 +                    changedBy={changedBy}                     
      263                      onCancel={onCancel}
      264                      onSaved={onSaved}
      265                    />

● Now the EditForm — add changedBy, a reason input, the logFeederUpdate call,
  and the History section:

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 15 lines, removed 3 lines
      296  function EditForm({
      297    row,
      298    updatedBy,
      299 +  changedBy,                                                  
      300    onCancel,
      301    onSaved,
      302  }: {
      303    row: ClearingPlanRow;
      304    updatedBy: string;
      305 +  changedBy: string | null;                                   
      306    onCancel: () => void;
      305 -  onSaved: () => Promise<void>;                               
      307 +  onSaved: (warning?: string) => Promise<void>;               
      308  }) {
      309    const [edit, setEdit] = useState<ClearingPlanEdit>(() => edi
           tFromRow(row));
      310 +  const [reason, setReason] = useState('');                   
      311    const [errors, setErrors] = useState<ClearingPlanErrors>({})
           ;
      312    const [saving, setSaving] = useState(false);
      313    const [saveError, setSaveError] = useState<string | null>(nu
           ll);
     ...
      326      setSaveError(null);
      327      setSaving(true);
      328      try {
      326 -      await updateClearingPlan(row.id, edit, updatedBy);      
      327 -      await onSaved();                                        
      329 +      // Save first; the read-back gives the server-verified r
          +ow (prompt 08).                                               
      330 +      const saved = await updateClearingPlan(row.id, edit, upd
          +atedBy);                                                      
      331 +      // Then log the change. A logging failure does NOT undo 
          +the save — it is                                              
      332 +      // surfaced as a "saved but not logged" warning, never h
          +idden.                                                        
      333 +      const result = await logFeederUpdate(                   
      334 +        row,                                                  
      335 +        saved,                                                
      336 +        changedBy,                                            
      337 +        reason.trim() || null                                 
      338 +      );                                                      
      339 +      await onSaved(result.error);                            
      340      } catch (err) {
      341        setSaveError(toUserMessage(err, 'Failed to save.'));
      342      } finally {

● Now add the reason input and the History section into the form JSX (after
  Notes, before the save error):

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 13 lines
      435          />
      436        </Field>
      437  
      438 +      <Field label={`Reason for change (optional, ${reason.len
          +gth}/${REASON_MAX})`}>                                        
      439 +        <input                                                
      440 +          type="text"                                         
      441 +          value={reason}                                      
      442 +          maxLength={REASON_MAX}                              
      443 +          onChange={(e) => setReason(e.target.value)}         
      444 +          placeholder="Recorded in the change log"            
      445 +          className="w-full rounded-lg border border-gray-300 
          +bg-white px-3 py-2"                                           
      446 +        />                                                    
      447 +      </Field>                                                
      448 +                                                              
      449        {saveError && <p className="text-sm text-red-600">{saveE
           rror}</p>}
      450  
      451 +      <FeederHistory feederId={row.feeder_id} />              
      452 +                                                              
      453        <div className="flex gap-3">
      454          <button
      455            type="submit"

● Now add the FeederHistory, ChangeList, and formatting helpers. I'll insert
  them after the RecentChanges component:

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 72 lines
      221    );
      222  }
      223  
      224 +/** The change history for one feeder, newest first, shown ins
          +ide its edit view. */                                         
      225 +function FeederHistory({ feederId }: { feederId: string }) {  
      226 +  const [history, setHistory] = useState<ChangeLogRow[] | null
          +>(null);                                                      
      227 +                                                              
      228 +  useEffect(() => {                                           
      229 +    let cancelled = false;                                    
      230 +    void listFeederHistory(feederId).then((h) => {            
      231 +      if (!cancelled) setHistory(h);                          
      232 +    });                                                       
      233 +    return () => {                                            
      234 +      cancelled = true;                                       
      235 +    };                                                        
      236 +  }, [feederId]);                                             
      237 +                                                              
      238 +  return (                                                    
      239 +    <div className="rounded-lg border border-gray-200 bg-gray-
          +50/60 px-4 py-3">                                             
      240 +      <h3 className="mb-2 text-xs font-semibold uppercase trac
          +king-wide text-gray-500">                                     
      241 +        History                                               
      242 +      </h3>                                                   
      243 +      {history === null ? (                                   
      244 +        <p className="text-xs text-gray-400">Loading…</p>     
      245 +      ) : history.length === 0 ? (                            
      246 +        <p className="text-xs text-gray-400">No changes logged
          + yet.</p>                                                     
      247 +      ) : (                                                   
      248 +        <ul className="divide-y divide-gray-200 text-sm">     
      249 +          {history.map((entry) => (                           
      250 +            <li key={entry.id} className="py-2">              
      251 +              <div className="text-xs text-gray-400">         
      252 +                {formatWhen(entry.changed_at)} · {entry.change
          +d_by}                                                         
      253 +              </div>                                          
      254 +              <ChangeList changes={entry.changes} />          
      255 +              {entry.reason && (                              
      256 +                <p className="mt-0.5 text-xs italic text-gray-
          +500">                                                         
      257 +                  “{entry.reason}”                            
      258 +                </p>                                          
      259 +              )}                                              
      260 +            </li>                                             
      261 +          ))}                                                 
      262 +        </ul>                                                 
      263 +      )}                                                      
      264 +    </div>                                                    
      265 +  );                                                          
      266 +}                                                             
      267 +                                                              
      268 +/** One field change per line: `Field: old → new`. */         
      269 +function ChangeList({ changes }: { changes: FieldChange[] }) {
      270 +  if (changes.length === 0) return null;                      
      271 +  return (                                                    
      272 +    <ul className="mt-0.5 space-y-0.5 text-xs text-gray-700"> 
      273 +      {changes.map((c) => (                                   
      274 +        <li key={c.field}>                                    
      275 +          <span className="text-gray-500">{FIELD_LABELS[c.fiel
          +d]}:</span>{' '}                                              
      276 +          <span className="text-gray-400">{formatValue(c.befor
          +e)}</span>                                                    
      277 +          {' → '}                                             
      278 +          <span className="font-medium text-gray-900">        
      279 +            {formatValue(c.after)}                            
      280 +          </span>                                             
      281 +        </li>                                                 
      282 +      ))}                                                     
      283 +    </ul>                                                     
      284 +  );                                                          
      285 +}                                                             
      286 +                                                              
      287 +const formatWhen = (d: Date): string =>                       
      288 +  d.toLocaleString(undefined, {                               
      289 +    dateStyle: 'medium',                                      
      290 +    timeStyle: 'short',                                       
      291 +  });                                                         
      292 +                                                              
      293 +const formatValue = (v: string | number | null): string =>    
      294 +  v == null || v === '' ? '(none)' : String(v);               
      295 +                                                              
      296  function FeederTable({
      297    rows,
      298    editingId,

● Now the tests. First the local-mode change-log tests:

● Write(app\row-tracker\src\__tests__\changeLog.test.ts)
  ⎿  Wrote 160 lines to app\row-tracker\src\__tests__\changeLog.test.ts
       1 import { afterEach, beforeEach, describe, expect, it, vi } from 
         'vitest';
       2 
         odule's
       4 // in-memory store; never touches the Rayfin client.
       5 vi.mock('@/services/rayfinClient', () => ({
       6   isLocalBackend: () => true,
       7   getRayfinClient: vi.fn(),
       9 
      10 import {
     … +170 lines (ctrl+o to expand)

● Write(app\row-tracker\src\__tests__\changeLogFabric.test.ts)
  ⎿  Wrote 66 lines to
     app\row-tracker\src\__tests__\changeLogFabric.test.ts
       1 import { beforeEach, describe, expect, it, vi } from 'vitest';
       2 
       3 // Fabric-backend path: isLocalBackend() is false, so the log wr
       4 // the mocked Rayfin client's ChangeLog.create.
       5 const mocks = vi.hoisted(() => ({ create: vi.fn() }));
       6 
       7 vi.mock('@/services/rayfinClient', () => ({
       8   isLocalBackend: () => false,
         reate } } }),
      10 }));
     … +66 lines (ctrl+o to expand)

● Write(app\row-tracker\src\__tests__\featureFlags.test.ts)
  ⎿  Wrote 19 lines to app\row-tracker\src\__tests__\featureFlags.test.ts
       1 import { describe, expect, it } from 'vitest';
       2 
       3 import { isFeederImportEnabled } from '@/services/featureFlags';
       5 describe('isFeederImportEnabled', () => {
       6   it('is on only when the flag is exactly the string "true"', ()
          => {
       7     expect(isFeederImportEnabled({ VITE_ENABLE_FEEDER_IMPORT: 't
         rue' })).toBe(true);
       9 
      10   it('is off when unset (the default)', () => {
     … +14 lines (ctrl+o to expand)

● Now run the build, tests, and linter.

  Ran 1 shell command (ctrl+o to expand)

● The logic works; the failure is the classic vitest "unhandled rejection" from
  mockRejectedValue eagerly creating the rejected promise. Switching to
  mockRejectedValueOnce (created at call time, consumed by the one call):

● Update(app\row-tracker\src\__tests__\changeLogFabric.test.ts)
  ⎿  Added 1 line, removed 1 line
      55    });
      56  
      57    it('reports "saved but not logged" when the log write fails',
           async () => {
      58 -    mocks.create.mockRejectedValue(new Error('GraphQL errors: i
         -nsert failed'));                                               
      58 +    mocks.create.mockRejectedValueOnce(new Error('GraphQL error
         +s: insert failed'));                                           
      59  
      60      const result = await logFeederUpdate(makeRow(), changedAfte
          r, 'ada@coop.test', null);
      61  

  Ran 1 shell command (ctrl+o to expand)

● All 45 tests pass. Now the build and linter:

  Ran 1 shell command (ctrl+o to expand)

● Build error is a TS "weak type" check on my param type. Fix the type (and
  document the flag in vite-env.d.ts):

● Update(app\row-tracker\src\services\featureFlags.ts)
  ⎿  Added 4 lines, removed 1 line
       2  // flag that is unset at build time compiles to a constant `fal
          se` and the gated
       3  // UI is tree-shaken out of the bundle.
       4  
       5 -type FeederImportEnv = { VITE_ENABLE_FEEDER_IMPORT?: unknown };
       5 +// A read-only bag of env values; `import.meta.env` and test fi
         +xtures both                                                    
       6 +// satisfy it. Typed as a record (not a single optional key) so
         + it isn't a weak                                               
       7 +// type that `ImportMetaEnv` fails to match.                   
       8 +type FeederImportEnv = Record<string, unknown>;                
       9  
      10  /**
      11   * The one-time "Import feeders" panel (prompt 09) is OFF by de
          fault. It is only

● Write(app\row-tracker\src\vite-env.d.ts)
  ⎿  Error writing file

  Read 1 file (ctrl+o to expand)

● Update(app\row-tracker\src\vite-env.d.ts)
  ⎿  Added 6 lines
      1  /// <reference types="vite/client" />
      2 +                                                                
      3 +interface ImportMetaEnv {                                       
      4 +  /** Build-time switch for the one-time "Import feeders" panel;
        + off unless                                                     
      5 +   * exactly "true". See src/services/featureFlags.ts. */       
      6 +  readonly VITE_ENABLE_FEEDER_IMPORT?: string;                  
      7 +}                                                               
  Ran 1 shell command (ctrl+o to expand)

● Build passes; lint reports only the pre-existing AuthContext.tsx warning (not
  my files, exit 0). Now let me assemble the append-only proof without running
  any rayfin up/db command. Let me check what generated artifacts already exist
  on disk.

● API Error: Connection closed mid-response. The response above may be 
  incomplete.

✻ Sautéed for 8m 43s

❯ The connection dropped while you were assembling the append-only proof.       
  Continue from there: finish the proof that ChangeLog has no update or delete  
  operations (from the generated client types or schema, no rayfin up or db     
  commands), complete the doc updates, then give me CHECKPOINT 2.               

● I'll pick up from the proof. Let me check what generated artifacts and client
  types exist on disk.

  Read 1 file, ran 1 shell command (ctrl+o to expand)

● The on-disk dab-config.json is stale (pre-dates ChangeLog, and rayfin env
  doesn't regenerate it). Rather than run a forbidden up/db command, I'll
  generate the DAB config offline in-memory from the decorator metadata using
  the core package's own generator. Let me check what the core package exports.

  Read 1 file, ran 1 shell command (ctrl+o to expand)

● The ConfigGenerator needs analyzed entities. Let me see how the analyzer turns
  entity classes (which carry decorator metadata) into that input — ideally
  from the already-registered schema array, in-memory.

  Read 2 files (ctrl+o to expand)

● SchemaAnalyzer(schema).analyzeEntities() → ConfigGenerator.generateConfig(...)
  reads the decorator metadata in-memory (no network) and emits the same DAB
  permissions that drive the GraphQL schema. The client types expose
  .create/.update/.delete on every entity regardless of grants, so they can't
  prove it — the DAB config is the authoritative artifact. I'll capture it as a
  repeatable in-repo test. Let me confirm the dialect enum and that the deep
  imports resolve.

  Ran 1 shell command (ctrl+o to expand)

● Now the proof test — it generates the DAB config in-memory from the real
  decorators and asserts ChangeLog exposes only read/create:

● Write(app\row-tracker\src\__tests__\changeLogPermissions.test.ts)
  ⎿  Wrote 50 lines to
     app\row-tracker\src\__tests__\changeLogPermissions.test.ts
       1 import { describe, expect, it } from 'vitest';
       3 // Proof that the ChangeLog audit trail is append-only. The DAB 
       4 // is generated purely from the entity decorators (Symbol.metada
         ta), in-memory —
         aphQL mutation for
         e config" is
         PI" (the same
       8 // mechanism already observed for create in docs/app-notes.md "D
       9 //
         n every entity
     … +55 lines (ctrl+o to expand)

  Ran 1 shell command (ctrl+o to expand)

● Package exports blocks the deep specifier. Let me see what subpaths the
  package actually exposes.

  Ran 1 shell command (ctrl+o to expand)

● There's a public ./analysis subpath. Let me check its exports.

  Ran 1 shell command (ctrl+o to expand)

● SchemaAnalyzer and ConfigGenerator are exported from the public
  @microsoft/rayfin-core/analysis subpath. Let me fix the imports:

● Update(app\row-tracker\src\__tests__\changeLogPermissions.test.ts)
  ⎿  Added 1 line, removed 2 lines
      10  // The generated client *types* expose .create/.update/.delete 
          on every entity
      11  // regardless of grants, so the type surface cannot prove this 
          — the DAB config
      12  // (which drives the GraphQL schema) is the authoritative artif
          act.
      13 -import { ConfigGenerator } from '@microsoft/rayfin-core/dist/an
         -alysis/dab-config-generator.js';                               
      14 -import { SchemaAnalyzer } from '@microsoft/rayfin-core/dist/ana
         -lysis/schema-analyzer.js';                                     
      13 +import { ConfigGenerator, SchemaAnalyzer } from '@microsoft/ray
         +fin-core/analysis';                                            
      14  
      15  import { schema } from '../../rayfin/data/schema';
      16  

  Ran 1 shell command (ctrl+o to expand)

● The entity files use TC39 Stage-3 decorators, which the test runner's swc
  transform rejects (only the project's tsc build handles them). Let me check
  whether tsc -b emits compiled JS I can import instead of the raw .ts.

  Ran 1 shell command (ctrl+o to expand)

● tsc -b emits decorator-transformed JS to rayfin/.temp/compiled/. I'll point
  the proof at the compiled schema (bypassing the swc transform entirely) and
  confirm it actually produces the config. Let me verify via a quick node run
  first.

  Ran 1 shell command (ctrl+o to expand)

● The real generated DAB config is the proof: ChangeLog → authenticated create
  (policy @claims.email eq @item.changed_by) + read, with no update, delete, or
  *; ClearingPlan unchanged. Let me make the committed test robust: import the
  tsc-compiled schema (decorators already lowered, so no swc issue), silence the
  analyzer log, and normalize the policy-wrapped action.
● Write(app\row-tracker\src\__tests__\changeLogPermissions.test.ts)
  ⎿  Added 32 lines, removed 12 lines
       1  import { describe, expect, it } from 'vitest';
       2  
       3 +import { ConfigGenerator, SchemaAnalyzer } from '@microsoft/ray
         +fin-core/analysis';                                            
       4 +                                                               
       5  // Proof that the ChangeLog audit trail is append-only. The DAB
           permission config
       6  // is generated purely from the entity decorators (Symbol.metad
          ata), in-memory —
       7  // no deploy, no `rayfin up`, no database. DAB only exposes a G
          raphQL mutation for
       8  // an action some role grants, so "no update/delete action in t
          he config" is
       7 -// exactly "no updateChangeLog/deleteChangeLog mutation on the 
         -API" (the same                                                 
       8 -// mechanism already observed for create in docs/app-notes.md "
         -Deployed results").                                            
       9 +// exactly "no updateChangeLog/deleteChangeLog mutation on the 
         +API" — the same                                                
      10 +// mechanism already observed for create in docs/app-notes.md "
         +Deployed results".                                             
      11  //
      12  // The generated client *types* expose .create/.update/.delete 
          on every entity
      11 -// regardless of grants, so the type surface cannot prove this 
         -— the DAB config                                               
      13 +// regardless of grants, so the type surface cannot prove this;
         + the DAB config                                                
      14  // (which drives the GraphQL schema) is the authoritative artif
          act.
      13 -import { ConfigGenerator, SchemaAnalyzer } from '@microsoft/ray
         -fin-core/analysis';                                            
      15 +//                                                             
      16 +// We read the entities from the `tsc`-compiled output rather t
         +han the .ts source                                             
      17 +// because the entity files use TC39 Stage-3 decorators that th
         +e test runner's                                                
      18 +// swc transform does not parse; `tsc -b` (part of `npm run bui
         +ld`) lowers them.                                              
      19 +// Run `npm run build` before the suite — the DoD order — so th
         +is artifact exists.                                            
      20 +import { schema } from '../../rayfin/.temp/compiled/data/schema
         +.js';                                                          
      21  
      15 -import { schema } from '../../rayfin/data/schema';             
      22 +type DabAction = string | { action: string; policy?: { database
         +?: string } };                                                 
      23  
      24  function dabConfig() {
      18 -  const analyzed = new SchemaAnalyzer(schema, 'mssql').analyzeE
         -ntities();                                                     
      25 +  // Silence the analyzer's per-field progress logging in the t
         +est output.                                                    
      26 +  const analyzed = new SchemaAnalyzer(schema, 'mssql', { log: (
         +) => {} }).analyzeEntities();                                  
      27    return new ConfigGenerator('mssql').generateConfig(analyzed);
      28  }
      29  
      22 -/** All actions any role is granted on an entity, flattened. */
      30 +const actionName = (a: DabAction): string => (typeof a === 'str
         +ing' ? a : a.action);                                          
      31 +                                                               
      32 +/** Every action any role is granted on an entity, by name. */ 
      33  function grantedActions(entityName: string): string[] {
      34    const entity = dabConfig().entities[entityName];
      25 -  return entity.permissions.flatMap((p: { actions: string[] }) 
         -=> p.actions);                                                 
      35 +  return entity.permissions.flatMap((p: { actions: DabAction[] 
         +}) =>                                                          
      36 +    p.actions.map(actionName)                                  
      37 +  );                                                           
      38  }
      39  
      40  describe('ChangeLog is append-only (generated DAB config)', () 
          => {
      41    it('exposes only read and create — never update or delete', (
          ) => {
      42      const actions = grantedActions('ChangeLog');
      31 -    expect(actions).toContain('read');                         
      32 -    expect(actions).toContain('create');                       
      43 +    expect(actions.sort()).toEqual(['create', 'read']);        
      44      expect(actions).not.toContain('update');
      45      expect(actions).not.toContain('delete');
      46      expect(actions).not.toContain('*');
     ...
      53      expect(roles).toEqual(['authenticated']);
      54    });
      55  
      56 +  it('pins create to the caller email via a row-level policy', 
         +() => {                                                        
      57 +    const actions = dabConfig().entities.ChangeLog.permissions[
         +0]                                                             
      58 +      .actions as DabAction[];                                 
      59 +    const create = actions.find(                               
      60 +      (a): a is Exclude<DabAction, string> =>                  
      61 +        typeof a !== 'string' && a.action === 'create'         
      62 +    );                                                         
      63 +    expect(create?.policy?.database).toBe('@claims.email eq @it
         +em.changed_by');                                               
      64 +  });                                                          
      65 +                                                               
      66    it('leaves ClearingPlan unchanged (read + update, still no cr
          eate/delete)', () => {
      46 -    const actions = grantedActions('ClearingPlan').sort();     
      47 -    expect(actions).toEqual(['read', 'update']);               
      67 +    expect(grantedActions('ClearingPlan').sort()).toEqual(['rea
         +d', 'update']);                                                
      68    });
      69  });

  Ran 1 shell command (ctrl+o to expand)

● Build's tsc -b type-checks the test and rejects my action type (the
  generator's real type includes a storage-policy union). Runtime is green (49
  passing), but I need to satisfy tsc. I'll coerce the config to a loose local
  shape via as unknown as:

● Update(app\row-tracker\src\__tests__\changeLogPermissions.test.ts)
  ⎿  Added 7 lines, removed 4 lines
      19  // Run `npm run build` before the suite — the DoD order — so th
          is artifact exists.
      20  import { schema } from '../../rayfin/.temp/compiled/data/schema
          .js';
      21  
      22 +// A loose view of the generated DAB config — enough to read pe
         +rmissions without                                              
      23 +// coupling the test to the generator's full (storage-aware) ac
         +tion union.                                                    
      24  type DabAction = string | { action: string; policy?: { database
          ?: string } };
      25 +type DabEntity = { permissions: { role: string; actions: DabAct
         +ion[] }[] };                                                   
      26  
      24 -function dabConfig() {                                         
      27 +function entities(): Record<string, DabEntity> {               
      28    // Silence the analyzer's per-field progress logging in the t
          est output.
      29    const analyzed = new SchemaAnalyzer(schema, 'mssql', { log: (
          ) => {} }).analyzeEntities();
      27 -  return new ConfigGenerator('mssql').generateConfig(analyzed);
      30 +  const cfg = new ConfigGenerator('mssql').generateConfig(analy
         +zed);                                                          
      31 +  return cfg.entities as unknown as Record<string, DabEntity>; 
      32  }
      33  
      34  const actionName = (a: DabAction): string => (typeof a === 'str
          ing' ? a : a.action);
      35  
      36  /** Every action any role is granted on an entity, by name. */
      37  function grantedActions(entityName: string): string[] {
      34 -  const entity = dabConfig().entities[entityName];             
      35 -  return entity.permissions.flatMap((p: { actions: DabAction[] 
         -}) =>                                                          
      38 +  return entities()[entityName].permissions.flatMap((p) =>     
      39      p.actions.map(actionName)
      40    );
      41  }

● Update(app\row-tracker\src\__tests__\changeLogPermissions.test.ts)
  ⎿  Added 6 lines, removed 9 lines
      50    });
      51  
      52    it('grants ChangeLog only to the authenticated role (no anony
          mous access)', () => {
      53 -    const roles = dabConfig().entities.ChangeLog.permissions.ma
         -p(                                                             
      54 -      (p: { role: string }) => p.role                          
      55 -    );                                                         
      53 +    const roles = entities().ChangeLog.permissions.map((p) => p
         +.role);                                                        
      54      expect(roles).toEqual(['authenticated']);
      55    });
      56  
      57    it('pins create to the caller email via a row-level policy', 
          () => {
      60 -    const actions = dabConfig().entities.ChangeLog.permissions[
         -0]                                                             
      61 -      .actions as DabAction[];                                 
      62 -    const create = actions.find(                               
      63 -      (a): a is Exclude<DabAction, string> =>                  
      64 -        typeof a !== 'string' && a.action === 'create'         
      65 -    );                                                         
      58 +    const create = entities()                                  
      59 +      .ChangeLog.permissions[0].actions.find(                  
      60 +        (a): a is Exclude<DabAction, string> =>                
      61 +          typeof a !== 'string' && a.action === 'create'       
      62 +      );                                                       
      63      expect(create?.policy?.database).toBe('@claims.email eq @it
          em.changed_by');
      64    });
      65  

  Ran 1 shell command (ctrl+o to expand)

● All green: build passes, 49/49 tests pass, lint clean (0 errors; the lone
  warning is pre-existing in AuthContext.tsx, which I didn't touch). Now the
  docs. Let me read poc-log.md for format.

  Read 1 file (ctrl+o to expand)

● All checks green. Now the doc updates. First, poc-log.md:

● Update(docs\poc-log.md)
  ⎿  Added 1 line
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
      19 +| 2026-10-28 | R9. Change log / audit trail (prompt 10) | Claud
         +e Code (Opus 4.8); Rayfin SDK/CLI 1.36.2 docs + core analyzer r
         +ead from `node_modules`; no MCP | ~60 | | Part A: answered "who
         + made the change" from the installed docs — a create-policy wit
         +h an `@item` reference is supported (`@authenticated('create', 
         +{ policy: (c,i) => c.email.eq(i.changed_by) })`, compiles to `@
         +claims.email eq @item.changed_by`); confirmed the decorator sur
         +face has no server-set/auto-now timestamp (`default` is a stati
         +c literal only). Planned the `ChangeLog` entity, append-only ru
         +les, write sequence, screens and the import-panel switch (Check
         +point 1). Part B: added `ChangeLog` (read + create-with-policy,
         + no update/delete), the changed-fields diff + log write after e
         +ach verified save, a distinct "saved but not logged" path, Hist
         +ory (per-feeder) and Recent changes (last 20) views, an optiona
         +l Reason field, and gated the Import panel behind build-time `V
         +ITE_ENABLE_FEEDER_IMPORT` (off by default). Proved append-only 
         +by generating the DAB config in-memory from the decorators (no 
         +deploy): `ChangeLog` → `create`+`read` only. 14 new tests; `bui
         +ld`, 49 tests, lint all pass. | | yes | Per Josh's Checkpoint-1
         + changes: did NOT add the `ClearingPlan` update policy (payload
         +-vs-stored-row ambiguity with one user → deferred to prompt 11)
         +; `changed_at` stays client-set (known gap); no 'unknown' fallb
         +ack for `changed_by`. Only fully verifiable on Fabric. Lint war
         +ning in AuthContext.tsx still pre-existing |                   
      20  | 2026-10-16 | R8. Load 153 feeders (prompt 09) | Claude Code (
          Opus 4.8); Rayfin SDK/CLI 1.36.2 client; generator; no MCP | ~5
          5 | | Part A: wrote `08_app_load_export.sql` (ROLE_REPORTER, 9 
          cols, 153 rows) + recommended an in-app Import control over bun
          dling; flagged 2 reconciliation gaps from the repo alone. Gap 1
          : 3 feeders (858-3/658-6/189-6, raw "Q3 2027"/"Spring 2027"/"20
          27?") cleaned to tentative-with-no-date, which the form would s
          kip → fixed the STAGING rule so quarter/season/"year?" → TBD (y
          ear kept); regenerated deterministically (raw plan byte-identic
          al, answer key flips 5 certainty cells only), so report Feeders
           TBD 5→8 and `05` stays green. Gap 2: only 2 of the 15 seed fee
          der_ids (214-1, 328-4) exist in the 153 → 13 leftovers reported
          , not deleted. Part B: built the Import path (own CSV parser, p
          er-row validation reusing the form rules, upsert by feeder_id, 
          full-row read-back incl district, result + reconciliation UI), 
          enabled gated `@authenticated('create')`, 13 new tests; `build`
          , 30 tests, lint all pass. | | yes | Not run against Fabric (Jo
          sh deploys + loads). Found 328-4's real district (Pine Hollow) 
          differs from the seed (Cedar Valley), so the update path overwr
          ites district too. Leftover cleanup is a manual Fabric SQL `DEL
          ETE` (app has no delete permission). Lint warning in AuthContex
          t.tsx still pre-existing |
      21  
      22  ## Observations

● Now decisions.md — append the prompt-10 decisions:

● Update(docs\decisions.md)
  ⎿  Added 6 lines
      41  | 2026-10-16 | Cleaning-rule change (prompt 09): a date cell th
          at is a quarter/season/"year?" (a year known, no recoverable da
          y) now cleans to **TBD** (planned year kept), not **tentative**
          . So **confirmed** and **tentative** always carry a real date. 
          Applied in both `04_staging_clean.sql` certainty branches and `
          data/generate.py`'s answer key; regenerated deterministically (
          raw plan byte-identical, 5 answer-key certainty cells flip: 858
          -3/658-6/189-6 on Next Clearing, 125-3/328-6 on Last Cleared). 
          Report effect: `Feeders TBD` 5→8, `tentative` 4→1; everything e
          lse (Feeders in Plan 153, DQ 69, next-date 143, %Confirmed, Ove
          rdue/Due Soon) unchanged. `05_staging_test` stays at expected/c
          aught 69, missed/extra/mismatched 0. | The report and the app m
          ust agree. The app's edit form requires a date for confirmed/te
          ntative, so these 3 feeders would be skipped on import. Busines
          s logic belongs in Snowflake, not the app — so the rule moves u
          pstream rather than relaxing the form. | Josh (prompt 09) | Cle
          aning SQL, generator, report certainty KPIs, app load |
      42  | 2026-10-16 | App feeder-load approach (prompt 09): an in-app 
          **"Import feeders"** control (file picker) that reads the Snowf
          lake export CSV at runtime and upserts by `feeder_id` (existing
           updated — district included — missing created), chosen over bu
          ndling the CSV into the build. Create is gated with `@authentic
          ated('create')` (enabled in this PR, **off in a follow-up PR** 
          after the load), the same pattern as the seed. Every row is val
          idated with the form's rules before saving; failures are skippe
          d and listed. | Keeps synthetic data out of the committed bundl
          e (the repo forbids committing CSVs), is re-runnable, and reuse
          s the gated-seed pattern. Bundling would commit data and couple
           reloads to a rebuild. | Josh (prompt 09) | `app/row-tracker` i
          mport path, `ClearingPlan` permissions, UI |
      43  | 2026-10-16 | Leftover seed rows (prompt 09): only 2 of the 15
           current seed feeders (214-1, 328-4) are among the 153; the oth
          er 13 are reported by the import, **not deleted**. Removing the
          m is a **one-time manual `DELETE` in the Fabric SQL database qu
          ery editor** (outside the app), run once after the load, becaus
          e the app has no delete permission (and none is added here). Th
          e exact SQL and the 13 ids are in `docs/app-notes.md`. | The ap
          p must not gain delete permission for a one-off cleanup; a dire
          ct database statement is the smallest, auditable way. | Josh (p
          rompt 09) | Deployed `dbo.ClearingPlans`, app-notes |
      44 +| 2026-10-28 | Change log (prompt 10): new **`ChangeLog`** enti
         +ty, one row per saved change (`feeder_id`, `action`, `changed_b
         +y`, `changed_at`, `before_json`, `after_json`, optional `reason
         +`). Permissions are **read + create only — no update, no delete
         + decorator**, so DAB generates no update/delete mutation and th
         +e log is **append-only through the API**. Proven offline: the g
         +enerated DAB config (from the decorators, no deploy) grants `Ch
         +angeLog` only `create`+`read`. | Phase 3 exit test: every edit 
         +produces an audit row no user can alter. | Josh (prompt 10) | `
         +ChangeLog` entity, app DB, permissions |                       
      45 +| 2026-10-28 | "Who made the change" (prompt 10): a **create po
         +licy with an `@item` reference is supported and documented** (g
         +uide `data/permissions.md`). Applied to `ChangeLog` create: `@a
         +uthenticated('create', { policy: (c,i) => c.email.eq(i.changed_
         +by) })`, which compiles to `@claims.email eq @item.changed_by` 
         +— so the browser cannot forge the audit row's author. `changed_
         +by` uses **`claims.email`** (the only non-`sub` claim the deplo
         +yed app receives). | The audit row's "who" must not be client-t
         +rusted; the policy is enforced server-side by DAB. | Josh (prom
         +pt 10) | `ChangeLog` create rule |                             
      46 +| 2026-10-28 | **No `ClearingPlan` update policy in this task**
         + (deferred to the role-rules task, prompt 11). With a single us
         +er we cannot tell whether DAB evaluates an update policy's `@it
         +em` against the submitted payload (what we'd want) or the store
         +d pre-image (which, on the mutable `updated_by`, would lock a u
         +ser out of rows last edited by someone else). The `ChangeLog` c
         +reate policy is unambiguous and stands; `updated_by` remains cl
         +ient-set and **not audit-grade** — the `ChangeLog` is the trust
         +worthy record. | Avoid shipping a policy whose semantics we can
         +'t verify yet; the audit trail doesn't depend on it. | Josh (pr
         +ompt 10) | Deferred to prompt 11; `ClearingPlan` update |      
      47 +| 2026-10-28 | `changed_at` is **set by the browser** (known ga
         +p). The decorator surface has no server-set/auto-now timestamp 
         +— `@date`/`default` only take a static literal (confirmed again
         +st `@microsoft/rayfin-core` `DateFieldOptions`). Recorded next 
         +to the two-writes gap. | No server-stamped time is available wi
         +thout a Rayfin Function. | Agent (prompt 10) — Josh to confirm 
         +| `ChangeLog.changed_at` |                                     
      48 +| 2026-10-28 | Write sequence is **two separate writes** (save 
         +the feeder, then write the log), not one transaction. If the sa
         +ve succeeds but the log write fails — or there is **no email** 
         +to attribute the change to (no `'unknown'` fallback for `change
         +d_by`) — the edit is kept and a distinct **"saved but not logge
         +d"** warning is shown, never hidden. A single server-side trans
         +action needs a Rayfin **Function** (later step). The 153-feeder
         + **import is not logged** (baseline). | Honest failure surface;
         + atomic save+log is out of scope for this slice. | Josh (prompt
         + 10) | Edit-save path, import |                                
      49 +| 2026-10-28 | The **Import feeders** panel is hidden unless th
         +e app is built with **`VITE_ENABLE_FEEDER_IMPORT=true`** (off b
         +y default; Vite inlines the flag so it tree-shakes out). An opt
         +ional **"Reason for change"** field (≤250) was added to the edi
         +t form, logged with the change. | The one-time load panel shoul
         +dn't show in a normal build; a reason makes the audit row more 
         +useful. | Josh (prompt 10) | Home page UI, `ChangeLog.reason` |
      50  
      51  ## R1 profile findings (2026-10-15)
      52  

● Now app-notes.md — add the change-log section and refresh the open questions:

● Update(docs\app-notes.md)
  ⎿  Added 73 lines
      221     plain message; the full error still goes to the browser con
           sole
      222     (`src/services/errors.ts`, `toUserMessage`).
      223  
      224 +## Change log (audit trail, prompt 10)                        
      225 +                                                              
      226 +The second half of Phase 3's exit test — "every edit produces 
          +an audit row" —                                               
      227 +an **append-only** log of who changed what and when, that no u
          +ser can edit or                                               
      228 +delete.                                                       
      229 +                                                              
      230 +### How it works                                              
      231 +                                                              
      232 +| Layer | File(s) | What it does |                            
      233 +|---|---|---|                                                 
      234 +| Entity | `rayfin/data/ChangeLog.ts`, `rayfin/data/schema.ts`
          + | One row per saved change: `feeder_id`, `action`, `changed_b
          +y`, `changed_at`, `before_json`, `after_json`, optional `reaso
          +n`. **read + create only** (see permissions). |               
      235 +| Types | `src/services/changeLogModel.ts` | The logged fields
          +, friendly labels, and the `ChangeLogRow` / `FieldChange` shap
          +es. |                                                         
      236 +| Service | `src/services/changeLog.ts` | `diffFeeder` (change
          +d-fields diff), `buildChangeLogWrite`, `logFeederUpdate` (orch
          +estrates the write), `listFeederHistory`, `listRecentChanges`.
          + In-memory in local mode; typed Rayfin client against Fabric. 
          +|                                                             
      237 +| UI | `src/pages/HomePage.tsx` | A **History** block in each 
          +feeder's edit view (newest first: when, who, field `old → new`
          +, reason) and a **Recent changes** panel (last 20 across all f
          +eeders). An optional **Reason for change** input. Plain React 
          ++ Tailwind; no new library. |                                 
      238 +| Flag | `src/services/featureFlags.ts`, `src/vite-env.d.ts` |
          + `isFeederImportEnabled()` — the Import panel is hidden unless
          + built with `VITE_ENABLE_FEEDER_IMPORT=true`. |               
      239 +                                                              
      240 +**Write sequence.** On save: `updateClearingPlan` saves and re
          +ad-backs the                                                  
      241 +server-verified row (prompt 08). Then `logFeederUpdate(before,
          + saved, …)` diffs                                             
      242 +the two, keeps only the fields that changed (a cleared value r
          +ecorded as                                                    
      243 +`null`), and writes one `ChangeLog` row holding just those fie
          +lds. An unchanged                                             
      244 +save writes nothing.                                          
      245 +                                                              
      246 +**Who is trustworthy.** `changed_by` is the signed-in **email*
          +*, and a create                                               
      247 +policy pins it server-side: `@authenticated('create', { policy
          +: (c,i) =>                                                    
      248 +c.email.eq(i.changed_by) })`, which DAB compiles to           
      249 +`@claims.email eq @item.changed_by`. A row whose `changed_by` 
          +≠ the caller's                                                
      250 +email is rejected by the API — the browser cannot forge the au
          +thor.                                                         
      251 +                                                              
      252 +### Proving it is append-only                                 
      253 +                                                              
      254 +`ChangeLog` carries **no `update` and no `delete` decorator**.
          + DAB only exposes                                             
      255 +a GraphQL mutation for an action some role grants (the same re
          +ason the                                                      
      256 +create-disabled seed earlier failed with "`createClearingPlan`
          + does not exist on                                            
      257 +the type `Mutation`"), so there is no `updateChangeLog` / `del
          +eteChangeLog`                                                 
      258 +operation at all. The generated client *types* expose `.update
          +`/`.delete` on                                                
      259 +every entity regardless of grants, so they can't prove it — th
          +e **DAB config**                                              
      260 +(which drives the GraphQL schema) is the authoritative artifac
          +t.                                                            
      261 +                                                              
      262 +`src/__tests__/changeLogPermissions.test.ts` proves it **offli
          +ne, no deploy**:                                              
      263 +it runs the core `SchemaAnalyzer` + `ConfigGenerator` over the
          + real decorators                                              
      264 +in-memory and asserts `ChangeLog` grants only `create` (with t
          +he email policy) +                                            
      265 +`read`. The generated permissions block:                      
      266 +                                                              
      267 +```json                                                       
      268 +{ "role": "authenticated",                                    
      269 +  "actions": [ { "action": "create",                          
      270 +                 "policy": { "database": "@claims.email eq @it
          +em.changed_by" } },                                           
      271 +               "read" ] }                                     
      272 +```                                                           
      273 +                                                              
      274 +(The test reads the entities from the `tsc`-compiled output un
          +der                                                           
      275 +`rayfin/.temp/compiled/`, because the Stage-3 decorators in `r
          +ayfin/data/*.ts`                                              
      276 +aren't parsed by the test runner's swc transform; run `npm run
          + build` first, as                                             
      277 +the DoD does.)                                                
      278 +                                                              
      279 +### Known gaps                                                
      280 +                                                              
      281 +- **Two writes, not one transaction.** Save and log are separa
          +te API calls. If                                              
      282 +  the save succeeds but the log write fails — or there is **no
          + email** on the                                               
      283 +  session to attribute the change to (no `'unknown'` fallback 
          +for `changed_by`)                                             
      284 +  — the edit is kept and a distinct **"saved but not logged"**
          + warning is shown,                                            
      285 +  never hidden. Making both atomic needs a server-side Rayfin 
          +**Function** on                                               
      286 +  write (same place as the cross-field enforcement in Finding 
          +1).                                                           
      287 +- **`changed_at` is set by the browser.** The decorator surfac
          +e has no                                                      
      288 +  server-set / auto-now timestamp (`default` is a static liter
          +al only). A                                                   
      289 +  server-stamped time also needs a Function.                  
      290 +- **The import is not logged.** The 153-feeder load is the bas
          +eline, not an                                                 
      291 +  edit.                                                       
      292 +- **`ClearingPlan.updated_by` is still client-set** and not au
          +dit-grade. The                                                
      293 +  trustworthy record of who changed a feeder is the `ChangeLog
          +`, not                                                        
      294 +  `updated_by`. Pinning `updated_by` with an update policy was
          + deliberately                                                 
      295 +  deferred (see Open questions / prompt 11).                  
      296 +                                                              
      297  ## Open questions
      298  
      299  - **Entra groups / roles** (Finding 2): the deployed claims pa
           nel shows only

● Now update the Open questions list — audit fields are now addressed; add the
  prompt-11 update-policy question:

● Update(docs\app-notes.md)
  ⎿  Added 13 lines, removed 3 lines
      301    (mapped `role` claim, lookup table, or a Function).
      302  - **Server-side cross-field enforcement** (Finding 1): add a R
           ayfin Function on
      303    write. The read-back guard catches an inconsistent save afte
           r the fact, but
      304 -  the rules are still only enforced client-side.              
      304 +  the rules are still only enforced client-side. The same Func
          +tion would make                                               
      305 +  the feeder save + change-log write atomic and server-stamp `
          +changed_at`.                                                  
      306  - **Clear-to-null on Fabric: resolved.** The client does suppo
           rt clearing via an
      307    explicit `null` (see "Deployed results" above). A Rayfin Fun
           ction is no longer
      308    required for this; it stays on the list only for cross-field
            enforcement.
      308 -- **Audit fields:** replace client-set `updated_by` with a ser
          -ver-stamped value                                             
      309 -  in the change-log step.                                     
      309 +- **`ClearingPlan` update policy (prompt 11 / role rules):** d
          +ecide whether to                                              
      310 +  pin `updated_by` with `@authenticated('update', { policy: (c
          +,i) =>                                                        
      311 +  c.email.eq(i.updated_by) })`. Deferred from prompt 10 becaus
          +e, with one user,                                             
      312 +  we can't tell whether DAB evaluates an update policy's `@ite
          +m` against the                                                
      313 +  submitted payload (what we want) or the stored pre-image (wh
          +ich would lock a                                              
      314 +  user out of rows last edited by someone else). Confirm with 
          +a two-user test                                               
      315 +  after deploy. The `ChangeLog` **create** policy is unambiguo
          +us and already                                                
      316 +  applied.                                                    
      317 +- **Audit fields: addressed** by the change-log step. `ChangeL
          +og.changed_by` is                                             
      318 +  server-pinned to the caller's email. `ClearingPlan.updated_b
          +y` stays client-set                                           
      319 +  (not audit-grade) — the `ChangeLog` is the trustworthy recor
          +d.                                                            

● Let me fix one now-stale sentence in the earlier Permissions section (the
  change-log step added ChangeLog, it didn't replace updated_by):

● Update(docs\app-notes.md)
  ⎿  Added 6 lines, removed 2 lines
      56  are a later step. This is deliberately coarse for the thin slic
          e.
      57  
      58  `updated_by` is set by the client from the signed-in session. I
          t is **not
      59 -audit-grade** — a client controls the value it sends. The chang
         -e-log step will                                                
      60 -replace it with a server-stamped field. `updated_at` is a datet
         -ime (`@date`).                                                 
      59 +audit-grade** — a client controls the value it sends. The chang
         +e-log step                                                     
      60 +(prompt 10) did **not** replace it; instead it added the append
         +-only `ChangeLog`                                              
      61 +whose `changed_by` **is** server-pinned (to `claims.email`), so
         + the trustworthy                                               
      62 +record of who changed a feeder is the `ChangeLog`, not `updated
         +_by`. See                                                      
      63 +"Change log (audit trail, prompt 10)" below. `updated_at` is a 
         +datetime                                                       
      64 +(`@date`).                                                     
      65  
      66  ## How to run it locally (no Fabric)
      67  

● Let me re-run the full gate once more to confirm everything is green after all
  edits, and capture the diff summary.

  Ran 2 shell commands (ctrl+o to expand)

● Everything is green and the work is complete. Here is CHECKPOINT 2.

  What changed

  New ChangeLog entity (append-only audit trail)
  - rayfin/data/ChangeLog.ts — one row per saved change: feeder_id, action,
  changed_by, changed_at, before_json, after_json, optional reason. Permissions:
  read + create only, with a create policy pinning changed_by to the caller's
  email. No update/delete decorator.
  - rayfin/data/schema.ts — registers ChangeLog.

  Services
  - src/services/changeLogModel.ts — logged-field list, labels,
  ChangeLogRow/FieldChange types.
  - src/services/changeLog.ts — diffFeeder (changed-fields diff, cleared →
  null), buildChangeLogWrite, logFeederUpdate (writes after the verified save;
  returns a "saved but not logged" result instead of throwing),
  listFeederHistory, listRecentChanges. In-memory locally, typed Rayfin client
  on Fabric.
  - src/services/featureFlags.ts + src/vite-env.d.ts — isFeederImportEnabled(),
  off unless built with VITE_ENABLE_FEEDER_IMPORT=true.

  UI (src/pages/HomePage.tsx) — History block per feeder (newest first, field
  old → new, reason), Recent changes panel (last 20), optional Reason input,
  "saved but not logged" banner, Import panel now gated by the flag. changed_by
  = email only (no 'unknown' fallback); updated_by unchanged.

  Per your Checkpoint-1 changes: no ClearingPlan update policy added (deferred
  to prompt 11); changed_at stays client-set, recorded as a gap; Reason field
  kept; no 'unknown' fallback for changed_by.

  Check results

  - npm run build ✅ — tsc -b + vite build clean.
  - Tests ✅ — 49 passed (14 new): changed-fields diff, log entry from a save,
  "saved but not logged" (no-email + write-failure), history ordering + recent
  limit, the import-panel switch, and the append-only proof.
  - npm run lint ✅ — 0 errors (the 1 warning in AuthContext.tsx is
  pre-existing, untouched).

  Proof that ChangeLog has no update or delete operations

  DAB only generates a GraphQL mutation for an action some role grants — the
  same mechanism that earlier made the create-disabled seed fail with
  "createClearingPlan does not exist on the type Mutation". The generated client
  types expose .update/.delete on every entity regardless, so the DAB config is
  the authoritative artifact. src/__tests__/changeLogPermissions.test.ts
  generates it offline, no deploy (core SchemaAnalyzer + ConfigGenerator over
  the real decorators) and asserts the grant is exactly:

  { "role": "authenticated",
    "actions": [ { "action": "create",
                   "policy": { "database": "@claims.email eq @item.changed_by" }
  },
                 "read" ] }

  No update, no delete, no *; ClearingPlan stays read+update.

  Your steps to verify after deploy

  1. Edit shows in History + Recent changes — edit a feeder; the edit view's
  History and the home Recent panel show the change (when, you, field old→new,
  reason) newest first.
  2. SQL in the Fabric SQL database — SELECT feeder_id, action, changed_by, 
  changed_at, before_json, after_json, reason FROM dbo.ChangeLogs ORDER BY 
  changed_at DESC; shows the row.
  3. Who-field matches you — changed_by equals your signed-in email (the create
  policy enforces it server-side; a forged value is rejected).
  4. (Optional) Confirm append-only on the live API: there is no
  updateChangeLog/deleteChangeLog mutation.

  Proposed commits (you commit; I never push)

  1 — Append-only change log
  git add app/row-tracker/rayfin/data/ChangeLog.ts \
          app/row-tracker/rayfin/data/schema.ts \
          app/row-tracker/src/services/changeLog.ts \
          app/row-tracker/src/services/changeLogModel.ts \
          app/row-tracker/src/services/featureFlags.ts \
          app/row-tracker/src/vite-env.d.ts \
          app/row-tracker/src/pages/HomePage.tsx \
          app/row-tracker/src/__tests__/changeLog.test.ts \
          app/row-tracker/src/__tests__/changeLogFabric.test.ts \
          app/row-tracker/src/__tests__/changeLogPermissions.test.ts \
          app/row-tracker/src/__tests__/featureFlags.test.ts
  Message: feat(app): append-only change log (audit trail) for row-tracker

  2 — Docs
  git add docs/app-notes.md docs/decisions.md docs/poc-log.md
  Message: docs: record the change-log slice (prompt 10)

  3 — Prompt record
  git add prompts/10_change_log.md
  Message: docs(prompts): add prompt 10 (change log)

  Known gaps (all recorded in docs/app-notes.md): save+log aren't one
  transaction, changed_at is browser-set, the 153-feeder import isn't logged,
  and updated_by stays client-set — all awaiting a Rayfin Function / the
  prompt-11 role rules.

  One note for your awareness: the append-only proof test reads the tsc-compiled
  entities under rayfin/.temp/compiled/ (the Stage-3 decorators in
  rayfin/data/*.ts aren't parsed by the test runner's swc transform), so it
  relies on npm run build having run first — the normal DoD order. Flag me if
  you'd prefer a different arrangement.

✻ Churned for 6m 57s

❯ Approved. Make the three commits as proposed, without asking between them.    
  Don't push. Then show me git log -4 --oneline.                                

  Committed d77a24a, d0c8f56, 260a590 (ctrl+o to expand)

● All three commits are in on feat/change-log, nothing pushed:

  260a590 docs(prompts): add prompt 10 (change log)
  d0c8f56 docs: record the change-log slice (prompt 10)
  d77a24a feat(app): append-only change log (audit trail) for row-tracker
  f3a2eb0 Remove create permission after loading the 153 feeders (#22)

  Working tree is clean. The LF→CRLF warnings are just Git's line-ending
  normalization notices (the repo stores LF); nothing was altered in the
  commits. Whenever you're ready, you push and open the PR.

✻ Worked for 13s