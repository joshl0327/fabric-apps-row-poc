import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory (local backend) path — the audit log lives in the module's
// in-memory store; never touches the Rayfin client.
vi.mock('@/services/rayfinClient', () => ({
  isLocalBackend: () => true,
  getRayfinClient: vi.fn(),
}));

import {
  _resetLocalChangeLog,
  buildChangeLogWrite,
  diffFeeder,
  listFeederHistory,
  listRecentChanges,
  logFeederUpdate,
} from '@/services/changeLog';
import type { ClearingPlanRow } from '@/services/clearingPlanModel';

function makeRow(over: Partial<ClearingPlanRow> = {}): ClearingPlanRow {
  return {
    id: 'f1',
    feeder_id: '101-1',
    district_name: 'North Ridge',
    vendor: 'Summit Vegetation Management',
    last_cleared_date: new Date('2021-06-14'),
    last_work_done: 'trim',
    next_clearing_date: new Date('2026-11-15'),
    date_certainty: 'confirmed',
    planned_year: null,
    notes: 'gate locked',
    updated_by: 'seed',
    updated_at: new Date('2026-10-16T12:00:00Z'),
    ...over,
  };
}

// A confirmed feeder changed to TBD: vendor + certainty changed, next date
// cleared; notes unchanged.
const changedAfter = makeRow({
  vendor: 'Ironwood Forestry',
  date_certainty: 'TBD',
  next_clearing_date: null,
});

beforeEach(() => _resetLocalChangeLog());
afterEach(() => vi.useRealTimers());

describe('diffFeeder', () => {
  it('returns only the changed fields, in logged-field order', () => {
    const changes = diffFeeder(makeRow(), changedAfter);
    expect(changes.map((c) => c.field)).toEqual([
      'vendor',
      'date_certainty',
      'next_clearing_date',
    ]);
  });

  it('records a cleared value as null (old value preserved)', () => {
    const changes = diffFeeder(makeRow(), changedAfter);
    const nc = changes.find((c) => c.field === 'next_clearing_date')!;
    expect(nc.before).toBe('2026-11-15');
    expect(nc.after).toBeNull();
  });

  it('returns no changes when nothing changed', () => {
    expect(diffFeeder(makeRow(), makeRow())).toEqual([]);
  });
});

describe('buildChangeLogWrite', () => {
  it('builds an update entry holding only the changed fields', () => {
    const changes = diffFeeder(makeRow(), changedAfter);
    const w = buildChangeLogWrite('101-1', 'ada@coop.test', changes, 'rescheduled');

    expect(w.feeder_id).toBe('101-1');
    expect(w.action).toBe('update');
    expect(w.changed_by).toBe('ada@coop.test');
    expect(w.reason).toBe('rescheduled');

    const before = JSON.parse(w.before_json);
    const after = JSON.parse(w.after_json);
    expect(Object.keys(after).sort()).toEqual([
      'date_certainty',
      'next_clearing_date',
      'vendor',
    ]);
    expect('notes' in after).toBe(false); // unchanged field not stored
    expect(before.next_clearing_date).toBe('2026-11-15');
    expect(after.next_clearing_date).toBeNull();
    expect(after.vendor).toBe('Ironwood Forestry');
  });

  it('omits reason when none is given', () => {
    const w = buildChangeLogWrite('101-1', 'ada@coop.test', [], null);
    expect(w.reason).toBeUndefined();
  });
});

describe('logFeederUpdate', () => {
  it('writes an audit row on a real change and reads it back', async () => {
    const result = await logFeederUpdate(
      makeRow(),
      changedAfter,
      'ada@coop.test',
      'rescheduled'
    );
    expect(result).toEqual({ logged: true });

    const history = await listFeederHistory('101-1');
    expect(history).toHaveLength(1);
    expect(history[0].changed_by).toBe('ada@coop.test');
    expect(history[0].reason).toBe('rescheduled');
    expect(history[0].changes.map((c) => c.field)).toContain('vendor');
  });

  it('does not log and does not error when nothing changed', async () => {
    const result = await logFeederUpdate(makeRow(), makeRow(), 'ada@coop.test', null);
    expect(result.logged).toBe(false);
    expect(result.error).toBeUndefined();
    expect(await listFeederHistory('101-1')).toHaveLength(0);
  });

  it('reports "saved but not logged" and writes nothing when there is no email', async () => {
    const result = await logFeederUpdate(makeRow(), changedAfter, null, null);
    expect(result.logged).toBe(false);
    expect(result.error).toMatch(/saved/i);
    expect(result.error).toMatch(/not be logged/i);
    expect(await listFeederHistory('101-1')).toHaveLength(0);
  });
});

describe('history ordering', () => {
  it('returns feeder history newest first', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));
    await logFeederUpdate(makeRow(), makeRow({ vendor: 'Ironwood Forestry' }), 'a@x', null);
    vi.setSystemTime(new Date('2026-01-01T11:00:00Z'));
    await logFeederUpdate(makeRow(), makeRow({ vendor: 'Clearline Tree Service' }), 'a@x', null);
    vi.useRealTimers();

    const history = await listFeederHistory('101-1');
    expect(history).toHaveLength(2);
    expect(history[0].changed_at.getTime()).toBeGreaterThan(
      history[1].changed_at.getTime()
    );
  });

  it('limits recent changes across all feeders', async () => {
    await logFeederUpdate(makeRow(), makeRow({ vendor: 'Ironwood Forestry' }), 'a@x', null);
    await logFeederUpdate(
      makeRow({ feeder_id: '118-2' }),
      makeRow({ feeder_id: '118-2', vendor: 'Ironwood Forestry' }),
      'a@x',
      null
    );
    expect(await listRecentChanges(1)).toHaveLength(1);
    expect(await listRecentChanges(20)).toHaveLength(2);
  });
});
