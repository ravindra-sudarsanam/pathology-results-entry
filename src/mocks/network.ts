/**
 * Controls for the simulated network: latency, and failures you can arm on
 * purpose ("fail the next save") from the Mock API panel or from tests.
 * Deterministic failures make every error state easy to demo and to test.
 */

export type MockEndpoint =
  'listPatients' | 'createPatient' | 'getPatient' | 'getParameters' | 'listResults' | 'saveResult';

/**
 * - `error`: the server fails before doing anything (HTTP 500, nothing saved).
 * - `errorAfterSave`: the save succeeds but the response is lost (HTTP 500 after
 *   commit). Retrying with the same clientRequestId must not create a duplicate.
 */
export type FailureMode = 'error' | 'errorAfterSave';

export interface LatencyRange {
  minMs: number;
  maxMs: number;
}

export const LATENCY_PRESETS = {
  none: { minMs: 0, maxMs: 0 },
  normal: { minMs: 300, maxMs: 900 },
  slow: { minMs: 2000, maxMs: 3500 },
} satisfies Record<string, LatencyRange>;

export type LatencyPreset = keyof typeof LATENCY_PRESETS;

interface NetworkState {
  latency: LatencyPreset;
  armedFailures: Partial<Record<MockEndpoint, FailureMode>>;
}

let state: NetworkState = { latency: 'normal', armedFailures: {} };
const listeners = new Set<() => void>();

function setState(next: NetworkState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export const mockNetwork = {
  getState: (): NetworkState => state,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setLatency(latency: LatencyPreset) {
    setState({ ...state, latency });
  },

  failNext(endpoint: MockEndpoint, mode: FailureMode = 'error') {
    setState({ ...state, armedFailures: { ...state.armedFailures, [endpoint]: mode } });
  },

  disarm(endpoint: MockEndpoint) {
    const armedFailures = { ...state.armedFailures };
    delete armedFailures[endpoint];
    setState({ ...state, armedFailures });
  },

  /** Returns the armed failure for this endpoint, if any, and clears it (one-shot). */
  takeFailure(endpoint: MockEndpoint): FailureMode | undefined {
    const mode = state.armedFailures[endpoint];
    if (mode) this.disarm(endpoint);
    return mode;
  },

  reset(latency: LatencyPreset = 'normal') {
    setState({ latency, armedFailures: {} });
  },
};

export function simulateLatency(): Promise<void> {
  const { minMs, maxMs } = LATENCY_PRESETS[state.latency];
  if (maxMs === 0) return Promise.resolve();
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}
