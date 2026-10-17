import { parseNumericInput, type ParsedInput } from './numericInput';
import type { FieldValidationError, ParameterDefinition } from './types';

export type FieldCheck =
  { status: 'empty' } | { status: 'invalid'; error: FieldValidationError } | { status: 'valid'; value: number };

/**
 * Validation answers "is this a possible measurement?". It runs before, and
 * separately from, classification ("is this measurement normal?").
 * An invalid value is rejected; it is never classified as abnormal.
 */
export function validateParsedValue(input: ParsedInput, parameter: ParameterDefinition): FieldCheck {
  if (input.kind === 'empty') return { status: 'empty' };
  if (input.kind === 'invalid') return { status: 'invalid', error: { code: 'NOT_A_NUMBER' } };

  const { value, decimalPlaces } = input;
  const { plausible } = parameter;

  // Range is checked before precision: "-5" on haemoglobin is primarily impossible, not imprecise.
  if (value < plausible.low) {
    return { status: 'invalid', error: { code: 'BELOW_PLAUSIBLE_MIN', min: plausible.low } };
  }
  if (value > plausible.high) {
    return { status: 'invalid', error: { code: 'ABOVE_PLAUSIBLE_MAX', max: plausible.high } };
  }
  if (decimalPlaces > parameter.decimals) {
    return { status: 'invalid', error: { code: 'TOO_MANY_DECIMALS', maxDecimals: parameter.decimals } };
  }
  return { status: 'valid', value };
}

export function validateRawInput(raw: string, parameter: ParameterDefinition): FieldCheck {
  return validateParsedValue(parseNumericInput(raw), parameter);
}

/**
 * Converts a value from an API payload into the same ParsedInput shape the
 * form produces, so client and server share one validation path.
 * The contract expects JSON numbers; strings, booleans, NaN etc. are rejected.
 */
export function parseSubmittedValue(value: unknown): ParsedInput {
  if (value === null || value === undefined) return { kind: 'empty' };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { kind: 'invalid' };
  // Re-use the strict text parser so exponent forms (1e-7) are rejected consistently.
  return parseNumericInput(String(value));
}
