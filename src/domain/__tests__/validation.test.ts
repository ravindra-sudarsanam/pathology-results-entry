import { describe, expect, it } from 'vitest';
import { REFERENCE_CONFIG } from '../../config/referenceConfig';
import { assessFormValues, assessSubmission } from '../assessment';
import { parseNumericInput } from '../numericInput';
import { parseSubmittedValue, validateRawInput } from '../validation';
import type { ParameterId } from '../types';

const param = (id: ParameterId) => REFERENCE_CONFIG.parameters.find((p) => p.id === id)!;

describe('parseNumericInput', () => {
  it.each([
    ['', { kind: 'empty' }],
    ['   ', { kind: 'empty' }],
    ['120', { kind: 'number', value: 120, decimalPlaces: 0 }],
    [' 4.2 ', { kind: 'number', value: 4.2, decimalPlaces: 1 }],
    ['.5', { kind: 'number', value: 0.5, decimalPlaces: 1 }],
    ['5.', { kind: 'number', value: 5, decimalPlaces: 0 }],
    ['-3', { kind: 'number', value: -3, decimalPlaces: 0 }],
    ['4.25', { kind: 'number', value: 4.25, decimalPlaces: 2 }],
  ])('parses %j', (raw, expected) => {
    expect(parseNumericInput(raw)).toEqual(expected);
  });

  it.each(['abc', '12a', '1e2', '0x10', '12,5', '1.2.3', '--1', '+5', 'Infinity', 'NaN', '.', '-'])(
    'rejects %j as not a number',
    (raw) => {
      expect(parseNumericInput(raw)).toEqual({ kind: 'invalid' });
    },
  );
});

describe('validateRawInput', () => {
  it('rejects text', () => {
    expect(validateRawInput('high', param('systolicBp'))).toEqual({
      status: 'invalid',
      error: { code: 'NOT_A_NUMBER' },
    });
  });

  it('rejects decimals on whole-number parameters', () => {
    expect(validateRawInput('120.5', param('systolicBp'))).toEqual({
      status: 'invalid',
      error: { code: 'TOO_MANY_DECIMALS', maxDecimals: 0 },
    });
  });

  it('rejects more decimals than configured', () => {
    expect(validateRawInput('4.25', param('potassium'))).toEqual({
      status: 'invalid',
      error: { code: 'TOO_MANY_DECIMALS', maxDecimals: 1 },
    });
  });

  it('reports an impossible value as out of range before precision', () => {
    expect(validateRawInput('-0.55', param('haemoglobin'))).toEqual({
      status: 'invalid',
      error: { code: 'BELOW_PLAUSIBLE_MIN', min: 1 },
    });
  });

  it('accepts the exact plausible limits', () => {
    expect(validateRawInput('40', param('systolicBp'))).toEqual({ status: 'valid', value: 40 });
    expect(validateRawInput('300', param('systolicBp'))).toEqual({ status: 'valid', value: 300 });
  });

  it('treats a blank field as not measured, not as an error', () => {
    expect(validateRawInput('', param('potassium'))).toEqual({ status: 'empty' });
  });
});

describe('parseSubmittedValue (API payloads)', () => {
  it.each([
    [4.2, { kind: 'number', value: 4.2, decimalPlaces: 1 }],
    [120, { kind: 'number', value: 120, decimalPlaces: 0 }],
    [null, { kind: 'empty' }],
    [undefined, { kind: 'empty' }],
  ])('accepts %j', (value, expected) => {
    expect(parseSubmittedValue(value)).toEqual(expected);
  });

  it.each(['120', true, NaN, Infinity, 1e-7, {}, []])('rejects %j', (value) => {
    expect(parseSubmittedValue(value)).toEqual({ kind: 'invalid' });
  });
});

describe('entry-level assessment', () => {
  it('requires at least one value', () => {
    const result = assessFormValues({}, 'female', REFERENCE_CONFIG);
    expect(result.isValid).toBe(false);
    expect(result.entryErrors).toEqual([{ code: 'NO_VALUES' }]);
  });

  it('accepts a partial entry and classifies only the values given', () => {
    const result = assessFormValues({ potassium: '6.4', heartRate: '72' }, 'female', REFERENCE_CONFIG);
    expect(result.isValid).toBe(true);
    expect(result.values).toEqual([
      { parameterId: 'heartRate', value: 72, classification: 'NORMAL' },
      { parameterId: 'potassium', value: 6.4, classification: 'CRITICAL_HIGH' },
    ]);
    expect(result.fields.systolicBp).toEqual({ status: 'empty' });
  });

  it('rejects diastolic BP that is not lower than systolic BP', () => {
    const result = assessFormValues({ systolicBp: '90', diastolicBp: '90' }, 'male', REFERENCE_CONFIG);
    expect(result.isValid).toBe(false);
    expect(result.fields.diastolicBp).toEqual({
      status: 'invalid',
      error: { code: 'CROSS_FIELD', ruleId: 'diastolic-below-systolic', lower: 'diastolicBp', higher: 'systolicBp' },
    });
    expect(result.fields.systolicBp).toMatchObject({ status: 'valid', classification: 'NORMAL' });
  });

  it('skips the cross-field rule when one side is missing or invalid', () => {
    expect(assessFormValues({ diastolicBp: '95' }, 'male', REFERENCE_CONFIG).isValid).toBe(true);
    const withInvalidSystolic = assessFormValues({ systolicBp: '9000', diastolicBp: '95' }, 'male', REFERENCE_CONFIG);
    expect(withInvalidSystolic.fields.diastolicBp).toMatchObject({ status: 'valid', classification: 'HIGH' });
  });

  it('one invalid field makes the whole entry invalid, but other fields are still classified', () => {
    const result = assessFormValues({ systolicBp: '900', potassium: '3.0' }, 'female', REFERENCE_CONFIG);
    expect(result.isValid).toBe(false);
    expect(result.fields.systolicBp.status).toBe('invalid');
    expect(result.fields.potassium).toMatchObject({ status: 'valid', classification: 'LOW' });
  });
});

describe('assessSubmission (server-side)', () => {
  it('rejects unknown parameter ids', () => {
    const result = assessSubmission({ potassium: 4.1, cholesterol: 180 }, 'female', REFERENCE_CONFIG);
    expect(result.isValid).toBe(false);
    expect(result.entryErrors).toContainEqual({ code: 'UNKNOWN_PARAMETER', parameterId: 'cholesterol' });
  });

  it('rejects string numbers in the payload', () => {
    const result = assessSubmission({ potassium: '4.1' }, 'female', REFERENCE_CONFIG);
    expect(result.fields.potassium).toEqual({ status: 'invalid', error: { code: 'NOT_A_NUMBER' } });
  });

  it('classifies a valid payload the same way as the form', () => {
    const fromForm = assessFormValues({ systolicBp: '182', diastolicBp: '95' }, 'male', REFERENCE_CONFIG);
    const fromApi = assessSubmission({ systolicBp: 182, diastolicBp: 95 }, 'male', REFERENCE_CONFIG);
    expect(fromApi.values).toEqual(fromForm.values);
  });
});
