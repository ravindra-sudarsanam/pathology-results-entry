import { describe, expect, it } from 'vitest';
import { resolveNormalRange, type ParameterDefinition, type Sex } from '../../domain';
import { REFERENCE_CONFIG } from '../referenceConfig';

/**
 * Guards against a mis-typed range shipping silently. If any of these fail,
 * classification would produce nonsense (e.g. a value both LOW and CRITICAL_HIGH).
 */
const isOnStep = (n: number, decimals: number) => Number(n.toFixed(decimals)) === n;

describe('reference configuration integrity', () => {
  const required = ['systolicBp', 'diastolicBp', 'heartRate', 'haemoglobin', 'bloodGlucose', 'potassium'];

  it('seeds every parameter the brief requires, once each', () => {
    const ids = REFERENCE_CONFIG.parameters.map((p) => p.id);
    expect([...ids].sort()).toEqual([...required].sort());
  });

  for (const p of REFERENCE_CONFIG.parameters) {
    for (const sex of ['female', 'male'] as Sex[]) {
      it(`${p.id} (${sex}): plausible < critical < normal < critical < plausible`, () => {
        const normal = resolveNormalRange(p, sex);
        expect(p.plausible.low).toBeLessThan(p.critical.low);
        expect(p.critical.low).toBeLessThan(normal.low);
        expect(normal.low).toBeLessThanOrEqual(normal.high);
        expect(normal.high).toBeLessThan(p.critical.high);
        expect(p.critical.high).toBeLessThan(p.plausible.high);
      });
    }

    it(`${p.id}: every limit can be typed at the configured precision`, () => {
      const limits = (q: ParameterDefinition) => [
        q.plausible.low,
        q.plausible.high,
        q.critical.low,
        q.critical.high,
        ...(['female', 'male'] as Sex[]).flatMap((s) => [resolveNormalRange(q, s).low, resolveNormalRange(q, s).high]),
      ];
      for (const limit of limits(p)) expect(isOnStep(limit, p.decimals)).toBe(true);
    });
  }

  it('cross-field rules only reference configured parameters', () => {
    const ids = new Set(REFERENCE_CONFIG.parameters.map((p) => p.id));
    for (const rule of REFERENCE_CONFIG.crossFieldRules) {
      expect(ids.has(rule.lower)).toBe(true);
      expect(ids.has(rule.higher)).toBe(true);
      expect(ids.has(rule.reportOn)).toBe(true);
    }
  });
});
