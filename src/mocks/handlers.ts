import { http, HttpResponse } from 'msw';
import { API_BASE } from '../api/client';
import type { ApiErrorBody, ApiErrorCode, ApiFieldError, SaveResultRequest } from '../api/contracts';
import { PATIENT_RULES } from '../config/patientRules';
import { REFERENCE_CONFIG } from '../config/referenceConfig';
import {
  assessSubmission,
  describeEntryError,
  describeFieldError,
  validatePatient,
  type EntryAssessment,
} from '../domain';
import { db } from './db';
import { mockNetwork, simulateLatency, type MockEndpoint } from './network';

/**
 * The mock backend. It is the source of truth: it validates and classifies
 * every saved entry, exactly as a real API would. The UI's live flags are only
 * a preview using the same domain module.
 */

function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  details: Pick<ApiErrorBody['error'], 'fieldErrors' | 'formErrors'> = {},
) {
  const body: ApiErrorBody = { error: { code, message, ...details } };
  return HttpResponse.json(body, { status });
}

const internalError = () => errorResponse(500, 'INTERNAL_ERROR', 'The server hit an unexpected error.');

/** Applies simulated latency, then returns a 500 if a failure was armed for this endpoint. */
async function beginRequest(endpoint: MockEndpoint) {
  await simulateLatency();
  return mockNetwork.takeFailure(endpoint);
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function validationErrorsOf(assessment: EntryAssessment) {
  const fieldErrors: Record<string, ApiFieldError> = {};
  for (const parameter of REFERENCE_CONFIG.parameters) {
    const field = assessment.fields[parameter.id];
    if (field.status === 'invalid') {
      fieldErrors[parameter.id] = {
        code: field.error.code,
        message: describeFieldError(field.error, parameter, REFERENCE_CONFIG.parameters),
      };
    }
  }
  return { fieldErrors, formErrors: assessment.entryErrors.map(describeEntryError) };
}

const patientsUrl = `${API_BASE}/patients`;
const patientUrl = `${API_BASE}/patients/:patientId`;
const resultsUrl = `${API_BASE}/patients/:patientId/results`;

export const handlers = [
  http.get(patientsUrl, async () => {
    if (await beginRequest('listPatients')) return internalError();
    return HttpResponse.json(db.listPatients());
  }),

  http.post(patientsUrl, async ({ request }) => {
    if (await beginRequest('createPatient')) return internalError();
    const body = await readJsonBody(request);
    if (!isRecord(body)) return errorResponse(400, 'BAD_REQUEST', 'Request body must be a JSON object.');

    const result = validatePatient(body, PATIENT_RULES);
    if (!result.ok) {
      const fieldErrors = Object.fromEntries(
        Object.entries(result.errors).map(([field, message]) => [field, { code: 'INVALID', message }]),
      );
      return errorResponse(400, 'VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors });
    }
    return HttpResponse.json(db.insertPatient(result.patient), { status: 201 });
  }),

  http.get(patientUrl, async ({ params }) => {
    if (await beginRequest('getPatient')) return internalError();
    const patient = db.getPatient(String(params.patientId));
    if (!patient) return errorResponse(404, 'NOT_FOUND', 'Patient not found.');
    return HttpResponse.json(patient);
  }),

  http.get(`${API_BASE}/parameters`, async () => {
    if (await beginRequest('getParameters')) return internalError();
    return HttpResponse.json(REFERENCE_CONFIG);
  }),

  http.get(resultsUrl, async ({ params }) => {
    if (await beginRequest('listResults')) return internalError();
    const patientId = String(params.patientId);
    if (!db.getPatient(patientId)) return errorResponse(404, 'NOT_FOUND', 'Patient not found.');
    return HttpResponse.json(db.listResults(patientId));
  }),

  http.post(resultsUrl, async ({ params, request }) => {
    const failure = await beginRequest('saveResult');
    if (failure === 'error') return internalError();

    const patient = db.getPatient(String(params.patientId));
    if (!patient) return errorResponse(404, 'NOT_FOUND', 'Patient not found.');

    const body = await readJsonBody(request);
    if (!isRecord(body) || !isRecord(body.values)) {
      return errorResponse(400, 'BAD_REQUEST', 'Request body must include a "values" object.');
    }
    const { clientRequestId } = body as Partial<SaveResultRequest>;
    if (typeof clientRequestId !== 'string' || clientRequestId.trim() === '') {
      return errorResponse(400, 'BAD_REQUEST', 'Request body must include a "clientRequestId" string.');
    }

    // Idempotent retry: the first attempt was saved, so return it instead of saving again.
    const alreadySaved = db.findByRequestId(clientRequestId);
    if (alreadySaved) {
      if (alreadySaved.patientId !== patient.id) {
        return errorResponse(400, 'BAD_REQUEST', 'This clientRequestId was already used for another patient.');
      }
      return HttpResponse.json(alreadySaved, { status: 200 });
    }

    const assessment = assessSubmission(body.values, patient.sex, REFERENCE_CONFIG);
    if (!assessment.isValid) {
      return errorResponse(
        400,
        'VALIDATION_FAILED',
        'Some values are not possible readings.',
        validationErrorsOf(assessment),
      );
    }

    const saved = db.insertResult(patient, assessment.values, { clientRequestId });
    if (failure === 'errorAfterSave') return internalError();
    return HttpResponse.json(saved, { status: 201 });
  }),
];
