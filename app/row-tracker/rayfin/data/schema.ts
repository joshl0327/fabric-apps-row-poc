import { ChangeLog } from './ChangeLog.js';
import { ClearingPlan } from './ClearingPlan.js';

export type ClearingPlanAppSchema = {
  ClearingPlan: ClearingPlan;
  ChangeLog: ChangeLog;
};

export const schema = [ClearingPlan, ChangeLog];
