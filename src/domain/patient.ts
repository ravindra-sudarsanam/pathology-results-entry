import type { Sex } from './types';

export interface Patient {
  id: string;
  name: string;
  /** Age in whole years at registration. */
  age: number;
  sex: Sex;
}

export interface PatientRules {
  nameMaxLength: number;
  minAgeYears: number;
  maxAgeYears: number;
}

export type PatientField = 'name' | 'age' | 'sex';

export type PatientValidationResult =
  { ok: true; patient: Omit<Patient, 'id'> } | { ok: false; errors: Partial<Record<PatientField, string>> };

const SEXES: readonly Sex[] = ['female', 'male'];

function parseAge(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isInteger(raw) ? raw : null;
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number(raw.trim());
  return null;
}

/** Shared by the "New patient" form and the mock API. */
export function validatePatient(
  input: { name?: unknown; age?: unknown; sex?: unknown },
  rules: PatientRules,
): PatientValidationResult {
  const errors: Partial<Record<PatientField, string>> = {};

  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
  if (name === '') errors.name = 'Enter the patient’s name.';
  else if (name.length > rules.nameMaxLength) errors.name = `Use ${rules.nameMaxLength} characters or fewer.`;

  const age = parseAge(input.age);
  if (input.age === '' || input.age === undefined || input.age === null) errors.age = 'Enter the patient’s age.';
  else if (age === null) errors.age = 'Enter the age in whole years.';
  else if (age < rules.minAgeYears || age > rules.maxAgeYears) {
    errors.age = `Age must be between ${rules.minAgeYears} and ${rules.maxAgeYears}. Reference ranges here are for adults only.`;
  }

  const sex = SEXES.find((s) => s === input.sex);
  if (!sex) errors.sex = 'Select female or male.';

  if (Object.keys(errors).length > 0 || age === null || !sex) return { ok: false, errors };
  return { ok: true, patient: { name, age, sex } };
}
