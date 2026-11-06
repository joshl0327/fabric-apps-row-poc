import { createContext, useContext } from 'react';

export interface FeederPanelContextValue {
  /** The feeder whose panel is open, or null. */
  openFeederId: string | null;
  /** Open the side panel for a feeder (validated id). */
  openFeeder: (feederId: string) => void;
  closeFeeder: () => void;
  /** Bumped after a save so lists/KPIs re-fetch. */
  dataVersion: number;
  /** Call after a successful save to refresh dependent queries. */
  notifySaved: () => void;
}

export const FeederPanelContext = createContext<FeederPanelContextValue | undefined>(undefined);

export function useFeederPanel(): FeederPanelContextValue {
  const ctx = useContext(FeederPanelContext);
  if (!ctx) throw new Error('useFeederPanel must be used within AppShell');
  return ctx;
}
