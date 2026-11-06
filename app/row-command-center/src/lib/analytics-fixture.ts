// DEV-only synthetic analytics fixtures, shaped like the semantic-model DAX
// results. Served only when isLocalBackend() is true (npm run dev:frontend), so
// this module is tree-shaken from production builds. Synthetic data only.
//
// These are STATIC snapshots — the per-feeder status and the KPI counts are
// baked in, exactly as the model's measures would return them, NOT recomputed in
// TypeScript (no business logic in the app; see AGENTS.md). So a local edit
// updates the SQL store and the feeder panel, but these DAX-side numbers stay
// fixed offline; the live recompute-on-edit loop is a Fabric behaviour. Noted as
// a local-only gap in the README.

import type { GridRow, Kpis, ScheduleCell } from './analytics-types';

export const FIXTURE_KPIS: Kpis = {
  feedersInPlan: 12,
  withoutDate: 4,
  dueSoon: 2,
  overdue: 2,
  coverage: 0.6667,
  dqIssues: 6,
};

export const FIXTURE_GRID: GridRow[] = [
  { feederId: '125-1', circuitName: 'Birch Tap 1', substationName: 'Cypress Substation', district: 'Elk Meadow', vendor: 'North District Line Crew', certainty: 'confirmed', nextClearingDate: '2026-12-01', plannedYear: 2026, lineMiles: 55.8, status: 'Due soon', hasDqIssue: false },
  { feederId: '125-4', circuitName: 'Heron Hollow 4', substationName: 'Cypress Substation', district: 'Elk Meadow', vendor: 'Ironwood Forestry', certainty: 'confirmed', nextClearingDate: '2026-06-17', plannedYear: 2026, lineMiles: 27.7, status: 'Overdue', hasDqIssue: true },
  { feederId: '127-2', circuitName: 'Falcon Gap 2', substationName: 'Birch Substation', district: 'Pine Hollow', vendor: 'Clearline Tree Service', certainty: 'confirmed', nextClearingDate: '2027-05-10', plannedYear: 2027, lineMiles: 39.3, status: 'Scheduled', hasDqIssue: false },
  { feederId: '127-5', circuitName: 'Otter Loop 5', substationName: 'Birch Substation', district: 'Pine Hollow', vendor: 'Unassigned', certainty: 'TBD', nextClearingDate: null, plannedYear: null, lineMiles: 12.1, status: 'No date', hasDqIssue: true },
  { feederId: '130-4', circuitName: 'Willow Bend 4', substationName: 'Stone Substation', district: 'North Ridge', vendor: 'Greenway Land and Timber', certainty: 'confirmed', nextClearingDate: '2026-12-20', plannedYear: 2026, lineMiles: 48.0, status: 'Due soon', hasDqIssue: false },
  { feederId: '214-1', circuitName: 'Cedar Run 1', substationName: 'Oak Substation', district: 'Stone Creek', vendor: 'Summit Vegetation Management', certainty: 'tentative', nextClearingDate: '2026-05-02', plannedYear: 2026, lineMiles: 33.0, status: 'Overdue', hasDqIssue: true },
  { feederId: '245-2', circuitName: 'Pine Spur 2', substationName: 'Oak Substation', district: 'Cedar Valley', vendor: 'Trailhead Vegetation Control', certainty: 'confirmed', nextClearingDate: '2028-02-14', plannedYear: 2028, lineMiles: 22.4, status: 'Scheduled', hasDqIssue: false },
  { feederId: '316-1', circuitName: 'Elm Line 1', substationName: 'Maple Substation', district: 'North Ridge', vendor: 'Ironwood Forestry', certainty: 'next year', nextClearingDate: null, plannedYear: 2028, lineMiles: 18.9, status: 'No date', hasDqIssue: true },
  { feederId: '402-2', circuitName: 'Spruce Gap 2', substationName: 'Maple Substation', district: 'Stone Creek', vendor: 'Clearline Tree Service', certainty: 'confirmed', nextClearingDate: '2027-01-05', plannedYear: 2027, lineMiles: 41.2, status: 'Scheduled', hasDqIssue: false },
  { feederId: '533-1', circuitName: 'Aspen Loop 1', substationName: 'Pine Substation', district: 'Cedar Valley', vendor: 'Summit Vegetation Management', certainty: 'TBD', nextClearingDate: null, plannedYear: null, lineMiles: 9.5, status: 'No date', hasDqIssue: false },
  { feederId: '619-2', circuitName: 'Fir Branch 2', substationName: 'Pine Substation', district: 'Elk Meadow', vendor: 'Greenway Land and Timber', certainty: 'confirmed', nextClearingDate: '2027-01-20', plannedYear: 2027, lineMiles: 29.1, status: 'Scheduled', hasDqIssue: false },
  { feederId: '742-2', circuitName: 'Larch Tap 2', substationName: 'Cedar Substation', district: 'Pine Hollow', vendor: 'Unassigned', certainty: 'next year', nextClearingDate: null, plannedYear: 2029, lineMiles: 15.7, status: 'No date', hasDqIssue: false },
];

export const FIXTURE_SCHEDULE: ScheduleCell[] = [
  { monthSort: 202612, monthLabel: 'Dec 2026', vendor: 'North District Line Crew', feeders: 1 },
  { monthSort: 202612, monthLabel: 'Dec 2026', vendor: 'Greenway Land and Timber', feeders: 1 },
  { monthSort: 202701, monthLabel: 'Jan 2027', vendor: 'Clearline Tree Service', feeders: 1 },
  { monthSort: 202701, monthLabel: 'Jan 2027', vendor: 'Greenway Land and Timber', feeders: 1 },
  { monthSort: 202705, monthLabel: 'May 2027', vendor: 'Clearline Tree Service', feeders: 1 },
];
