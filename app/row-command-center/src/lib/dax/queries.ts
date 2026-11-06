// DAX query builders for the command center. Every number and status comes from
// the SAME published semantic model as the Power BI report (row_pbi_poc), through
// the fabric-semanticmodel connector. The app calculates nothing: overdue, due
// soon, coverage, no-date and per-feeder status are all model measures.
//
// Safe DAX (AGENTS.md hard limit): no user-typed text is ever interpolated into a
// query string. The only dynamic inputs are
//   - a feeder id, validated against FEEDER_ID_PATTERN (see assertFeederId), and
//   - a Clearing Status or certainty value, checked against a fixed allowlist.
// Both are additionally rendered through daxLiteral() as defence in depth.
// Browser-side slicers, search and sorting act on the rows these queries return;
// they never build a query from input.

import { assertFeederId } from './feeder-id';

/** The four per-feeder states the model's [Clearing Status] measure returns. */
export const CLEARING_STATUSES = ['Overdue', 'Due soon', 'Scheduled', 'No date'] as const;
export type ClearingStatus = (typeof CLEARING_STATUSES)[number];

/** The four date-certainty values (DIM_DATE_CERTAINTY), mirrored from the model. */
export const DATE_CERTAINTIES = ['confirmed', 'tentative', 'next year', 'TBD'] as const;
export type DateCertainty = (typeof DATE_CERTAINTIES)[number];

/** Certainty values that mean "no firm date" — the Without-a-Date card. */
export const WITHOUT_DATE_CERTAINTIES: readonly DateCertainty[] = ['next year', 'TBD'];
/** Certainty values that mean "a real date is scheduled" — the Coverage card. */
export const SCHEDULED_CERTAINTIES: readonly DateCertainty[] = ['confirmed', 'tentative'];

/**
 * Render a string as a DAX double-quoted literal: double every embedded quote.
 * We only ever pass allowlisted constants or a pattern-checked feeder id, so this
 * is defence in depth, not the primary guard.
 */
export function daxLiteral(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function assertOneOf<T extends string>(value: string, allowed: readonly T[]): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`Value ${JSON.stringify(value)} is not in the allowlist`);
  }
  return value as T;
}

/** A DAX `{ "a", "b" }` list from an allowlisted set of values. */
function daxValueSet(values: readonly string[]): string {
  return `{ ${values.map(daxLiteral).join(', ')} }`;
}

// The per-feeder projection reused by the grid and every card drill-down, so the
// grid and the lists it links to share one column contract.
const PER_FEEDER_COLUMNS = `
    DIM_CIRCUIT[FEEDER_ID],
    DIM_CIRCUIT[CIRCUIT_NAME],
    DIM_CIRCUIT[SUBSTATION_NAME],
    DIM_CIRCUIT[RESPONSIBLE_DISTRICT_NAME],
    FACT_ROW_PLAN[VENDOR_NAME],
    FACT_ROW_PLAN[DATE_CERTAINTY],
    FACT_ROW_PLAN[NEXT_CLEARING_DATE],
    FACT_ROW_PLAN[PLANNED_YEAR],
    "LineMiles", [Line Miles in Plan],
    "Status", [Clearing Status]`;

/** Today-page KPI row. All six values are model measures. */
export function kpisQuery(): string {
  return `EVALUATE
ROW (
    "FeedersInPlan", [Feeders in Plan],
    "FeedersWithoutDate", [Feeders Without a Date],
    "FeedersDueSoon", [Feeders Due Soon],
    "FeedersOverdue", [Feeders Overdue],
    "Coverage", [% Plan Date Scheduled],
    "FeedersWithDqIssues", [Feeders with DQ Issues]
)`;
}

/** Every feeder, one row, with the dimensions joined and the model status. */
export function feederGridQuery(): string {
  return `EVALUATE
SUMMARIZECOLUMNS (${PER_FEEDER_COLUMNS}
)
ORDER BY DIM_CIRCUIT[FEEDER_ID]`;
}

