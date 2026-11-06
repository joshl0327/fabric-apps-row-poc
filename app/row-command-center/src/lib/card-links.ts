// Wiring from each Today-page KPI card to the feeder list it opens. The list is
// produced by a DAX query (status or certainty), never by filtering in
// TypeScript — see AGENTS.md. This module only maps a card to the right query;
// analytics.ts runs it.

import {
  getFeederGrid,
  getFeedersByCertainty,
  getFeedersByStatus,
  getFeedersWithDq,
} from './analytics';
import type { GridRow } from './analytics-types';
import { SCHEDULED_CERTAINTIES, WITHOUT_DATE_CERTAINTIES } from './dax/queries';

export type CardId =
  | 'feedersInPlan'
  | 'withoutDate'
  | 'dueSoon'
  | 'overdue'
  | 'coverage'
  | 'dqIssues';

export type DrillSpec =
  | { kind: 'all' }
  | { kind: 'status'; status: 'Overdue' | 'Due soon' }
  | { kind: 'certainty'; certainties: readonly ('confirmed' | 'tentative' | 'next year' | 'TBD')[] }
  | { kind: 'dq' };

/** Each card: its title and the drill-down query it opens. */
export const CARD_LINKS: Record<CardId, { title: string; spec: DrillSpec }> = {
  feedersInPlan: { title: 'Feeders in Plan', spec: { kind: 'all' } },
  withoutDate: { title: 'Feeders Without a Date', spec: { kind: 'certainty', certainties: WITHOUT_DATE_CERTAINTIES } },
  dueSoon: { title: 'Due Soon', spec: { kind: 'status', status: 'Due soon' } },
  overdue: { title: 'Overdue', spec: { kind: 'status', status: 'Overdue' } },
  coverage: { title: 'Coverage (scheduled)', spec: { kind: 'certainty', certainties: SCHEDULED_CERTAINTIES } },
  dqIssues: { title: 'Feeders with DQ Issues', spec: { kind: 'dq' } },
};

/** Run the drill-down query a spec names. */
export function feedersForSpec(spec: DrillSpec): Promise<GridRow[]> {
  switch (spec.kind) {
    case 'all':
      return getFeederGrid();
    case 'status':
      return getFeedersByStatus(spec.status);
    case 'certainty':
      return getFeedersByCertainty(spec.certainties);
    case 'dq':
      return getFeedersWithDq();
  }
}

export const feedersForCard = (card: CardId): Promise<GridRow[]> =>
  feedersForSpec(CARD_LINKS[card].spec);
