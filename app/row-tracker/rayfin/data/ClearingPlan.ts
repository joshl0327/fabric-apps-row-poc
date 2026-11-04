import { entity, authenticated, uuid, text, int, date, set } from '@microsoft/rayfin-core';

// One row per feeder — the clean target the spreadsheet never had: a real date,
// a certainty picklist, a vendor dropdown, and a canonical district. Column
// names mirror the Snowflake ANALYTICS layer (see root AGENTS.md "Model map").
//
// Permissions: any signed-in user may READ and UPDATE every feeder. No create
// (off — see the create note above the class) and no delete. Per-row role rules
// (district managers edit their own district, an approved group edits all) were
// scoped out of the POC — only id/email claims reach the deployed app; see
// docs/app-notes.md.
//
// Cross-field rules (confirmed/tentative need a date, "next year" needs a
// planned year and no date, TBD has no date) are NOT enforced here: Rayfin's
// schema validation and DAB are per-field only. They are enforced in the edit
// form (src/services/validation.ts). Server-side enforcement would need a
// Rayfin Function — a later step.
@entity()
@authenticated('read')
@authenticated('update')
// Create is OFF. It was briefly enabled once, through a gated PR pair, for the
// one-time 153-feeder load into prod (the "Import feeders" control upserts from
// the Snowflake export); it was switched back off in PR #32 after the load.
// With no create grant the API exposes no createClearingPlan mutation. To run
// the gated load again: uncomment the line below, deploy, import, then
// re-comment and redeploy. See docs/app-notes.md + docs/decisions.md.
// @authenticated('create')
export class ClearingPlan {
  @uuid() id!: string;

  // Feeder identity: substation_num-circuit_num, e.g. "214-1". One per feeder.
  @text({ max: 20, unique: true }) feeder_id!: string;

  @text({ max: 100 }) district_name!: string;

  // Canonical vendors from data/generate.py, plus "Unassigned" for feeders with
  // no vendor (mirrors the ANALYTICS DIM_VENDOR "Unassigned" member). Keep this
  // list in sync with VENDORS in src/services/clearingPlanModel.ts.
  @set(
    'Summit Vegetation Management',
    'Clearline Tree Service',
    'Greenway Land and Timber',
    'Ironwood Forestry',
    'Trailhead Vegetation Control',
    'North District Line Crew',
    'Unassigned'
  )
  vendor!:
    | 'Summit Vegetation Management'
    | 'Clearline Tree Service'
    | 'Greenway Land and Timber'
    | 'Ironwood Forestry'
    | 'Trailhead Vegetation Control'
    | 'North District Line Crew'
    | 'Unassigned';

  @date({ optional: true }) last_cleared_date?: Date;
  @text({ max: 200, optional: true }) last_work_done?: string;
  @date({ optional: true }) next_clearing_date?: Date;

  // Keep in sync with DATE_CERTAINTIES in src/services/clearingPlanModel.ts.
  @set('confirmed', 'tentative', 'next year', 'TBD')
  date_certainty!: 'confirmed' | 'tentative' | 'next year' | 'TBD';

  @int({ optional: true }) planned_year?: number;
  @text({ max: 500, optional: true }) notes?: string;

  // Who last changed the row and when. updated_at is a datetime (@date stores
  // ISO date/time). updated_by is set by the client from the signed-in session
  // and is NOT audit-grade — a client can send any value. It was not replaced;
  // the trustworthy "who changed it" record is the append-only ChangeLog entity
  // (its changed_by is server-pinned to the caller's email). See docs/app-notes.md.
  @text({ max: 200 }) updated_by!: string;
  @date() updated_at!: Date;
}
