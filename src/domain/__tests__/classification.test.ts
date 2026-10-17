import { describe, expect, it } from 'vitest';
import { REFERENCE_CONFIG } from '../../config/referenceConfig';
import { classify, isAbnormal, isCritical, resolveNormalRange, summarize } from '../classification';
import { validateRawInput } from '../validation';
import type { Classification, ClassificationPolicy, ParameterDefinition, Sex } from '../types';

const INCLUSIVE: ClassificationPolicy = { normalRangeInclusive: true, criticalLimitInclusive: true };
const EXCLUSIVE: ClassificationPolicy = { normalRangeInclusive: false, criticalLimitInclusive: false };
const SEXES: Sex[] = ['female', 'male'];

/** Smallest step a nurse can enter for this parameter, e.g. 0.1 for potassium. */
const stepOf = (p: ParameterDefinition) => 10 ** -p.decimals;
/** Renders a number the way a nurse would type it, so the cases also exercise parsing. */
const typed = (p: ParameterDefinition, n: number) => n.toFixed(p.decimals);

type Expected = Classification | 'INVALID';

/**
 * Below / exact / above every boundary, derived from configuration so the
 * suite stays correct if a range is tuned.
 */
function boundaryCases(p: ParameterDefinition, sex: Sex): Array<[string, number, Expected]> {
  const s = stepOf(p);
  const normal = resolveNormalRange(p, sex);
  return [
    ['below plausible min', p.plausible.low - s, 'INVALID'],
    ['at plausible min', p.plausible.low, 'CRITICAL_LOW'],
    ['below critical low', p.critical.low - s, 'CRITICAL_LOW'],
    ['at critical low', p.critical.low, 'CRITICAL_LOW'],
    ['just above critical low', p.critical.low + s, 'LOW'],
    ['just below normal low', normal.low - s, 'LOW'],
    ['at normal low', normal.low, 'NORMAL'],
    ['just above normal low', normal.low + s, 'NORMAL'],
    ['just below normal high', normal.high - s, 'NORMAL'],
    ['at normal high', normal.high, 'NORMAL'],
    ['just above normal high', normal.high + s, 'HIGH'],
    ['just below critical high', p.critical.high - s, 'HIGH'],
    ['at critical high', p.critical.high, 'CRITICAL_HIGH'],
    ['above critical high', p.critical.high + s, 'CRITICAL_HIGH'],
    ['at plausible max', p.plausible.high, 'CRITICAL_HIGH'],
    ['above plausible max', p.plausible.high + s, 'INVALID'],
  ];
}

function validateThenClassify(p: ParameterDefinition, raw: string, sex: Sex, policy: ClassificationPolicy): Expected {
  const check = validateRawInput(raw, p);
  if (check.status !== 'valid') return 'INVALID';
  return classify(check.value, p, sex, policy);
}

describe('classification boundaries (default policy: normal inclusive, critical inclusive)', () => {
  for (const parameter of REFERENCE_CONFIG.parameters) {
    for (const sex of SEXES) {
      describe(`${parameter.name} (${sex})`, () => {
        it.each(boundaryCases(parameter, sex))('%s (%s) → %s', (_label, value, expected) => {
          const raw = typed(parameter, value);
          expect(validateThenClassify(parameter, raw, sex, REFERENCE_CONFIG.policy)).toBe(expected);
        });
      });
    }
  }
});

describe('hand-written spec examples', () => {
  const byId = (id: string) => REFERENCE_CONFIG.parameters.find((p) => p.id === id)!;
  const run = (id: string, raw: string, sex: Sex = 'female') =>
    validateThenClassify(byId(id), raw, sex, REFERENCE_CONFIG.policy);

  it('flags high blood pressure as HIGH, and a hypertensive crisis as CRITICAL_HIGH', () => {
    expect(run('systolicBp', '145')).toBe('HIGH');
    expect(run('systolicBp', '185')).toBe('CRITICAL_HIGH');
  });

  it('rejects impossible values instead of classifying them', () => {
    expect(run('systolicBp', '900')).toBe('INVALID');
    expect(run('haemoglobin', '-1')).toBe('INVALID');
    expect(run('haemoglobin', '0')).toBe('INVALID');
  });

  it('applies sex-specific haemoglobin ranges', () => {
    expect(run('haemoglobin', '13.0', 'female')).toBe('NORMAL');
    expect(run('haemoglobin', '13.0', 'male')).toBe('LOW');
    expect(run('haemoglobin', '16.0', 'female')).toBe('HIGH');
    expect(run('haemoglobin', '16.0', 'male')).toBe('NORMAL');
  });

  it('classifies potassium at its exact limits', () => {
    expect(run('potassium', '3.5')).toBe('NORMAL');
    expect(run('potassium', '5.0')).toBe('NORMAL');
    expect(run('potassium', '5.1')).toBe('HIGH');
    expect(run('potassium', '6.2')).toBe('CRITICAL_HIGH');
    expect(run('potassium', '2.8')).toBe('CRITICAL_LOW');
  });
});

describe('boundary policy is configuration, not code', () => {
  const potassium = REFERENCE_CONFIG.parameters.find((p) => p.id === 'potassium')!;

  it.each<[string, number, ClassificationPolicy, Classification]>([
    ['normal low, inclusive', 3.5, INCLUSIVE, 'NORMAL'],
    ['normal low, exclusive', 3.5, EXCLUSIVE, 'LOW'],
    ['normal high, inclusive', 5.0, INCLUSIVE, 'NORMAL'],
    ['normal high, exclusive', 5.0, EXCLUSIVE, 'HIGH'],
    ['critical low, inclusive', 2.8, INCLUSIVE, 'CRITICAL_LOW'],
    ['critical low, exclusive', 2.8, EXCLUSIVE, 'LOW'],
    ['critical high, inclusive', 6.2, INCLUSIVE, 'CRITICAL_HIGH'],
    ['critical high, exclusive', 6.2, EXCLUSIVE, 'HIGH'],
  ])('%s: %s → %s', (_label, value, policy, expected) => {
    expect(classify(value, potassium, 'female', policy)).toBe(expected);
  });
});

describe('severity helpers', () => {
  it('treats critical as abnormal, and only critical as critical', () => {
    expect(isAbnormal('NORMAL')).toBe(false);
    expect(isAbnormal('LOW')).toBe(true);
    expect(isAbnormal('CRITICAL_HIGH')).toBe(true);
    expect(isCritical('HIGH')).toBe(false);
    expect(isCritical('CRITICAL_LOW')).toBe(true);
  });

  it('summarises a set of classifications', () => {
    expect(summarize(['NORMAL', 'LOW', 'CRITICAL_HIGH', 'HIGH'])).toEqual({ abnormal: 3, critical: 1 });
    expect(summarize([])).toEqual({ abnormal: 0, critical: 0 });
  });
});
