import { useCallback, useEffect, useState } from 'react';

import { ClaimsPanel } from '@/components/ClaimsPanel';
import { useAuth } from '@/hooks/AuthContext';
import {
  listFeederHistory,
  listRecentChanges,
  logFeederUpdate,
} from '@/services/changeLog';
import {
  FIELD_LABELS,
  type ChangeLogRow,
  type FieldChange,
} from '@/services/changeLogModel';
import {
  DATE_CERTAINTIES,
  NOTES_MAX,
  VENDORS,
  type ClearingPlanEdit,
  type ClearingPlanRow,
} from '@/services/clearingPlanModel';
import {
  importFeeders,
  listClearingPlans,
  seedFabric,
  updateClearingPlan,
} from '@/services/clearingPlans';
import { toUserMessage } from '@/services/errors';
import { isFeederImportEnabled } from '@/services/featureFlags';
import type { ImportSummary } from '@/services/import';
import { isLocalBackend } from '@/services/rayfinClient';
import {
  hasErrors,
  validateClearingPlan,
  type ClearingPlanErrors,
} from '@/services/validation';

/** Reason is logged with a change but is not part of the feeder row, so it is
 * never 'unknown'-filled: the audit row's `changed_by` must be the real email. */
const REASON_MAX = 250;

/** Format a Date as `yyyy-mm-dd` for display and date inputs; '' when null. */
const toInputDate = (d: Date | null): string =>
  d ? d.toISOString().slice(0, 10) : '';

function editFromRow(row: ClearingPlanRow): ClearingPlanEdit {
  return {
    vendor: row.vendor,
    date_certainty: row.date_certainty,
    last_cleared_date: toInputDate(row.last_cleared_date),
    last_work_done: row.last_work_done ?? '',
    next_clearing_date: toInputDate(row.next_clearing_date),
    planned_year: row.planned_year != null ? String(row.planned_year) : '',
    notes: row.notes ?? '',
  };
}

export function HomePage() {
  const { signOut, user } = useAuth();
  const [rows, setRows] = useState<ClearingPlanRow[]>([]);
  const [recent, setRecent] = useState<ChangeLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The audit row's author. The email claim only — no id/'unknown' fallback (a
  // change-log decision): without an email we don't attempt the log write.
  const changedBy = user?.email ?? null;
  // Who to stamp on the feeder row itself (unchanged, client-set, not audit-grade).
  const updatedBy = user?.email ?? user?.id ?? 'unknown';

  const fetchRows = useCallback(async () => {
    const [feeders, changes] = await Promise.all([
      listClearingPlans(),
      listRecentChanges(20),
    ]);
    setRows(feeders);
    setRecent(changes);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const handleSeed = async () => {
    setSeedError(null);
    setSeeding(true);
    try {
      await seedFabric(updatedBy);
      await fetchRows();
    } catch (err) {
      setSeedError(toUserMessage(err, 'Failed to load data.'));
    } finally {
      setSeeding(false);
    }
  };

  // Called after a feeder save. `notice` carries a "saved but not logged"
  // warning when the edit persisted but its audit row did not.
  const handleSaved = async (warning?: string) => {
    setEditingId(null);
    setNotice(warning ?? null);
    await fetchRows();
  };

  const isEmpty = !loading && rows.length === 0;
  // The Fabric seed sits behind the same off-by-default build flag as the
  // Import panel (VITE_ENABLE_FEEDER_IMPORT). With the flag off, an empty table
  // shows a plain message and no load controls.
  const showSeed = isEmpty && !isLocalBackend() && isFeederImportEnabled();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-5">
        <h1 className="text-xl font-bold text-gray-900">ROW Clearing Tracker</h1>
        <div className="flex items-center gap-4">
          {user?.email && (
            <span className="text-sm text-gray-600" title={user.email}>
              {user.email}
            </span>
          )}
          <button
            onClick={() => void signOut()}
            className="text-sm text-gray-400 transition-colors hover:text-gray-600"
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <ClaimsPanel />

        {notice && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>{notice}</span>
            <button
              onClick={() => setNotice(null)}
              className="text-amber-500 hover:text-amber-700"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* The one-time feeder load (prompt 09). Hidden unless the app was built
            with VITE_ENABLE_FEEDER_IMPORT=true (off by default); it only succeeds
            while the gated create permission is enabled. */}
        {isFeederImportEnabled() && !isLocalBackend() && !loading && (
          <ImportPanel updatedBy={updatedBy} onImported={fetchRows} />
        )}

        {loading ? (
          <p className="text-center text-sm text-gray-400">Loading…</p>
        ) : showSeed ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center">
            <p className="mb-4 text-sm text-gray-500">
              No feeders yet. Load the 15 synthetic sample rows to get started.
            </p>
            <button
              onClick={() => void handleSeed()}
              disabled={seeding}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-40"
            >
              {seeding ? 'Loading…' : 'Load sample data'}
            </button>
            {seedError && (
              <p className="mt-3 text-sm text-red-600">{seedError}</p>
            )}
          </div>
        ) : isEmpty ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center">
            <p className="text-sm text-gray-500">No feeders loaded yet</p>
          </div>
        ) : (
          <>
            <FeederTable
              rows={rows}
              editingId={editingId}
              onEdit={setEditingId}
              onCancel={() => setEditingId(null)}
              onSaved={handleSaved}
              updatedBy={updatedBy}
              changedBy={changedBy}
            />
            <RecentChanges rows={recent} />
          </>
        )}
      </main>
    </div>
  );
}

