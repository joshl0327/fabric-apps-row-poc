import { describe, expect, it } from 'vitest';

import { toGridRow } from './analytics';
import type { GridRow } from './analytics-types';

// A connector result record keyed by the DAX result's actual table-prefixed
// column names (verified live against ROW-POC-Dev). This locks toGridRow to those
// exact names — if a key drifts (the class of bug that left the grid showing only
// two columns), the corresponding field goes empty and these assertions fail.
const RECORD: Record<string, unknown> = {
  'DIM_CIRCUIT[FEEDER_ID]': '125-1',
  'DIM_CIRCUIT[CIRCUIT_NAME]': 'Birch Tap 1',
  'DIM_CIRCUIT[SUBSTATION_NAME]': 'Cypress Substation',
  'DIM_CIRCUIT[RESPONSIBLE_DISTRICT_NAME]': 'Elk Meadow',
  'FACT_ROW_PLAN[VENDOR_NAME]': 'North District Line Crew',
  'FACT_ROW_PLAN[DATE_CERTAINTY]': 'tentative',
  'FACT_ROW_PLAN[NEXT_CLEARING_DATE]': '2028-03-27T00:00:00.000',
  'FACT_ROW_PLAN[PLANNED_YEAR]': 2028,
  '[LineMiles]': 55.8,
  '[Status]': 'Scheduled',
};

const EXPECTED_COLUMNS: (keyof GridRow)[] = [
  'feederId',
  'circuitName',
  'substationName',
  'district',
  'vendor',
  'certainty',
  'nextClearingDate',
  'plannedYear',
  'lineMiles',
  'status',
];

describe('toGridRow (DAX result -> grid row mapping)', () => {
  it('maps every expected column from the table-prefixed result names', () => {
    const row = toGridRow(RECORD);
    expect(row).toEqual({
      feederId: '125-1',
      circuitName: 'Birch Tap 1',
      substationName: 'Cypress Substation',
      district: 'Elk Meadow',
      vendor: 'North District Line Crew',
      certainty: 'tentative',
      nextClearingDate: '2028-03-27',
      plannedYear: 2028,
      lineMiles: 55.8,
      status: 'Scheduled',
    });
  });

  it('leaves no expected column blank when the result has it', () => {
    const row = toGridRow(RECORD) as unknown as Record<string, unknown>;
    for (const col of EXPECTED_COLUMNS) {
      expect(row[col], `column "${col}" should be populated`).not.toBe('');
      expect(row[col], `column "${col}" should be populated`).not.toBeNull();
      expect(row[col], `column "${col}" should be populated`).not.toBeUndefined();
    }
  });
});
