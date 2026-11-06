// Status pill, coloured by the model's Clearing Status. The colour is a display
// choice; the status value itself comes from the model measure.
const STYLES: Record<string, string> = {
  Overdue: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  'Due soon': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  Scheduled: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  'No date': 'bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? 'bg-slate-200 text-slate-700';
  return (
    <span className={`inline-block w-24 rounded-full px-2 py-0.5 text-center text-200 font-medium ${style}`}>
      {status || '—'}
    </span>
  );
}
