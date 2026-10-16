import { describe, expect, it } from 'vitest';

import type { ClearingPlanEdit } from '@/services/clearingPlanModel';
import { hasErrors, validateClearingPlan } from '@/services/validation';

const base: ClearingPlanEdit = {
  vendor: 'Summit Vegetation Management',
  date_certainty: 'confirmed',
  last_cleared_date: '',
  last_work_done: '',
  next_clearing_date: '2027-05-01',
  planned_year: '',
  notes: '',
};

const edit = (patch: Partial<ClearingPlanEdit>): ClearingPlanEdit => ({
  ...base,
  ...patch,
});

describe('validateClearingPlan — cross-field rules', () => {
  it('accepts confirmed/tentative with a next clearing date', () => {
    expect(hasErrors(validateClearingPlan(edit({ date_certainty: 'confirmed' })))).toBe(false);
    expect(
      hasErrors(
        validateClearingPlan(edit({ date_certainty: 'tentative' }))
      )
    ).toBe(false);
  });

  it('rejects confirmed/tentative without a next clearing date', () => {
    const errors = validateClearingPlan(
      edit({ date_certainty: 'confirmed', next_clearing_date: '' })
    );
    expect(errors.next_clearing_date).toBeDefined();
  });

  it('requires a planned year and no date for "next year"', () => {
    const missingYear = validateClearingPlan(
      edit({ date_certainty: 'next year', next_clearing_date: '', planned_year: '' })
    );
    expect(missingYear.planned_year).toBeDefined();

    const hasDate = validateClearingPlan(
      edit({
        date_certainty: 'next year',
        next_clearing_date: '2027-05-01',
        planned_year: '2027',
      })
    );
    expect(hasDate.next_clearing_date).toBeDefined();

    const ok = validateClearingPlan(
      edit({ date_certainty: 'next year', next_clearing_date: '', planned_year: '2027' })
    );
    expect(hasErrors(ok)).toBe(false);
  });

  it('requires no date for TBD', () => {
    const hasDate = validateClearingPlan(
      edit({ date_certainty: 'TBD', next_clearing_date: '2027-05-01' })
    );
    expect(hasDate.next_clearing_date).toBeDefined();

    const ok = validateClearingPlan(
      edit({ date_certainty: 'TBD', next_clearing_date: '' })
    );
    expect(hasErrors(ok)).toBe(false);
  });
});

describe('validateClearingPlan — field rules', () => {
  it('rejects notes longer than 500 characters', () => {
    const errors = validateClearingPlan(edit({ notes: 'x'.repeat(501) }));
    expect(errors.notes).toBeDefined();
  });

  it('rejects a non-four-digit planned year', () => {
    const errors = validateClearingPlan(
      edit({ date_certainty: 'next year', next_clearing_date: '', planned_year: '27' })
    );
    expect(errors.planned_year).toBeDefined();
  });

  it('rejects a vendor outside the list', () => {
    const errors = validateClearingPlan(
      edit({ vendor: 'Totally Fake Vendor' as ClearingPlanEdit['vendor'] })
    );
    expect(errors.vendor).toBeDefined();
  });
});
