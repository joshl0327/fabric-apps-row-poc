 ▐▛███▜▌   Claude Code v2.1.181
▝▜█████▛▘  Opus 4.8 · Claude Pro
  ▘▘ ▝▝    C:\dev\fabric-apps-row-poc

 ▎ Meet Fable 5, our newest model for complex, long-running work. Switch anytime with /model.

❯ /clear                                                                        

❯ Follow prompts/09_load_153_feeders.md                                         

● I'll start by reading the prompt file that defines this task.

  Read 1 file (ctrl+o to expand)

● This is a Part A (planning) task. Let me read the required docs first, as the
  prompt instructs.

  Read 4 files (ctrl+o to expand)

● Now let me examine the app's current structure — entity, model, validation,
  seed, and services.

  Read 5 files (ctrl+o to expand)

● Let me look at the UI, the rayfin client, existing Snowflake scripts (to write
  export SQL correctly), and the test setup.

  Searched for 2 patterns, read 2 files (ctrl+o to expand)

● No project tests found yet under src. Let me check the test setup and read the
  ANALYTICS views SQL (to write the export correctly).

  Searched for 1 pattern, read 2 files (ctrl+o to expand)

● I now have everything I need. This is Part A (plan only) — the one file the
  prompt tells me to write is the export SQL. Let me verify a couple of facts
  before writing: whether the current seed feeder IDs overlap the real 153
  (affects the "report, don't delete" note) and that data/out/ is gitignored.

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

● Confirmed: the 153 feeder IDs come from a random substation sample, so the 15
  hand-picked seed IDs (101-1, 118-2, …) almost certainly won't all be among
  them. That's the key thing to flag at the checkpoint.

  Now let me write the one file Part A calls for — the export SQL.

● Write(snowflake\08_app_load_export.sql)
  ⎿  Wrote 47 lines to snowflake\08_app_load_export.sql
       1 -- =============================================================
       2 -- Fabric Apps POC - export the 153 clean feeders for the app lo
       3 -- Run in a Snowsight worksheet as ROLE_REPORTER, the same role 
       4 -- Produces exactly the columns the app's ClearingPlan entity ne
       5 -- per feeder, ordered by feeder_id. Download the result grid as
          a CSV into
         ads it.
       8 -- Reads ANALYTICS only (the clean star schema), so it carries t
       9 -- the report shows. No STAGING, no RAW. Read-only: no objects a
      10 --
     … +60 lines (ctrl+o to expand)

● I've written the export SQL. Here's the complete Part A plan. No app code
  changed; the only file I created is snowflake/08_app_load_export.sql.

  ---
  1. Export SQL — snowflake/08_app_load_export.sql

  One SELECT, run as ROLE_REPORTER, reading ANALYTICS only, ordered by
  feeder_id:

  SELECT
    p.feeder_id,
    d.district_name,
    v.vendor_name                               AS vendor,
    TO_CHAR(p.last_cleared_date,  'YYYY-MM-DD') AS last_cleared_date,
    p.last_work_done,
    TO_CHAR(p.next_clearing_date, 'YYYY-MM-DD') AS next_clearing_date,
    p.date_certainty,
    p.planned_year,
    p.notes
  FROM ROW_DB.ANALYTICS.FACT_ROW_PLAN p
  JOIN ROW_DB.ANALYTICS.DIM_CIRCUIT  c ON c.feeder_id   = p.feeder_id
  JOIN ROW_DB.ANALYTICS.DIM_DISTRICT d ON d.district_id =
  c.responsible_district_id
  JOIN ROW_DB.ANALYTICS.DIM_VENDOR   v ON v.vendor_id   = p.vendor_id
  ORDER BY p.feeder_id;

  Design notes:
  - Exactly the 9 target columns, in entity order. vendor is the canonical name;
  vendor_id 0 resolves to the "Unassigned" DIM_VENDOR member, so no-vendor
  feeders arrive as "Unassigned" — matching the entity's @set and the report.
  - Inner joins are safe: R1 profiling proved 0 plan rows without a circuit and
  0 without a vendor, so all 153 come through and no key is null.
  - Dates forced to ISO text (TO_CHAR … 'YYYY-MM-DD') so the CSV is
  locale-independent and the parser I'll write in Part B can rely on the format.
  planned_year stays numeric.
  - district_name comes from DIM_DISTRICT (the report's chosen source per the
  2026-10-15 decision; names always agree with DIM_CIRCUIT).

  2. How the CSV gets into the deployed app — recommendation

  Data in published bundle
  (a) In-app "Import feeders" control: No — file picked at runtime, never
    committed
  (b) Bundle CSV into the build: Yes — and committing a CSV is a "Do not" in
  this
     prompt; it'd have to become a committed .ts to dodge that, which is the
  same
     data in the repo
  ────────────────────────────────────────
  Re-runnability
  (a) In-app "Import feeders" control: Re-pick the file anytime; upsert by
    feeder_id
  (b) Bundle CSV into the build: Fixed at build; a reload means rebuild +
    redeploy
  ────────────────────────────────────────
  Effort
  (a) In-app "Import feeders" control: Modest: a small hand-written CSV parser +

    an import panel, reusing the existing gated-seed pattern
  (b) Bundle CSV into the build: Low code, but violates the commit rule and
    couples data to deploys
  ────────────────────────────────────────
  Fits existing pattern
  (a) In-app "Import feeders" control: Yes — same gate as "Load sample data"
    (shown only while create is on)
  (b) Bundle CSV into the build: No

  Recommendation: (a), the in-app "Import feeders" control. It keeps synthetic
  data out of the committed bundle (honoring "don't commit any CSV"), is
  re-runnable by design, and reuses the create-gated seed pattern already in the
  app. One change from the seed button: show it whenever create is enabled, not
  only when the table is empty — this is a migration/upsert, not a first-time
  seed.

  3. What the deploy will change

  - Permissions: uncomment @authenticated('create') on ClearingPlan (same gated
  toggle as the seed; a follow-up PR switches it back off after the load). No
  other permission change — no delete.
  - Schema: none. All 9 columns map to existing entity fields; no field added,
  renamed, or retyped.
  - UI: the empty-state "Load sample data" button is replaced/joined by an
  "Import feeders" file-picker + result panel, shown only when create is
  allowed. updated_by set from the session as today.

  4. Reconciliation counts the app will show after a load, and where

  Shown in the import result panel on HomePage, right after the run:
  - Created / Updated / Skipped (with each skipped row's feeder_id + reason).
  - Total feeders in source = 153.
  - Certainty mix: confirmed 142, tentative 4, next year 2, TBD 5.
  - Feeders with a next clearing date = 143.
  - Rows present in the app but not in the source — listed, not deleted (no
  delete permission).

  ---
  ⚠️ One thing I'm unsure about — needs your call

  The 15 current rows use hand-picked feeder IDs (101-1, 118-2, 203-1, …). The
  real 153 come from a random substation sample in data/generate.py, so those
  seed IDs are very unlikely to all exist in the 153. On load, any current row
  whose feeder_id isn't in the source gets reported, not deleted (per the
  rules).

  Consequence: right after the load the deployed table will likely hold more 
  than 153 rows — the 153 clean feeders plus whatever seed rows didn't match —
  until you remove the leftovers by hand (no delete permission in this PR).

  How do you want to handle that?

● User answered Claude's questions:
  ⎿  · After the load, non-matching seed rows can't be deleted by the app (no 
     delete permission). How should the plan handle the leftover rows so the app
     reconciles to exactly 153? → Report only, you clean up

● Noted — report only, you clean up: the app lists the non-matching feeder IDs
  in the result panel, you remove them yourself, and this PR stays delete-free.
  That's consistent with the "no delete permission" rule. I'll record it in
  docs/decisions.md as part of Part B.

  ---
  CHECKPOINT 1 — stopping for your approval

  Delivered (Part A):
  - snowflake/08_app_load_export.sql written — one ROLE_REPORTER SELECT over
  ANALYTICS, exactly the 9 target columns, ISO dates, ordered by feeder_id, 153
  rows expected.
  - Recommendation: in-app "Import feeders" control (option a), shown whenever
  create is enabled — keeps synthetic data out of the bundle, re-runnable,
  upsert by feeder_id.
  - Deploy changes: enable @authenticated('create') (gated, off again in a
  follow-up PR); no schema change; swap the empty-state seed button for an
  import file-picker + result panel.
  - Reconciliation (in the result panel): created/updated/skipped, 153 source
  rows, certainty 142/4/2/5, next-date 143, plus non-matching rows reported.
  - Open item resolved: leftover seed rows → reported, not deleted; you clean
  up.

  No app code, docs, or powerbi/ touched. To verify the SQL now, you can run it
  in Snowsight as ROLE_REPORTER and confirm 153 rows with the expected certainty
  mix.

  I'll wait here. Once you approve, I'll start Part B (build the import path,
  flip the create gate, write the tests, update the three docs) and stop again
  at CHECKPOINT 2 with the diff, check results, your exact steps, and the
  proposed commits. Nothing is committed and nothing deploys without your
  go-ahead.

✻ Cooked for 2m 20s

