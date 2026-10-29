import { beforeEach, describe, expect, it, vi } from 'vitest';

// Fabric-backend path: isLocalBackend() is false, so the log write goes through
// the mocked Rayfin client's ChangeLog.create.
const mocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('@/services/rayfinClient', () => ({
  isLocalBackend: () => false,
  getRayfinClient: () => ({ data: { ChangeLog: { create: mocks.create } } }),
}));

import { logFeederUpdate } from '@/services/changeLog';
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

const changedAfter = makeRow({ vendor: 'Ironwood Forestry', date_certainty: 'TBD', next_clearing_date: null });

describe('logFeederUpdate (Fabric path)', () => {
  beforeEach(() => mocks.create.mockReset());

  it('creates one audit row stamped with the caller email', async () => {
    mocks.create.mockResolvedValue({});

    const result = await logFeederUpdate(makeRow(), changedAfter, 'ada@coop.test', null);

    expect(result).toEqual({ logged: true });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const [entry] = mocks.create.mock.calls[0];
    expect(entry.changed_by).toBe('ada@coop.test');
    expect(entry.action).toBe('update');
    expect(entry.reason).toBeUndefined();
    // Only the changed fields are stored.
    expect(Object.keys(JSON.parse(entry.after_json)).sort()).toEqual([
      'date_certainty',
      'next_clearing_date',
      'vendor',
    ]);
  });

  it('reports "saved but not logged" when the log write fails', async () => {
    mocks.create.mockRejectedValueOnce(new Error('GraphQL errors: insert failed'));

    const result = await logFeederUpdate(makeRow(), changedAfter, 'ada@coop.test', null);

    expect(result.logged).toBe(false);
    expect(result.error).toMatch(/saved/i);
    expect(result.error).toMatch(/not be logged/i);
  });
});
