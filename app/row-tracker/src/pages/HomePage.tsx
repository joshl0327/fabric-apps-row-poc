import { useCallback, useEffect, useState } from 'react';

import { ClaimsPanel } from '@/components/ClaimsPanel';
import { useAuth } from '@/hooks/AuthContext';
import {
  DATE_CERTAINTIES,
  NOTES_MAX,
  VENDORS,
  type ClearingPlanEdit,
  type ClearingPlanRow,
} from '@/services/clearingPlanModel';
import {
  listClearingPlans,
  seedFabric,
  updateClearingPlan,
} from '@/services/clearingPlans';
import { isLocalBackend } from '@/services/rayfinClient';
import {
  hasErrors,
  validateClearingPlan,
  type ClearingPlanErrors,
} from '@/services/validation';

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
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setRows(await listClearingPlans());
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const handleSeed = async () => {
    setSeedError(null);
    setSeeding(true);
    try {
      await seedFabric(user?.email ?? user?.id ?? 'unknown');
      await fetchRows();
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setSeeding(false);
    }
  };

  // The gated Fabric seed: offered only against a real backend when empty.
  const showSeed = !isLocalBackend() && !loading && rows.length === 0;

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
        ) : (
          <FeederTable
            rows={rows}
            editingId={editingId}
            onEdit={setEditingId}
            onCancel={() => setEditingId(null)}
            onSaved={async () => {
              setEditingId(null);
              await fetchRows();
            }}
            updatedBy={user?.email ?? user?.id ?? 'unknown'}
          />
        )}
      </main>
    </div>
  );
}

function FeederTable({
  rows,
  editingId,
  onEdit,
  onCancel,
  onSaved,
  updatedBy,
}: {
  rows: ClearingPlanRow[];
  editingId: string | null;
  onEdit: (id: string) => void;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  updatedBy: string;
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
  onCancel,
  onSaved,
}: {
  row: ClearingPlanRow;
  updatedBy: string;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [edit, setEdit] = useState<ClearingPlanEdit>(() => editFromRow(row));
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
      await updateClearingPlan(row.id, edit, updatedBy);
      await onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save.');
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

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

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
