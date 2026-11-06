import type { ClearingStatus, DateCertainty } from './dax/queries';

/** One feeder row as the grid and card lists display it (joined dimensions +
 * the model's per-feeder status). */
export interface GridRow {
  feederId: string;
  circuitName: string;
  substationName: string;
  district: string;
  vendor: string;
  certainty: DateCertainty | string;
  nextClearingDate: string | null;
  plannedYear: number | null;
  lineMiles: number | null;
  status: ClearingStatus | string;
  /** Only populated by the DQ list / fixture; undefined elsewhere. */
  hasDqIssue?: boolean;
}

/** The Today-page KPI values (all model measures). */
export interface Kpis {
  feedersInPlan: number;
  withoutDate: number;
  dueSoon: number;
  overdue: number;
  /** % Plan Date Scheduled, 0..1. */
  coverage: number;
  dqIssues: number;
}

/** One cell of the Schedule chart: feeders due in a month, by vendor. */
export interface ScheduleCell {
  monthSort: number;
  monthLabel: string;
  vendor: string;
  feeders: number;
}
