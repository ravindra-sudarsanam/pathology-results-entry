import type { Classification } from '../domain';

export type Severity = 'normal' | 'abnormal' | 'critical';

export const SEVERITY: Record<Classification, Severity> = {
  NORMAL: 'normal',
  LOW: 'abnormal',
  HIGH: 'abnormal',
  CRITICAL_LOW: 'critical',
  CRITICAL_HIGH: 'critical',
};
