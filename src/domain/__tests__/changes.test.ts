import { describe, expect, it } from 'vitest';
import { REFERENCE_CONFIG } from '../../config/referenceConfig';
import { computeChanges, type EntryWithValues } from '../changes';

const entry = (id: string, recordedAt: string, values: EntryWithValues['values']): EntryWithValues => ({
  id,
  recordedAt,
  values,
});

describe('computeChanges', () => {
  const oldest = entry('e1', '2026-10-01T09:00:00.000Z', [
    { parameterId: 'potassium', value: 4.1 },
    { parameterId: 'systolicBp', value: 128 },
  ]);
  const middle = entry('e2', '2026-10-08T09:00:00.000Z', [{ parameterId: 'systolicBp', value: 141 }]);
  const newest = entry('e3', '2026-10-15T09:00:00.000Z', [
    { parameterId: 'potassium', value: 4.4 },
    { parameterId: 'systolicBp', value: 141 },
  ]);

  it('compares with the most recent earlier measurement, regardless of input order', () => {
    const changes = computeChanges([newest, oldest, middle], REFERENCE_CONFIG.parameters);

    expect(changes.get('e1')).toEqual({});
    expect(changes.get('e2')?.systolicBp).toMatchObject({ previousValue: 128, difference: 13, direction: 'up' });
    expect(changes.get('e3')?.systolicBp).toMatchObject({ difference: 0, direction: 'unchanged' });
  });

  it('skips entries where the parameter was not measured', () => {
    const changes = computeChanges([oldest, middle, newest], REFERENCE_CONFIG.parameters);
    // e2 has no potassium, so e3 compares with e1.
    expect(changes.get('e3')?.potassium).toEqual({
      previousValue: 4.1,
      previousRecordedAt: oldest.recordedAt,
      difference: 0.3,
      direction: 'up',
    });
  });

  it('rounds to the parameter precision (no floating-point noise)', () => {
    const a = entry('a', '2026-10-01T09:00:00.000Z', [{ parameterId: 'potassium', value: 4.4 }]);
    const b = entry('b', '2026-10-02T09:00:00.000Z', [{ parameterId: 'potassium', value: 4.1 }]);
    expect(computeChanges([a, b], REFERENCE_CONFIG.parameters).get('b')?.potassium?.difference).toBe(-0.3);
  });
});
