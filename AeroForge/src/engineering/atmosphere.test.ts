import { describe, expect, it } from 'vitest';
import { standardAtmosphere } from './atmosphere';

describe('ISA troposphere', () => {
  it('matches standard sea-level conditions', () => {
    const result = standardAtmosphere(0);
    expect(result.temperatureK).toBeCloseTo(288.15, 8);
    expect(result.pressurePa).toBeCloseTo(101325, 4);
    expect(result.densityKgM3).toBeCloseTo(1.225, 3);
  });
  it('matches the 11 km boundary within reference rounding', () => {
    const result = standardAtmosphere(11000);
    expect(result.temperatureK).toBeCloseTo(216.65, 6);
    expect(result.pressurePa).toBeCloseTo(22632, -1);
    expect(result.densityKgM3).toBeCloseTo(0.3639, 3);
  });
  it('rejects altitudes outside the implemented layer', () => {
    expect(() => standardAtmosphere(11001)).toThrow(RangeError);
  });
});
