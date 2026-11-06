import type { GridRow } from '@/lib/analytics-types';
import { useFeederPanel } from '@/app/feeder-context';
import { StatusBadge } from './StatusBadge';

/** A compact, clickable feeder list used by the Today card drill-downs. Rows
 * open the feeder panel. The rows come from a DAX query (see analytics.ts); this
 * component only displays them. */
export function FeederList({ rows }: { rows: GridRow[] }) {
  const { openFeeder } = useFeederPanel();
  if (rows.length === 0) {
    return <p className="text-300 text-muted-foreground">No feeders.</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {rows.map((r) => (
        <li key={r.feederId}>
          <button
            type="button"
            onClick={() => openFeeder(r.feederId)}
            className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-foreground/[0.04]"
          >
            <span className="w-16 font-medium tabular-nums">{r.feederId}</span>
            <span className="flex-1 truncate text-300">{r.circuitName}</span>
            <span className="w-28 truncate text-200 text-muted-foreground">{r.district}</span>
            <span className="w-48 truncate text-200 text-muted-foreground">{r.vendor}</span>
            <span className="w-24 text-200 tabular-nums text-muted-foreground">
              {r.nextClearingDate ?? '—'}
            </span>
            <StatusBadge status={r.status} />
          </button>
        </li>
      ))}
    </ul>
  );
}
