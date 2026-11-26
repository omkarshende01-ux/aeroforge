import { describe, expect, it } from 'vitest';
import { defaultDesign } from '../domain/types';
import { calculateAerodynamics, ellipticalSpanLoad } from './aerodynamics';

describe('finite-wing aerodynamic model', () => {
  it('matches an independently evaluated coefficient and force benchmark', () => {
    const design = { ...defaultDesign, flightCondition: { ...defaultDesign.flightCondition, densitySource: 'manual' as const, densityKgM3: 1.225 } };
    const result = calculateAerodynamics(design);
    const expectedSlope = (2 * Math.PI) / (1 + (2 * Math.PI) / (Math.PI * 0.8 * 8));
    const expectedCl = expectedSlope * 6 * Math.PI / 180;
    const expectedCdi = expectedCl ** 2 / (Math.PI * 0.8 * 8);
    const expectedQ = 0.5 * 1.225 * 50 ** 2;
    expect(result.finiteWingLiftSlopePerRad).toBeCloseTo(expectedSlope, 10);
    expect(result.liftCoefficient).toBeCloseTo(expectedCl, 10);
    expect(result.inducedDragCoefficient).toBeCloseTo(expectedCdi, 10);
    expect(result.dragCoefficient).toBeCloseTo(0.025 + expectedCdi, 10);
    expect(result.dynamicPressurePa).toBeCloseTo(expectedQ, 3);
    expect(result.liftN).toBeCloseTo(expectedQ * 18 * expectedCl, 2);
  });
  it('produces a symmetric elliptical load with zero tip load', () => {
    const load = ellipticalSpanLoad(1000, 10, 5);
    expect(load[0].liftPerSpanNm).toBeCloseTo(0, 10);
    expect(load[2].liftPerSpanNm).toBeCloseTo(400 / Math.PI, 10);
    expect(load[1].liftPerSpanNm).toBeCloseTo(load[3].liftPerSpanNm, 10);
  });
  it('flags use beyond supplied CLmax', () => {
    const design = { ...defaultDesign, flightCondition: { ...defaultDesign.flightCondition, angleOfAttackDeg: 30 } };
    expect(calculateAerodynamics(design).warnings.some((warning) => warning.includes('CLmax'))).toBe(true);
  });
});
