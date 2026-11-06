import { describe, expect, it } from 'vitest';

import { validateFeeder, hasErrors } from './validation';
import type { FeederEdit } from './clearingPlanModel';

const base: FeederEdit = {
  vendor: 'Ironwood Forestry',
  last_cleared_date: '2024-01-01',
  last_work_done: 'Full-width clearing',
  next_clearing_date: '2027-06-01',
  date_certainty: 'confirmed',
  planned_year: '2027',
  notes: '',
};

describe('validateFeeder (copied cross-field rules)', () => {
  it('passes a well-formed confirmed feeder', () => {
    expect(hasErrors(validateFeeder(base))).toBe(false);
  });

  it('confirmed/tentative require a next clearing date', () => {
    expect(validateFeeder({ ...base, next_clearing_date: '' }).next_clearing_date).toMatch(/needs a next clearing date/);
    expect(validateFeeder({ ...base, date_certainty: 'tentative', next_clearing_date: '' }).next_clearing_date).toBeTruthy();
  });

  it('"next year" needs a planned year and no exact date', () => {
    const noYear = validateFeeder({ ...base, date_certainty: 'next year', next_clearing_date: '', planned_year: '' });
    expect(noYear.planned_year).toMatch(/needs a planned year/);
    const withDate = validateFeeder({ ...base, date_certainty: 'next year', planned_year: '2028' });
    expect(withDate.next_clearing_date).toMatch(/clear the next clearing date/);
  });

  it('TBD has no date', () => {
    expect(validateFeeder({ ...base, date_certainty: 'TBD' }).next_clearing_date).toMatch(/TBD has no date/);
    expect(hasErrors(validateFeeder({ ...base, date_certainty: 'TBD', next_clearing_date: '' }))).toBe(false);
  });

  it('rejects an off-list vendor, over-long notes and a bad year', () => {
    expect(validateFeeder({ ...base, vendor: 'Totally Fake Co' as never }).vendor).toBeTruthy();
    expect(validateFeeder({ ...base, notes: 'x'.repeat(501) }).notes).toBeTruthy();
    expect(validateFeeder({ ...base, planned_year: '99' }).planned_year).toBeTruthy();
  });
});
