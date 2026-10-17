import { describe, expect, it } from 'vitest';
import { REFERENCE_CONFIG } from '../../config/referenceConfig';
import { BAND_WIDTHS, markerPosition } from '../gaugeScale';

const potassium = REFERENCE_CONFIG.parameters.find((p) => p.id === 'potassium')!;

describe('markerPosition', () => {
  it('maps each limit to the edge of its band', () => {
    const edges = BAND_WIDTHS.reduce<number[]>((acc, width) => [...acc, acc[acc.length - 1] + width], [0]);
    // plausible.low, critical.low, normal.low, normal.high, critical.high, plausible.high
    const limits = [1, 2.8, 3.5, 5.0, 6.2, 10];
    limits.forEach((limit, index) => expect(markerPosition(limit, potassium, 'female')).toBeCloseTo(edges[index]));
  });

  it('places a value proportionally inside its band', () => {
    // Midway through the normal band (3.5–5.0) is the middle of the gauge.
    expect(markerPosition(4.25, potassium, 'female')).toBeCloseTo(50);
  });

  it('clamps out-of-range values to the ends', () => {
    expect(markerPosition(-5, potassium, 'female')).toBe(0);
    expect(markerPosition(99, potassium, 'female')).toBe(100);
  });
});
