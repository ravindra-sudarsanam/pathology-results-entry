import type { ClassificationPolicy, CrossFieldRule, ParameterDefinition, ReferenceConfig } from '../domain';

/**
 * Reference configuration. In a full-stack build this would live in the
 * database; here the mock API owns it and serves it from GET /api/parameters.
 * The UI never imports this file directly.
 *
 * Ranges are illustrative adult values chosen to be reasonable, not clinically
 * authoritative (the brief does not grade clinical accuracy).
 *
 * Invariant (checked by referenceConfig.test.ts):
 *   plausible.low < critical.low < normal.low <= normal.high < critical.high < plausible.high
 */
export const PARAMETERS: readonly ParameterDefinition[] = [
  {
    id: 'systolicBp',
    name: 'Systolic BP',
    unit: 'mmHg',
    category: 'vitals',
    decimals: 0,
    plausible: { low: 40, high: 300 },
    normal: { low: 90, high: 129 },
    critical: { low: 70, high: 180 },
  },
  {
    id: 'diastolicBp',
    name: 'Diastolic BP',
    unit: 'mmHg',
    category: 'vitals',
    decimals: 0,
    plausible: { low: 20, high: 200 },
    normal: { low: 60, high: 80 },
    critical: { low: 40, high: 120 },
  },
  {
    id: 'heartRate',
    name: 'Heart rate',
    unit: 'bpm',
    category: 'vitals',
    decimals: 0,
    plausible: { low: 20, high: 250 },
    normal: { low: 60, high: 100 },
    critical: { low: 40, high: 130 },
  },
  {
    id: 'haemoglobin',
    name: 'Haemoglobin',
    unit: 'g/dL',
    category: 'labs',
    decimals: 1,
    plausible: { low: 1, high: 25 },
    normal: { female: { low: 12, high: 15.5 }, male: { low: 13.5, high: 17.5 } },
    critical: { low: 7, high: 20 },
  },
  {
    id: 'bloodGlucose',
    name: 'Blood glucose (fasting)',
    unit: 'mg/dL',
    category: 'labs',
    decimals: 0,
    plausible: { low: 10, high: 1500 },
    normal: { low: 70, high: 99 },
    critical: { low: 50, high: 400 },
  },
  {
    id: 'potassium',
    name: 'Potassium',
    unit: 'mmol/L',
    category: 'labs',
    decimals: 1,
    plausible: { low: 1, high: 10 },
    normal: { low: 3.5, high: 5 },
    critical: { low: 2.8, high: 6.2 },
  },
];

/**
 * Boundary decisions (see README "Clinical Assumptions & Trade-offs"):
 * - A value exactly on a normal limit is NORMAL (reference intervals are
 *   conventionally reported as inclusive).
 * - A value exactly on a critical limit is CRITICAL. Critical limits are alert
 *   thresholds, so reaching one should alert: we prefer an extra alert over a
 *   missed one.
 */
export const CLASSIFICATION_POLICY: ClassificationPolicy = {
  normalRangeInclusive: true,
  criticalLimitInclusive: true,
};

export const CROSS_FIELD_RULES: readonly CrossFieldRule[] = [
  {
    kind: 'lessThan',
    id: 'diastolic-below-systolic',
    lower: 'diastolicBp',
    higher: 'systolicBp',
    reportOn: 'diastolicBp',
  },
];

export const REFERENCE_CONFIG: ReferenceConfig = {
  parameters: [...PARAMETERS],
  policy: CLASSIFICATION_POLICY,
  crossFieldRules: [...CROSS_FIELD_RULES],
};