/** The last 20 changes across all feeders, newest first. */
function RecentChanges({ rows }: { rows: ChangeLogRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">
        Recent changes
      </h2>
      <ul className="divide-y divide-gray-100 text-sm">
        {rows.map((entry) => (
          <li key={entry.id} className="py-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium text-gray-900">
                {entry.feeder_id}
              </span>
              <span className="text-xs text-gray-400">
                {formatWhen(entry.changed_at)} · {entry.changed_by}
              </span>
            </div>
            <ChangeList changes={entry.changes} />
            {entry.reason && (
              <p className="mt-0.5 text-xs italic text-gray-500">
                “{entry.reason}”
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The change history for one feeder, newest first, shown inside its edit view. */
function FeederHistory({ feederId }: { feederId: string }) {
  const [history, setHistory] = useState<ChangeLogRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listFeederHistory(feederId).then((h) => {
      if (!cancelled) setHistory(h);
    });
    return () => {
      cancelled = true;
    };
  }, [feederId]);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-4 py-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        History
      </h3>
      {history === null ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : history.length === 0 ? (
        <p className="text-xs text-gray-400">No changes logged yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 text-sm">
          {history.map((entry) => (
            <li key={entry.id} className="py-2">
              <div className="text-xs text-gray-400">
                {formatWhen(entry.changed_at)} · {entry.changed_by}
              </div>
              <ChangeList changes={entry.changes} />
              {entry.reason && (
                <p className="mt-0.5 text-xs italic text-gray-500">
                  “{entry.reason}”
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One field change per line: `Field: old → new`. */
function ChangeList({ changes }: { changes: FieldChange[] }) {
  if (changes.length === 0) return null;
  return (
    <ul className="mt-0.5 space-y-0.5 text-xs text-gray-700">
      {changes.map((c) => (
        <li key={c.field}>
          <span className="text-gray-500">{FIELD_LABELS[c.field]}:</span>{' '}
          <span className="text-gray-400">{formatValue(c.before)}</span>
          {' → '}
          <span className="font-medium text-gray-900">
            {formatValue(c.after)}
          </span>
        </li>
      ))}
    </ul>
  );
}

const formatWhen = (d: Date): string =>
  d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const formatValue = (v: string | number | null): string =>
  v == null || v === '' ? '(none)' : String(v);

function FeederTable({
  rows,
  editingId,
  onEdit,
  onCancel,
  onSaved,
  updatedBy,
  changedBy,
}: {
  rows: ClearingPlanRow[];
  editingId: string | null;
  onEdit: (id: string) => void;
  onCancel: () => void;
  onSaved: (warning?: string) => Promise<void>;
  updatedBy: string;
  changedBy: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
          <tr>
            <th className="px-4 py-3">Feeder</th>
            <th className="px-4 py-3">District</th>
            <th className="px-4 py-3">Vendor</th>
            <th className="px-4 py-3">Next clearing</th>
            <th className="px-4 py-3">Certainty</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) =>
            row.id === editingId ? (
              <tr key={row.id}>
                <td colSpan={6} className="bg-blue-50/40 px-4 py-4">
                  <EditForm
                    row={row}
                    updatedBy={updatedBy}
                    changedBy={changedBy}
                    onCancel={onCancel}
                    onSaved={onSaved}
                  />
                </td>
              </tr>
            ) : (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {row.feeder_id}
                </td>
                <td className="px-4 py-3 text-gray-700">{row.district_name}</td>
                <td className="px-4 py-3 text-gray-700">{row.vendor}</td>
                <td className="px-4 py-3 text-gray-700">
                  {toInputDate(row.next_clearing_date) || '—'}
                </td>
                <td className="px-4 py-3 text-gray-700">{row.date_certainty}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onEdit(row.id)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function EditForm({
  row,
  updatedBy,
  changedBy,
  onCancel,
  onSaved,
}: {
  row: ClearingPlanRow;
  updatedBy: string;
  changedBy: string | null;
  onCancel: () => void;
  onSaved: (warning?: string) => Promise<void>;
}) {
  const [edit, setEdit] = useState<ClearingPlanEdit>(() => editFromRow(row));
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<ClearingPlanErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof ClearingPlanEdit>(
    key: K,
    value: ClearingPlanEdit[K]
  ) => setEdit((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateClearingPlan(edit);
    setErrors(found);
    if (hasErrors(found)) return;

    setSaveError(null);
    setSaving(true);
    try {
      // Save first; the read-back gives the server-verified row (prompt 08).
      const saved = await updateClearingPlan(row.id, edit, updatedBy);
      // Then log the change. A logging failure does NOT undo the save — it is
      // surfaced as a "saved but not logged" warning, never hidden.
      const result = await logFeederUpdate(
        row,
        saved,
        changedBy,
        reason.trim() || null
      );
      await onSaved(result.error);
    } catch (err) {
      setSaveError(toUserMessage(err, 'Failed to save.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-gray-700">
        <span>
          <span className="text-gray-400">Feeder</span>{' '}
          <span className="font-medium text-gray-900">{row.feeder_id}</span>
        </span>
        <span>
          <span className="text-gray-400">District</span>{' '}
          <span className="font-medium text-gray-900">{row.district_name}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Vendor" error={errors.vendor}>
          <select
            value={edit.vendor}
            onChange={(e) => set('vendor', e.target.value as ClearingPlanEdit['vendor'])}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
          >
            {VENDORS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date certainty" error={errors.date_certainty}>
          <select
            value={edit.date_certainty}
            onChange={(e) =>
              set('date_certainty', e.target.value as ClearingPlanEdit['date_certainty'])
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
          >
            {DATE_CERTAINTIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Next clearing date" error={errors.next_clearing_date}>
          <input
            type="date"
            value={edit.next_clearing_date}
            onChange={(e) => set('next_clearing_date', e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
          />
        </Field>

        <Field label="Planned year" error={errors.planned_year}>
          <input
            type="number"
            value={edit.planned_year}
            onChange={(e) => set('planned_year', e.target.value)}
            placeholder="e.g. 2027"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
          />
        </Field>

        <Field label="Last cleared date" error={errors.last_cleared_date}>
          <input
            type="date"
            value={edit.last_cleared_date}
            onChange={(e) => set('last_cleared_date', e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
          />
        </Field>

        <Field label="Last work done" error={errors.last_work_done}>
          <input
            type="text"
            value={edit.last_work_done}
            onChange={(e) => set('last_work_done', e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
          />
        </Field>
      </div>

      <Field label={`Notes (${edit.notes.length}/${NOTES_MAX})`} error={errors.notes}>
        <textarea
          value={edit.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
        />
      </Field>

      <Field label={`Reason for change (optional, ${reason.length}/${REASON_MAX})`}>
        <input
          type="text"
          value={reason}
          maxLength={REASON_MAX}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Recorded in the change log"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
        />
      </Field>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      <FeederHistory feederId={row.feeder_id} />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// Expected reconciliation after a clean load, from docs/measures.md. Shown
// beside the actual counts so a mismatch is obvious at a glance.
const EXPECTED = {
  total: 153,
  certainty: { confirmed: 142, tentative: 1, 'next year': 2, TBD: 8 },
  withNextDate: 143,
} as const;

/** The gated feeder load (prompt 09): pick the Snowflake export CSV, upsert by
 * feeder_id, and show the result + reconciliation counts. */
function ImportPanel({
  updatedBy,
  onImported,
}: {
  updatedBy: string;
  onImported: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setSummary(null);
    setBusy(true);
    try {
      const text = await file.text();
      const result = await importFeeders(text, updatedBy);
      setSummary(result);
      await onImported();
    } catch (err) {
      setError(toUserMessage(err, 'Failed to import feeders.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Import feeders</h2>
          <p className="text-xs text-gray-500">
            Load the 153 clean feeders from the Snowflake export CSV. Matches by
            feeder ID: existing rows are updated, missing ones created.
          </p>
        </div>
        <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 aria-disabled:opacity-40">
          {busy ? 'Importing…' : 'Choose CSV…'}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ''; // allow re-picking the same file
              if (file) void handleFile(file);
            }}
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="mt-4 space-y-3 text-sm">
          <p className="font-medium text-gray-900">
            Created {summary.created} · Updated {summary.updated} · Skipped{' '}
            {summary.skipped}
          </p>

          <div className="rounded-lg bg-gray-50 px-4 py-3 text-gray-700">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Reconciliation (actual vs expected)
            </p>
            <ul className="space-y-0.5">
              <Recon label="Feeders in plan" actual={summary.reconciliation.total} expected={EXPECTED.total} />
              <Recon label="Confirmed" actual={summary.reconciliation.certainty.confirmed} expected={EXPECTED.certainty.confirmed} />
              <Recon label="Tentative" actual={summary.reconciliation.certainty.tentative} expected={EXPECTED.certainty.tentative} />
              <Recon label="Next year" actual={summary.reconciliation.certainty['next year']} expected={EXPECTED.certainty['next year']} />
              <Recon label="TBD" actual={summary.reconciliation.certainty.TBD} expected={EXPECTED.certainty.TBD} />
              <Recon label="With a next clearing date" actual={summary.reconciliation.withNextDate} expected={EXPECTED.withNextDate} />
            </ul>
          </div>

          {summary.errors.length > 0 && (
            <details className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <summary className="cursor-pointer font-medium text-amber-800">
                {summary.errors.length} row(s) skipped
              </summary>
              <ul className="mt-2 space-y-0.5 text-xs text-amber-900">
                {summary.errors.map((e) => (
                  <li key={`${e.row}-${e.feeder_id}`}>
                    Row {e.row} ({e.feeder_id}): {e.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {summary.leftover.length > 0 && (
            <details className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <summary className="cursor-pointer font-medium text-gray-700">
                {summary.leftover.length} existing feeder(s) not in the file —
                reported, not deleted
              </summary>
              <p className="mt-2 text-xs text-gray-500">
                The app has no delete permission; remove these in the Fabric SQL
                database if they shouldn't be there (see docs/app-notes.md).
              </p>
              <p className="mt-1 break-words text-xs text-gray-700">
                {summary.leftover.join(', ')}
              </p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Recon({
  label,
  actual,
  expected,
}: {
  label: string;
  actual: number;
  expected: number;
}) {
  const ok = actual === expected;
  return (
    <li className="flex justify-between">
      <span>{label}</span>
      <span className={ok ? 'text-gray-900' : 'font-semibold text-red-600'}>
        {actual}
        {!ok && <span className="text-gray-400"> / {expected}</span>}
      </span>
    </li>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
