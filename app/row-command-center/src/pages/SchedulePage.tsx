import { useMemo } from 'react';
import { VegaVisual } from '@microsoft/fabric-visuals';
import type { VisualizationSpec } from '@microsoft/fabric-visuals';
import type { DataTable } from '@microsoft/fabric-visuals-core';

import { useThemeContext } from '@/hooks/theme.context';
import { useAsync } from '@/hooks/use-async';
import { useFeederPanel } from '@/app/feeder-context';
import { getSchedule, getUpcomingFeeders } from '@/lib/analytics';
import { FeederList } from '@/components/FeederList';

export default function SchedulePage() {
  const { theme } = useThemeContext();
  const { dataVersion } = useFeederPanel();
  const schedule = useAsync(getSchedule, [dataVersion]);
  const upcomingQuery = useAsync(getUpcomingFeeders, [dataVersion]);

  const dataTable: DataTable = useMemo(() => {
    const cells = [...(schedule.data ?? [])].sort((a, b) => a.monthSort - b.monthSort);
    return {
      columns: [
        { name: 'month', displayName: 'Month' },
        { name: 'vendor', displayName: 'Vendor' },
        { name: 'feeders', displayName: 'Feeders', format: '#,0' },
        { name: 'monthSort', displayName: 'Sort' },
      ],
      rows: cells.map((c) => [c.monthLabel, c.vendor, c.feeders, c.monthSort]),
    };
  }, [schedule.data]);

  // Stacked bar: feeders due per month, coloured by vendor. Chart (fabric-visuals
  // Vega) per ruling 1 — no hand-written SVG.
  const spec: VisualizationSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    mark: 'bar',
    encoding: {
      x: { field: 'month', type: 'nominal', sort: { field: 'monthSort' }, title: 'Month' },
      y: { field: 'feeders', type: 'quantitative', aggregate: 'sum', title: 'Feeders due' },
      color: { field: 'vendor', type: 'nominal', title: 'Vendor' },
      tooltip: [
        { field: 'month', type: 'nominal' },
        { field: 'vendor', type: 'nominal' },
        { field: 'feeders', type: 'quantitative' },
      ],
    },
  };

  // The bar chart is aggregated by month/vendor, so the clickable per-feeder
  // list (its own DAX query, next 12 months, evaluated in the model) is how a
  // user drills to a single feeder's panel.
  const upcoming = upcomingQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-500 font-semibold text-emphasis-foreground">Schedule</h1>
        <p className="text-200 text-muted-foreground">Next 12 months of clearing work, by month and vendor.</p>
      </div>

      {schedule.error ? (
        <p role="alert" className="text-300 text-destructive">{schedule.error.message}</p>
      ) : schedule.loading ? (
        <p className="text-300 text-muted-foreground">Loading schedule…</p>
      ) : (
        <VegaVisual spec={spec} data={dataTable} theme={theme} style={{ height: 320 }} header={{ title: 'Upcoming clearing by month' }} />
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-400 font-semibold text-emphasis-foreground">Upcoming feeders</h2>
        {upcomingQuery.loading ? <p className="text-300 text-muted-foreground">Loading…</p> : <FeederList rows={upcoming} />}
      </section>
    </div>
  );
}
