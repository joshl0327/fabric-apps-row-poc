import { describe, expect, it } from 'vitest';

import { GRID_COLUMNS } from './feeders-columns';
import { toGridRow } from '@/lib/analytics';

// Guards bug #1: DataGrid renders exactly the columns it is given, so the Feeders
// grid column list must cover every field toGridRow returns. If a column is
// dropped from GRID_COLUMNS (or toGridRow gains a field with no column), this
// fails — the grid would silently stop showing that field.
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

describe('Feeders grid columns cover every mapped field', () => {
  it('GRID_COLUMNS ids exactly match the keys toGridRow returns', () => {
    const rowKeys = Object.keys(toGridRow(RECORD)).sort();
    const columnIds = GRID_COLUMNS.map((c) => c.id).sort();
    expect(columnIds).toEqual(rowKeys);
  });
});
