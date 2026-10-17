import type { PatientRules } from '../domain';

/**
 * Patient registration rules. Reference ranges in this app are adult ranges,
 * so registration is limited to adults rather than silently applying adult
 * ranges to children.
 */
export const PATIENT_RULES: PatientRules = {
  nameMaxLength: 80,
  minAgeYears: 18,
  maxAgeYears: 120,
};
