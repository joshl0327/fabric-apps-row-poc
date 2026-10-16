import type { ClearingPlanEdit, ClearingPlanRow } from './clearingPlanModel';
import { getRayfinClient, isLocalBackend } from './rayfinClient';
import { SEED_ROWS } from './seed';

// The fields the client reads back from the data API, in display order.
const FIELDS = [
  'id',
  'feeder_id',
  'district_name',
  'vendor',
  'last_cleared_date',
  'last_work_done',
  'next_clearing_date',
  'date_certainty',
  'planned_year',
  'notes',
  'updated_by',
  'updated_at',
] as const;

// Local-dev fallback: when no Fabric backend is configured (plain `vite` /
// `npm run dev:frontend`), keep feeders in memory, pre-seeded, so the slice is
// fully usable offline with no database and no deploy. Mirrors the template's
// in-memory Todo store.
let inMemory: ClearingPlanRow[] | null = null;
function localStore(): ClearingPlanRow[] {
  if (inMemory === null) {
    inMemory = SEED_ROWS.map((r) => ({ ...r }));
  }
  return inMemory;
}

const byFeeder = (a: ClearingPlanRow, b: ClearingPlanRow) =>
  a.feeder_id.localeCompare(b.feeder_id, undefined, { numeric: true });

/** A date value coming from the data API is an ISO string; normalise to Date. */
const toDate = (value: unknown): Date | null =>
  value == null || value === '' ? null : new Date(value as string);

function fromApi(raw: Record<string, unknown>): ClearingPlanRow {
  return {
    id: String(raw.id),
    feeder_id: String(raw.feeder_id),
    district_name: String(raw.district_name),
    vendor: raw.vendor as ClearingPlanRow['vendor'],
    last_cleared_date: toDate(raw.last_cleared_date),
    last_work_done: (raw.last_work_done as string | null) ?? null,
    next_clearing_date: toDate(raw.next_clearing_date),
    date_certainty: raw.date_certainty as ClearingPlanRow['date_certainty'],
    planned_year: (raw.planned_year as number | null) ?? null,
    notes: (raw.notes as string | null) ?? null,
    updated_by: String(raw.updated_by ?? ''),
    updated_at: toDate(raw.updated_at) ?? new Date(),
  };
}

export async function listClearingPlans(): Promise<ClearingPlanRow[]> {
  if (isLocalBackend()) {
    return [...localStore()].sort(byFeeder);
  }
  const client = getRayfinClient();
  const results = await client.data.ClearingPlan.select([...FIELDS])
    .orderBy({ feeder_id: 'asc' })
    .execute();
  return (results as unknown as Record<string, unknown>[]).map(fromApi);
}

/** The editable values in domain form (dates as `Date | null`). */
function toWrite(edit: ClearingPlanEdit, updatedBy: string) {
  return {
    vendor: edit.vendor,
    date_certainty: edit.date_certainty,
    last_cleared_date: edit.last_cleared_date
      ? new Date(edit.last_cleared_date)
      : null,
    last_work_done: edit.last_work_done.trim() || null,
    next_clearing_date: edit.next_clearing_date
      ? new Date(edit.next_clearing_date)
      : null,
    planned_year: edit.planned_year ? Number(edit.planned_year) : null,
    notes: edit.notes.trim() || null,
    updated_by: updatedBy,
    updated_at: new Date(),
  };
}

// The Rayfin mutation type takes `T | undefined` for optional fields, not
// `null`. For CREATE, "no value" and "null" are equivalent, so collapse null to
// undefined and let the column default to null.
const nullToUndef = <T>(v: T | null): T | undefined => v ?? undefined;

// For UPDATE, null and undefined are NOT equivalent. The installed
// @microsoft/rayfin-data client serialises an explicit `null` to a GraphQL
// `null` literal — which DAB applies as "set this column to null" — but OMITS an
// `undefined` field entirely, leaving the stored value unchanged
// (formatMutationInput skips only undefined; formatGraphQLValue renders null as
// `null`). So clearing a field on update means sending a runtime `null`. The
// generated `UpdateInput` type has no `null` in it, so the cast carries the null
// through without changing it. See docs/app-notes.md "Clear-to-null on Fabric".
const clearable = <T>(v: T | null): T | undefined => v as unknown as T | undefined;

