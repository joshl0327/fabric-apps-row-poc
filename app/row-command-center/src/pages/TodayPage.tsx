import { useState } from 'react';
import { KpiCard } from '@microsoft/fabric-visuals';

import { useThemeContext } from '@/hooks/theme.context';
import { useAsync } from '@/hooks/use-async';
import { useFeederPanel } from '@/app/feeder-context';
import { getKpis } from '@/lib/analytics';
import { CARD_LINKS, feedersForCard, type CardId } from '@/lib/card-links';
import { FeederList } from '@/components/FeederList';

// Card order and the KPI + format each shows. All values are model measures.
const CARDS: { id: CardId; subtitle: string; value: (k: Awaited<ReturnType<typeof getKpis>>) => number; format: string }[] = [
  { id: 'feedersInPlan', subtitle: 'In the clearing plan', value: (k) => k.feedersInPlan, format: '#,0' },
  { id: 'coverage', subtitle: '% with a scheduled date', value: (k) => k.coverage, format: '0.0%' },
  { id: 'overdue', subtitle: 'Past due, real date', value: (k) => k.overdue, format: '#,0' },
  { id: 'dueSoon', subtitle: 'Within 90 days', value: (k) => k.dueSoon, format: '#,0' },
  { id: 'withoutDate', subtitle: 'Next year or TBD', value: (k) => k.withoutDate, format: '#,0' },
  { id: 'dqIssues', subtitle: 'Affected in-plan feeders', value: (k) => k.feedersWithDqIssues, format: '#,0' },
];

export default function TodayPage() {
  const { theme } = useThemeContext();
  const { dataVersion } = useFeederPanel();
  const { data: kpis, loading, error } = useAsync(getKpis, [dataVersion]);
  const [card, setCard] = useState<CardId | null>(null);
  const drill = useAsync(() => (card ? feedersForCard(card) : Promise.resolve([])), [card, dataVersion]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-500 font-semibold text-emphasis-foreground">Today</h1>
        <p className="text-200 text-muted-foreground">
          Data as of now — the clearing plan is live (DirectQuery from the app database); circuits,
          districts and vendors are imported. Every number is a model measure.
        </p>
      </div>

      {error && <p role="alert" className="text-300 text-destructive">{error.message}</p>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {CARDS.map(({ id, subtitle, value, format }) => (
          <button
            key={id}
            type="button"
            onClick={() => setCard(id)}
            aria-pressed={card === id}
            className={`rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              card === id ? 'ring-2 ring-brand' : ''
            }`}
          >
            <KpiCard
              header={{ title: CARD_LINKS[id].title, subtitle }}
              theme={theme}
              callout={{ metric: { value: kpis && !loading ? value(kpis) : null, format } }}
            />
          </button>
        ))}
      </div>

      {card && (
        <section className="flex flex-col gap-2">
          <h2 className="text-400 font-semibold text-emphasis-foreground">{CARD_LINKS[card].title}</h2>
          {drill.loading ? (
            <p className="text-300 text-muted-foreground">Loading feeders…</p>
          ) : drill.error ? (
            <p role="alert" className="text-300 text-destructive">{drill.error.message}</p>
          ) : (
            <FeederList rows={drill.data ?? []} />
          )}
        </section>
      )}
    </div>
  );
}
