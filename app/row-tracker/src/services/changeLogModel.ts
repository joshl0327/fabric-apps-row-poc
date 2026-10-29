// Shared types for the change-log (audit trail) slice, used by the service, the
// UI and the tests. The entity itself lives in rayfin/data/ChangeLog.ts.

export type ChangeAction = 'create' | 'update';

// The feeder fields whose changes we log. Business-editable fields only —
// identity (id, feeder_id), district (not editable in the form) and audit
// metadata (updated_by/updated_at) are deliberately excluded.
export const LOGGED_FIELDS = [
  'vendor',
  'date_certainty',
  'next_clearing_date',
  'last_cleared_date',
  'planned_year',
  'last_work_done',
  'notes',
] as const;
export type LoggedField = (typeof LOGGED_FIELDS)[number];

// Friendly labels for the History / Recent changes views.
export const FIELD_LABELS: Record<LoggedField, string> = {
  vendor: 'Vendor',
  date_certainty: 'Date certainty',
  next_clearing_date: 'Next clearing date',
  last_cleared_date: 'Last cleared date',
  planned_year: 'Planned year',
  last_work_done: 'Last work done',
  notes: 'Notes',
};

// A logged value is a plain scalar so it round-trips through JSON cleanly:
// dates are stored as `yyyy-mm-dd` strings, a planned year as a number, text as
// text, and a cleared value as null.
export type LoggedValue = string | number | null;

/** One field that changed in a save: its old and new value. */
export interface FieldChange {
  field: LoggedField;
  before: LoggedValue;
  after: LoggedValue;
}

/** A change-log row as the app reads and displays it. `changes` is parsed from
 * the stored before_json / after_json. */
export interface ChangeLogRow {
  id: string;
  feeder_id: string;
  action: ChangeAction;
  changed_by: string;
  changed_at: Date;
  changes: FieldChange[];
  reason: string | null;
}
