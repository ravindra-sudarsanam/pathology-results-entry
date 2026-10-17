import type { ParameterDefinition, ParameterId } from './types';

export interface ValueChange {
  previousValue: number;
  previousRecordedAt: string;
  /** current - previous, rounded to the parameter's precision. */
  difference: number;
  direction: 'up' | 'down' | 'unchanged';
}

export interface EntryWithValues {
  id: string;
  /** ISO 8601 timestamp. */
  recordedAt: string;
  values: ReadonlyArray<{ parameterId: ParameterId; value: number }>;
}

export type ChangesByEntry = Map<string, Partial<Record<ParameterId, ValueChange>>>;

function roundTo(value: number, decimals: number): number {
  const rounded = Number(value.toFixed(decimals));
  return rounded === 0 ? 0 : rounded; // avoid "-0"
}

/**
 * For every value in every entry, the change from the most recent earlier
 * value of the same parameter. A parameter left blank in an entry is skipped,
 * so the comparison is always against the last time it was actually measured.
 * Input order does not matter; entries are ordered by recordedAt.
 */
export function computeChanges(
  entries: readonly EntryWithValues[],
  parameters: readonly ParameterDefinition[],
): ChangesByEntry {
  const decimalsById = new Map(parameters.map((p) => [p.id, p.decimals]));
  const chronological = [...entries].sort(
    (a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt) || a.id.localeCompare(b.id),
  );

  const lastSeen = new Map<ParameterId, { value: number; recordedAt: string }>();
  const result: ChangesByEntry = new Map();

  for (const entry of chronological) {
    const changes: Partial<Record<ParameterId, ValueChange>> = {};
    for (const { parameterId, value } of entry.values) {
      const previous = lastSeen.get(parameterId);
      if (previous) {
        const difference = roundTo(value - previous.value, decimalsById.get(parameterId) ?? 2);
        changes[parameterId] = {
          previousValue: previous.value,
          previousRecordedAt: previous.recordedAt,
          difference,
          direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'unchanged',
        };
      }
      lastSeen.set(parameterId, { value, recordedAt: entry.recordedAt });
    }
    result.set(entry.id, changes);
  }
  return result;
}
