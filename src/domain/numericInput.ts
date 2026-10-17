/**
 * Parsing of what the nurse typed. Kept strict on purpose: in a clinical form
 * "1e2", "0x10" or "12,5" should never silently become a number.
 *
 * Accepted: optional leading minus, digits, optional single "." with digits.
 * A trailing "." ("5.") is accepted as the nurse may still be typing.
 * Assumption: "." is the decimal separator (no locale-specific commas).
 */

export type ParsedInput =
  { kind: 'empty' } | { kind: 'invalid' } | { kind: 'number'; value: number; decimalPlaces: number };

const NUMERIC_PATTERN = /^-?(\d+(\.\d*)?|\.\d+)$/;

export function parseNumericInput(raw: string): ParsedInput {
  const text = raw.trim();
  if (text === '') return { kind: 'empty' };
  if (!NUMERIC_PATTERN.test(text)) return { kind: 'invalid' };

  const value = Number(text);
  if (!Number.isFinite(value)) return { kind: 'invalid' };

  const fraction = text.split('.')[1] ?? '';
  return { kind: 'number', value, decimalPlaces: fraction.length };
}
