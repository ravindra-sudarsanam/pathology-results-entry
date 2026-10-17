import type { Classification, ParameterDefinition, Sex } from '../domain';
import { BAND_KINDS, BAND_WIDTHS, markerPosition } from './gaugeScale';
import { SEVERITY } from './severity';

interface RangeGaugeProps {
  parameter: ParameterDefinition;
  sex: Sex;
  /** Present only for a valid value. */
  reading?: { value: number; classification: Classification };
}

/** Decorative: the text flag and range carry the same information for assistive tech. */
export function RangeGauge({ parameter, sex, reading }: RangeGaugeProps) {
  return (
    <div className="gauge" aria-hidden="true">
      <div className="gauge__track">
        {BAND_WIDTHS.map((width, index) => (
          <span
            key={index}
            className={`gauge__band gauge__band--${BAND_KINDS[index]}`}
            style={{ width: `${width}%` }}
          />
        ))}
      </div>
      {reading && (
        <span
          className={`gauge__marker gauge__marker--${SEVERITY[reading.classification]}`}
          style={{ left: `${markerPosition(reading.value, parameter, sex)}%` }}
        />
      )}
    </div>
  );
}
