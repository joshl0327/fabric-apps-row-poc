// The change-log (audit trail) service. Pure helpers (diff, entry assembly) are
// unit-tested directly; the IO wiring uses the in-memory store in local mode and
// the typed Rayfin client against Fabric. See docs/app-notes.md.

import type { ClearingPlanRow } from './clearingPlanModel';
import {
  LOGGED_FIELDS,
  type ChangeAction,
  type ChangeLogRow,
  type FieldChange,
  type LoggedField,
  type LoggedValue,
} from './changeLogModel';
import { toUserMessage } from './errors';
import { getRayfinClient, isLocalBackend } from './rayfinClient';

// The fields read back from the data API, in a stable order.
const FIELDS = [
  'id',
  'feeder_id',
  'action',
  'changed_by',
  'changed_at',
  'before_json',
  'after_json',
  'reason',
] as const;

/** Normalise a feeder field to a JSON-safe scalar: dates to `yyyy-mm-dd`, a
 * cleared value to null, everything else as-is. */
function loggedValue(row: ClearingPlanRow, field: LoggedField): LoggedValue {
  const v = row[field];
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v as LoggedValue;
}

/**
 * The changed-fields diff: compare the feeder row before and after a save and
 * return only the fields whose value changed, oldest-value first. A cleared
 * field is reported with `after: null`. Pure — no IO.
 */
export function diffFeeder(
  before: ClearingPlanRow,
  after: ClearingPlanRow
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of LOGGED_FIELDS) {
    const b = loggedValue(before, field);
    const a = loggedValue(after, field);
    if (b !== a) changes.push({ field, before: b, after: a });
  }
  return changes;
}

/** The create input for one change-log row, built from a diff. before_json /
 * after_json carry only the changed fields. Pure — no IO. */
export function buildChangeLogWrite(
  feederId: string,
  changedBy: string,
  changes: FieldChange[],
  reason: string | null,
  action: ChangeAction = 'update'
) {
  const before: Record<string, LoggedValue> = {};
  const after: Record<string, LoggedValue> = {};
  for (const c of changes) {
    before[c.field] = c.before;
    after[c.field] = c.after;
  }
  return {
    feeder_id: feederId,
    action,
    changed_by: changedBy,
    changed_at: new Date(),
    before_json: JSON.stringify(before),
    after_json: JSON.stringify(after),
    reason: reason ?? undefined,
  };
}

/** Parse the stored JSON blobs back into display changes, in LOGGED_FIELDS
 * order. Tolerates malformed JSON by returning no changes. */
function parseChanges(beforeJson: string, afterJson: string): FieldChange[] {
  let before: Record<string, LoggedValue> = {};
  let after: Record<string, LoggedValue> = {};
  try {
    before = JSON.parse(beforeJson || '{}');
    after = JSON.parse(afterJson || '{}');
  } catch {
    return [];
  }
  return LOGGED_FIELDS.filter((f) => f in before || f in after).map((field) => ({
    field,
    before: before[field] ?? null,
    after: after[field] ?? null,
  }));
}

function fromApi(raw: Record<string, unknown>): ChangeLogRow {
  return {
    id: String(raw.id),
    feeder_id: String(raw.feeder_id),
    action: raw.action as ChangeAction,
    changed_by: String(raw.changed_by ?? ''),
    changed_at: new Date(raw.changed_at as string),
    changes: parseChanges(
      String(raw.before_json ?? '{}'),
      String(raw.after_json ?? '{}')
    ),
    reason: (raw.reason as string | null) ?? null,
  };
}

// Local-dev fallback: an in-memory append-only log, mirroring the in-memory
// feeder store. Empty at start.
let inMemory: ChangeLogRow[] = [];
const newestFirst = (a: ChangeLogRow, b: ChangeLogRow) =>
  b.changed_at.getTime() - a.changed_at.getTime();

/** Test-only: reset the in-memory log between cases. */
export function _resetLocalChangeLog(): void {
  inMemory = [];
}

type ChangeLogWrite = ReturnType<typeof buildChangeLogWrite>;

async function writeChangeLog(entry: ChangeLogWrite): Promise<void> {
  if (isLocalBackend()) {
    inMemory.push({
      id: crypto.randomUUID(),
      feeder_id: entry.feeder_id,
      action: entry.action,
      changed_by: entry.changed_by,
      changed_at: entry.changed_at,
      changes: parseChanges(entry.before_json, entry.after_json),
      reason: entry.reason ?? null,
    });
    return;
  }
  await getRayfinClient().data.ChangeLog.create(entry);
}

/** Change history for one feeder, newest first. */
export async function listFeederHistory(
  feederId: string
): Promise<ChangeLogRow[]> {
  if (isLocalBackend()) {
    return inMemory.filter((e) => e.feeder_id === feederId).sort(newestFirst);
  }
  const rows = (await getRayfinClient()
    .data.ChangeLog.select([...FIELDS])
    .where({ feeder_id: { eq: feederId } })
    .orderBy({ changed_at: 'desc' })
    .execute()) as unknown as Record<string, unknown>[];
  return rows.map(fromApi);
}

/** The most recent changes across all feeders, newest first. */
export async function listRecentChanges(limit = 20): Promise<ChangeLogRow[]> {
  if (isLocalBackend()) {
    return [...inMemory].sort(newestFirst).slice(0, limit);
  }
  const rows = (await getRayfinClient()
    .data.ChangeLog.select([...FIELDS])
    .orderBy({ changed_at: 'desc' })
    .first(limit)
    .execute()) as unknown as Record<string, unknown>[];
  return rows.map(fromApi);
}

/** The outcome of trying to log a save. The edit itself has already succeeded
 * by the time this runs; a failure here must be surfaced, never hidden. */
export interface LogResult {
  logged: boolean;
  /** A user-facing "saved but not logged" message when logging was needed but
   * did not happen. Absent when the row was logged, or when there was nothing to
   * log (an unchanged save). */
  error?: string;
}

const SAVED_NOT_LOGGED = 'The edit was saved, but it could not be logged';

/**
 * Write the audit row for a successful feeder save, using the server-verified
 * `after` row from the update read-back (prompt 08). Returns a result rather
 * than throwing: the edit is already persisted, so a logging failure is a
 * visible warning, not a lost save.
 *
 * `changedBy` must be the signed-in email (the create policy pins the audit row
 * to it). When it is null — no email on the session — we do NOT invent a value;
 * we skip the write and report "saved but not logged" (per the prompt-10
 * decision: no 'unknown' fallback for changed_by).
 */
export async function logFeederUpdate(
  before: ClearingPlanRow,
  after: ClearingPlanRow,
  changedBy: string | null,
  reason: string | null
): Promise<LogResult> {
  const changes = diffFeeder(before, after);
  if (changes.length === 0) return { logged: false };

  if (!changedBy) {
    return {
      logged: false,
      error: `${SAVED_NOT_LOGGED}: there is no signed-in email to attribute the change to.`,
    };
  }

  try {
    await writeChangeLog(
      buildChangeLogWrite(after.feeder_id, changedBy, changes, reason)
    );
    return { logged: true };
  } catch (err) {
    return {
      logged: false,
      error: `${SAVED_NOT_LOGGED}: ${toUserMessage(err, 'the change-log write failed.')}`,
    };
  }
}
