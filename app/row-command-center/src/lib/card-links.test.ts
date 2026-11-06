import { describe, expect, it } from 'vitest';

import { CARD_LINKS, feedersForCard } from './card-links';

describe('KPI card -> feeder list wiring', () => {
  it('maps each card to the correct DAX drill-down', () => {
    expect(CARD_LINKS.overdue.spec).toEqual({ kind: 'status', status: 'Overdue' });
    expect(CARD_LINKS.dueSoon.spec).toEqual({ kind: 'status', status: 'Due soon' });
    expect(CARD_LINKS.withoutDate.spec).toEqual({ kind: 'certainty', certainties: ['next year', 'TBD'] });
    expect(CARD_LINKS.coverage.spec).toEqual({ kind: 'certainty', certainties: ['confirmed', 'tentative'] });
    expect(CARD_LINKS.dqIssues.spec).toEqual({ kind: 'dq' });
    expect(CARD_LINKS.feedersInPlan.spec).toEqual({ kind: 'all' });
  });

  it('opens only Overdue feeders from the Overdue card (local fixtures)', async () => {
    const rows = await feedersForCard('overdue');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.status === 'Overdue')).toBe(true);
  });

  it('opens only no-firm-date feeders from the Without-a-Date card', async () => {
    const rows = await feedersForCard('withoutDate');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.certainty === 'next year' || r.certainty === 'TBD')).toBe(true);
  });

  it('opens only DQ-flagged feeders from the DQ card', async () => {
    const rows = await feedersForCard('dqIssues');
    expect(rows.every((r) => r.hasDqIssue)).toBe(true);
  });
});
