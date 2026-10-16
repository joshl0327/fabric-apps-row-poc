import { useAuth } from '@/hooks/AuthContext';

/**
 * Diagnostic "Who am I" card. Shows every claim the app can read for the
 * signed-in user. It exists to answer the open design question — do Entra
 * groups/roles reach the app so role rules can use them? — once the app is
 * deployed and signed in through Fabric. Display only.
 */
export function ClaimsPanel() {
  const { claims } = useAuth();
  const entries = claims ? Object.entries(claims) : [];

  return (
    <section
      aria-label="Who am I (diagnostic)"
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-800">
          Who am I
        </h2>
        <span className="rounded bg-amber-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-900">
          Diagnostic
        </span>
      </div>
      <p className="mb-3 text-xs text-amber-700">
        The claims this app receives for you. Used to check whether Entra
        groups/roles reach the app — confirmed after deploy.
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-amber-800">No claims available.</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="font-mono text-amber-900">{key}</dt>
              <dd className="break-words text-amber-800">
                {typeof value === 'string' ? value : JSON.stringify(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
