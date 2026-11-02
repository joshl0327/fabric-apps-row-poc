import { entity, authenticated, uuid, text, int, date, set } from '@microsoft/rayfin-core';

// One row per feeder — the clean target the spreadsheet never had: a real date,
// a certainty picklist, a vendor dropdown, and a canonical district. Column
// names mirror the Snowflake ANALYTICS layer (see root AGENTS.md "Model map").
//
// Permissions for this thin slice: any signed-in user may READ and UPDATE every
// feeder. No create (rows arrive through the seed) and no delete. Per-row rules
// — district managers edit their own district, an approved Entra group edits all
// — come in a later step; see docs/app-notes.md.
//
// Cross-field rules (confirmed/tentative need a date, "next year" needs a
// planned year and no date, TBD has no date) are NOT enforced here: Rayfin's
// schema validation and DAB are per-field only. They are enforced in the edit
// form (src/services/validation.ts). Server-side enforcement would need a
// Rayfin Function — a later step.
@entity()
@authenticated('read')
@authenticated('update')
// CREATE IS TEMPORARILY ENABLED for the one-time feeder load (prompt 09): the
// "Import feeders" control upserts the 153 clean feeders from the Snowflake
// export. A FOLLOW-UP PR SWITCHES THIS BACK OFF (re-comment the line) and
// redeploys, the same gated pattern as the seed. While it is on, any signed-in
// user can insert rows — mitigated by dev-only synthetic data and the immediate
// removal. See docs/app-notes.md + docs/decisions.md.
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
  // and is NOT audit-grade — a client can send any value. The change-log step
  // will replace it with a server-stamped field. See docs/app-notes.md.
  @text({ max: 200 }) updated_by!: string;
  @date() updated_at!: Date;
}
