import type { Classification, ClassificationPolicy, ParameterDefinition, Range, Sex, SexSpecificRange } from './types';

export function isSexSpecific(range: Range | SexSpecificRange): range is SexSpecificRange {
  return 'female' in range && 'male' in range;
}

export function resolveNormalRange(parameter: ParameterDefinition, sex: Sex): Range {
  return isSexSpecific(parameter.normal) ? parameter.normal[sex] : parameter.normal;
}

function isAtOrBelow(value: number, limit: number, inclusive: boolean): boolean {
  return inclusive ? value <= limit : value < limit;
}

function isAtOrAbove(value: number, limit: number, inclusive: boolean): boolean {
  return inclusive ? value >= limit : value > limit;
}

/**
 * Classifies a value that has already passed validation (see validation.ts).
 * Critical limits are checked first so they always win over LOW/HIGH.
 */
export function classify(
  value: number,
  parameter: ParameterDefinition,
  sex: Sex,
  policy: ClassificationPolicy,
): Classification {
  const { critical } = parameter;
  if (isAtOrBelow(value, critical.low, policy.criticalLimitInclusive)) return 'CRITICAL_LOW';
  if (isAtOrAbove(value, critical.high, policy.criticalLimitInclusive)) return 'CRITICAL_HIGH';

  const normal = resolveNormalRange(parameter, sex);
  // An inclusive normal range means the boundary itself is still NORMAL.
  if (isAtOrBelow(value, normal.low, !policy.normalRangeInclusive)) return 'LOW';
  if (isAtOrAbove(value, normal.high, !policy.normalRangeInclusive)) return 'HIGH';
  return 'NORMAL';
}

export function isCritical(classification: Classification): boolean {
  return classification === 'CRITICAL_LOW' || classification === 'CRITICAL_HIGH';
}

/** Abnormal includes critical: anything that is not NORMAL. */
export function isAbnormal(classification: Classification): boolean {
  return classification !== 'NORMAL';
}

export interface ClassificationSummary {
  /** Values outside the normal range, critical ones included. */
  abnormal: number;
  critical: number;
}

export function summarize(classifications: readonly Classification[]): ClassificationSummary {
  return {
    abnormal: classifications.filter(isAbnormal).length,
    critical: classifications.filter(isCritical).length,
  };
}
