import { isSexSpecific } from './classification';
import type {
  Classification,
  EntryValidationError,
  FieldValidationError,
  ParameterDefinition,
  ParameterId,
  Range,
} from './types';

/**
 * Text labels for each classification. The UI always shows these next to the
 * colour so meaning never depends on colour alone.
 */
export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  NORMAL: 'Normal',
  LOW: 'LOW',
  HIGH: 'HIGH',
  CRITICAL_LOW: 'CRITICAL LOW',
  CRITICAL_HIGH: 'CRITICAL HIGH',
};

export function formatNumber(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

export function formatRange(range: Range, decimals: number): string {
  return `${formatNumber(range.low, decimals)}–${formatNumber(range.high, decimals)}`;
}

function nameOf(id: ParameterId, parameters: readonly ParameterDefinition[]): string {
  return parameters.find((p) => p.id === id)?.name ?? id;
}

export function describeFieldError(
  error: FieldValidationError,
  parameter: ParameterDefinition,
  parameters: readonly ParameterDefinition[],
): string {
  const { plausible, decimals, unit, name } = parameter;
  const possibleRange = `${formatRange(plausible, decimals)} ${unit}`;

  switch (error.code) {
    case 'NOT_A_NUMBER':
      return decimals === 0 ? 'Enter a whole number, for example 120.' : 'Enter a number, for example 4.2.';
    case 'TOO_MANY_DECIMALS':
      return error.maxDecimals === 0
        ? `${name} is recorded in whole numbers.`
        : `Use up to ${error.maxDecimals} decimal place${error.maxDecimals === 1 ? '' : 's'}.`;
    case 'BELOW_PLAUSIBLE_MIN':
    case 'ABOVE_PLAUSIBLE_MAX':
      return `Not a possible ${name} value. Check the reading: it must be between ${possibleRange}.`;
    case 'CROSS_FIELD':
      return `${nameOf(error.lower, parameters)} must be lower than ${nameOf(error.higher, parameters)}.`;
  }
}

export function describeEntryError(error: EntryValidationError): string {
  switch (error.code) {
    case 'NO_VALUES':
      return 'Enter at least one value before saving.';
    case 'UNKNOWN_PARAMETER':
      return `Unknown parameter "${error.parameterId}".`;
  }
}

/** Human-readable normal range, e.g. "Normal 12.0–15.5 (female)". */
export function describeNormalRange(parameter: ParameterDefinition, sex?: 'female' | 'male'): string {
  if (!isSexSpecific(parameter.normal)) return formatRange(parameter.normal, parameter.decimals);
  if (sex) return `${formatRange(parameter.normal[sex], parameter.decimals)} (${sex})`;
  const { female, male } = parameter.normal;
  return `female ${formatRange(female, parameter.decimals)}, male ${formatRange(male, parameter.decimals)}`;
}
