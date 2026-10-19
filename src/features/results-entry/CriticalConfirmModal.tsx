import { useEffect, useRef, useState } from 'react';
import { FlagBadge } from '../../components/FlagBadge';
import type { AssessedValue, ParameterDefinition } from '../../domain';
import { isCritical } from '../../domain';

interface CriticalConfirmModalProps {
  criticalValues: AssessedValue[];
  parameters: readonly ParameterDefinition[];
  patientName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CriticalConfirmModal({
  criticalValues,
  parameters,
  patientName,
  onConfirm,
  onCancel,
}: CriticalConfirmModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const parametersById = new Map(parameters.map((p) => [p.id, p]));
  const criticalList = criticalValues.filter((v) => isCritical(v.classification));

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="critical-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="critical-modal-title"
      >
        <div className="critical-modal__header">
          <div className="critical-modal__icon" aria-hidden="true">⚠️</div>
          <div>
            <h3 id="critical-modal-title" className="critical-modal__title">Critical Values Detected</h3>
            <p className="critical-modal__subtitle">
              The reading for <strong>{patientName}</strong> contains values beyond hospital critical limits.
            </p>
          </div>
        </div>

        <ul className="critical-modal__list" aria-label="List of critical parameters">
          {criticalList.map((item) => {
            const param = parametersById.get(item.parameterId);
            return (
              <li key={item.parameterId} className="critical-modal__item">
                <span className="critical-modal__param-name">{param?.name ?? item.parameterId}</span>
                <span className="critical-modal__param-value">
                  {item.value} {param?.unit ?? ''}
                </span>
                <FlagBadge classification={item.classification} />
              </li>
            );
          })}
        </ul>

        <label className="critical-modal__checkbox-label">
          <input
            type="checkbox"
            className="critical-modal__checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span>I confirm these critical readings have been verified and urgent protocol is initiated.</span>
        </label>

        <div className="critical-modal__actions">
          <button ref={cancelButtonRef} type="button" className="button button--secondary" onClick={onCancel}>
            Review values
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className="button button--primary critical-modal__confirm-btn"
            disabled={!acknowledged}
            onClick={onConfirm}
          >
            Acknowledge & Save
          </button>
        </div>
      </div>
    </div>
  );
}