// Change-log (audit trail) service. Pure helpers (diff, entry assembly, parse)
// are unit-tested directly; IO uses the in-memory store locally and the
// row-tracker SQL connector against Fabric. Mirrors app/row-tracker/src/
// services/changeLog.ts, adapted to the connector client (camelCase columns).
//
// ChangeLogs grants read + create only (append-only), and the create policy pins
// changedBy to the caller's email — enforced server-side, same as the first app.

import type { FeederRow } from './clearingPlanModel';
import {
  LOGGED_FIELDS,
  type ChangeAction,
  type ChangeLogRow,
  type FieldChange,
  type LoggedField,
  type LoggedValue,
} from './changeLogModel';
import { toUserMessage } from './errors';
import { isLocalBackend, localChangeLog } from './local-backend';

// Connector entity columns (camelCase), stable order.
const FIELDS = [
  'id',
  'feederId',
  'action',
  'changedBy',
  'changedAt',
  'beforeJson',
  'afterJson',
  'reason',
] as const;

// Snake_case logged field -> camelCase FeederRow property. The logged keys stay
// snake_case (see changeLogModel.ts) so blobs match the first app's.
const FIELD_TO_ROW: Record<LoggedField, keyof FeederRow> = {
  vendor: 'vendor',
  date_certainty: 'dateCertainty',
  next_clearing_date: 'nextClearingDate',
  last_cleared_date: 'lastClearedDate',
  planned_year: 'plannedYear',
  last_work_done: 'lastWorkDone',
  notes: 'notes',
};

function loggedValue(row: FeederRow, field: LoggedField): LoggedValue {
  const v = row[FIELD_TO_ROW[field]];
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v as LoggedValue;
}

/** Changed-fields diff, oldest-value first; a cleared field has after: null. Pure. */
export function diffFeeder(before: FeederRow, after: FeederRow): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of LOGGED_FIELDS) {
    const b = loggedValue(before, field);
    const a = loggedValue(after, field);
    if (b !== a) changes.push({ field, before: b, after: a });
  }
  return changes;
}

/** Create input for one change-log row (connector camelCase). Pure. */
export function buildChangeLogWrite(
  feederId: string,
  changedBy: string,
  changes: FieldChange[],
  reason: string | null,
  action: ChangeAction = 'update',
) {
  const before: Record<string, LoggedValue> = {};
  const after: Record<string, LoggedValue> = {};
  for (const c of changes) {
    before[c.field] = c.before;
    after[c.field] = c.after;
  }
  return {
    feederId,
    action,
    changedBy,
    changedAt: new Date(),
    beforeJson: JSON.stringify(before),
    afterJson: JSON.stringify(after),
    reason: reason ?? undefined,
  };
}

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
    feeder_id: String(raw.feederId),
    action: raw.action as ChangeAction,
    changed_by: String(raw.changedBy ?? ''),
    changed_at: new Date(raw.changedAt as string),
    changes: parseChanges(String(raw.beforeJson ?? '{}'), String(raw.afterJson ?? '{}')),
    reason: (raw.reason as string | null) ?? null,
  };
}

const newestFirst = (a: ChangeLogRow, b: ChangeLogRow) =>
  b.changed_at.getTime() - a.changed_at.getTime();

// Lazy (see clearingPlans.ts): keep the connector entity graph out of local dev
// and tests.
async function logClient() {
  const { getRayfinClient } = await import('@/lib/rayfin-client');
  return getRayfinClient().connectors['row-tracker'].ChangeLogs;
}

type ChangeLogWrite = ReturnType<typeof buildChangeLogWrite>;

async function writeChangeLog(entry: ChangeLogWrite): Promise<void> {
  if (isLocalBackend()) {
    localChangeLog().push({
      id: crypto.randomUUID(),
      feeder_id: entry.feederId,
      action: entry.action,
      changed_by: entry.changedBy,
      changed_at: entry.changedAt,
      changes: parseChanges(entry.beforeJson, entry.afterJson),
      reason: entry.reason ?? null,
    });
    return;
  }
  await (await logClient()).create(entry);
}

/** Change history for one feeder, newest first. */
export async function listFeederHistory(feederId: string): Promise<ChangeLogRow[]> {
  if (isLocalBackend()) {
    return localChangeLog().filter((e) => e.feeder_id === feederId).sort(newestFirst);
  }
  const rows = (await (await logClient())
    .select([...FIELDS])
    .where({ feederId: { eq: feederId } })
    .orderBy({ changedAt: 'desc' })
    .execute()) as unknown as Record<string, unknown>[];
  return rows.map(fromApi);
}

/** The most recent changes across all feeders, newest first. */
export async function listRecentChanges(limit = 50): Promise<ChangeLogRow[]> {
  if (isLocalBackend()) {
    return [...localChangeLog()].sort(newestFirst).slice(0, limit);
  }
  const rows = (await (await logClient())
    .select([...FIELDS])
    .orderBy({ changedAt: 'desc' })
    .first(limit)
    .execute()) as unknown as Record<string, unknown>[];
  return rows.map(fromApi);
}

export interface LogResult {
  logged: boolean;
  error?: string;
}

const SAVED_NOT_LOGGED = 'The edit was saved, but it could not be logged';

/**
 * Write the audit row for a successful save, from the server-verified `after`
 * row. Returns a result rather than throwing: the edit is already persisted, so
 * a logging failure is a visible warning, not a lost save. changedBy must be the
 * signed-in email (the create policy pins the row to it); with no email we skip
 * the write and report "saved but not logged" — no invented author.
 */
export async function logFeederUpdate(
  before: FeederRow,
  after: FeederRow,
  changedBy: string | null,
  reason: string | null,
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
    await writeChangeLog(buildChangeLogWrite(after.feederId, changedBy, changes, reason));
    return { logged: true };
  } catch (err) {
    return {
      logged: false,
      error: `${SAVED_NOT_LOGGED}: ${toUserMessage(err, 'the change-log write failed.')}`,
    };
  }
}
