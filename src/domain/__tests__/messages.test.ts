import { describe, expect, it } from 'vitest';
import { REFERENCE_CONFIG } from '../../config/referenceConfig';
import { describeEntryError, describeFieldError, describeNormalRange, formatRange } from '../messages';
import type { FieldValidationError, ParameterId } from '../types';

const param = (id: ParameterId) => REFERENCE_CONFIG.parameters.find((p) => p.id === id)!;
const describe_ = (error: FieldValidationError, id: ParameterId) =>
  describeFieldError(error, param(id), REFERENCE_CONFIG.parameters);

describe('user-facing messages', () => {
  it.each<[FieldValidationError, ParameterId, string]>([
    [{ code: 'NOT_A_NUMBER' }, 'systolicBp', 'Enter a whole number, for example 120.'],
    [{ code: 'NOT_A_NUMBER' }, 'potassium', 'Enter a number, for example 4.2.'],
    [{ code: 'TOO_MANY_DECIMALS', maxDecimals: 0 }, 'heartRate', 'Heart rate is recorded in whole numbers.'],
    [{ code: 'TOO_MANY_DECIMALS', maxDecimals: 1 }, 'potassium', 'Use up to 1 decimal place.'],
    [{ code: 'TOO_MANY_DECIMALS', maxDecimals: 2 }, 'potassium', 'Use up to 2 decimal places.'],
    [
      { code: 'ABOVE_PLAUSIBLE_MAX', max: 300 },
      'systolicBp',
      'Not a possible Systolic BP value. Check the reading: it must be between 40–300 mmHg.',
    ],
    [
      { code: 'BELOW_PLAUSIBLE_MIN', min: 1 },
      'haemoglobin',
      'Not a possible Haemoglobin value. Check the reading: it must be between 1.0–25.0 g/dL.',
    ],
    [
      { code: 'CROSS_FIELD', ruleId: 'r', lower: 'diastolicBp', higher: 'systolicBp' },
      'diastolicBp',
      'Diastolic BP must be lower than Systolic BP.',
    ],
  ])('%j on %s', (error, id, expected) => {
    expect(describe_(error, id)).toBe(expected);
  });

  it('describes entry-level errors', () => {
    expect(describeEntryError({ code: 'NO_VALUES' })).toBe('Enter at least one value before saving.');
    expect(describeEntryError({ code: 'UNKNOWN_PARAMETER', parameterId: 'x' })).toBe('Unknown parameter "x".');
  });

  it('formats ranges at the parameter precision', () => {
    expect(formatRange({ low: 3.5, high: 5 }, 1)).toBe('3.5–5.0');
    expect(describeNormalRange(param('potassium'))).toBe('3.5–5.0');
    expect(describeNormalRange(param('haemoglobin'), 'female')).toBe('12.0–15.5 (female)');
    expect(describeNormalRange(param('haemoglobin'))).toBe('female 12.0–15.5, male 13.5–17.5');
  });
});
