import type {
  ApiErrorBody,
  ApiErrorCode,
  ApiFieldError,
  CreatePatientRequest,
  Patient,
  PatientListItem,
  ReferenceConfigResponse,
  ResultEntry,
  SaveResultRequest,
} from './contracts';

export const API_BASE = '/api';

type ErrorCode = ApiErrorCode | 'NETWORK_ERROR' | 'UNEXPECTED_RESPONSE';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fieldErrors: Record<string, ApiFieldError>;
  readonly formErrors: string[];

  constructor(options: {
    status: number;
    code: ErrorCode;
    message: string;
    fieldErrors?: Record<string, ApiFieldError>;
    formErrors?: string[];
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors ?? {};
    this.formErrors = options.formErrors ?? [];
  }

  /** 4xx validation problems the user can fix by editing the form. */
  get isValidationError(): boolean {
    return this.code === 'VALIDATION_FAILED';
  }
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as ApiErrorBody).error?.message === 'string'
  );
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Absolute URL so the same client works in the browser and in Node-based tests.
  const url = new URL(`${API_BASE}${path}`, window.location.origin);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check the connection and try again.',
    });
  }

  const body = await readJson(response);

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiError({ status: response.status, ...body.error });
    }
    throw new ApiError({
      status: response.status,
      code: response.status >= 500 ? 'INTERNAL_ERROR' : 'UNEXPECTED_RESPONSE',
      message: `The server responded with an error (${response.status}).`,
    });
  }

  if (body === undefined) {
    throw new ApiError({
      status: response.status,
      code: 'UNEXPECTED_RESPONSE',
      message: 'The server sent an empty or unreadable response.',
    });
  }
  return body as T;
}

const json = (data: unknown): RequestInit => ({ body: JSON.stringify(data) });

export const api = {
  listPatients: () => request<PatientListItem[]>('/patients'),

  getPatient: (patientId: string) => request<Patient>(`/patients/${encodeURIComponent(patientId)}`),

  createPatient: (data: CreatePatientRequest) => request<Patient>('/patients', { method: 'POST', ...json(data) }),

  getReferenceConfig: () => request<ReferenceConfigResponse>('/parameters'),

  listResults: (patientId: string) => request<ResultEntry[]>(`/patients/${encodeURIComponent(patientId)}/results`),

  saveResult: (patientId: string, data: SaveResultRequest) =>
    request<ResultEntry>(`/patients/${encodeURIComponent(patientId)}/results`, { method: 'POST', ...json(data) }),
};
