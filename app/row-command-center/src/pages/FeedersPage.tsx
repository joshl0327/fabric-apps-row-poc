import { useMemo, useState } from 'react';
import { DataGrid } from '@microsoft/fabric-datagrid';
import type { GridColumnDef } from '@microsoft/fabric-datagrid';
import type { DataTable } from '@microsoft/fabric-visuals-core';

import { useThemeContext } from '@/hooks/theme.context';
import { useAsync } from '@/hooks/use-async';
import { useFeederPanel } from '@/app/feeder-context';
import { getFeederGrid } from '@/lib/analytics';
import type { GridRow } from '@/lib/analytics-types';

const ALL = '(all)';

function distinct(rows: GridRow[], key: (r: GridRow) => string): string[] {
  return [ALL, ...Array.from(new Set(rows.map(key).filter(Boolean))).sort()];
}

function FilterSelect({ label, value, set, options }: { label: string; value: string; set: (v: string) => void; options: string[] }) {
  return (
    <label className="flex flex-col gap-1 text-200 text-muted-foreground">
      {label}
      <select value={value} onChange={(e) => set(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-300 text-foreground">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export default function FeedersPage() {
  const { theme } = useThemeContext();
  const { dataVersion, openFeeder } = useFeederPanel();
  const { data: rows = [], loading, error } = useAsync(getFeederGrid, [dataVersion]);

  const [district, setDistrict] = useState(ALL);
  const [vendor, setVendor] = useState(ALL);
  const [certainty, setCertainty] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [plannedYear, setPlannedYear] = useState(ALL);
  const [search, setSearch] = useState('');

  // Slicers and search act on the rows already returned by the DAX query, in the
  // browser (AGENTS.md) — no query is built from this input.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (district === ALL || r.district === district) &&
        (vendor === ALL || r.vendor === vendor) &&
        (certainty === ALL || r.certainty === certainty) &&
        (status === ALL || r.status === status) &&
        (plannedYear === ALL || String(r.plannedYear ?? '') === plannedYear) &&
        (q === '' || r.feederId.toLowerCase().includes(q) || r.circuitName.toLowerCase().includes(q)),
    );
  }, [rows, district, vendor, certainty, status, plannedYear, search]);

  const dataTable: DataTable = useMemo(
    () => ({
      columns: [
        { name: 'feederId', displayName: 'Feeder' },
        { name: 'circuitName', displayName: 'Circuit' },
        { name: 'substationName', displayName: 'Substation' },
        { name: 'district', displayName: 'District' },
        { name: 'vendor', displayName: 'Vendor' },
        { name: 'certainty', displayName: 'Certainty' },
        { name: 'nextClearingDate', displayName: 'Next clearing' },
        { name: 'plannedYear', displayName: 'Planned year' },
        { name: 'lineMiles', displayName: 'Line miles', format: '#,0.0' },
        { name: 'status', displayName: 'Status' },
      ],
      rows: filtered.map((r) => [
        r.feederId, r.circuitName, r.substationName, r.district, r.vendor,
        r.certainty, r.nextClearingDate ?? '', r.plannedYear ?? '', r.lineMiles ?? '', r.status,
      ]),
    }),
    [filtered],
  );

  const columns: GridColumnDef[] = useMemo(
    () => [
      {
        id: 'feederId',
        header: 'Feeder',
        cellRenderer: (value, row) => (
          <button
            type="button"
            onClick={() => openFeeder(String(row['feederId'] ?? value))}
            className="font-medium text-brand-foreground underline tabular-nums"
          >
            {String(value)}
          </button>
        ),
      },
      { id: 'lineMiles', header: 'Line miles', numericStyling: true },
    ],
    [openFeeder],
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-500 font-semibold text-emphasis-foreground">Feeders</h1>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-200 text-muted-foreground">
          Search
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Feeder or circuit" className="rounded-lg border border-border bg-background px-2 py-1 text-300 text-foreground" />
        </label>
        <FilterSelect label="District" value={district} set={setDistrict} options={distinct(rows, (r) => r.district)} />
        <FilterSelect label="Vendor" value={vendor} set={setVendor} options={distinct(rows, (r) => r.vendor)} />
        <FilterSelect label="Certainty" value={certainty} set={setCertainty} options={distinct(rows, (r) => String(r.certainty))} />
        <FilterSelect label="Status" value={status} set={setStatus} options={distinct(rows, (r) => String(r.status))} />
        <FilterSelect label="Planned year" value={plannedYear} set={setPlannedYear} options={distinct(rows, (r) => String(r.plannedYear ?? ''))} />
        <span className="ml-auto text-200 text-muted-foreground">{filtered.length} of {rows.length} feeders</span>
      </div>

      {error ? (
        <p role="alert" className="text-300 text-destructive">{error.message}</p>
      ) : loading ? (
        <p className="text-300 text-muted-foreground">Loading feeders…</p>
      ) : (
        <DataGrid data={dataTable} columns={columns} theme={theme} header={{ title: 'Clearing plan' }} />
      )}
    </div>
  );
}
