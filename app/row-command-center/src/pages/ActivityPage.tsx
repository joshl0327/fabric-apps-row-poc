import { useMemo, useState } from 'react';

import { useAsync } from '@/hooks/use-async';
import { useFeederPanel } from '@/app/feeder-context';
import { listRecentChanges } from '@/services/changeLog';
import { FIELD_LABELS, type ChangeLogRow, type LoggedValue } from '@/services/changeLogModel';

const ALL = '(all)';
const fmt = (v: LoggedValue): string => (v == null ? '—' : String(v));

function ChangeRow({ row, onOpen }: { row: ChangeLogRow; onOpen: (id: string) => void }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center gap-3 text-200 text-muted-foreground">
        <span className="tabular-nums">{row.changed_at.toLocaleString()}</span>
        <span>·</span>
        <span>{row.changed_by}</span>
        <span>·</span>
        <button type="button" onClick={() => onOpen(row.feeder_id)} className="font-medium text-brand-foreground underline tabular-nums">
          {row.feeder_id}
        </button>
        {row.reason && <span className="italic">“{row.reason}”</span>}
      </div>
      <ul className="flex flex-col gap-0.5 text-300">
        {row.changes.map((c) => (
          <li key={c.field}>
            <span className="text-muted-foreground">{FIELD_LABELS[c.field]}:</span>{' '}
            <span className="line-through opacity-70">{fmt(c.before)}</span> → <span className="font-medium">{fmt(c.after)}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

export default function ActivityPage() {
  const { dataVersion, openFeeder } = useFeederPanel();
  const { data: rows = [], loading, error } = useAsync(() => listRecentChanges(200), [dataVersion]);

  const [person, setPerson] = useState(ALL);
  const [feeder, setFeeder] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const people = useMemo(() => [ALL, ...Array.from(new Set(rows.map((r) => r.changed_by))).sort()], [rows]);

  const filtered = useMemo(() => {
    const f = feeder.trim().toLowerCase();
    const fromT = from ? new Date(from).getTime() : -Infinity;
    const toT = to ? new Date(to).getTime() + 86_400_000 : Infinity;
    return rows.filter(
      (r) =>
        (person === ALL || r.changed_by === person) &&
        (f === '' || r.feeder_id.toLowerCase().includes(f)) &&
        r.changed_at.getTime() >= fromT &&
        r.changed_at.getTime() <= toT,
    );
  }, [rows, person, feeder, from, to]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-500 font-semibold text-emphasis-foreground">Activity</h1>
      <p className="text-200 text-muted-foreground">
        Every edit, newest first — including edits made in the first app (both write the same ChangeLogs table).
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-200 text-muted-foreground">Person
          <select value={person} onChange={(e) => setPerson(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-300 text-foreground">
            {people.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-200 text-muted-foreground">Feeder
          <input value={feeder} onChange={(e) => setFeeder(e.target.value)} placeholder="e.g. 214-1" className="rounded-lg border border-border bg-background px-2 py-1 text-300 text-foreground" />
        </label>
        <label className="flex flex-col gap-1 text-200 text-muted-foreground">From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-300 text-foreground" />
        </label>
        <label className="flex flex-col gap-1 text-200 text-muted-foreground">To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-300 text-foreground" />
        </label>
        <span className="ml-auto text-200 text-muted-foreground">{filtered.length} changes</span>
      </div>

      {error ? (
        <p role="alert" className="text-300 text-destructive">{error.message}</p>
      ) : loading ? (
        <p className="text-300 text-muted-foreground">Loading changes…</p>
      ) : filtered.length === 0 ? (
        <p className="text-300 text-muted-foreground">No changes recorded yet. Edit a feeder to see it here.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {filtered.map((r) => <ChangeRow key={r.id} row={r} onOpen={openFeeder} />)}
        </ul>
      )}
    </div>
  );
}
