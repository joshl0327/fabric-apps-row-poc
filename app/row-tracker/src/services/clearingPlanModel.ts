// Shared constants and types for the ClearingPlan slice, used by the data
// service, the validation rules, the seed, and the UI. The entity decorators in
// rayfin/data/ClearingPlan.ts carry their own literal lists (a decorator needs
// literal arguments); keep the two in sync.

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

// Canonical districts from data/generate.py. district_name is a free-text field
// on the entity (per the slice decisions); the form offers these as a dropdown
// for usability.
export const DISTRICTS = [
  'North Ridge',
  'Pine Hollow',
  'Cedar Valley',
  'Stone Creek',
  'Elk Meadow',
] as const;

export const NOTES_MAX = 500;

/** A feeder row as the app reads and displays it. Dates are `Date | null`. */
export interface ClearingPlanRow {
  id: string;
  feeder_id: string;
  district_name: string;
  vendor: Vendor;
  last_cleared_date: Date | null;
  last_work_done: string | null;
  next_clearing_date: Date | null;
  date_certainty: DateCertainty;
  planned_year: number | null;
  notes: string | null;
  updated_by: string;
  updated_at: Date;
}

/**
 * The editable subset, as the form holds it. Dates are `yyyy-mm-dd` strings (or
 * '') so they bind directly to `<input type="date">`; `planned_year` is the raw
 * string from a number input. The service converts this to a typed write.
 */
export interface ClearingPlanEdit {
  vendor: Vendor;
  last_cleared_date: string;
  last_work_done: string;
  next_clearing_date: string;
  date_certainty: DateCertainty;
  planned_year: string;
  notes: string;
}
