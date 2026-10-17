import { describe, expect, it } from 'vitest';
import { api, ApiError } from '../../api/client';
import { REFERENCE_CONFIG } from '../../config/referenceConfig';
import { mockNetwork } from '../network';
import { SEED_PATIENT_IDS } from '../seed';

/**
 * Exercises the real API client against the mock backend over (intercepted)
 * HTTP: the contract documented in docs/API.md.
 */

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected the request to fail');
}

describe('mock API contract', () => {
  it('serves the reference configuration from GET /api/parameters', async () => {
    const config = await api.getReferenceConfig();
    expect(config.parameters.map((p) => p.id)).toEqual(REFERENCE_CONFIG.parameters.map((p) => p.id));
    expect(config.policy).toEqual(REFERENCE_CONFIG.policy);
  });

  it('lists patients with a summary of their latest result', async () => {
    const patients = await api.listPatients();
    const rahul = patients.find((p) => p.id === SEED_PATIENT_IDS.rahul)!;
    expect(rahul.latestResult).toMatchObject({ critical: 1 });
    expect(patients.find((p) => p.id === SEED_PATIENT_IDS.meera)!.latestResult).toBeNull();
  });

  it('classifies on the server and returns the classification with the saved entry', async () => {
    const saved = await api.saveResult(SEED_PATIENT_IDS.meera, {
      clientRequestId: 'req-1',
      values: { systolicBp: 185, diastolicBp: 95, potassium: 4.2 },
    });

    expect(saved.values).toEqual([
      expect.objectContaining({ parameterId: 'systolicBp', classification: 'CRITICAL_HIGH', unit: 'mmHg' }),
      expect.objectContaining({ parameterId: 'diastolicBp', classification: 'HIGH' }),
      expect.objectContaining({ parameterId: 'potassium', classification: 'NORMAL' }),
    ]);
    expect(saved.summary).toEqual({ abnormal: 2, critical: 1 });
    expect(saved.values[0].referenceRange).toEqual({
      normal: { low: 90, high: 129 },
      critical: { low: 70, high: 180 },
    });
  });

  it('returns history newest first, including the new entry', async () => {
    const saved = await api.saveResult(SEED_PATIENT_IDS.asha, { clientRequestId: 'req-2', values: { heartRate: 70 } });
    const history = await api.listResults(SEED_PATIENT_IDS.asha);

    expect(history[0].id).toBe(saved.id);
    const times = history.map((entry) => Date.parse(entry.recordedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('rejects impossible values with field-level errors and saves nothing', async () => {
    const error = await captureError(
      api.saveResult(SEED_PATIENT_IDS.meera, {
        clientRequestId: 'req-3',
        values: { systolicBp: 900, haemoglobin: -2 },
      }),
    );

    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.fieldErrors.systolicBp.code).toBe('ABOVE_PLAUSIBLE_MAX');
    expect(error.fieldErrors.haemoglobin.code).toBe('BELOW_PLAUSIBLE_MIN');
    expect(await api.listResults(SEED_PATIENT_IDS.meera)).toEqual([]);
  });

  it('rejects an empty entry and unknown parameters', async () => {
    const empty = await captureError(api.saveResult(SEED_PATIENT_IDS.meera, { clientRequestId: 'req-4', values: {} }));
    expect(empty.formErrors).toEqual(['Enter at least one value before saving.']);

    const unknown = await captureError(
      api.saveResult(SEED_PATIENT_IDS.meera, {
        clientRequestId: 'req-5',
        values: { cholesterol: 180 } as never,
      }),
    );
    expect(unknown.formErrors).toContain('Unknown parameter "cholesterol".');
  });

  it('returns 404 for an unknown patient', async () => {
    const error = await captureError(api.listResults('p-does-not-exist'));
    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('a lost response followed by a retry with the same clientRequestId saves exactly once', async () => {
    const before = (await api.listResults(SEED_PATIENT_IDS.daniel)).length;
    mockNetwork.failNext('saveResult', 'errorAfterSave');
    const request = { clientRequestId: 'req-6', values: { potassium: 5.6 } };

    const lost = await captureError(api.saveResult(SEED_PATIENT_IDS.daniel, request));
    expect(lost.status).toBe(500);

    const retried = await api.saveResult(SEED_PATIENT_IDS.daniel, request);
    expect(retried.values[0]).toMatchObject({ parameterId: 'potassium', classification: 'HIGH' });
    expect(await api.listResults(SEED_PATIENT_IDS.daniel)).toHaveLength(before + 1);
  });

  it('validates new patients on the server', async () => {
    const error = await captureError(api.createPatient({ name: '', age: 12, sex: 'female' }));
    expect(error.status).toBe(400);
    expect(Object.keys(error.fieldErrors).sort()).toEqual(['age', 'name']);

    const created = await api.createPatient({ name: 'Lena Fischer', age: 38, sex: 'female' });
    expect((await api.getPatient(created.id)).name).toBe('Lena Fischer');
  });

  it('reports a server failure as a 500 ApiError', async () => {
    mockNetwork.failNext('listPatients');
    const error = await captureError(api.listPatients());
    expect(error).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
    // Failures are one-shot: the next call succeeds.
    await expect(api.listPatients()).resolves.toHaveLength(5);
  });
});