// The optional fields the edit form can clear, verified on read-back below.
const VERIFIED_FIELDS = [
  'vendor',
  'date_certainty',
  'last_cleared_date',
  'last_work_done',
  'next_clearing_date',
  'planned_year',
  'notes',
  'updated_by',
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
 * Compare what we submitted against the row the server actually kept. Returns a
 * human-readable description of each field whose stored value differs, naming
 * the value the server kept. `updated_at` is intentionally not verified: a
 * datetime can lose sub-second precision on the round trip.
 */
export function diffSavedRow(
  submitted: SubmittedWrite,
  saved: ClearingPlanRow
): string[] {
  const mismatches: string[] = [];
  for (const field of VERIFIED_FIELDS) {
    const sent = submitted[field];
    const kept = saved[field];
    if (!valuesEqual(sent, kept)) {
      mismatches.push(
        `${field} (sent ${display(sent)}, server kept ${display(kept)})`
      );
    }
  }
  return mismatches;
}

export async function updateClearingPlan(
  id: string,
  edit: ClearingPlanEdit,
  updatedBy: string
): Promise<ClearingPlanRow> {
  const write = toWrite(edit, updatedBy);

  if (isLocalBackend()) {
    const row = localStore().find((r) => r.id === id);
    if (!row) throw new Error('Feeder not found');
    Object.assign(row, write);
    return { ...row };
  }

  const client = getRayfinClient();
  await client.data.ClearingPlan.update(
    { id },
    {
      vendor: write.vendor,
      date_certainty: write.date_certainty,
      // Cleared optional fields go as explicit null (set to null), not undefined
      // (leave unchanged) — see `clearable` above. Fixes the prompt-08 bug where
      // clearing a date silently kept the old value.
      last_cleared_date: clearable(write.last_cleared_date),
      last_work_done: clearable(write.last_work_done),
      next_clearing_date: clearable(write.next_clearing_date),
      planned_year: clearable(write.planned_year),
      notes: clearable(write.notes),
      updated_by: write.updated_by,
      updated_at: write.updated_at,
    }
  );

  // Read the full row back and confirm the server kept what we submitted. A
  // silent mismatch (e.g. a cleared field the API left unchanged) must surface
  // as an error, not bad data. `findById` only selects the key, so select the
  // display fields explicitly.
  const rows = (await client.data.ClearingPlan.select([...FIELDS])
    .where({ id: { eq: id } })
    .execute()) as unknown as Record<string, unknown>[];
  if (rows.length === 0) {
    throw new Error('Saved feeder could not be read back to confirm the change.');
  }
  const saved = fromApi(rows[0]);

  const mismatches = diffSavedRow(write, saved);
  if (mismatches.length > 0) {
    throw new Error(
      `The save did not fully apply — the server kept different values for: ${mismatches.join('; ')}.`
    );
  }
  return saved;
}

/**
 * One-time load of the 15 sample rows into the Fabric database. The deployed
 * app starts empty; this is the gated seed path (see docs/app-notes.md).
 *
 * Requires the `@authenticated('create')` permission on the entity, which is
 * committed commented-out — enable it, deploy, run this once, then disable it
 * and redeploy. Not used in local mode (the in-memory store is pre-seeded), so
 * it throws there to avoid confusion.
 */
export async function seedFabric(updatedBy: string): Promise<number> {
  if (isLocalBackend()) {
    throw new Error('Local backend is already seeded; seeding is Fabric-only.');
  }
  const client = getRayfinClient();
  for (const r of SEED_ROWS) {
    await client.data.ClearingPlan.create({
      feeder_id: r.feeder_id,
      district_name: r.district_name,
      vendor: r.vendor,
      last_cleared_date: nullToUndef(r.last_cleared_date),
      last_work_done: nullToUndef(r.last_work_done),
      next_clearing_date: nullToUndef(r.next_clearing_date),
      date_certainty: r.date_certainty,
      planned_year: nullToUndef(r.planned_year),
      notes: nullToUndef(r.notes),
      updated_by: updatedBy,
      updated_at: new Date(),
    });
  }
  return SEED_ROWS.length;
}
