import type { Ref } from 'react';
import { FlagBadge } from '../../components/FlagBadge';
import { SEVERITY } from '../../components/severity';
import { RangeGauge } from '../../components/RangeGauge';
import { describeNormalRange, type FieldAssessment, type ParameterDefinition, type Sex } from '../../domain';

interface ParameterFieldProps {
  parameter: ParameterDefinition;
  sex: Sex;
  raw: string;
  assessment: FieldAssessment;
  /** Already-formatted error to show, or undefined to show none. */
  errorMessage?: string;
  readOnly: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputRef?: Ref<HTMLInputElement>;
}

export function ParameterField({
  parameter,
  sex,
  raw,
  assessment,
  errorMessage,
  readOnly,
  onChange,
  onBlur,
  inputRef,
}: ParameterFieldProps) {
  const inputId = `value-${parameter.id}`;
  const flagId = `${inputId}-flag`;
  const rangeId = `${inputId}-range`;
  const errorId = `${inputId}-error`;

  const reading = assessment.status === 'valid' ? assessment : undefined;
  const severity = errorMessage ? 'invalid' : reading ? SEVERITY[reading.classification] : 'empty';
  const describedBy = [reading && flagId, rangeId, errorMessage && errorId].filter(Boolean).join(' ');

  return (
    <div className={`param param--${severity}`}>
      <label className="param__label" htmlFor={inputId}>
        {parameter.name}
      </label>

      <div className="param__input">
        <input
          ref={inputRef}
          id={inputId}
          name={parameter.id}
          type="text"
          inputMode="decimal"
          placeholder="Not measured"
          autoComplete="off"
          spellCheck={false}
          value={raw}
          readOnly={readOnly}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
        <span className="param__unit">{parameter.unit}</span>
      </div>

      <div className="param__flag">{reading && <FlagBadge id={flagId} classification={reading.classification} />}</div>

      <div className="param__reference">
        <RangeGauge parameter={parameter} sex={sex} reading={reading} />
        <p id={rangeId} className="param__range">
          Normal {describeNormalRange(parameter, sex)} {parameter.unit}
        </p>
      </div>

      {errorMessage && (
        <p id={errorId} className="param__error">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
