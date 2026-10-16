import { beforeEach, describe, expect, it, vi } from 'vitest';

// Fabric-backend path: isLocalBackend() is false, so updateClearingPlan goes
// through the mocked Rayfin client. The mock records the update payload and
// returns a controllable read-back row.
const mocks = vi.hoisted(() => {
  const update = vi.fn().mockResolvedValue({});
  const execute = vi.fn();
  const where = vi.fn(() => ({ execute }));
  const select = vi.fn(() => ({ where }));
  return { update, execute, where, select };
});

vi.mock('@/services/rayfinClient', () => ({
  isLocalBackend: () => false,
  getRayfinClient: () => ({
    data: { ClearingPlan: { update: mocks.update, select: mocks.select } },
  }),
}));

import type { ClearingPlanEdit } from '@/services/clearingPlanModel';
import { updateClearingPlan } from '@/services/clearingPlans';

// A confirmed feeder (2026-11-15) being changed to TBD with every optional field
// cleared — the exact prompt-08 scenario for feeder 101-1.
const clearingEdit: ClearingPlanEdit = {
  vendor: 'Ironwood Forestry',
  date_certainty: 'TBD',
  last_cleared_date: '',
  last_work_done: '',
  next_clearing_date: '',
  planned_year: '',
  notes: '',
};

/** The row the server reports back. Defaults echo a correctly-applied clear. */
function savedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'feeder-1',
    feeder_id: '101-1',
    district_name: 'North Ridge',
    vendor: 'Ironwood Forestry',
    last_cleared_date: null,
    last_work_done: null,
    next_clearing_date: null,
    date_certainty: 'TBD',
    planned_year: null,
    notes: null,
    updated_by: 'tester@local',
    updated_at: '2026-10-16T12:00:00.000Z',
    ...overrides,
  };
}

describe('updateClearingPlan (Fabric path)', () => {
  beforeEach(() => {
    mocks.update.mockClear();
    mocks.execute.mockReset();
  });

  it('sends cleared optional fields as explicit null, not undefined', async () => {
    mocks.execute.mockResolvedValue([savedRow()]);

    await updateClearingPlan('feeder-1', clearingEdit, 'tester@local');

    expect(mocks.update).toHaveBeenCalledTimes(1);
    const [, payload] = mocks.update.mock.calls[0];

    // Every cleared field is present AND null — undefined would be omitted and
    // the server would keep the old value (the bug this fixes).
    for (const field of [
      'next_clearing_date',
      'planned_year',
      'last_cleared_date',
      'last_work_done',
      'notes',
    ]) {
      expect(field in payload, `${field} present in payload`).toBe(true);
      expect(payload[field], `${field} is null`).toBeNull();
    }

    // Touched (non-cleared) fields still carry their value.
    expect(payload.date_certainty).toBe('TBD');
    expect(payload.vendor).toBe('Ironwood Forestry');
  });

  it('throws a field-named error when the server keeps a different value', async () => {
    // Server silently kept the old next clearing date instead of clearing it.
    mocks.execute.mockResolvedValue([
      savedRow({ next_clearing_date: '2026-11-15T00:00:00.000Z' }),
    ]);

    await expect(
      updateClearingPlan('feeder-1', clearingEdit, 'tester@local')
    ).rejects.toThrow(/next_clearing_date/);
  });

  it('returns the read-back row when everything matches', async () => {
    mocks.execute.mockResolvedValue([savedRow()]);

    const saved = await updateClearingPlan(
      'feeder-1',
      clearingEdit,
      'tester@local'
    );

    expect(saved.date_certainty).toBe('TBD');
    expect(saved.next_clearing_date).toBeNull();
  });
});
