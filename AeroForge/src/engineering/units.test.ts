import { describe, expect, it } from 'vitest';
import { convertFromSi, convertToSi } from './units';

describe('mission unit conversions', () => {
  it('converts standard aviation units to and from SI', () => {
    expect(convertFromSi(1852, 'distance', 'aviation')).toBeCloseTo(1, 12);
    expect(convertFromSi(0.5144444444444445, 'speed', 'aviation')).toBeCloseTo(1, 12);
    expect(convertFromSi(0.3048, 'altitude', 'aviation')).toBeCloseTo(1, 12);
    expect(convertFromSi(0.00508, 'climbRate', 'aviation')).toBeCloseTo(1, 12);
    expect(convertFromSi(0.45359237, 'mass', 'aviation')).toBeCloseTo(1, 12);
  });

  it('round-trips every mission quantity', () => {
    const cases = [
      ['mass', 172.5], ['distance', 1_250_000], ['length', 420],
      ['speed', 53.2], ['altitude', 3048], ['climbRate', 3.4],
    ] as const;
    for (const [quantity, value] of cases) {
      expect(convertToSi(convertFromSi(value, quantity, 'aviation'), quantity, 'aviation')).toBeCloseTo(value, 10);
      expect(convertToSi(convertFromSi(value, quantity, 'si'), quantity, 'si')).toBeCloseTo(value, 10);
    }
  });
});
