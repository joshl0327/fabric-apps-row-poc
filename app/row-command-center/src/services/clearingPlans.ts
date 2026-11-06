// Feeder data service. Reads and updates the ClearingPlans table through the
// row-tracker SQL connector (Category A) against Fabric, or the in-memory
// synthetic store in local dev. Mirrors app/row-tracker/src/services/
// clearingPlans.ts, adapted to the connector client (camelCase columns, the
// fabric-sqldatabase dialect returns the full persisted row on write).
//
// Write rules match the first app and the data boundary: update only (no create,
// no delete — those grants are absent from the entity), cleared fields sent as
// explicit null, and every save read back and compared field by field.

import type { FeederEdit, FeederRow, Vendor } from './clearingPlanModel';
import { DATE_CERTAINTIES } from './clearingPlanModel';
import { isLocalBackend, localFeeders } from './local-backend';

// Connector entity column set, in display order (camelCase properties).
const FIELDS = [
  'id',
  'feederId',
  'districtName',
  'vendor',
  'lastClearedDate',
  'lastWorkDone',
  'nextClearingDate',
  'dateCertainty',
  'plannedYear',
  'notes',
  'updatedBy',
  'updatedAt',
] as const;

const byFeeder = (a: FeederRow, b: FeederRow) =>
  a.feederId.localeCompare(b.feederId, undefined, { numeric: true });

const toDate = (value: unknown): Date | null =>
  value == null || value === '' ? null : value instanceof Date ? value : new Date(value as string);

function fromApi(raw: Record<string, unknown>): FeederRow {
  const certainty = raw.dateCertainty as FeederRow['dateCertainty'];
  return {
    id: String(raw.id),
    feederId: String(raw.feederId),
    districtName: String(raw.districtName),
    vendor: raw.vendor as Vendor,
    lastClearedDate: toDate(raw.lastClearedDate),
    lastWorkDone: (raw.lastWorkDone as string | null) ?? null,
    nextClearingDate: toDate(raw.nextClearingDate),
    dateCertainty: DATE_CERTAINTIES.includes(certainty) ? certainty : 'TBD',
    plannedYear: (raw.plannedYear as number | null) ?? null,
    notes: (raw.notes as string | null) ?? null,
    updatedBy: String(raw.updatedBy ?? ''),
    updatedAt: toDate(raw.updatedAt) ?? new Date(),
  };
}

// Lazy, DEV-safe: importing the connector client pulls in the generated entity
// classes (TC39 decorators). Loading it only inside the Fabric branch keeps that
// graph out of local dev and the unit tests, which run entirely on the in-memory
// store.
async function rowClient() {
  const { getRayfinClient } = await import('@/lib/rayfin-client');
  return getRayfinClient().connectors['row-tracker'].ClearingPlans;
}

export async function listFeeders(): Promise<FeederRow[]> {
  if (isLocalBackend()) {
    return [...localFeeders()].sort(byFeeder);
  }
  const rows = (await (await rowClient())
    .select([...FIELDS])
    .orderBy({ feederId: 'asc' })
    .execute()) as unknown as Record<string, unknown>[];
  return rows.map(fromApi);
}

/** Editable values in domain form (dates as Date|null). */
function toWrite(edit: FeederEdit, updatedBy: string) {
  return {
    vendor: edit.vendor,
    dateCertainty: edit.date_certainty,
    lastClearedDate: edit.last_cleared_date ? new Date(edit.last_cleared_date) : null,
    lastWorkDone: edit.last_work_done.trim() || null,
    nextClearingDate: edit.next_clearing_date ? new Date(edit.next_clearing_date) : null,
    plannedYear: edit.planned_year ? Number(edit.planned_year) : null,
    notes: edit.notes.trim() || null,
    updatedBy,
    updatedAt: new Date(),
  };
}

// On UPDATE a cleared field must go as an explicit null ("set to null"), not
// undefined ("leave unchanged") — the same rayfin-data serialization the first
// app relies on. The generated update type has no null, so carry it through a
// cast. See app/row-tracker/docs "Clear-to-null on Fabric".
const clearable = <T>(v: T | null): T | undefined => v as unknown as T | undefined;

const VERIFIED_FIELDS = [
  'vendor',
  'dateCertainty',
  'lastClearedDate',
  'lastWorkDone',
  'nextClearingDate',
  'plannedYear',
  'notes',
  'updatedBy',
] as const;

type SubmittedWrite = ReturnType<typeof toWrite>;

const valuesEqual = (a: unknown, b: unknown): boolean => {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date || b instanceof Date) return false;
  return (a ?? null) === (b ?? null);
};

const display = (v: unknown): string => {
  if (v == null) return '(cleared)';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
};

/**
 * Compare what we submitted against the row the server kept. Returns a
 * human-readable description of each differing field. `updatedAt` is not
 * verified — a datetime can lose sub-second precision on the round trip.
 */
export function diffSavedRow(submitted: SubmittedWrite, saved: FeederRow): string[] {
  const mismatches: string[] = [];
  for (const field of VERIFIED_FIELDS) {
    const sent = submitted[field];
    const kept = saved[field];
    if (!valuesEqual(sent, kept)) {
      mismatches.push(`${field} (sent ${display(sent)}, server kept ${display(kept)})`);
    }
  }
  return mismatches;
}

/**
 * Update a feeder and confirm the server kept exactly what we submitted. The
 * fabric-sqldatabase dialect returns the full persisted row from update(), which
 * IS the read-back; local mode mutates and returns the stored row. A mismatch
 * throws rather than leaving silent bad data.
 */
export async function updateFeeder(
  id: string,
  edit: FeederEdit,
  updatedBy: string,
): Promise<FeederRow> {
  const write = toWrite(edit, updatedBy);

  if (isLocalBackend()) {
    const row = localFeeders().find((r) => r.id === id);
    if (!row) throw new Error('Feeder not found');
    Object.assign(row, write);
    return { ...row };
  }

  const client = await rowClient();
  const saved = fromApi(
    (await client.update(
      { id },
      {
        vendor: write.vendor,
        dateCertainty: write.dateCertainty,
        lastClearedDate: clearable(write.lastClearedDate),
        lastWorkDone: clearable(write.lastWorkDone),
        nextClearingDate: clearable(write.nextClearingDate),
        plannedYear: clearable(write.plannedYear),
        notes: clearable(write.notes),
        updatedBy: write.updatedBy,
        updatedAt: write.updatedAt,
      },
    )) as unknown as Record<string, unknown>,
  );

  const mismatches = diffSavedRow(write, saved);
  if (mismatches.length > 0) {
    throw new Error(
      `The save did not fully apply — the server kept different values for: ${mismatches.join('; ')}.`,
    );
  }
  return saved;
}
