import type { PatientListItem, ResultEntry, ResultValue } from '../api/contracts';
import { REFERENCE_CONFIG } from '../config/referenceConfig';
import { resolveNormalRange, summarize, type AssessedValue, type Patient } from '../domain';

/**
 * In-memory "database" behind the mock API. It resets on page reload, which
 * is a documented limitation of the Frontend track.
 */
interface Tables {
  patients: Map<string, Patient>;
  /** Per patient, stored oldest first. */
  results: Map<string, ResultEntry[]>;
  /** clientRequestId -> saved entry, for idempotent retries. */
  savedRequests: Map<string, ResultEntry>;
}

let tables: Tables = emptyTables();
let sequence = 0;

function emptyTables(): Tables {
  return { patients: new Map(), results: new Map(), savedRequests: new Map() };
}

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

/** Turns domain-assessed values into stored values with a range snapshot. */
export function toResultValues(patient: Patient, assessed: readonly AssessedValue[]): ResultValue[] {
  return assessed.map(({ parameterId, value, classification }) => {
    const parameter = REFERENCE_CONFIG.parameters.find((p) => p.id === parameterId);
    if (!parameter) throw new Error(`Unknown parameter ${parameterId}`);
    return {
      parameterId,
      value,
      unit: parameter.unit,
      classification,
      referenceRange: { normal: resolveNormalRange(parameter, patient.sex), critical: { ...parameter.critical } },
    };
  });
}

export const db = {
  reset() {
    tables = emptyTables();
    sequence = 0;
  },

  insertPatient(data: Omit<Patient, 'id'>, id: string = nextId('p')): Patient {
    const patient: Patient = { id, ...data };
    tables.patients.set(patient.id, patient);
    tables.results.set(patient.id, []);
    return patient;
  },

  getPatient(id: string): Patient | undefined {
    return tables.patients.get(id);
  },

  listPatients(): PatientListItem[] {
    return [...tables.patients.values()]
      .map((patient) => {
        const latest = db.listResults(patient.id)[0];
        return {
          ...patient,
          latestResult: latest ? { recordedAt: latest.recordedAt, ...latest.summary } : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  /** Newest first. */
  listResults(patientId: string): ResultEntry[] {
    return [...(tables.results.get(patientId) ?? [])].reverse();
  },

  findByRequestId(clientRequestId: string): ResultEntry | undefined {
    return tables.savedRequests.get(clientRequestId);
  },

  insertResult(
    patient: Patient,
    assessed: readonly AssessedValue[],
    options: { clientRequestId?: string; recordedAt?: Date } = {},
  ): ResultEntry {
    const values = toResultValues(patient, assessed);
    const entry: ResultEntry = {
      id: nextId('r'),
      patientId: patient.id,
      recordedAt: (options.recordedAt ?? new Date()).toISOString(),
      values,
      summary: summarize(values.map((v) => v.classification)),
    };
    const history = tables.results.get(patient.id) ?? [];
    history.push(entry);
    history.sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
    tables.results.set(patient.id, history);
    if (options.clientRequestId) tables.savedRequests.set(options.clientRequestId, entry);
    return entry;
  },
};
