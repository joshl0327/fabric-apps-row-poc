import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { CalendarClock, Home, ListTree, History } from 'lucide-react';

import { FeederPanelContext } from './feeder-context';
import { parseFeederId } from '@/lib/dax/feeder-id';
import { readFeederParam, FEEDER_PARAM } from '@/lib/deep-link';
import { FeederPanel } from '@/components/FeederPanel';
import { isLocalBackend } from '@/services/local-backend';

const TodayPage = lazy(() => import('@/pages/TodayPage'));
const FeedersPage = lazy(() => import('@/pages/FeedersPage'));
const ActivityPage = lazy(() => import('@/pages/ActivityPage'));
const SchedulePage = lazy(() => import('@/pages/SchedulePage'));

type PageId = 'today' | 'feeders' | 'activity' | 'schedule';

const NAV: { id: PageId; label: string; Icon: typeof Home }[] = [
  { id: 'today', label: 'Today', Icon: Home },
  { id: 'feeders', label: 'Feeders', Icon: ListTree },
  { id: 'activity', label: 'Activity', Icon: History },
  { id: 'schedule', label: 'Schedule', Icon: CalendarClock },
];

export function AppShell() {
  const [page, setPage] = useState<PageId>('today');
  // Deep link: ?feeder=<id> opens that feeder's panel on load (id validated).
  const [openFeederId, setOpenFeederId] = useState<string | null>(() =>
    readFeederParam(window.location.search),
  );
  const [dataVersion, setDataVersion] = useState(0);

  const openFeeder = useCallback((feederId: string) => {
    const id = parseFeederId(feederId);
    if (!id) return;
    setOpenFeederId(id);
    const url = new URL(window.location.href);
    url.searchParams.set(FEEDER_PARAM, id);
    window.history.replaceState(null, '', url);
  }, []);

  const closeFeeder = useCallback(() => {
    setOpenFeederId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete(FEEDER_PARAM);
    window.history.replaceState(null, '', url);
  }, []);

  const notifySaved = useCallback(() => setDataVersion((v) => v + 1), []);

  const ctx = useMemo(
    () => ({ openFeederId, openFeeder, closeFeeder, dataVersion, notifySaved }),
    [openFeederId, openFeeder, closeFeeder, dataVersion, notifySaved],
  );

  return (
    <FeederPanelContext.Provider value={ctx}>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        {/* Brand bar */}
        <header className="flex items-center gap-4 border-b border-border bg-card px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded-md bg-brand" aria-hidden />
            <span className="text-400 font-semibold text-emphasis-foreground">ROW Command Center</span>
          </div>
          <nav className="ml-6 flex items-center gap-1">
            {NAV.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPage(id)}
                aria-current={page === id ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-300 ${
                  page === id
                    ? 'bg-brand text-on-brand'
                    : 'text-muted-foreground hover:bg-foreground/[0.06]'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            ))}
          </nav>
          <span className="ml-auto text-200 text-muted-foreground">
            {isLocalBackend() ? 'Local preview — synthetic data' : 'ROW-POC-Dev'}
          </span>
        </header>

        <main className="flex-1 p-6">
          <Suspense fallback={<div className="text-300 text-muted-foreground">Loading…</div>}>
            {page === 'today' && <TodayPage />}
            {page === 'feeders' && <FeedersPage />}
            {page === 'activity' && <ActivityPage />}
            {page === 'schedule' && <SchedulePage />}
          </Suspense>
        </main>

        {openFeederId && <FeederPanel feederId={openFeederId} onClose={closeFeeder} />}
      </div>
    </FeederPanelContext.Provider>
  );
}
