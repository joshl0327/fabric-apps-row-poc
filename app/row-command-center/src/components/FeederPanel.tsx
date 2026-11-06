import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { useCurrentUser } from '@/hooks/use-current-user';
import { useFeederPanel } from '@/app/feeder-context';
import { listFeeders, updateFeeder } from '@/services/clearingPlans';
import { listFeederHistory, logFeederUpdate } from '@/services/changeLog';
import { toUserMessage } from '@/services/errors';
import { validateFeeder, hasErrors, type FeederErrors } from '@/services/validation';
import {
  DATE_CERTAINTIES,
  VENDORS,
  toEdit,
  type FeederEdit,
  type FeederRow,
} from '@/services/clearingPlanModel';
import type { ChangeLogRow } from '@/services/changeLogModel';
import { FIELD_LABELS } from '@/services/changeLogModel';

function field(edit: FeederEdit, key: keyof FeederEdit) {
  return edit[key];
}

export function FeederPanel({ feederId, onClose }: { feederId: string; onClose: () => void }) {
  const user = useCurrentUser();
  const { notifySaved } = useFeederPanel();

  const [row, setRow] = useState<FeederRow | null>(null);
  const [edit, setEdit] = useState<FeederEdit | null>(null);
  const [errors, setErrors] = useState<FeederErrors>({});
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<ChangeLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [warning, setWarning] = useState<string>();

  const loadHistory = useCallback(() => {
    void listFeederHistory(feederId).then(setHistory).catch(() => setHistory([]));
  }, [feederId]);

  useEffect(() => {
    let cancelled = false;
    // Intended data-loading pattern: show the loading state as the fetch starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void listFeeders()
      .then((all) => {
        if (cancelled) return;
        const found = all.find((r) => r.feederId === feederId) ?? null;
        setRow(found);
        setEdit(found ? toEdit(found) : null);
      })
      .finally(() => !cancelled && setLoading(false));
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [feederId, loadHistory]);

  const setField = (key: keyof FeederEdit, value: string) =>
    setEdit((e) => (e ? { ...e, [key]: value } : e));

  async function save() {
    if (!row || !edit) return;
    const errs = validateFeeder(edit);
    setErrors(errs);
    if (hasErrors(errs)) return;
    setSaving(true);
    setSaveError(undefined);
    setWarning(undefined);
    try {
      const before = row;
      const saved = await updateFeeder(row.id, edit, user.email ?? '');
      const logResult = await logFeederUpdate(before, saved, user.email, reason.trim() || null);
      setRow(saved);
      setEdit(toEdit(saved));
      setReason('');
      notifySaved();
      loadHistory();
      if (!logResult.logged && logResult.error) setWarning(logResult.error);
    } catch (err) {
      setSaveError(toUserMessage(err, 'The save failed.'));
    } finally {
      setSaving(false);
    }
  }

  const input = 'rounded-lg border border-border bg-background px-2 py-1 text-300 text-foreground';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-card shadow-container-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Feeder ${feederId}`}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-400 font-semibold text-emphasis-foreground">Feeder {feederId}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-foreground/[0.06]">
            <X className="h-5 w-5" />
          </button>
        </header>

        {loading ? (
          <p className="p-5 text-300 text-muted-foreground">Loading…</p>
        ) : !row || !edit ? (
          <p className="p-5 text-300 text-muted-foreground">Feeder {feederId} was not found.</p>
        ) : (
          <div className="flex flex-col gap-5 p-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-300">
              <dt className="text-muted-foreground">District</dt><dd>{row.districtName}</dd>
              <dt className="text-muted-foreground">Last cleared</dt><dd>{edit.last_cleared_date || '—'}</dd>
            </dl>

            <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
              <label className="flex flex-col gap-1 text-200 text-muted-foreground">Vendor
                <select className={input} value={field(edit, 'vendor')} onChange={(e) => setField('vendor', e.target.value)}>
                  {VENDORS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-200 text-muted-foreground">Date certainty
                <select className={input} value={field(edit, 'date_certainty')} onChange={(e) => setField('date_certainty', e.target.value)}>
                  {DATE_CERTAINTIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-200 text-muted-foreground">Next clearing date
                <input type="date" className={input} value={field(edit, 'next_clearing_date')} onChange={(e) => setField('next_clearing_date', e.target.value)} />
                {errors.next_clearing_date && <span className="text-200 text-destructive">{errors.next_clearing_date}</span>}
              </label>

              <label className="flex flex-col gap-1 text-200 text-muted-foreground">Planned year
                <input type="number" className={input} value={field(edit, 'planned_year')} onChange={(e) => setField('planned_year', e.target.value)} />
                {errors.planned_year && <span className="text-200 text-destructive">{errors.planned_year}</span>}
              </label>

              <label className="flex flex-col gap-1 text-200 text-muted-foreground">Last cleared date
                <input type="date" className={input} value={field(edit, 'last_cleared_date')} onChange={(e) => setField('last_cleared_date', e.target.value)} />
                {errors.last_cleared_date && <span className="text-200 text-destructive">{errors.last_cleared_date}</span>}
              </label>

              <label className="flex flex-col gap-1 text-200 text-muted-foreground">Last work done
                <input className={input} value={field(edit, 'last_work_done')} onChange={(e) => setField('last_work_done', e.target.value)} />
              </label>

              <label className="flex flex-col gap-1 text-200 text-muted-foreground">Notes
                <textarea className={input} rows={2} value={field(edit, 'notes')} onChange={(e) => setField('notes', e.target.value)} />
                {errors.notes && <span className="text-200 text-destructive">{errors.notes}</span>}
              </label>

              <label className="flex flex-col gap-1 text-200 text-muted-foreground">Reason for change (optional)
                <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>

              {saveError && <p role="alert" className="text-300 text-destructive">{saveError}</p>}
              {warning && <p role="alert" className="text-300 text-amber-700 dark:text-amber-300">{warning}</p>}

              <button type="submit" disabled={saving} className="self-start rounded-lg bg-brand px-4 py-2 text-300 font-semibold text-on-brand hover:opacity-90 disabled:opacity-60">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>

            <section className="flex flex-col gap-2">
              <h3 className="text-300 font-semibold text-emphasis-foreground">History</h3>
              {history.length === 0 ? (
                <p className="text-200 text-muted-foreground">No changes recorded for this feeder.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {history.map((h) => (
                    <li key={h.id} className="rounded-lg border border-border p-3 text-200">
                      <div className="text-muted-foreground">{h.changed_at.toLocaleString()} · {h.changed_by}{h.reason ? ` · “${h.reason}”` : ''}</div>
                      <ul>
                        {h.changes.map((c) => (
                          <li key={c.field}>{FIELD_LABELS[c.field]}: <span className="line-through opacity-70">{c.before ?? '—'}</span> → <span className="font-medium">{c.after ?? '—'}</span></li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
