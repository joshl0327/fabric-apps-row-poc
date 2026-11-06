// Shared types for the change-log (audit trail), used by the service, UI and
// tests. Copied from app/row-tracker/src/services/changeLogModel.ts (deliberate
// duplicate; see validation.ts). The logged field names stay snake_case so the
// before_json / after_json blobs this app writes are byte-compatible with the
// rows the first app writes and reads — both apps share one ChangeLogs table.

export type ChangeAction = 'create' | 'update';

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

export const FIELD_LABELS: Record<LoggedField, string> = {
  vendor: 'Vendor',
  date_certainty: 'Date certainty',
  next_clearing_date: 'Next clearing date',
  last_cleared_date: 'Last cleared date',
  planned_year: 'Planned year',
  last_work_done: 'Last work done',
  notes: 'Notes',
};

export type LoggedValue = string | number | null;

export interface FieldChange {
  field: LoggedField;
  before: LoggedValue;
  after: LoggedValue;
}

export interface ChangeLogRow {
  id: string;
  feeder_id: string;
  action: ChangeAction;
  changed_by: string;
  changed_at: Date;
  changes: FieldChange[];
  reason: string | null;
}
