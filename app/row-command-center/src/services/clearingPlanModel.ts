// Shared constants and types for the feeder slice, used by the data service,
// validation, fixtures and UI. Mirrors app/row-tracker/src/services/
// clearingPlanModel.ts — the two apps edit the same table but cannot share code
// without a shared package (out of scope), so this is a deliberate duplicate;
// see docs/governance.md and the README "Known gaps".
//
// The connector entity (rayfin/connectors/row-tracker/ClearingPlans.ts) exposes
// camelCase properties mapped to the snake_case SQL columns, so FeederRow is
// camelCase. The edit-form shape (FeederEdit) is kept snake_case and identical to
// the first app so the copied validation rules below read verbatim.

export const VENDORS = [
  'Summit Vegetation Management',
  'Clearline Tree Service',
  'Greenway Land and Timber',
  'Ironwood Forestry',
  'Trailhead Vegetation Control',
  'North District Line Crew',
  'Unassigned',
] as const;
export type Vendor = (typeof VENDORS)[number];

export const DATE_CERTAINTIES = [
  'confirmed',
  'tentative',
  'next year',
  'TBD',
] as const;
export type DateCertainty = (typeof DATE_CERTAINTIES)[number];

export const DISTRICTS = [
  'North Ridge',
  'Pine Hollow',
  'Cedar Valley',
  'Stone Creek',
  'Elk Meadow',
] as const;

export const NOTES_MAX = 500;

/** A feeder row as the app reads and displays it (connector camelCase; dates as
 * `Date | null`). */
export interface FeederRow {
  id: string;
  feederId: string;
  districtName: string;
  vendor: Vendor;
  lastClearedDate: Date | null;
  lastWorkDone: string | null;
  nextClearingDate: Date | null;
  dateCertainty: DateCertainty;
  plannedYear: number | null;
  notes: string | null;
  updatedBy: string;
  updatedAt: Date;
}

/**
 * The editable subset, as the form holds it. Dates are `yyyy-mm-dd` strings (or
 * '') so they bind to `<input type="date">`; `planned_year` is the raw string
 * from a number input. Field names match the first app verbatim so the copied
 * validation rules are unchanged.
 */
export interface FeederEdit {
  vendor: Vendor;
  last_cleared_date: string;
  last_work_done: string;
  next_clearing_date: string;
  date_certainty: DateCertainty;
  planned_year: string;
  notes: string;
}

/** Build the editable form shape from a stored row. */
export function toEdit(row: FeederRow): FeederEdit {
  const iso = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : '');
  return {
    vendor: row.vendor,
    last_cleared_date: iso(row.lastClearedDate),
    last_work_done: row.lastWorkDone ?? '',
    next_clearing_date: iso(row.nextClearingDate),
    date_certainty: row.dateCertainty,
    planned_year: row.plannedYear != null ? String(row.plannedYear) : '',
    notes: row.notes ?? '',
  };
}
