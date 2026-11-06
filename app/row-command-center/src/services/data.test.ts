import { beforeEach, describe, expect, it } from 'vitest';

import type { FeederRow, FeederEdit } from './clearingPlanModel';
import { diffSavedRow, updateFeeder, listFeeders } from './clearingPlans';
import { diffFeeder, buildChangeLogWrite, logFeederUpdate, listFeederHistory } from './changeLog';
import { _resetLocalBackend, localFeeders } from './local-backend';
import { toEdit } from './clearingPlanModel';

function row(overrides: Partial<FeederRow> = {}): FeederRow {
  return {
    id: 'f-1',
    feederId: '214-1',
    districtName: 'Stone Creek',
    vendor: 'Ironwood Forestry',
    lastClearedDate: new Date('2024-01-01'),
    lastWorkDone: 'Full-width clearing',
    nextClearingDate: new Date('2027-06-01'),
    dateCertainty: 'confirmed',
    plannedYear: 2027,
    notes: null,
    updatedBy: 'a@b.c',
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

const submitted = {
  vendor: 'Ironwood Forestry' as const,
  dateCertainty: 'TBD' as const,
  lastClearedDate: null,
  lastWorkDone: null,
  nextClearingDate: null,
  plannedYear: null,
  notes: null,
  updatedBy: 'a@b.c',
  updatedAt: new Date('2026-02-02'),
};

describe('diffSavedRow (read-back guard)', () => {
  it('is empty when the server kept exactly what we sent', () => {
    const saved = row({ dateCertainty: 'TBD', nextClearingDate: null, lastClearedDate: null, lastWorkDone: null, plannedYear: null, notes: null });
    expect(diffSavedRow(submitted, saved)).toEqual([]);
  });

  it('flags a field the server kept differently (the clear-to-null bug)', () => {
    const saved = row({ dateCertainty: 'TBD', lastClearedDate: null, lastWorkDone: null, plannedYear: null, notes: null, nextClearingDate: new Date('2027-06-01') });
    const mismatches = diffSavedRow(submitted, saved);
    expect(mismatches.join()).toMatch(/nextClearingDate/);
  });
});

describe('diffFeeder + buildChangeLogWrite (audit diff)', () => {
  it('returns only changed fields and round-trips through the blobs', () => {
    const before = row();
    const after = row({ vendor: 'Clearline Tree Service', nextClearingDate: null, dateCertainty: 'TBD' });
    const changes = diffFeeder(before, after);
    const fields = changes.map((c) => c.field).sort();
    expect(fields).toEqual(['date_certainty', 'next_clearing_date', 'vendor']);
    const write = buildChangeLogWrite('214-1', 'a@b.c', changes, null);
    expect(JSON.parse(write.beforeJson).vendor).toBe('Ironwood Forestry');
    expect(JSON.parse(write.afterJson).next_clearing_date).toBeNull();
  });
});

describe('local backend round-trip + change-log (DEV synthetic)', () => {
  beforeEach(() => _resetLocalBackend());

  it('updates a feeder in the in-memory store and reads it back', async () => {
    const all = await listFeeders();
    const target = all.find((r) => r.feederId === '214-1')!;
    const edit: FeederEdit = { ...toEdit(target), date_certainty: 'TBD', next_clearing_date: '' };
    const saved = await updateFeeder(target.id, edit, 'tester@brillit.example');
    expect(saved.dateCertainty).toBe('TBD');
    expect(saved.nextClearingDate).toBeNull();
    expect(localFeeders().find((r) => r.id === target.id)!.dateCertainty).toBe('TBD');
  });

  it('logFeederUpdate writes one history row with the pinned email', async () => {
    const before = row();
    const after = row({ dateCertainty: 'TBD', nextClearingDate: null });
    const result = await logFeederUpdate(before, after, 'tester@brillit.example', 'cycle change');
    expect(result.logged).toBe(true);
    const history = await listFeederHistory('214-1');
    expect(history).toHaveLength(1);
    expect(history[0].changed_by).toBe('tester@brillit.example');
    expect(history[0].reason).toBe('cycle change');
  });

  it('reports "saved but not logged" when there is no email', async () => {
    const result = await logFeederUpdate(row(), row({ dateCertainty: 'TBD', nextClearingDate: null }), null, null);
    expect(result.logged).toBe(false);
    expect(result.error).toMatch(/no signed-in email/);
  });

  it('logs nothing for an unchanged save', async () => {
    const result = await logFeederUpdate(row(), row(), 'tester@brillit.example', null);
    expect(result.logged).toBe(false);
    expect(result.error).toBeUndefined();
  });
});