❯ Approved, with two things to settle before Part B:                            
  1. The counts don't reconcile with the app's rules: confirmed + tentative =   
  146, but only 143 feeders have a next clearing date, so about 3 rows are      
  confirmed/tentative with no date and the import would skip them. From the     
  repo only (generator code or data/out, cleaning SQL, answer key logic; no     
  Snowflake access), identify which feeders these are, what their raw           
  spreadsheet values were, and which cleaning rule produced them. Propose the   
  fix. I expect a change to the STAGING cleaning rule in Snowflake (e.g.        
  confirmed/tentative with no date becomes TBD) so the report and the app       
  agree, but show me the options and their effect on the report's counts.       
  2. Check whether the 15 seed feeder_ids exist in the 153 (from the            
  generator's circuit data). Tell me how many would be left over.               
  Stop again after these two with your recommendation.                          

● Both are repo-only investigations. Let me gather the raw material: the
  generated data (if present on disk), the cleaning SQL, and the answer-key/test
  logic.

  Read 1 file, listed 1 directory (ctrl+o to expand)
● The cleaning logic is clear: a Next Clearing cell that's text containing a 
  year but no parseable date (quarter/season/"2027?") → tentative with no date
  (the date CASE only recovers parseable formats or the d - TBD pattern). Those
  are the confirmed/tentative-without-date rows. Let me identify the specific
  feeders from the regenerated data on disk.

  Ran 1 shell command (ctrl+o to expand)

● There's a row_clearing_plan.csv landing file and an answer_key.csv with
  expected_date_certainty/expected_planned_year. Let me pull the
  tentative/confirmed-without-date rows directly from the answer key, and the
  raw Next Clearing cells.

  Read 1 file (ctrl+o to expand)

● Found it. The 3 rows are 858-3 (Q3 2027), 658-6 (Spring 2027), 189-6 (2027?) —
  all hit the "quarter / season / year?" branch → tentative, planned year 2027,
  no recoverable date. (704-2 10/20/2027 - TBD is also tentative but keeps a
  recovered date, so it imports fine.) No confirmed row lacks a date.

  Now task 2 — check the 15 seed feeder IDs against the real circuit list.

  Ran 1 shell command (ctrl+o to expand)

● Findings

  1. The 3 confirmed/tentative-without-date feeders

  Exactly 3 rows (no confirmed row lacks a date — all 142 confirmed come from
  real/parseable date cells):

  ┌────────┬────────────────┬─────────────────────┬────────────────────────┐
  │ Feeder │   Raw "Next    │     Cleaned to      │  Cleaning rule that    │
  │        │ Clearing" cell │                     │      produced it       │
  ├────────┼────────────────┼─────────────────────┼────────────────────────┤
  │ 858-3  │ Q3 2027        │ tentative, planned  │ quarter →              │
  │        │                │ year 2027, no date  │ tentative-with-year    │
  ├────────┼────────────────┼─────────────────────┼────────────────────────┤
  │ 658-6  │ Spring 2027    │ tentative, planned  │ season →               │
  │        │                │ year 2027, no date  │ tentative-with-year    │
  ├────────┼────────────────┼─────────────────────┼────────────────────────┤
  │ 189-6  │ 2027?          │ tentative, planned  │ "year?" →              │
  │        │                │ year 2027, no date  │ tentative-with-year    │
  └────────┴────────────────┴─────────────────────┴────────────────────────┘

  All three hit the same branch in STG_PLAN_RESOLVED.next_clearing_certainty:
  WHEN REGEXP_SUBSTR(raw, '(19|20)[0-9]{2}') IS NOT NULL THEN 'tentative' —
  while the date CASE returns NULL (no parseable date, not the d - TBD pattern).
  This is the documented "Quarter / season / 'year?' → tentative, keep planned
  year" rule in docs/cleaning-rules.md.

  (The 4th tentative, 704-2 10/20/2027 - TBD, keeps a recovered date 2027-10-20,
  so it imports fine. That's why tentative = 4 but only 143 of 146
  confirmed+tentative carry a date.)

  Root cause of the disagreement: Snowflake's "tentative" means "a date or year
  we're unsure of" and legitimately allows no date; the app's cross-field rule
  demands a date for both confirmed and tentative. So these 3 would be skipped
  on import.

  2. The 15 seed feeder IDs vs the real 153

  Only 2 of the 15 exist in the 153: 214-1 and 328-4 (updated on load). The
  other 13 (101-1, 118-2, 203-1, 227-3, 245-2, 316-1, 402-2, 417-1, 533-1, 
  548-3, 619-2, 701-1, 742-2) are not in the 153.

  So a clean load = 2 updated + 151 created, leaving 13 leftover rows
  reported-not-deleted → the table holds 166 rows until you remove the 13 by
  hand (your "report only, you clean up" choice).

  ---
  Fix options for the 3 feeders (report-count effect)

  Baseline today: confirmed 142 / tentative 4 / next year 2 / TBD 5; next-date
  143; %Confirmed 92.8%.

  Option: 1. tentative-no-date → TBD (recommended; your "e.g.")
  Where: STAGING next_clearing_certainty: the year-only branch yields TBD
  Resulting mix: confirmed 142 / tentative 1 / next year 2 / TBD 8
  Report numbers that move: Only Feeders TBD 5→8. %Confirmed, next-date 143,
    Overdue, Due Soon, Next Year all unchanged (these 3 never had a date, so no
    date-based measure counted them)
  Trade-off: "tentative" now consistently means "a soft date we recovered"
    (704-2). Honest, minimal report disturbance, app + report agree with zero
    import skips.
  ────────────────────────────────────────
  Option: 2. → next year
  Where: STAGING: year-only branch yields next year
  Resulting mix: confirmed 142 / tentative 1 / next year 5 / TBD 5
  Report numbers that move: Only Feeders Next Year 2→5
  Trade-off: All three happen to be 2027 (= as-of +1), and the app already
  models
    "known year, no date" as next year. But it mislabels Q3/Spring/2027? as the
    literal "Next Year" category, muddying the DQ story, and is fragile if the
    as-of year changes.
  ────────────────────────────────────────
  Option: 3. relax the app (tentative may have no date)
  Where: app validation.ts only
  Resulting mix: no change
  Report numbers that move: none
  Trade-off: Rejected: pushes business logic into app code (against AGENTS.md
    "logic lives in Snowflake/model"), diverges the form from cleaning-rules.md,

    and lets a user save a tentative row with no date.

  Sub-choice under Option 1: keep planned_year = 2027 on the now-TBD rows (I'd
  keep it — it's real info, the app's TBD rule permits a planned year, and no
  report measure keys on planned_year), or null it to match the blank/"per
  vendor" TBDs. I recommend keeping it.

  My recommendation

  - Option 1, keep planned year: edit the year-only branch of
  next_clearing_certainty in snowflake/04_staging_clean.sql (and update the
  matching line in docs/cleaning-rules.md + the expected mix in
  docs/measures.md). Only Feeders TBD moves, 5→8. You re-run 04 and 06 in
  Snowsight, re-export, and all 153 import with 0 skips.
  - Leftovers: 13 reported-not-deleted; you prune them. Final 153 after cleanup.

  ---
  Two things to confirm before I start Part B:

● User answered Claude's questions:
  ⎿  · How should the 3 tentative-without-date feeders (858-3, 658-6, 189-6) be 
     reconciled so the report and the app agree? → Opt 1: → TBD, keep year
     · Does Part B include editing the Snowflake STAGING cleaning SQL 
     (04_staging_clean.sql) and the affected docs, or only the app load path? → 
     Include the STAGING fix

● Decisions noted: Option 1 → TBD, keep planned year, and Part B includes the 
  STAGING fix. Before I build, one dependency I need to verify — the STAGING
  cleaning rule is validated against an answer key (05_staging_test.sql /
  data/generate.py). Changing the rule may cascade into the generator and the
  test. Let me check the blast radius.

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

● This is the cascade I needed to confirm. The staging test
  (05_staging_test.sql) compares STG_DQ_ISSUES.date_certainty against the answer
  key, and the generator plants these exact values as tentative:

  data/generate.py:184   (f"Q3 {year}",            "tentative", year),
  data/generate.py:185   (f"Spring {year}",        "tentative", year),
  data/generate.py:186   (f"{year}?",              "tentative", year),
  data/generate.py:187   (f"10/20/{year} - TBD",   "tentative", year),   # keeps
  its date

  So editing only 04_staging_clean.sql → TBD makes 05_staging_test report
  mismatched = 3 (answer key still says tentative). Keeping the test green means
  also flipping lines 184–186 to "TBD", regenerating data/out, and reloading 
  RAW (scripts 01–03, human-run in Snowsight) — a bigger Snowflake operation
  than the "edit 04 + two docs" I scoped in the question. Let me check whether
  the generator is seeded (deterministic), which decides how safe that regen is.

  Ran 1 shell command (ctrl+o to expand)

● Good — the generator is deterministic (--seed 42, fixed --as-of), and lines
  184–186 only set the expected certainty label, not the raw cell text. So
  flipping them "tentative"→"TBD" and regenerating with the same seed produces
  byte-identical CSVs except the 3 certainty cells in answer_key.csv: no feeder
  IDs move, the raw spreadsheet is unchanged, and the only report shift is the
  designed Feeders TBD 5→8.

  Revised Part B scope — the STAGING fix is bigger than the 3 files I quoted

  To make the report and app agree and keep the staging test green, the
  certainty fix touches the whole cleaning pipeline, not just 04:

  File: data/generate.py (184–186)
  Change: "tentative"→"TBD", keep year
  Who runs it: — (code)
  ────────────────────────────────────────
  File: snowflake/04_staging_clean.sql
  Change: year-only branch of next_clearing_certainty → 'TBD' (date CASE already

    null; planned-year CASE already keeps 2027)
  Who runs it: you, in Snowsight
  ────────────────────────────────────────
  File: docs/cleaning-rules.md
  Change: "Quarter / season / 'year?'" row → TBD, keep planned year
  Who runs it: —
  ────────────────────────────────────────
  File: docs/measures.md
  Change: certainty mix → confirmed 142 / tentative 1 / next year 2 / TBD 8;
    Feeders TBD checked result 5→8
  Who runs it: —
  ────────────────────────────────────────
  File: data/out/*
  Change: regenerate (deterministic)
  Who runs it: you: python data/generate.py
  ────────────────────────────────────────
  File: RAW + rebuild
  Change: reload RAW then rerun 04, 05, 06
  Who runs it: you, in Snowsight

  If I edit only 04 and not the generator, 05_staging_test.sql goes from
  mismatched 0 to mismatched 3 (answer key still says tentative) — a permanently
  red test. I don't recommend leaving that.

  My recommendation

  Do the full, consistent path (Path 2 above). It's deterministic, keeps 05
  green at expected 69 / caught 69 / missed 0 / extra 0 / mismatched 0, and the
  only moving report number is Feeders TBD 5→8. Your added Snowflake steps:
  regen data/out → reload RAW (03) → rerun 04/05/06 → re-export via 08 → then
  the app load.

  Your exact end-to-end sequence would be:

  1. Data/cleaning fix (local + Snowsight): I edit generate.py + 04 + the two
  docs; you run python data/generate.py, then in Snowsight reload RAW and rerun
  04 → 05 (confirm all-zero deltas) → 06.
  2. Export: run 08_app_load_export.sql as ROLE_REPORTER, download CSV to
  data/out/ → 153 rows, now with 0 confirmed/tentative-without-date.
  3. App load: merge → you deploy with create enabled → import the CSV (2
  updated, 151 created, 0 skipped) → you prune the 13 leftover seed rows →
  follow-up PR switches create off → deploy.

  ---
  This expands the Snowflake work beyond the "04 + 2 docs" I described when you 
  picked "Include the STAGING fix," so I'm stopping here rather than building.
  Confirm you want me to:

  - include data/generate.py in this PR's changes (the deterministic regen + RAW
  reload being your steps), and
  - proceed to build everything in Part B (STAGING fix + app import path +
  create gate + tests + the four doc updates),

  and I'll go, stopping next at CHECKPOINT 2.

✻ Sautéed for 4m 16s

❯ Approved: include data/generate.py and proceed with Part B. Three additions:  
  1. Propose separate commits: (a) generator + 04 cleaning rule +               
  cleaning-rules.md + measures.md, (b) export SQL 08, (c) app import path +     
  create gate + tests, (d) app-notes, decisions, poc-log.                       
  2. In my steps, add the Power BI refresh after rerunning 06, and what I       
  should see in the report afterwards (TBD 8, tentative 1, everything else      
  unchanged).                                                                   
  3. For the 13 leftover seed rows: in app-notes, give me the exact SQL to      
  delete them in the Fabric SQL database query editor (by feeder_id, listed     
  explicitly), and record in decisions.md that this one-time cleanup is a       
  manual database step outside the app, done once, because the app has no       
  delete permission.                                                            

● Proceeding with Part B. Let me read the generator's damage logic to scope the
  04 change precisely (next-clearing only vs. both date columns), then make the
  edits.

  Read 1 file (ctrl+o to expand)

● The nondate_values list is shared by both date columns. Let me confirm how the
  cycle is scoped (per-column or shared) so I change exactly the right branches
  in 04.

  Read 1 file, ran 1 shell command (ctrl+o to expand)

● Confirmed: both date columns carry Q3/Spring/year? entries (Next Clearing:
  858-3, 658-6, 189-6; Last Cleared: 125-3, 328-6). The generator list is
  shared, so flipping it and 04 must cover both certainty branches to keep 05
  green. Only Next Clearing feeds the report's date_certainty, so report-wise
  only Feeders TBD 5→8 moves; the two Last Cleared flips are DQ-detail only.

  Let me make the edits. Commit (a): generator + cleaning rule + docs.

  Read 1 file (ctrl+o to expand)

● Update(data\generate.py)
  ⎿  Added 8 lines, removed 3 lines
      181          ("Next Year", "next year", year),
      182          ("TBD", "TBD", ""),
      183          ("per vendor", "TBD", ""),
      184 -        (f"Q3 {year}", "tentative", year),                    
      185 -        (f"Spring {year}", "tentative", year),                
      186 -        (f"{year}?", "tentative", year),                      
      184 +        # Quarter / season / "year?": a year is known but no e
          +xact date. Cleaned                                            
      185 +        # to TBD (not tentative) so "tentative" always carries
          + a real date — the                                            
      186 +        # app's edit form requires a date for confirmed/tentat
          +ive, and the report                                           
      187 +        # and app must agree. The planned year is still recove
          +red. See                                                      
      188 +        # docs/cleaning-rules.md and docs/decisions.md (2026-1
          +0-16).                                                        
      189 +        (f"Q3 {year}", "TBD", year),                          
      190 +        (f"Spring {year}", "TBD", year),                      
      191 +        (f"{year}?", "TBD", year),                            
      192          (f"10/20/{year} - TBD", "tentative", year),  # embedde
           d date, still tentative
      193      ]
      194  

● Now 04_staging_clean.sql — both year-only certainty branches:

● Update(snowflake\04_staging_clean.sql)
  ⎿  Added 4 lines, removed 1 line
      218        TRY_TO_DATE(TRIM(raw_last_cleared), 'MM/DD/YY')) IS NOT 
           NULL THEN 'confirmed'
      219      WHEN TRY_TO_DATE(REGEXP_SUBSTR(TRIM(raw_last_cleared), '^[
           0-9]{1,2}/[0-9]{1,2}/[0-9]{4}'), 'MM/DD/YYYY') IS NOT NULL THE
           N 'tentative'
      220      WHEN LOWER(TRIM(raw_last_cleared)) LIKE '%next year%' THEN
            'next year'
      221 -    WHEN REGEXP_SUBSTR(TRIM(raw_last_cleared), '(19|20)[0-9]{2
          -}') IS NOT NULL THEN 'tentative'                              
      221 +    -- A year with no recoverable date (quarter/season/"year?"
          +) -> TBD, not                                                 
      222 +    -- tentative, so "tentative" always carries a real date. T
          +he planned year is                                            
      223 +    -- still kept below. See docs/cleaning-rules.md + docs/dec
          +isions.md.                                                    
      224 +    WHEN REGEXP_SUBSTR(TRIM(raw_last_cleared), '(19|20)[0-9]{2
          +}') IS NOT NULL THEN 'TBD'                                    
      225      ELSE 'TBD'
      226    END AS last_cleared_certainty,
      227    CASE

● Update(snowflake\04_staging_clean.sql)
  ⎿  Added 5 lines, removed 1 line
      275        TRY_TO_DATE(TRIM(raw_next_clearing), 'MM/DD/YY')) IS NOT
            NULL THEN 'confirmed'
      276      WHEN TRY_TO_DATE(REGEXP_SUBSTR(TRIM(raw_next_clearing), '^
           [0-9]{1,2}/[0-9]{1,2}/[0-9]{4}'), 'MM/DD/YYYY') IS NOT NULL TH
           EN 'tentative'
      277      WHEN LOWER(TRIM(raw_next_clearing)) LIKE '%next year%' THE
           N 'next year'
      278 -    WHEN REGEXP_SUBSTR(TRIM(raw_next_clearing), '(19|20)[0-9]{
          -2}') IS NOT NULL THEN 'tentative'                             
      278 +    -- A year with no recoverable date (quarter/season/"year?"
          +) -> TBD, not                                                 
      279 +    -- tentative, so "tentative" always carries a real date (t
          +he app's form                                                 
      280 +    -- requires a date for confirmed/tentative). The planned y
          +ear is still kept                                             
      281 +    -- below. See docs/cleaning-rules.md + docs/decisions.md. 
      282 +    WHEN REGEXP_SUBSTR(TRIM(raw_next_clearing), '(19|20)[0-9]{
          +2}') IS NOT NULL THEN 'TBD'                                   
      283      ELSE 'TBD'
      284    END AS next_clearing_certainty,
      285    CASE
● Update the rule-summary comment in 04:

● Update(snowflake\04_staging_clean.sql)
  ⎿  Added 1 line, removed 1 line
      150  --      text, parseable  -> that date, confirmed            (d
           ate_format)
      151  --      text, "d - TBD"  -> recovered date, tentative       (n
           on_date)
      152  --      text, "Next Year"-> no date, next year, planned = as-o
           f year + 1
      153 ---      text w/ a year   -> no date, tentative, that year   (q
          -uarter/season/"?")                                            
      153 +--      text w/ a year   -> no date, TBD, that year kept    (q
          +uarter/season/"?")                                            
      154  --      anything else    -> no date, TBD                    (n
           on_date)
      155  -- -----------------------------------------------------------
           ----------
      156  CREATE OR REPLACE VIEW ROW_DB.STAGING.STG_PLAN_RESOLVED AS

● Now docs/cleaning-rules.md — the quarter/season row:

● Update(docs\cleaning-rules.md)
  ⎿  Added 1 line, removed 1 line
      14  | **Feeder not in the circuit list** | Can't be matched to a re
          al circuit — left out of the clean plan and sent to review. | `
          765-3` (no such circuit) → review |
      15  | **Real date typed as text** | Read the date; mark it **confir
          med**. | `2024-05-09`, `12-19-2028 ` → `2028-12-19` |
      16  | **"Next Year"** | Next year relative to the as-of date; mark 
          **next year**, no exact date yet. | `Next Year` → planned year 
          **2027** |
      17 -| **Quarter / season / "year?"** | No exact date; mark **tentat
         -ive** and keep the planned year. | `Q3 2027`, `Spring 2027`, `2
         -027?` → tentative, year **2027** |                             
      17 +| **Quarter / season / "year?"** | A year is known but no exact
         + date; mark **TBD** and keep the planned year. (Was tentative; 
         +changed so **tentative** always carries a real date, matching t
         +he app's form rule — see `docs/decisions.md`, 2026-10-16.) | `Q
         +3 2027`, `Spring 2027`, `2027?` → TBD, year **2027** |         
      18  | **Date with a "TBD" note** | Recover the date but mark it **t
          entative** (not yet firm). | `10/20/2027 - TBD` → `2027-10-20`,
           tentative |
      19  | **Blank / "per vendor" / other text** | No date; mark **TBD**
          . | `per vendor`, `TBD`, *(blank)* → TBD |
      20  | **Last Cleared text** | Keep a real date if one can be read; 
          otherwise leave it empty. | `Q3 2027` → *(empty)* · `2024-01-29
          ` → `2024-01-29` |

● Update(docs\cleaning-rules.md)
  ⎿  Added 5 lines, removed 2 lines
      23  | **Vendor we can't match** | Left null and sent to review (nev
          er guessed). | *(unrecognized)* → review |
      24  | **Blank vendor** | Left empty in STAGING and logged as a data
           quality issue. (The ANALYTICS `DIM_VENDOR` later labels these 
          feeders "Unassigned" for the report — see `docs/data-model.md`.
          ) | *(blank)* → *(empty)* → report shows **Unassigned** |
      25  
      26 -**Date certainty** is one of: `confirmed` (a real date), `tenta
         -tive` (a date or                                               
      27 -year we're not sure of), `next year`, or `TBD` (unknown).      
      26 +**Date certainty** is one of: `confirmed` (a real date), `tenta
         +tive` (a real                                                  
      27 +date we're not fully sure of, e.g. a date carrying a "TBD" note
         +), `next year`,                                                
      28 +or `TBD` (no exact date — blank, unmatchable text, or a known y
         +ear/quarter with                                               
      29 +no day). Every `confirmed` and `tentative` feeder carries a rea
         +l date; a known                                                
      30 +year with no date is `TBD` (planned year kept) or `next year`. 
      31  
      32  Anything the rules can't settle on their own — orphan feeders, 
          an unmatchable
      33  vendor, or duplicate rows that disagree — lands in `STAGING.STG
          _DQ_REVIEW` for a

● docs/measures.md — Feeders TBD result and the certainty-mix note:

● Update(docs\measures.md)
  ⎿  Added 1 line, removed 1 line
      15  | 10 - Plan | Line Miles in Plan | Line miles of the feeders in
           the plan, each feeder counted once; responds to vendor and cer
          tainty filters. | `#,0.0` | 4,634.7 (= `SUM(DIM_CIRCUIT[LINE_MI
          LES])`) |
      16  | 10 - Plan | % Plan Date Confirmed | Feeders with certainty "c
          onfirmed" ÷ Feeders in Plan. | `0.0%` | 92.8% (142 / 153) |
      17  | 10 - Plan | Feeders Next Year | Feeders with certainty "next 
          year". | `#,0` | 2 |
      18 -| 10 - Plan | Feeders TBD | Feeders with certainty "TBD". | `#,
         -0` | 5 |                                                       
      18 +| 10 - Plan | Feeders TBD | Feeders with certainty "TBD". | `#,
         +0` | 8 |                                                       
      19  | 20 - Clearing Cycle | Feeders Overdue | Feeders with a real n
          ext-clearing date (confirmed or tentative, not blank) before to
          day. | `#,0` | 14 |
      20  | 20 - Clearing Cycle | Line Miles Overdue | Line miles on the 
          overdue feeders (same rule as Feeders Overdue). | `#,0.0` | 522
          .9 |
      21  | 20 - Clearing Cycle | Feeders Due Soon | Feeders whose next-c
          learing date falls from today through today + 90 days. | `#,0` 
          | 10 |

● Update(docs\measures.md)
  ⎿  Added 8 lines, removed 4 lines
      37    Feeders/Line Miles Overdue explicitly require `NOT ISBLANK(NE
          XT_CLEARING_DATE)`
      38    on top of the confirmed/tentative certainty filter (there are
           confirmed/
      39    tentative feeders with no date; 143 of 153 feeders carry a ne
          xt-clearing date).
      40 -- **Certainty mix (after prompt 06 data refresh):** confirmed 1
         -42, tentative 4,                                               
      41 -  next year 2, TBD 5 (= 153). 143 feeders carry a next-clearing
         - date — the                                                    
      42 -  `10/20/<year> - TBD` pattern now appears in Next Clearing and
         - recovers one                                                  
      43 -  tentative date.                                              
      40 +- **Certainty mix (after the prompt 09 cleaning-rule change):**
         + confirmed 142,                                                
      41 +  tentative 1, next year 2, TBD 8 (= 153). 143 feeders carry a 
         +next-clearing                                                  
      42 +  date. The quarter/season/"year?" feeders (858-3, 658-6, 189-6
         +) moved from                                                   
      43 +  tentative to **TBD** (planned year kept) so every confirmed/t
         +entative feeder                                                
      44 +  carries a real date and the report agrees with the app's form
         + rule; the only                                                
      45 +  tentative left is the one `10/20/<year> - TBD` feeder (704-2)
         +, which keeps its                                              
      46 +  recovered date. Was tentative 4 / TBD 5 before the change. Se
         +e                                                              
      47 +  `docs/decisions.md` (2026-10-16).                            
      48  - **Base-measure reuse:** the percentage, overdue, due-soon and
           vendor measures
      49    all build on `Feeders in Plan` / `Line Miles in Plan` so a de
          finition is
      50    written once.

● Commit (a) edits are done. Now commit (c) — the app import path. Let me read
  the existing tests and the errors helper to match patterns before writing
  code.

  Read 3 files (ctrl+o to expand)

● Now I'll write the import logic. First the CSV tokenizer:

● Write(app\row-tracker\src\services\csv.ts)
  ⎿  Wrote 62 lines to app\row-tracker\src\services\csv.ts
       1 // A small, dependency-free CSV parser — enough for the feeder e
       2 // reads (prompt 09). We write our own rather than add a depende
       3 // no new npm packages without asking). It handles the shapes Sn
       4 // download produces: quoted fields, commas and newlines inside 
       5 // quotes ("") as an escaped quote, a UTF-8 BOM, and CRLF or LF 
         line endings.
       7 /**
         ing fields.
         uoted field
         nput yields [].
     … +62 lines (ctrl+o to expand)

● Now the import logic (parse + validate + upsert planning + reconciliation),
  all pure and testable:

● Write(app\row-tracker\src\services\import.ts)
  ⎿  Wrote 221 lines to app\row-tracker\src\services\import.ts
       1 // The feeder-load logic for prompt 09: turn the Snowflake ANALY
       2 // (see snowflake/08_app_load_export.sql) into clean feeder rows
         , validated with
       3 // the SAME rules as the edit form, then upserted by feeder_id. 
       4 // is pure (no Rayfin client, no DOM) so it is unit-tested direc
         tly; the IO wiring
       6 
       7 import { parseCsv } from './csv';
       8 import {
      10   VENDORS,
     … +238 lines (ctrl+o to expand)

● Let me reuse updateClearingPlan for matches if the district already agrees —
  check the real districts for the two matching feeders (214-1, 328-4) vs the
  seed:

  Read 1 file (ctrl+o to expand)

● 328-4's real district is Pine Hollow, but the seed has it as Cedar Valley — so
  the import must overwrite district_name on update. Good thing I checked. I'll
  extend updateClearingPlan with an optional district (keeps the existing test
  green) and add importFeeders.

● Update(app\row-tracker\src\services\clearingPlans.ts)
  ⎿  Added 7 lines
       1  import type { ClearingPlanEdit, ClearingPlanRow } from './clear
          ingPlanModel';
       2 +import {                                                       
       3 +  buildSummary,                                                
       4 +  parseFeederImport,                                           
       5 +  planUpsert,                                                  
       6 +  type ImportRecord,                                           
       7 +  type ImportSummary,                                          
       8 +} from './import';                                             
       9  import { getRayfinClient, isLocalBackend } from './rayfinClient
          ';
      10  import { SEED_ROWS } from './seed';
      11  

● Update(app\row-tracker\src\services\clearingPlans.ts)
  ⎿  Added 13 lines, removed 1 line
      158  export async function updateClearingPlan(
      159    id: string,
      160    edit: ClearingPlanEdit,
      161 -  updatedBy: string                                           
      161 +  updatedBy: string,                                          
      162 +  // The edit form never changes a feeder's district, so it is
          +n't part of                                                   
      163 +  // ClearingPlanEdit. The feeder load (importFeeders) DOES ov
          +erwrite it with the                                           
      164 +  // clean district from Snowflake, so it is passed here and, 
          +when present, sent                                            
      165 +  // and verified on read-back.                               
      166 +  districtName?: string                                       
      167  ): Promise<ClearingPlanRow> {
      168    const write = toWrite(edit, updatedBy);
      169  
     ...
      171      const row = localStore().find((r) => r.id === id);
      172      if (!row) throw new Error('Feeder not found');
      173      Object.assign(row, write);
      174 +    if (districtName !== undefined) row.district_name = distri
          +ctName;                                                       
      175      return { ...row };
      176    }
      177  
     ...
      179    await client.data.ClearingPlan.update(
      180      { id },
      181      {
      182 +      ...(districtName !== undefined ? { district_name: distri
          +ctName } : {}),                                               
      183        vendor: write.vendor,
      184        date_certainty: write.date_certainty,
      185        // Cleared optional fields go as explicit null (set to n
           ull), not undefined
     ...
      208    const saved = fromApi(rows[0]);
      209  
      210    const mismatches = diffSavedRow(write, saved);
      211 +  if (districtName !== undefined && saved.district_name !== di
          +strictName) {                                                 
      212 +    mismatches.push(                                          
      213 +      `district_name (sent ${districtName}, server kept ${save
          +d.district_name})`                                            
      214 +    );                                                        
      215 +  }                                                           
      216    if (mismatches.length > 0) {
      217      throw new Error(
      218        `The save did not fully apply — the server kept differen
           t values for: ${mismatches.join('; ')}.`

● Now add the importFeeders orchestration and its create helper, after
  seedFabric:

● Update(app\row-tracker\src\services\clearingPlans.ts)
  ⎿  Added 86 lines
      252    }
      253    return SEED_ROWS.length;
      254  }
      255 +                                                              
      256 +/** A record's editable values in domain form (dates as Date|n
          +ull), reusing the                                             
      257 + * form's conversion. feeder_id and district_name are carried 
          +alongside. */                                                 
      258 +function recordWrite(record: ImportRecord, updatedBy: string) 
          +{                                                             
      259 +  return toWrite(record.edit, updatedBy);                     
      260 +}                                                             
      261 +                                                              
      262 +/** Create a new feeder from an import record (Fabric). Option
          +al fields collapse                                            
      263 + * null → undefined, the same as the seed create. */          
      264 +async function createFeeder(                                  
      265 +  client: ReturnType<typeof getRayfinClient>,                 
      266 +  record: ImportRecord,                                       
      267 +  updatedBy: string                                           
      268 +): Promise<void> {                                            
      269 +  const w = recordWrite(record, updatedBy);                   
      270 +  await client.data.ClearingPlan.create({                     
      271 +    feeder_id: record.feeder_id,                              
      272 +    district_name: record.district_name,                      
      273 +    vendor: w.vendor,                                         
      274 +    last_cleared_date: nullToUndef(w.last_cleared_date),      
      275 +    last_work_done: nullToUndef(w.last_work_done),            
      276 +    next_clearing_date: nullToUndef(w.next_clearing_date),    
      277 +    date_certainty: w.date_certainty,                         
      278 +    planned_year: nullToUndef(w.planned_year),                
      279 +    notes: nullToUndef(w.notes),                              
      280 +    updated_by: w.updated_by,                                 
      281 +    updated_at: w.updated_at,                                 
      282 +  });                                                         
      283 +}                                                             
      284 +                                                              
      285 +/** Local-dev create: append a fully-formed row to the in-memo
          +ry store. */                                                  
      286 +function createLocal(record: ImportRecord, updatedBy: string):
          + void {                                                       
      287 +  const w = recordWrite(record, updatedBy);                   
      288 +  localStore().push({                                         
      289 +    id: crypto.randomUUID(),                                  
      290 +    feeder_id: record.feeder_id,                              
      291 +    district_name: record.district_name,                      
      292 +    vendor: w.vendor,                                         
      293 +    last_cleared_date: w.last_cleared_date,                   
      294 +    last_work_done: w.last_work_done,                         
      295 +    next_clearing_date: w.next_clearing_date,                 
      296 +    date_certainty: w.date_certainty,                         
      297 +    planned_year: w.planned_year,                             
      298 +    notes: w.notes,                                           
      299 +    updated_by: w.updated_by,                                 
      300 +    updated_at: w.updated_at,                                 
      301 +  });                                                         
      302 +}                                                             
      303 +                                                              
      304 +/**                                                           
      305 + * Load the 153 clean feeders from the Snowflake export CSV (p
          +rompt 09). Every                                              
      306 + * row is validated with the same rules as the edit form; a fa
          +iling row is                                                  
      307 + * skipped and listed, never silently dropped. Matching is by 
          +feeder_id —                                                   
      308 + * existing rows are updated (district included), missing ones
          + are created — so                                             
      309 + * loading twice gives the same result. Rows already in the ap
          +p that the file                                               
      310 + * doesn't contain are reported in the summary, never deleted 
          +(no delete                                                    
      311 + * permission). Requires the gated `@authenticated('create')` 
          +window; see                                                   
      312 + * docs/app-notes.md.                                         
      313 + */                                                           
      314 +export async function importFeeders(                          
      315 +  csvText: string,                                            
      316 +  updatedBy: string                                           
      317 +): Promise<ImportSummary> {                                   
      318 +  const existing = (await listClearingPlans()).map((r) => ({  
      319 +    id: r.id,                                                 
      320 +    feeder_id: r.feeder_id,                                   
      321 +  }));                                                        
      322 +  const parsed = parseFeederImport(csvText);                  
      323 +  const plan = planUpsert(parsed.records, existing);          
      324 +                                                              
      325 +  if (isLocalBackend()) {                                     
      326 +    for (const record of plan.toCreate) createLocal(record, up
          +datedBy);                                                     
      327 +    for (const { id, record } of plan.toUpdate) {             
      328 +      await updateClearingPlan(id, record.edit, updatedBy, rec
          +ord.district_name);                                           
      329 +    }                                                         
      330 +    return buildSummary(plan.toCreate.length, plan.toUpdate.le
          +ngth, parsed, plan);                                          
      331 +  }                                                           
      332 +                                                              
      333 +  const client = getRayfinClient();                           
      334 +  for (const record of plan.toCreate) await createFeeder(clien
          +t, record, updatedBy);                                        
      335 +  for (const { id, record } of plan.toUpdate) {               
      336 +    // Full-row read-back guard (prompt 08), district included
          +.                                                             
      337 +    await updateClearingPlan(id, record.edit, updatedBy, recor
          +d.district_name);                                             
      338 +  }                                                           
      339 +  return buildSummary(plan.toCreate.length, plan.toUpdate.leng
          +th, parsed, plan);                                            
      340 +}                                                             
● Now flip the create gate in the entity:

● Update(app\row-tracker\rayfin\data\ClearingPlan.ts)
  ⎿  Added 7 lines, removed 6 lines
      17  @entity()
      18  @authenticated('read')
      19  @authenticated('update')
      20 -// Seeding the Fabric database (see docs/app-notes.md + docs/de
         -cisions.md):                                                   
      21 -// the deployed app starts empty. To load the 15 sample rows on
         -ce, temporarily                                                
      22 -// uncomment the line below, run `npx rayfin up`, click "Load s
         -ample data" in                                                 
      23 -// the app, then re-comment it and run `npx rayfin up` again. L
         -eaving create                                                  
      24 -// enabled would let any signed-in user insert rows.           
      25 -// @authenticated('create')                                    
      20 +// CREATE IS TEMPORARILY ENABLED for the one-time feeder load (
         +prompt 09): the                                                
      21 +// "Import feeders" control upserts the 153 clean feeders from 
         +the Snowflake                                                  
      22 +// export. A FOLLOW-UP PR SWITCHES THIS BACK OFF (re-comment th
         +e line) and                                                    
      23 +// redeploys, the same gated pattern as the seed. While it is o
         +n, any signed-in                                               
      24 +// user can insert rows — mitigated by dev-only synthetic data 
         +and the immediate                                              
      25 +// removal. See docs/app-notes.md + docs/decisions.md.         
      26 +@authenticated('create')                                       
      27  export class ClearingPlan {
      28    @uuid() id!: string;
      29  

● Now the UI — add an "Import feeders" panel (shown on the Fabric backend, i.e.
  during the gated window). Update the imports and render it:

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 2 lines
      10    type ClearingPlanRow,
      11  } from '@/services/clearingPlanModel';
      12  import {
      13 +  importFeeders,                                               
      14    listClearingPlans,
      15    seedFabric,
      16    updateClearingPlan,
      17  } from '@/services/clearingPlans';
      18  import { toUserMessage } from '@/services/errors';
      19 +import type { ImportSummary } from '@/services/import';        
      20  import { isLocalBackend } from '@/services/rayfinClient';
      21  import {
      22    hasErrors,

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 9 lines
       96        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
       97          <ClaimsPanel />
       98  
       99 +        {/* The one-time feeder load (prompt 09). Offered on t
          +he Fabric backend;                                            
      100 +            it only succeeds while the gated create permission
          + is enabled. */}                                              
      101 +        {!isLocalBackend() && !loading && (                   
      102 +          <ImportPanel                                        
      103 +            updatedBy={user?.email ?? user?.id ?? 'unknown'}  
      104 +            onImported={fetchRows}                            
      105 +          />                                                  
      106 +        )}                                                    
      107 +                                                              
      108          {loading ? (
      109            <p className="text-center text-sm text-gray-400">Loa
           ding…</p>
      110          ) : showSeed ? (

● Now append the ImportPanel component:

● Update(app\row-tracker\src\pages\HomePage.tsx)
  ⎿  Added 143 lines
      362    );
      363  }
      364  
      365 +// Expected reconciliation after a clean load, from docs/measu
          +res.md. Shown                                                 
      366 +// beside the actual counts so a mismatch is obvious at a glan
          +ce.                                                           
      367 +const EXPECTED = {                                            
      368 +  total: 153,                                                 
      369 +  certainty: { confirmed: 142, tentative: 1, 'next year': 2, T
          +BD: 8 },                                                      
      370 +  withNextDate: 143,                                          
      371 +} as const;                                                   
      372 +                                                              
      373 +/** The gated feeder load (prompt 09): pick the Snowflake expo
          +rt CSV, upsert by                                             
      374 + * feeder_id, and show the result + reconciliation counts. */ 
      375 +function ImportPanel({                                        
      376 +  updatedBy,                                                  
      377 +  onImported,                                                 
      378 +}: {                                                          
      379 +  updatedBy: string;                                          
      380 +  onImported: () => Promise<void>;                            
      381 +}) {                                                          
      382 +  const [busy, setBusy] = useState(false);                    
      383 +  const [error, setError] = useState<string | null>(null);    
      384 +  const [summary, setSummary] = useState<ImportSummary | null>
          +(null);                                                       
      385 +                                                              
      386 +  const handleFile = async (file: File) => {                  
      387 +    setError(null);                                           
      388 +    setSummary(null);                                         
      389 +    setBusy(true);                                            
      390 +    try {                                                     
      391 +      const text = await file.text();                         
      392 +      const result = await importFeeders(text, updatedBy);    
      393 +      setSummary(result);                                     
      394 +      await onImported();                                     
      395 +    } catch (err) {                                           
      396 +      setError(toUserMessage(err, 'Failed to import feeders.')
          +);                                                            
      397 +    } finally {                                               
      398 +      setBusy(false);                                         
      399 +    }                                                         
      400 +  };                                                          
      401 +                                                              
      402 +  return (                                                    
      403 +    <div className="rounded-xl border border-gray-200 bg-white
          + px-6 py-5">                                                  
      404 +      <div className="flex flex-wrap items-center justify-betw
          +een gap-3">                                                   
      405 +        <div>                                                 
      406 +          <h2 className="text-sm font-semibold text-gray-900">
          +Import feeders</h2>                                           
      407 +          <p className="text-xs text-gray-500">               
      408 +            Load the 153 clean feeders from the Snowflake expo
          +rt CSV. Matches by                                            
      409 +            feeder ID: existing rows are updated, missing ones
          + created.                                                     
      410 +          </p>                                                
      411 +        </div>                                                
      412 +        <label className="cursor-pointer rounded-lg bg-blue-60
          +0 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 a
          +ria-disabled:opacity-40">                                     
      413 +          {busy ? 'Importing…' : 'Choose CSV…'}               
      414 +          <input                                              
      415 +            type="file"                                       
      416 +            accept=".csv,text/csv"                            
      417 +            disabled={busy}                                   
      418 +            className="hidden"                                
      419 +            onChange={(e) => {                                
      420 +              const file = e.target.files?.[0];               
      421 +              e.target.value = ''; // allow re-picking the sam
          +e file                                                        
      422 +              if (file) void handleFile(file);                
      423 +            }}                                                
      424 +          />                                                  
      425 +        </label>                                              
      426 +      </div>                                                  
      427 +                                                              
      428 +      {error && <p className="mt-3 text-sm text-red-600">{erro
          +r}</p>}                                                       
      429 +                                                              
      430 +      {summary && (                                           
      431 +        <div className="mt-4 space-y-3 text-sm">              
      432 +          <p className="font-medium text-gray-900">           
      433 +            Created {summary.created} · Updated {summary.updat
          +ed} · Skipped{' '}                                            
      434 +            {summary.skipped}                                 
      435 +          </p>                                                
      436 +                                                              
      437 +          <div className="rounded-lg bg-gray-50 px-4 py-3 text
          +-gray-700">                                                   
      438 +            <p className="mb-1 text-xs font-semibold uppercase
          + tracking-wide text-gray-500">                                
      439 +              Reconciliation (actual vs expected)             
      440 +            </p>                                              
      441 +            <ul className="space-y-0.5">                      
      442 +              <Recon label="Feeders in plan" actual={summary.r
          +econciliation.total} expected={EXPECTED.total} />             
      443 +              <Recon label="Confirmed" actual={summary.reconci
          +liation.certainty.confirmed} expected={EXPECTED.certainty.conf
          +irmed} />                                                     
      444 +              <Recon label="Tentative" actual={summary.reconci
          +liation.certainty.tentative} expected={EXPECTED.certainty.tent
          +ative} />                                                     
      445 +              <Recon label="Next year" actual={summary.reconci
          +liation.certainty['next year']} expected={EXPECTED.certainty['
          +next year']} />                                               
      446 +              <Recon label="TBD" actual={summary.reconciliatio
          +n.certainty.TBD} expected={EXPECTED.certainty.TBD} />         
      447 +              <Recon label="With a next clearing date" actual=
          +{summary.reconciliation.withNextDate} expected={EXPECTED.withN
          +extDate} />                                                   
      448 +            </ul>                                             
      449 +          </div>                                              
      450 +                                                              
      451 +          {summary.errors.length > 0 && (                     
      452 +            <details className="rounded-lg border border-amber
          +-200 bg-amber-50 px-4 py-3">                                  
      453 +              <summary className="cursor-pointer font-medium t
          +ext-amber-800">                                               
      454 +                {summary.errors.length} row(s) skipped        
      455 +              </summary>                                      
      456 +              <ul className="mt-2 space-y-0.5 text-xs text-amb
          +er-900">                                                      
      457 +                {summary.errors.map((e) => (                  
      458 +                  <li key={`${e.row}-${e.feeder_id}`}>        
      459 +                    Row {e.row} ({e.feeder_id}): {e.reason}   
      460 +                  </li>                                       
      461 +                ))}                                           
      462 +              </ul>                                           
      463 +            </details>                                        
      464 +          )}                                                  
      465 +                                                              
      466 +          {summary.leftover.length > 0 && (                   
      467 +            <details className="rounded-lg border border-gray-
          +200 bg-white px-4 py-3">                                      
      468 +              <summary className="cursor-pointer font-medium t
          +ext-gray-700">                                                
      469 +                {summary.leftover.length} existing feeder(s) n
          +ot in the file —                                              
      470 +                reported, not deleted                         
      471 +              </summary>                                      
      472 +              <p className="mt-2 text-xs text-gray-500">      
      473 +                The app has no delete permission; remove these
          + in the Fabric SQL                                            
      474 +                database if they shouldn't be there (see docs/
          +app-notes.md).                                                
      475 +              </p>                                            
      476 +              <p className="mt-1 break-words text-xs text-gray
          +-700">                                                        
      477 +                {summary.leftover.join(', ')}                 
      478 +              </p>                                            
      479 +            </details>                                        
      480 +          )}                                                  
      481 +        </div>                                                
      482 +      )}                                                      
      483 +    </div>                                                    
      484 +  );                                                          
      485 +}                                                             
      486 +                                                              
      487 +function Recon({                                              
      488 +  label,                                                      
      489 +  actual,                                                     
      490 +  expected,                                                   
      491 +}: {                                                          
      492 +  label: string;                                              
      493 +  actual: number;                                             
      494 +  expected: number;                                           
      495 +}) {                                                          
      496 +  const ok = actual === expected;                             
      497 +  return (                                                    
      498 +    <li className="flex justify-between">                     
      499 +      <span>{label}</span>                                    
      500 +      <span className={ok ? 'text-gray-900' : 'font-semibold t
          +ext-red-600'}>                                                
      501 +        {actual}                                              
      502 +        {!ok && <span className="text-gray-400"> / {expected}<
          +/span>}                                                       
      503 +      </span>                                                 
      504 +    </li>                                                     
      505 +  );                                                          
      506 +}                                                             
      507 +                                                              
      508  function Field({
      509    label,
      510    error,

● Now the tests:

● Write(app\row-tracker\src\__tests__\import.test.ts)
  ⎿  Wrote 181 lines to app\row-tracker\src\__tests__\import.test.ts
       1 import { describe, expect, it } from 'vitest';
       2 
       3 import { parseCsv } from '@/services/csv';
       4 import {
       5   buildSummary,
       6   parseFeederImport,
       7   planUpsert,
       8   reconcile,
       9   type ImportRecord,
      10 } from '@/services/import';
     … +198 lines (ctrl+o to expand)

● Now let me run the build, tests, and linter:

  Ran 1 shell command (ctrl+o to expand)

● Wrong working directory. Let me use an absolute path:

  Ran 1 shell command (ctrl+o to expand)

● Build passed. Now tests and lint:

  Ran 1 shell command (ctrl+o to expand)

● All 30 tests pass (13 new). Now lint:

  Ran 1 shell command (ctrl+o to expand)

● Lint is clean (0 errors; the single warning is pre-existing in
  AuthContext.tsx, untouched by me). Let me verify the generator edit at least
  compiles and check its default args so my run-sheet instructions are exact.

  Read 1 file, ran 1 shell command (ctrl+o to expand)

● Let me confirm the exact generate command the project uses (for the run sheet)
  and that data/out plus .env.local are gitignored:

  Searched for 1 pattern (ctrl+o to expand)

● data/out/ and .env.* are gitignored. Since the regen is deterministic and the
  user reruns the exact command anyway, let me run it to verify my generator
  edit produces the expected answer key (and that only the certainty cells
  change):

  Ran 1 shell command (ctrl+o to expand)

● Bash is still in data/out from earlier. Let me redo with absolute paths:
  Ran 3 shell commands (ctrl+o to expand)

● Got it — the raw plan is data/out/landing/row_clearing_plan.csv. Let me verify
  properly:

  Ran 1 shell command (ctrl+o to expand)

● Verified exactly as predicted: the raw spreadsheet is byte-identical, and
  answer_key.csv flips only 5 certainty cells (tentative→TBD) for the
  quarter/season/year? patterns, year kept — so 05_staging_test stays green and
  only Feeders TBD moves 5→8. Let me confirm the Fabric table/column naming
  before writing the leftover-delete SQL into the docs.

  Searched for 1 pattern, read 1 file, ran 1 shell command (ctrl+o to expand)

● Table is dbo.ClearingPlans (T-SQL/mssql), columns = field names. Now let me
  read poc-log.md to match its format, then write the three doc updates.

  Read 1 file (ctrl+o to expand)

● Now the commit (d) docs. First docs/poc-log.md:

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
      19 +| 2026-10-16 | R8. Load 153 feeders (prompt 09) | Claude Code (
         +Opus 4.8); Rayfin SDK/CLI 1.36.2 client; generator; no MCP | ~5
         +5 | | Part A: wrote `08_app_load_export.sql` (ROLE_REPORTER, 9 
         +cols, 153 rows) + recommended an in-app Import control over bun
         +dling; flagged 2 reconciliation gaps from the repo alone. Gap 1
         +: 3 feeders (858-3/658-6/189-6, raw "Q3 2027"/"Spring 2027"/"20
         +27?") cleaned to tentative-with-no-date, which the form would s
         +kip → fixed the STAGING rule so quarter/season/"year?" → TBD (y
         +ear kept); regenerated deterministically (raw plan byte-identic
         +al, answer key flips 5 certainty cells only), so report Feeders
         + TBD 5→8 and `05` stays green. Gap 2: only 2 of the 15 seed fee
         +der_ids (214-1, 328-4) exist in the 153 → 13 leftovers reported
         +, not deleted. Part B: built the Import path (own CSV parser, p
         +er-row validation reusing the form rules, upsert by feeder_id, 
         +full-row read-back incl district, result + reconciliation UI), 
         +enabled gated `@authenticated('create')`, 13 new tests; `build`
         +, 30 tests, lint all pass. | | yes | Not run against Fabric (Jo
         +sh deploys + loads). Found 328-4's real district (Pine Hollow) 
         +differs from the seed (Cedar Valley), so the update path overwr
         +ites district too. Leftover cleanup is a manual Fabric SQL `DEL
         +ETE` (app has no delete permission). Lint warning in AuthContex
         +t.tsx still pre-existing |                                     
      20  
      21  ## Observations
      22  

● Now docs/decisions.md — three new rows:

● Update(docs\decisions.md)
  ⎿  Added 3 lines
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
      40  | 2026-10-16 | Clear-a-field fix (prompt 08): send cleared opti
          onal fields as an explicit `null` on update (not `undefined`), 
          carried through a cast because the generated `UpdateInput` type
           is `value \| undefined`. The installed `@microsoft/rayfin-data
          ` client serialises `null` to a GraphQL `null` literal (DAB set
          s the column null) and omits `undefined` (leaves it unchanged) 
          — verified in the client source, so this is the supported mecha
          nism, not a workaround. Plus a read-back guard that re-reads th
          e saved row and errors on any field the server kept differently
          , and friendly UI errors (raw GraphQL kept in the console only)
          . | The deployed app stored silent bad data: clearing a date sa
          ved as `undefined` = "leave unchanged", so TBD feeders kept the
          ir old date, breaking the cross-field rule. Only verifiable on 
          Fabric (local mode is in-memory). | Josh (prompt 08) | `app/row
          -tracker` update path, edit form errors |
      41 +| 2026-10-16 | Cleaning-rule change (prompt 09): a date cell th
         +at is a quarter/season/"year?" (a year known, no recoverable da
         +y) now cleans to **TBD** (planned year kept), not **tentative**
         +. So **confirmed** and **tentative** always carry a real date. 
         +Applied in both `04_staging_clean.sql` certainty branches and `
         +data/generate.py`'s answer key; regenerated deterministically (
         +raw plan byte-identical, 5 answer-key certainty cells flip: 858
         +-3/658-6/189-6 on Next Clearing, 125-3/328-6 on Last Cleared). 
         +Report effect: `Feeders TBD` 5→8, `tentative` 4→1; everything e
         +lse (Feeders in Plan 153, DQ 69, next-date 143, %Confirmed, Ove
         +rdue/Due Soon) unchanged. `05_staging_test` stays at expected/c
         +aught 69, missed/extra/mismatched 0. | The report and the app m
         +ust agree. The app's edit form requires a date for confirmed/te
         +ntative, so these 3 feeders would be skipped on import. Busines
         +s logic belongs in Snowflake, not the app — so the rule moves u
         +pstream rather than relaxing the form. | Josh (prompt 09) | Cle
         +aning SQL, generator, report certainty KPIs, app load |        
      42 +| 2026-10-16 | App feeder-load approach (prompt 09): an in-app 
         +**"Import feeders"** control (file picker) that reads the Snowf
         +lake export CSV at runtime and upserts by `feeder_id` (existing
         + updated — district included — missing created), chosen over bu
         +ndling the CSV into the build. Create is gated with `@authentic
         +ated('create')` (enabled in this PR, **off in a follow-up PR** 
         +after the load), the same pattern as the seed. Every row is val
         +idated with the form's rules before saving; failures are skippe
         +d and listed. | Keeps synthetic data out of the committed bundl
         +e (the repo forbids committing CSVs), is re-runnable, and reuse
         +s the gated-seed pattern. Bundling would commit data and couple
         + reloads to a rebuild. | Josh (prompt 09) | `app/row-tracker` i
         +mport path, `ClearingPlan` permissions, UI |                   
      43 +| 2026-10-16 | Leftover seed rows (prompt 09): only 2 of the 15
         + current seed feeders (214-1, 328-4) are among the 153; the oth
         +er 13 are reported by the import, **not deleted**. Removing the
         +m is a **one-time manual `DELETE` in the Fabric SQL database qu
         +ery editor** (outside the app), run once after the load, becaus
         +e the app has no delete permission (and none is added here). Th
         +e exact SQL and the 13 ids are in `docs/app-notes.md`. | The ap
         +p must not gain delete permission for a one-off cleanup; a dire
         +ct database statement is the smallest, auditable way. | Josh (p
         +rompt 09) | Deployed `dbo.ClearingPlans`, app-notes |          
      44  
      45  ## R1 profile findings (2026-10-15)
      46  

● Now docs/app-notes.md — add the feeder-load section with steps, expected
  counts, and the leftover-delete SQL:

● Update(docs\app-notes.md)
  ⎿  Added 67 lines
      100  clean long-term answer is a seed Function or a per-row create 
           policy, with the
      101  role rules.
      102  
      103 +## Loading the 153 feeders (prompt 09)                        
      104 +                                                              
      105 +The real population path, replacing the 15-row seed above: loa
          +d the 153 clean                                               
      106 +feeders from Snowflake `ROW_DB.ANALYTICS` into the app. Same g
          +ated-create                                                   
      107 +pattern as the seed, but driven by the **"Import feeders"** co
          +ntrol (file                                                   
      108 +picker) instead of a fixed button, and it **upserts by `feeder
          +_id`** so running                                             
      109 +it twice gives the same result.                               
      110 +                                                              
      111 +**Load steps (Josh runs these):**                             
      112 +                                                              
      113 +1. **Export** — in Snowsight, run `snowflake/08_app_load_expor
          +t.sql` as                                                     
      114 +   `ROLE_REPORTER`. Download the result grid as CSV into `data
          +/out/`                                                        
      115 +   (gitignored). Expect **153 rows**.                         
      116 +2. **Merge** the reviewed PR (create is enabled in it).       
      117 +3. **Deploy** — `npx rayfin up` (Josh; this PR has `@authentic
          +ated('create')`                                               
      118 +   on).                                                       
      119 +4. **Import** — sign in, and in the "Import feeders" panel cho
          +ose the CSV. The                                              
      120 +   result summary shows created / updated / skipped and the re
          +conciliation.                                                 
      121 +5. **Check counts** against the panel (below).                
      122 +6. **Clean up** the 13 leftover seed rows (SQL below).        
      123 +7. **Follow-up PR** re-comments `@authenticated('create')`; Jo
          +sh deploys again                                              
      124 +   to lock creates back down.                                 
      125 +                                                              
      126 +**Expected result (from the 15 current seed rows):**          
      127 +                                                              
      128 +| Metric | Expected |                                         
      129 +|---|---|                                                     
      130 +| Source rows | 153 |                                         
      131 +| Created | 151 |                                             
      132 +| Updated | 2 (214-1, 328-4 — the only seed ids in the 153; 32
          +8-4's district is corrected Cedar Valley → Pine Hollow) |     
      133 +| Skipped | 0 |                                               
      134 +| Feeders in plan | 153 |                                     
      135 +| Certainty: confirmed / tentative / next year / TBD | 142 / 1
          + / 2 / 8 |                                                    
      136 +| With a next clearing date | 143 |                           
      137 +| Leftover (reported, not deleted) | 13 |                     
      138 +                                                              
      139 +These match `docs/measures.md` after the prompt-09 cleaning-ru
          +le change                                                     
      140 +(`Feeders TBD` 5→8). The Import panel shows each count beside 
          +its expected value                                            
      141 +and flags any mismatch in red.                                
      142 +                                                              
      143 +**Cleaning up the 13 leftover seed rows (one-time, manual).** 
          +The app has no                                                
      144 +delete permission (none is added), so removing the seed feeder
          +s that aren't in                                              
      145 +the 153 is a one-time statement in the **Fabric SQL database q
          +uery editor**                                                 
      146 +(T-SQL), run once after the load. Confirm first with a `SELECT
          +`, then delete the                                            
      147 +exact `feeder_id`s the import summary lists as leftover — expe
          +cted to be these                                              
      148 +13 (the 15 seed ids minus 214-1 and 328-4):                   
      149 +                                                              
      150 +```sql                                                        
      151 +-- Confirm first (expect 13 rows):                            
      152 +SELECT feeder_id FROM dbo.ClearingPlans                       
      153 +WHERE feeder_id IN (                                          
      154 +  '101-1','118-2','203-1','227-3','245-2','316-1',            
      155 +  '402-2','417-1','533-1','548-3','619-2','701-1','742-2'     
      156 +);                                                            
      157 +                                                              
      158 +-- Then delete:                                               
      159 +DELETE FROM dbo.ClearingPlans                                 
      160 +WHERE feeder_id IN (                                          
      161 +  '101-1','118-2','203-1','227-3','245-2','316-1',            
      162 +  '402-2','417-1','533-1','548-3','619-2','701-1','742-2'     
      163 +);                                                            
      164 +```                                                           
      165 +                                                              
      166 +After cleanup the table holds exactly the 153 feeders. (If any
          + seed row was                                                 
      167 +hand-edited to a different `feeder_id` while testing, trust th
          +e import summary's                                            
      168 +leftover list over this fixed set.)                           
      169 +                                                              
      170  ## Deployed results (2026-10-16)
      171  
      172  First deploy of the slice to `ROW-POC-Dev`, after seeding. Obs
           ervations and the

● Let me add a one-line pointer in the now-stale seeding section so it doesn't
  contradict the enabled create gate:

● Update(docs\app-notes.md)
  ⎿  Added 6 lines
      84  
      85  ## Seeding the Fabric database (gated)
      86  
      87 +> Superseded for population by **"Loading the 153 feeders (prom
         +pt 09)"** below —                                              
      88 +> that's the real load. This section documents the original 15-
         +row seed pattern.                                              
      89 +> Note: as of prompt 09 `@authenticated('create')` is **committ
         +ed enabled** for                                               
      90 +> the load window (a follow-up PR switches it off), so step 1 b
         +elow is already                                                
      91 +> done on the current branch.                                  
      92 +                                                               
      93  The deployed app starts **empty** (`read`/`update` only, no cre
          ate). To load the
      94  15 sample rows once, after the first deploy:
      95  

● Let me get the full change summary for the checkpoint:

  Ran 1 shell command (ctrl+o to expand)

● All edits are complete, and the working tree is clean except for
  powerbi/.../editorSettings.json, which was already modified before this task —
  I won't stage it (it's under powerbi/, which this task must not touch).

  CHECKPOINT 2

  What changed

  Cleaning-rule fix (report ↔ app agreement)
  - data/generate.py — quarter/season/"year?" answer-key certainty tentative → 
  TBD (planned year kept).
  - snowflake/04_staging_clean.sql — both year-only certainty branches
  (last_cleared, next_clearing) → TBD; rule comment updated.
  - docs/cleaning-rules.md, docs/measures.md — rule + certainty mix updated
  (Feeders TBD 5→8, tentative 4→1).

  Export
  - snowflake/08_app_load_export.sql — ROLE_REPORTER SELECT, 9 columns, ISO
  dates, 153 rows.

  App load path
  - src/services/csv.ts — dependency-free CSV parser (quotes, embedded
  commas/newlines, "", BOM, CRLF).
  - src/services/import.ts — parse + per-row validation (reuses the form rules +
  feeder_id/district/duplicate guards), planUpsert (create/update/leftover),
  reconcile, buildSummary.
  - src/services/clearingPlans.ts — importFeeders (upsert by feeder_id, full-row
  read-back incl. district); updateClearingPlan gained an optional district
  arg.
  - rayfin/data/ClearingPlan.ts — @authenticated('create') enabled, with the
  follow-up-PR note.
  - src/pages/HomePage.tsx — "Import feeders" panel with result + reconciliation
  (actual vs expected), skipped-row list, leftover list.
  - src/__tests__/import.test.ts — 13 tests (CSV parsing, validation incl. bad
  rows, upsert decision, re-runnability, summary counts).

  Docs: docs/app-notes.md (load steps, expected counts, leftover DELETE SQL),
  docs/decisions.md (3 rows), docs/poc-log.md (R8, ~55 min agent; review blank).

  Check results

  - npm run build ✓ · npm run test ✓ 30 passed (13 new) · npm run lint ✓ 0
  errors (the 1 warning is pre-existing in AuthContext.tsx).
  - Generator regen verified deterministic: raw plan byte-identical;
  answer_key.csv flips only 5 certainty cells → 05_staging_test stays
  expected/caught 69, missed/extra/mismatched 0.
  - Repo-derived reconciliation: 153 source → 151 created, 2 updated (214-1, 
  328-4), 0 skipped, 13 leftover. 328-4's district corrected Cedar Valley → Pine
  Hollow.

  Your exact steps

  1. Regen data: python data/generate.py --seed 42 --as-of 2026-10-14 (already
  run locally to verify; re-run is idempotent).
  2. Snowflake (Snowsight): reload RAW (03) → rerun 04 → 05 (confirm all-zero
  deltas) → 06.
  3. Power BI refresh: refresh the model, and in the report confirm Feeders TBD 
  = 8, tentative = 1, and everything else unchanged (Feeders in Plan 153, DQ 69,
  Orphans 2, next-date 143, %Confirmed 92.8%, Overdue/Due Soon 14/10).
  4. Export: run 08 as ROLE_REPORTER → download CSV to data/out/ (153 rows).
  5. Merge → deploy (npx rayfin up, create enabled) → Import the CSV in-app →
  check counts in the panel.
  6. Clean up the 13 leftovers via the Fabric SQL DELETE in docs/app-notes.md.
  7. Follow-up PR re-comments @authenticated('create') → deploy again.

  Proposed commits (paths staged explicitly — your approval per commit)

  (a) cleaning-rule change
  git add data/generate.py snowflake/04_staging_clean.sql docs/cleaning-rules.md
  docs/measures.md
  fix(cleaning): quarter/season/"year?" dates clean to TBD so tentative always 
  has a date

  (b) export SQL
  git add snowflake/08_app_load_export.sql
  feat(snowflake): add 08 app-load export of the 153 clean feeders

  (c) app import path + create gate + tests
  git add app/row-tracker/rayfin/data/ClearingPlan.ts
  app/row-tracker/src/services/csv.ts app/row-tracker/src/services/import.ts
  app/row-tracker/src/services/clearingPlans.ts
  app/row-tracker/src/pages/HomePage.tsx
  app/row-tracker/src/__tests__/import.test.ts
  feat(app): import the 153 feeders (upsert by feeder_id) behind the gated 
  create

  (d) docs + prompt record
  git add docs/app-notes.md docs/decisions.md docs/poc-log.md
  prompts/09_load_153_feeders.md
  docs: record the feeder-load approach, counts, and leftover cleanup

  Not staged: powerbi/row_pbi_poc.SemanticModel/.pbi/editorSettings.json
  (pre-existing, and powerbi/ is off-limits for this task). data/out/ and
  .env.local are gitignored.

  I haven't committed, pushed, deployed, or touched Fabric. Want me to proceed
  with these four commits (I'll ask before each), or adjust anything first?

✻ Baked for 11m 45s

❯ Approved. Make all four commits (a) to (d) as proposed, without asking        
  between them. Don't push. Then show me git log -5 --oneline.                  

● I'll make the four commits in order, then show the log.

  Ran 4 shell commands (ctrl+o to expand)

● All four commits are in, in order, nothing pushed:

  868f9d9 docs: record the feeder-load approach, counts, and leftover cleanup
  9db47db feat(app): import the 153 feeders (upsert by feeder_id) behind the
  gated create
  aa7ae12 feat(snowflake): add 08 app-load export of the 153 clean feeders
  99a516a fix(cleaning): quarter/season/"year?" dates clean to TBD so tentative
  always has a date
  b79e5ae Add $schema to pbip, pbir and pbism (written by Power BI Desktop on
  save) (#20)

  Notes:
  - The LF→CRLF warnings are just Git's line-ending normalization on the new
  files — harmless, no content change.
  - Still unstaged (intentionally): powerbi/.../editorSettings.json
  (pre-existing, powerbi/ off-limits). data/out/ and .env.local remain
  gitignored.
  - Nothing pushed; no Fabric contact. When you're ready, the branch is
  feat/load-feeders for you to push and open the PR.

✻ Sautéed for 23s