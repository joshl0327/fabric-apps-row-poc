// The Feeders grid column list, extracted so it can be tested against the fields
// toGridRow returns (feeders-columns.test.ts) without importing the heavy
// fabric-datagrid page. DataGrid renders exactly the columns given, so every
// GridRow field must appear here or it silently drops from the grid — the bug
// this guards against. `id` must equal the GridRow property / DataTable column
// name. Cell rendering (clickable feeder, status badge) is attached in
// FeedersPage; only the structural list lives here.
import type { GridRow } from '@/lib/analytics-types';

export interface GridColumnSpec {
  /** Must match a GridRow key / DataTable column name. */
  id: keyof GridRow;
  header: string;
  numericStyling?: boolean;
}

export const GRID_COLUMNS: readonly GridColumnSpec[] = [
  { id: 'feederId', header: 'Feeder' },
  { id: 'circuitName', header: 'Circuit' },
  { id: 'substationName', header: 'Substation' },
  { id: 'district', header: 'District' },
  { id: 'vendor', header: 'Vendor' },
  { id: 'certainty', header: 'Certainty' },
  { id: 'nextClearingDate', header: 'Next clearing' },
  { id: 'plannedYear', header: 'Planned year', numericStyling: true },
  { id: 'lineMiles', header: 'Line miles', numericStyling: true },
  { id: 'status', header: 'Status' },
];