/** Feeders whose model [Clearing Status] equals `status` (allowlisted). */
export function feedersByStatusQuery(status: ClearingStatus): string {
  const safe = assertOneOf(status, CLEARING_STATUSES);
  return `EVALUATE
FILTER (
    SUMMARIZECOLUMNS (${PER_FEEDER_COLUMNS}
    ),
    [Status] = ${daxLiteral(safe)}
)
ORDER BY DIM_CIRCUIT[FEEDER_ID]`;
}

/** Feeders whose certainty is in `certainties` (each allowlisted). */
export function feedersByCertaintyQuery(certainties: readonly DateCertainty[]): string {
  const safe = certainties.map((c) => assertOneOf(c, DATE_CERTAINTIES));
  return `EVALUATE
CALCULATETABLE (
    SUMMARIZECOLUMNS (${PER_FEEDER_COLUMNS}
    ),
    FACT_ROW_PLAN[DATE_CERTAINTY] IN ${daxValueSet(safe)}
)
ORDER BY DIM_CIRCUIT[FEEDER_ID]`;
}

/** Feeders that carry at least one data-quality issue (match a circuit). */
export function feedersWithDqIssuesQuery(): string {
  return `EVALUATE
CALCULATETABLE (
    SUMMARIZECOLUMNS (
        DIM_CIRCUIT[FEEDER_ID],
        DIM_CIRCUIT[CIRCUIT_NAME],
        DIM_CIRCUIT[RESPONSIBLE_DISTRICT_NAME],
        "DQIssues", [DQ Issues]
    ),
    FACT_DQ_ISSUE
)
ORDER BY DIM_CIRCUIT[FEEDER_ID]`;
}

/**
 * Upcoming next-clearing work by month and vendor for the next 12 months.
 * Grouped on DIM_DATE so the month buckets come from the model's date table.
 */
export function scheduleByMonthQuery(): string {
  return `DEFINE
    VAR _today = TODAY ()
    VAR _horizon = EDATE ( _today, 12 )
EVALUATE
CALCULATETABLE (
    SUMMARIZECOLUMNS (
        DIM_DATE[Year Month Sort],
        DIM_DATE[Month Year],
        FACT_ROW_PLAN[VENDOR_NAME],
        "Feeders", [Feeders in Plan]
    ),
    FACT_ROW_PLAN[NEXT_CLEARING_DATE] >= _today
        && FACT_ROW_PLAN[NEXT_CLEARING_DATE] < _horizon
        && NOT ISBLANK ( FACT_ROW_PLAN[NEXT_CLEARING_DATE] )
)
ORDER BY DIM_DATE[Year Month Sort], FACT_ROW_PLAN[VENDOR_NAME]`;
}

/** Per-feeder rows whose next-clearing date falls in the next 12 months, for the
 * Schedule page's clickable list. The date window is evaluated in the model. */
export function upcomingFeedersQuery(): string {
  return `DEFINE
    VAR _today = TODAY ()
    VAR _horizon = EDATE ( _today, 12 )
EVALUATE
CALCULATETABLE (
    SUMMARIZECOLUMNS (${PER_FEEDER_COLUMNS}
    ),
    FACT_ROW_PLAN[NEXT_CLEARING_DATE] >= _today
        && FACT_ROW_PLAN[NEXT_CLEARING_DATE] < _horizon
        && NOT ISBLANK ( FACT_ROW_PLAN[NEXT_CLEARING_DATE] )
)
ORDER BY FACT_ROW_PLAN[NEXT_CLEARING_DATE]`;
}

/**
 * One feeder's analytics row, addressed by a validated feeder id. Used by the
 * deep-link panel to show the model's view beside the editable SQL row.
 */
export function feederDetailQuery(feederId: string): string {
  const safe = assertFeederId(feederId);
  return `EVALUATE
CALCULATETABLE (
    SUMMARIZECOLUMNS (${PER_FEEDER_COLUMNS}
    ),
    DIM_CIRCUIT[FEEDER_ID] = ${daxLiteral(safe)}
)`;
}
