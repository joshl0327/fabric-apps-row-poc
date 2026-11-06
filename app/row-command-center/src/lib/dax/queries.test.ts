import { describe, expect, it } from 'vitest';

import {
  assertFeederId,
  isValidFeederId,
  parseFeederId,
} from './feeder-id';
import {
  CLEARING_STATUSES,
  daxLiteral,
  feederDetailQuery,
  feederGridQuery,
  feedersByCertaintyQuery,
  feedersByStatusQuery,
  kpisQuery,
} from './queries';

describe('feeder id validation', () => {
  it('accepts well-formed ids', () => {
    for (const id of ['214-1', '125-10', '858-3', '70421-999']) {
      expect(isValidFeederId(id)).toBe(true);
    }
  });

  it('rejects anything that is not substation-circuit digits', () => {
    for (const bad of [
      '',
      ' 214-1',
      '214-1 ',
      '214_1',
      'abc-1',
      '214-1; DROP',
      '214-1") EVALUATE(',
      '214',
      '-1',
      '214-',
      '214-1-2',
    ]) {
      expect(isValidFeederId(bad)).toBe(false);
    }
  });

  it('parseFeederId trims and returns null for junk (deep-link boundary)', () => {
    expect(parseFeederId('  214-1  ')).toBe('214-1');
    expect(parseFeederId('"); EVALUATE ROW(1,1)')).toBeNull();
    expect(parseFeederId(null)).toBeNull();
    expect(parseFeederId(undefined)).toBeNull();
  });
});

describe('DAX builders never admit un-allowlisted input', () => {
  it('feedersByStatus throws on a status outside the allowlist', () => {
    // A hostile value cannot reach the query — it throws before building.
    expect(() => feedersByStatusQuery('Overdue"); EVALUATE ROW(1,1) --' as never)).toThrow();
    expect(() => feedersByStatusQuery('Whatever' as never)).toThrow();
  });

  it('feedersByStatus accepts every real status and quotes it', () => {
    for (const s of CLEARING_STATUSES) {
      const q = feedersByStatusQuery(s);
      expect(q).toContain(`[Status] = "${s}"`);
    }
  });

  it('feedersByCertainty throws on a certainty outside the allowlist', () => {
    expect(() => feedersByCertaintyQuery(['confirmed', 'evil'] as never)).toThrow();
  });

  it('feederDetail throws on an invalid feeder id (no injection path)', () => {
    expect(() => feederDetailQuery('1") EVALUATE CALCULATETABLE(')).toThrow();
    expect(() => assertFeederId('1 OR 1=1')).toThrow();
    // A valid id is quoted into a literal.
    expect(feederDetailQuery('214-1')).toContain('DIM_CIRCUIT[FEEDER_ID] = "214-1"');
  });
});

describe('daxLiteral escaping', () => {
  it('doubles embedded double-quotes', () => {
    expect(daxLiteral('a"b')).toBe('"a""b"');
    expect(daxLiteral('Due soon')).toBe('"Due soon"');
  });
});

describe('static queries reference only model measures', () => {
  it('kpis pulls the six Today measures', () => {
    const q = kpisQuery();
    for (const m of [
      '[Feeders in Plan]',
      '[Feeders Without a Date]',
      '[Feeders Due Soon]',
      '[Feeders Overdue]',
      '[% Plan Date Scheduled]',
      '[DQ Issues]',
    ]) {
      expect(q).toContain(m);
    }
  });

  it('grid selects the per-feeder columns and the model status', () => {
    const q = feederGridQuery();
    expect(q).toContain('DIM_CIRCUIT[FEEDER_ID]');
    expect(q).toContain('"Status", [Clearing Status]');
    expect(q).toContain('"LineMiles", [Line Miles in Plan]');
  });
});
