import { describe, expect, it, vi } from 'vitest';

// Force the in-memory (local backend) path; never touches the Rayfin client.
vi.mock('@/services/rayfinClient', () => ({
  isLocalBackend: () => true,
  getRayfinClient: vi.fn(),
}));

import type { ClearingPlanEdit } from '@/services/clearingPlanModel';
import {
  listClearingPlans,
  seedFabric,
  updateClearingPlan,
} from '@/services/clearingPlans';

describe('clearingPlans service (in-memory mode)', () => {
  it('lists the 15 seeded feeders sorted by feeder id', async () => {
    const rows = await listClearingPlans();
    expect(rows).toHaveLength(15);
    const ids = rows.map((r) => r.feeder_id);
    expect([...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))).toEqual(ids);
  });

  it('updates a feeder and persists the change', async () => {
    const [first] = await listClearingPlans();
    const update: ClearingPlanEdit = {
      vendor: 'Ironwood Forestry',
      date_certainty: 'TBD',
      last_cleared_date: '',
      last_work_done: 'mow',
      next_clearing_date: '',
      planned_year: '',
      notes: 'rescheduled',
    };

    const saved = await updateClearingPlan(first.id, update, 'tester@local');
    expect(saved.vendor).toBe('Ironwood Forestry');
    expect(saved.date_certainty).toBe('TBD');
    expect(saved.next_clearing_date).toBeNull();
    expect(saved.updated_by).toBe('tester@local');

    const reread = (await listClearingPlans()).find((r) => r.id === first.id);
    expect(reread?.notes).toBe('rescheduled');
  });

  it('refuses to seed in local mode (the in-memory store is pre-seeded)', async () => {
    await expect(seedFabric('tester@local')).rejects.toThrow();
  });
});
