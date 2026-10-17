import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';

interface UnsavedChangesGuardProps {
  when: boolean;
  patientName: string;
}

/**
 * Stops the nurse from switching patient (or leaving the page in-app) with
 * unsaved values. Values are never carried over to another patient: the form
 * is keyed by patient id, so the only choices are stay or discard.
 */
export function UnsavedChangesGuard({ when, patientName }: UnsavedChangesGuardProps) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname,
  );
  const stayButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (blocker.state === 'blocked') stayButton.current?.focus();
  }, [blocker.state]);

  if (blocker.state !== 'blocked') return null;

  return (
    <div
      className="notice notice--warning"
      role="alertdialog"
      aria-labelledby="unsaved-title"
      aria-describedby="unsaved-body"
    >
      <p id="unsaved-title" className="notice__title">
        Results for {patientName} are not saved.
      </p>
      <p id="unsaved-body" className="notice__body">
        If you leave now, the values you entered will be discarded.
      </p>
      <div className="notice__actions">
        <button ref={stayButton} type="button" className="button button--primary" onClick={() => blocker.reset()}>
          Stay and finish
        </button>
        <button type="button" className="button button--secondary" onClick={() => blocker.proceed()}>
          Discard and leave
        </button>
      </div>
    </div>
  );
}
