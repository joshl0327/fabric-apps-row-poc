// The feeder-load logic for prompt 09: turn the Snowflake ANALYTICS export CSV
// (see snowflake/08_app_load_export.sql) into clean feeder rows, validated with
// the SAME rules as the edit form, then upserted by feeder_id. Everything here
// is pure (no Rayfin client, no DOM) so it is unit-tested directly; the IO wiring
// lives in clearingPlans.ts (importFeeders).

import { parseCsv } from './csv';
import {
  DATE_CERTAINTIES,
  VENDORS,
  type ClearingPlanEdit,
  type DateCertainty,
} from './clearingPlanModel';
import { validateClearingPlan } from './validation';

// The columns 08_app_load_export.sql emits, in order. The header is matched by
// name (not position), so a reordered export still loads; a missing column is a
// whole-file error.
export const EXPORT_COLUMNS = [
  'feeder_id',
  'district_name',
  'vendor',
  'last_cleared_date',
  'last_work_done',
  'next_clearing_date',
  'date_certainty',
  'planned_year',
  'notes',
] as const;

const FEEDER_ID_MAX = 20;

/** One clean feeder from the file, ready to create or update. */
export interface ImportRecord {
  feeder_id: string;
  district_name: string;
  edit: ClearingPlanEdit;
}

/** A row that failed parsing/validation and was skipped. `row` is 1-based over
 * the data rows (header excluded). */
export interface ImportRowError {
  row: number;
  feeder_id: string;
  reason: string;
}

export interface ParsedImport {
  records: ImportRecord[];
  errors: ImportRowError[];
}

export interface Reconciliation {
  total: number;
  certainty: Record<DateCertainty, number>;
  withNextDate: number;
}

export interface UpsertPlan {
  toCreate: ImportRecord[];
  toUpdate: { id: string; record: ImportRecord }[];
  /** feeder_ids already in the app that the file does NOT contain. Reported,
   * never deleted (the app has no delete permission) — see docs/app-notes.md. */
  leftover: string[];
}

export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
  leftover: string[];
  reconciliation: Reconciliation;
}

/**
 * Parse and validate the export CSV. Every row is checked with the same rules
 * the edit form uses (validation.ts) plus the two fields the form doesn't hold
 * (feeder_id, district_name) and a duplicate-feeder guard. A failing row is
 * skipped and recorded in `errors`, never silently dropped. Throws only for a
 * structural problem (empty file, missing column) that fails the whole file.
 */
export function parseFeederImport(text: string): ParsedImport {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error('The file is empty.');
  }

  const header = rows[0].map((h) => h.trim());
  const index: Partial<Record<(typeof EXPORT_COLUMNS)[number], number>> = {};
  const missing: string[] = [];
  for (const col of EXPORT_COLUMNS) {
    const at = header.indexOf(col);
    if (at === -1) missing.push(col);
    else index[col] = at;
  }
  if (missing.length > 0) {
    throw new Error(`The file is missing column(s): ${missing.join(', ')}.`);
  }

  const records: ImportRecord[] = [];
  const errors: ImportRowError[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const cell = (col: (typeof EXPORT_COLUMNS)[number]): string =>
      (cells[index[col]!] ?? '').trim();

    // Skip a fully blank line (e.g. a trailing newline the parser kept).
    if (cells.every((c) => c.trim() === '')) continue;

    const rowNum = i; // 1-based data row (header is row 0)
    const feeder_id = cell('feeder_id');
    const district_name = cell('district_name');
    const edit: ClearingPlanEdit = {
      vendor: cell('vendor') as ClearingPlanEdit['vendor'],
      date_certainty: cell('date_certainty') as DateCertainty,
      last_cleared_date: cell('last_cleared_date'),
      last_work_done: cell('last_work_done'),
      next_clearing_date: cell('next_clearing_date'),
      planned_year: cell('planned_year'),
      notes: cell('notes'),
    };

    const reason = firstRowError(feeder_id, district_name, edit, seen);
    if (reason) {
      errors.push({ row: rowNum, feeder_id: feeder_id || '(blank)', reason });
      continue;
    }

    seen.add(feeder_id);
    records.push({ feeder_id, district_name, edit });
  }

  return { records, errors };
}

/** The first reason this row can't be loaded, or '' if it's valid. */
function firstRowError(
  feeder_id: string,
  district_name: string,
  edit: ClearingPlanEdit,
  seen: Set<string>
): string {
  if (!feeder_id) return 'feeder_id is required.';
  if (feeder_id.length > FEEDER_ID_MAX)
    return `feeder_id must be ${FEEDER_ID_MAX} characters or fewer.`;
  if (seen.has(feeder_id)) return 'duplicate feeder_id in file.';
  if (!district_name) return 'district_name is required.';
  if (!VENDORS.includes(edit.vendor))
    return `vendor "${edit.vendor}" is not in the canonical list.`;
  if (!DATE_CERTAINTIES.includes(edit.date_certainty))
    return `date_certainty "${edit.date_certainty}" is not valid.`;

  // The cross-field + remaining per-field rules, identical to the edit form.
  const errors = validateClearingPlan(edit);
  const keys = Object.keys(errors) as (keyof typeof errors)[];
  if (keys.length > 0) return errors[keys[0]]!;

  return '';
}

/** Certainty mix and next-date count over the valid records — the numbers the
 * load reconciles against docs/measures.md. */
export function reconcile(records: ImportRecord[]): Reconciliation {
  const certainty: Record<DateCertainty, number> = {
    confirmed: 0,
    tentative: 0,
    'next year': 0,
    TBD: 0,
  };
  let withNextDate = 0;
  for (const r of records) {
    certainty[r.edit.date_certainty]++;
    if (r.edit.next_clearing_date !== '') withNextDate++;
  }
  return { total: records.length, certainty, withNextDate };
}

/** Decide create vs update for each record by matching feeder_id against the
 * rows already in the app, and list the leftover rows the file doesn't cover. */
export function planUpsert(
  records: ImportRecord[],
  existing: { id: string; feeder_id: string }[]
): UpsertPlan {
  const idByFeeder = new Map(existing.map((e) => [e.feeder_id, e.id]));
  const incoming = new Set(records.map((r) => r.feeder_id));

  const toCreate: ImportRecord[] = [];
  const toUpdate: { id: string; record: ImportRecord }[] = [];
  for (const record of records) {
    const id = idByFeeder.get(record.feeder_id);
    if (id) toUpdate.push({ id, record });
    else toCreate.push(record);
  }

  const leftover = existing
    .filter((e) => !incoming.has(e.feeder_id))
    .map((e) => e.feeder_id);

  return { toCreate, toUpdate, leftover };
}

/** Assemble the result summary shown after a load. `created`/`updated` are the
 * rows actually written; the rest comes from the parse + plan. */
export function buildSummary(
  created: number,
  updated: number,
  parsed: ParsedImport,
  plan: UpsertPlan
): ImportSummary {
  return {
    created,
    updated,
    skipped: parsed.errors.length,
    errors: parsed.errors,
    leftover: plan.leftover,
    reconciliation: reconcile(parsed.records),
  };
}
