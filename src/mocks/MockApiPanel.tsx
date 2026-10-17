import { useQueryClient } from '@tanstack/react-query';
import { useState, useSyncExternalStore } from 'react';
import { mockNetwork, type FailureMode, type LatencyPreset, type MockEndpoint } from './network';
import { seedDatabase } from './seed';

/**
 * Demo tooling, not part of the product: lets a reviewer trigger latency and
 * failures on purpose to see every loading and error state.
 */

const FAILURES: Array<{ endpoint: MockEndpoint; mode: FailureMode; label: string }> = [
  { endpoint: 'saveResult', mode: 'error', label: 'Fail the next save (nothing is saved)' },
  { endpoint: 'saveResult', mode: 'errorAfterSave', label: 'Lose the next save response (saved, but the reply fails)' },
  { endpoint: 'listResults', mode: 'error', label: 'Fail the next history load' },
  { endpoint: 'listPatients', mode: 'error', label: 'Fail the next patient list load' },
  { endpoint: 'createPatient', mode: 'error', label: 'Fail the next new patient' },
];

const LATENCY_LABELS: Record<LatencyPreset, string> = {
  none: 'None',
  normal: '0.3–0.9 s',
  slow: '2–3.5 s',
};

export function MockApiPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const state = useSyncExternalStore(mockNetwork.subscribe, mockNetwork.getState);
  const queryClient = useQueryClient();
  const armedCount = Object.keys(state.armedFailures).length;

  function resetData() {
    seedDatabase();
    mockNetwork.reset(state.latency);
    void queryClient.resetQueries();
  }

  return (
    <div className="mock-panel">
      <button
        type="button"
        className="mock-panel__toggle"
        aria-expanded={isOpen}
        aria-controls="mock-panel-body"
        onClick={() => setIsOpen((open) => !open)}
      >
        Mock API{armedCount > 0 ? ` (${armedCount} armed)` : ''}
      </button>

      {isOpen && (
        <div id="mock-panel-body" className="mock-panel__body">
          <p className="mock-panel__intro">Simulated backend controls for reviewing error and loading states.</p>

          <fieldset className="mock-panel__group">
            <legend>Latency</legend>
            {(Object.keys(LATENCY_LABELS) as LatencyPreset[]).map((preset) => (
              <label key={preset} className="choice">
                <input
                  type="radio"
                  name="mock-latency"
                  checked={state.latency === preset}
                  onChange={() => mockNetwork.setLatency(preset)}
                />
                {LATENCY_LABELS[preset]}
              </label>
            ))}
          </fieldset>

          <fieldset className="mock-panel__group">
            <legend>Next request fails</legend>
            {FAILURES.map(({ endpoint, mode, label }) => {
              const armed = state.armedFailures[endpoint] === mode;
              return (
                <label key={`${endpoint}-${mode}`} className="choice">
                  <input
                    type="checkbox"
                    checked={armed}
                    onChange={() => (armed ? mockNetwork.disarm(endpoint) : mockNetwork.failNext(endpoint, mode))}
                  />
                  {label}
                </label>
              );
            })}
          </fieldset>

          <button type="button" className="button button--quiet button--small" onClick={resetData}>
            Reset demo data
          </button>
        </div>
      )}
    </div>
  );
}
