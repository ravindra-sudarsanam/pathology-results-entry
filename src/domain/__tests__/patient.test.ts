import { describe, expect, it } from 'vitest';
import { PATIENT_RULES } from '../../config/patientRules';
import { validatePatient } from '../patient';

describe('validatePatient', () => {
  it('accepts a valid adult and normalises whitespace in the name', () => {
    expect(validatePatient({ name: '  Asha   Menon ', age: '54', sex: 'female' }, PATIENT_RULES)).toEqual({
      ok: true,
      patient: { name: 'Asha Menon', age: 54, sex: 'female' },
    });
  });

  it.each([
    [17, false],
    [18, true],
    [120, true],
    [121, false],
  ])('age boundary %i → valid: %s', (age, valid) => {
    expect(validatePatient({ name: 'A', age, sex: 'male' }, PATIENT_RULES).ok).toBe(valid);
  });

  it('reports every missing field at once', () => {
    const result = validatePatient({ name: ' ', age: '', sex: '' }, PATIENT_RULES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['age', 'name', 'sex']);
  });

  it.each(['54.5', 'fifty', '-3', 54.5])('rejects non-whole-number age %j', (age) => {
    const result = validatePatient({ name: 'A', age, sex: 'male' }, PATIENT_RULES);
    expect(result.ok).toBe(false);
  });

  it('rejects names longer than the configured limit', () => {
    const name = 'x'.repeat(PATIENT_RULES.nameMaxLength + 1);
    expect(validatePatient({ name, age: 40, sex: 'female' }, PATIENT_RULES).ok).toBe(false);
  });
});
