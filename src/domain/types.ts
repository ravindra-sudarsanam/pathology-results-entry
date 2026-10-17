/**
 * Core domain types for pathology results entry.
 *
 * This module (and everything in src/domain) is framework-free TypeScript:
 * no React, no fetch, no browser APIs. It is shared by the mock API (which is
 * the source of truth for classification) and by the UI (which uses it to
 * preview flags while the nurse types).
 */

export type Sex = 'female' | 'male';

export type ParameterId = 'systolicBp' | 'diastolicBp' | 'heartRate' | 'haemoglobin' | 'bloodGlucose' | 'potassium';

export type ParameterCategory = 'vitals' | 'labs';

/** A closed numeric interval. Whether the ends are included is decided by the ClassificationPolicy. */
export interface Range {
  low: number;
  high: number;
}

export interface SexSpecificRange {
  female: Range;
  male: Range;
}

export interface ParameterDefinition {
  id: ParameterId;
  name: string;
  unit: string;
  category: ParameterCategory;
  /** Maximum number of decimal places a nurse may enter. 0 means whole numbers only. */
  decimals: number;
  /**
   * Physiologically plausible bounds (inclusive). Anything outside is an
   * impossible value: a validation error, never a classification.
   */
  plausible: Range;
  /** Normal reference range, optionally different by sex. */
  normal: Range | SexSpecificRange;
  /** Critical limits: values at/beyond these are CRITICAL (see ClassificationPolicy). */
  critical: Range;
}

export type Classification = 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL_LOW' | 'CRITICAL_HIGH';

/**
 * How values that land exactly on a boundary are treated. The brief leaves
 * this open on purpose, so it is configuration rather than code.
 */
export interface ClassificationPolicy {
  /** true: a value equal to normal.low or normal.high is NORMAL. */
  normalRangeInclusive: boolean;
  /** true: a value equal to critical.low or critical.high is CRITICAL. */
  criticalLimitInclusive: boolean;
}

/**
 * A rule that compares two parameters in the same entry, e.g. diastolic BP
 * must be lower than systolic BP. Only applied when both values are present
 * and individually valid.
 */
export interface LessThanRule {
  kind: 'lessThan';
  id: string;
  lower: ParameterId;
  higher: ParameterId;
  /** Field the error is attached to. */
  reportOn: ParameterId;
}

export type CrossFieldRule = LessThanRule;

/** Everything the classifier needs to know, as served by GET /api/parameters. */
export interface ReferenceConfig {
  parameters: ParameterDefinition[];
  policy: ClassificationPolicy;
  crossFieldRules: CrossFieldRule[];
}

export type FieldValidationError =
  | { code: 'NOT_A_NUMBER' }
  | { code: 'TOO_MANY_DECIMALS'; maxDecimals: number }
  | { code: 'BELOW_PLAUSIBLE_MIN'; min: number }
  | { code: 'ABOVE_PLAUSIBLE_MAX'; max: number }
  | { code: 'CROSS_FIELD'; ruleId: string; lower: ParameterId; higher: ParameterId };

export type EntryValidationError = { code: 'NO_VALUES' } | { code: 'UNKNOWN_PARAMETER'; parameterId: string };
