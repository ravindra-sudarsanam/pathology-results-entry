import { resolveNormalRange, type ParameterDefinition, type Sex } from '../domain';

/**
 * Display widths (percent) of each band. Bands are drawn at fixed widths
 * rather than to scale, so the normal band is readable for every parameter
 * (to scale, normal glucose would be a sliver). The marker is placed
 * proportionally within its band.
 */
export const BAND_WIDTHS = [14, 18, 36, 18, 14] as const;
export const BAND_KINDS = ['critical', 'abnormal', 'normal', 'abnormal', 'critical'] as const;

export function markerPosition(value: number, parameter: ParameterDefinition, sex: Sex): number {
  const normal = resolveNormalRange(parameter, sex);
  const limits = [
    parameter.plausible.low,
    parameter.critical.low,
    normal.low,
    normal.high,
    parameter.critical.high,
    parameter.plausible.high,
  ];
  let start = 0;
  for (let band = 0; band < BAND_WIDTHS.length; band += 1) {
    const from = limits[band];
    const to = limits[band + 1];
    if (value <= to || band === BAND_WIDTHS.length - 1) {
      const fraction = to === from ? 0.5 : Math.min(Math.max((value - from) / (to - from), 0), 1);
      return start + fraction * BAND_WIDTHS[band];
    }
    start += BAND_WIDTHS[band];
  }
  return 100;
}
