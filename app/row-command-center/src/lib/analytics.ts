// Analytics access: every number and status comes from the published semantic
// model via the row_pbi_poc connector (DAX), or from DEV fixtures locally. The
// queries are built by src/lib/dax/queries.ts (safe DAX only). The app shapes and
// displays the results; it never computes a business rule.

import {
  feederDetailQuery,
  feederGridQuery,
  feedersByCertaintyQuery,
  feedersByStatusQuery,
  feedersWithDqIssuesQuery,
  kpisQuery,
  scheduleByMonthQuery,
  upcomingFeedersQuery,
  type ClearingStatus,
  type DateCertainty,
} from './dax/queries';
import type { GridRow, Kpis, ScheduleCell } from './analytics-types';
import { isLocalBackend } from '@/services/local-backend';
import { FIXTURE_GRID, FIXTURE_KPIS, FIXTURE_SCHEDULE } from './analytics-fixture';

/** Run one DAX query and return rows as records keyed by DAX column name. */
async function runDax(query: string): Promise<Record<string, unknown>[]> {
  const { getRayfinClient } = await import('@/lib/rayfin-client');
  const result = await getRayfinClient().connectors['row_pbi_poc'].executeQuery({ query });
  if (result.status !== 'success') {
    throw new Error(result.error.message || 'The semantic model query failed.');
  }
  const { columns, rows } = result.table;
  return rows.map((row) => Object.fromEntries(columns.map((c, i) => [c.name, row[i]])));
}

const str = (v: unknown): string => (v == null ? '' : String(v));
const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));
const dateOrNull = (v: unknown): string | null =>
  v == null || v === '' ? null : String(v).slice(0, 10);

function toGridRow(r: Record<string, unknown>): GridRow {
  return {
    feederId: str(r['DIM_CIRCUIT[FEEDER_ID]']),
    circuitName: str(r['DIM_CIRCUIT[CIRCUIT_NAME]']),
    substationName: str(r['DIM_CIRCUIT[SUBSTATION_NAME]']),
    district: str(r['DIM_CIRCUIT[RESPONSIBLE_DISTRICT_NAME]']),
    vendor: str(r['FACT_ROW_PLAN[VENDOR_NAME]']),
    certainty: str(r['FACT_ROW_PLAN[DATE_CERTAINTY]']),
    nextClearingDate: dateOrNull(r['FACT_ROW_PLAN[NEXT_CLEARING_DATE]']),
    plannedYear: numOrNull(r['FACT_ROW_PLAN[PLANNED_YEAR]']),
    lineMiles: numOrNull(r['[LineMiles]']),
    status: str(r['[Status]']),
  };
}

export async function getKpis(): Promise<Kpis> {
  if (isLocalBackend()) return FIXTURE_KPIS;
  const [row] = await runDax(kpisQuery());
  return {
    feedersInPlan: Number(row['[FeedersInPlan]'] ?? 0),
    withoutDate: Number(row['[FeedersWithoutDate]'] ?? 0),
    dueSoon: Number(row['[FeedersDueSoon]'] ?? 0),
    overdue: Number(row['[FeedersOverdue]'] ?? 0),
    coverage: Number(row['[Coverage]'] ?? 0),
    dqIssues: Number(row['[DQIssues]'] ?? 0),
  };
}

export async function getFeederGrid(): Promise<GridRow[]> {
  if (isLocalBackend()) return FIXTURE_GRID;
  return (await runDax(feederGridQuery())).map(toGridRow);
}

export async function getFeedersByStatus(status: ClearingStatus): Promise<GridRow[]> {
  if (isLocalBackend()) return FIXTURE_GRID.filter((r) => r.status === status);
  return (await runDax(feedersByStatusQuery(status))).map(toGridRow);
}

export async function getFeedersByCertainty(cs: readonly DateCertainty[]): Promise<GridRow[]> {
  if (isLocalBackend()) return FIXTURE_GRID.filter((r) => cs.includes(r.certainty as DateCertainty));
  return (await runDax(feedersByCertaintyQuery(cs))).map(toGridRow);
}

export async function getFeedersWithDq(): Promise<GridRow[]> {
  if (isLocalBackend()) return FIXTURE_GRID.filter((r) => r.hasDqIssue);
  return (await runDax(feedersWithDqIssuesQuery())).map((r) => ({
    ...toGridRow(r),
    circuitName: str(r['DIM_CIRCUIT[CIRCUIT_NAME]']),
    district: str(r['DIM_CIRCUIT[RESPONSIBLE_DISTRICT_NAME]']),
    hasDqIssue: true,
  }));
}

export async function getFeederDetail(feederId: string): Promise<GridRow | null> {
  if (isLocalBackend()) return FIXTURE_GRID.find((r) => r.feederId === feederId) ?? null;
  const rows = await runDax(feederDetailQuery(feederId));
  return rows.length ? toGridRow(rows[0]) : null;
}

export async function getUpcomingFeeders(): Promise<GridRow[]> {
  if (isLocalBackend()) {
    // Static fixture: feeders with a date that aren't overdue read as "upcoming".
    return FIXTURE_GRID.filter((r) => r.nextClearingDate != null && r.status !== 'Overdue').sort((a, b) =>
      (a.nextClearingDate ?? '').localeCompare(b.nextClearingDate ?? ''),
    );
  }
  return (await runDax(upcomingFeedersQuery())).map(toGridRow);
}

export async function getSchedule(): Promise<ScheduleCell[]> {
  if (isLocalBackend()) return FIXTURE_SCHEDULE;
  return (await runDax(scheduleByMonthQuery())).map((r) => ({
    monthSort: Number(r['DIM_DATE[Year Month Sort]'] ?? 0),
    monthLabel: str(r['DIM_DATE[Month Year]']),
    vendor: str(r['FACT_ROW_PLAN[VENDOR_NAME]']),
    feeders: Number(r['[Feeders]'] ?? 0),
  }));
}
