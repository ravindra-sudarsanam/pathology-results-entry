import { classify } from './classification';
import { parseNumericInput, type ParsedInput } from './numericInput';
import type {
  Classification,
  CrossFieldRule,
  EntryValidationError,
  FieldValidationError,
  ParameterId,
  ReferenceConfig,
  Sex,
} from './types';
import { parseSubmittedValue, validateParsedValue, type FieldCheck } from './validation';

export type FieldAssessment =
  | { status: 'empty' }
  | { status: 'invalid'; error: FieldValidationError }
  | { status: 'valid'; value: number; classification: Classification };

export interface AssessedValue {
  parameterId: ParameterId;
  value: number;
  classification: Classification;
}

export interface EntryAssessment {
  /** One assessment per configured parameter, in configuration order. */
  fields: Record<ParameterId, FieldAssessment>;
  entryErrors: EntryValidationError[];
  /** true when there is at least one value and no field or entry errors. */
  isValid: boolean;
  /** Valid, classified values, in configuration order. Empty fields are omitted. */
  values: AssessedValue[];
}

type CheckedFields = Record<ParameterId, FieldCheck>;

function applyCrossFieldRules(fields: CheckedFields, rules: readonly CrossFieldRule[]): void {
  for (const rule of rules) {
    const lower = fields[rule.lower];
    const higher = fields[rule.higher];
    if (lower?.status !== 'valid' || higher?.status !== 'valid') continue;
    if (lower.value < higher.value) continue;
    fields[rule.reportOn] = {
      status: 'invalid',
      error: { code: 'CROSS_FIELD', ruleId: rule.id, lower: rule.lower, higher: rule.higher },
    };
  }
}

/**
 * The single validate-then-classify pipeline used by both the mock API
 * (authoritative) and the entry form (live preview).
 */
export function assessEntry(
  inputs: Partial<Record<ParameterId, ParsedInput>>,
  sex: Sex,
  config: ReferenceConfig,
): EntryAssessment {
  const checked = {} as CheckedFields;
  for (const parameter of config.parameters) {
    checked[parameter.id] = validateParsedValue(inputs[parameter.id] ?? { kind: 'empty' }, parameter);
  }
  applyCrossFieldRules(checked, config.crossFieldRules);

  const fields = {} as Record<ParameterId, FieldAssessment>;
  const values: AssessedValue[] = [];
  let hasInvalidField = false;

  for (const parameter of config.parameters) {
    const check = checked[parameter.id];
    if (check.status === 'valid') {
      const classification = classify(check.value, parameter, sex, config.policy);
      fields[parameter.id] = { status: 'valid', value: check.value, classification };
      values.push({ parameterId: parameter.id, value: check.value, classification });
    } else {
      if (check.status === 'invalid') hasInvalidField = true;
      fields[parameter.id] = check;
    }
  }

  const entryErrors: EntryValidationError[] = [];
  const hasAnyInput = config.parameters.some((p) => checked[p.id].status !== 'empty');
  if (!hasAnyInput) entryErrors.push({ code: 'NO_VALUES' });

  return {
    fields,
    entryErrors,
    isValid: !hasInvalidField && entryErrors.length === 0,
    values,
  };
}

/** Form convenience: raw text per field, exactly as typed. */
export function assessFormValues(
  rawValues: Partial<Record<ParameterId, string>>,
  sex: Sex,
  config: ReferenceConfig,
): EntryAssessment {
  const inputs: Partial<Record<ParameterId, ParsedInput>> = {};
  for (const parameter of config.parameters) {
    inputs[parameter.id] = parseNumericInput(rawValues[parameter.id] ?? '');
  }
  return assessEntry(inputs, sex, config);
}

/** API convenience: an untrusted JSON payload of { [parameterId]: number }. */
export function assessSubmission(payload: Record<string, unknown>, sex: Sex, config: ReferenceConfig): EntryAssessment {
  const knownIds = new Set<string>(config.parameters.map((p) => p.id));
  const unknownErrors: EntryValidationError[] = Object.keys(payload)
    .filter((key) => !knownIds.has(key))
    .map((parameterId) => ({ code: 'UNKNOWN_PARAMETER', parameterId }));

  const inputs: Partial<Record<ParameterId, ParsedInput>> = {};
  for (const parameter of config.parameters) {
    inputs[parameter.id] = parseSubmittedValue(payload[parameter.id]);
  }
  const assessment = assessEntry(inputs, sex, config);
  if (unknownErrors.length === 0) return assessment;

  return {
    ...assessment,
    entryErrors: [...assessment.entryErrors, ...unknownErrors],
    isValid: false,
  };
}
