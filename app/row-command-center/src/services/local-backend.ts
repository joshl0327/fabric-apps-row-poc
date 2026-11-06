// DEV-only synthetic backend for `npm run dev:frontend` (plain Vite, no Fabric).
// Everything here is gated behind isLocalBackend(), which is false in any
// production build (import.meta.env.DEV is false), so this module and its
// fixtures are tree-shaken out of the shipped bundle — the same "DEV-only" shape
// the first app uses for its local store and synthetic auth.
//
// Synthetic data only. The fixtures are shaped like the connector's rows and the
// DAX query results so the pages render end-to-end offline.

import type { FeederRow } from './clearingPlanModel';
import type { ChangeLogRow } from './changeLogModel';

/**
 * True when the app should use the in-memory synthetic backend instead of the
 * Fabric connectors: local Vite dev with no Rayfin API configured. Deployed and
 * `rayfin up` builds set VITE_RAYFIN_API_URL and run with DEV=false, so both
 * conditions make this false there.
 */
export function isLocalBackend(): boolean {
  return import.meta.env.DEV && !import.meta.env.VITE_RAYFIN_API_URL;
}

const d = (iso: string | null): Date | null => (iso ? new Date(iso) : null);

// A compact synthetic plan: covers every status, certainty, several vendors and
// all five districts, with overdue and due-soon feeders. Real data never lives
// here (12 feeders).
function seedRows(): FeederRow[] {
  const mk = (
    feederId: string,
    districtName: string,
    vendor: FeederRow['vendor'],
    dateCertainty: FeederRow['dateCertainty'],
    nextClearingDate: string | null,
    plannedYear: number | null,
    lastClearedDate: string | null,
  ): FeederRow => ({
    id: `f-${feederId}`,
    feederId,
    districtName,
    vendor,
    lastClearedDate: d(lastClearedDate),
    lastWorkDone: lastClearedDate ? 'Full-width clearing' : null,
    nextClearingDate: d(nextClearingDate),
    dateCertainty,
    plannedYear,
    notes: null,
    updatedBy: 'seed@brillit.example',
    updatedAt: new Date('2026-01-10'),
  });
  return [
    mk('125-1', 'Elk Meadow', 'North District Line Crew', 'confirmed', '2026-09-01', 2026, '2023-05-02'),
    mk('125-4', 'Elk Meadow', 'Ironwood Forestry', 'confirmed', '2026-06-17', 2026, '2022-04-18'),
    mk('127-2', 'Pine Hollow', 'Clearline Tree Service', 'confirmed', '2026-12-20', 2026, '2024-01-20'),
    mk('127-5', 'Pine Hollow', 'Unassigned', 'TBD', null, null, '2021-08-11'),
    mk('130-4', 'North Ridge', 'Greenway Land and Timber', 'confirmed', '2026-10-01', 2026, '2023-03-30'),
    mk('214-1', 'Stone Creek', 'Summit Vegetation Management', 'tentative', '2027-05-10', 2027, '2024-06-01'),
    mk('245-2', 'Cedar Valley', 'Trailhead Vegetation Control', 'confirmed', '2028-02-14', 2028, null),
    mk('316-1', 'North Ridge', 'Ironwood Forestry', 'next year', null, 2028, '2022-11-09'),
    mk('402-2', 'Stone Creek', 'Clearline Tree Service', 'confirmed', '2027-01-05', 2027, '2023-09-15'),
    mk('533-1', 'Cedar Valley', 'Summit Vegetation Management', 'TBD', null, null, null),
    mk('619-2', 'Elk Meadow', 'Greenway Land and Timber', 'confirmed', '2026-12-28', 2026, '2024-02-02'),
    mk('742-2', 'Pine Hollow', 'Unassigned', 'next year', null, 2029, '2020-07-07'),
  ];
}

let feeders: FeederRow[] | null = null;
let changeLog: ChangeLogRow[] = [];

export function localFeeders(): FeederRow[] {
  if (feeders === null) feeders = seedRows();
  return feeders;
}

export function localChangeLog(): ChangeLogRow[] {
  return changeLog;
}

/** Test-only: reset both stores between cases. */
export function _resetLocalBackend(): void {
  feeders = null;
  changeLog = [];
}
