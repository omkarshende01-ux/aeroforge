import { describe, expect, it } from 'vitest';
import { defaultDesign } from '../domain/types';
import { calculateMassProperties } from './massProperties';
import { calculatePerformance } from './performance';
import { calculateStability } from './stability';
import { calculateWingBeam } from './structures';
import { standardAtmosphere } from './atmosphere';

describe('Phase 3 multidisciplinary baseline', () => {
  it('computes component mass and longitudinal CG from independent moments', () => {
    const result = calculateMassProperties(defaultDesign);
    expect(result.accountedMassKg).toBe(1200);
    const expectedMoment = 600 * 3.7 + 180 * 0.9 + 250 * 3.1 + 170 * 2.8;
    expect(result.centerOfGravityXM).toBeCloseTo(expectedMoment / 1200, 10);
    expect(result.massDifferenceKg).toBe(0);
  });

  it('solves level-flight power, climb and range from the supplied polar and propulsion', () => {
    const result = calculatePerformance(defaultDesign);
    const rho = standardAtmosphere(0).densityKgM3; const q = 0.5 * rho * 50 ** 2; const weight = 1200 * 9.80665;
    const cl = weight / (q * 18); const cd = 0.025 + cl ** 2 / (Math.PI * 0.8 * 8); const drag = q * 18 * cd;
    expect(result.requiredLiftCoefficient).toBeCloseTo(cl, 10);
    expect(result.dragN).toBeCloseTo(drag, 8);
    expect(result.shaftPowerRequiredW).toBeCloseTo(drag * 50 / 0.82, 8);
    expect(result.rateOfClimbMs).toBeCloseTo((180000 * 0.82 - drag * 50) / weight, 8);
    expect(result.stillAirRangeM).toBeCloseTo(1.8e9 * 0.8 / result.shaftPowerRequiredW * 50, 6);
  });

  it('computes tail volume, neutral point and static margin from supplied stations', () => {
    const result = calculateStability(defaultDesign); const tailArea = 4.2 * 1.15 * 1.55 / 2; const mac = 14 / 9;
    const wingY = 12 / 6 * (1 + 2 * 0.5) / 1.5; const wingAc = 2.35 + wingY * Math.tan(3 * Math.PI / 180) + 0.25 * mac;
    const tailMac = (2 / 3) * 1.15 * (1 + 0.55 + 0.55 ** 2) / 1.55; const tailY = 4.2 / 6 * (1 + 2 * 0.55) / 1.55; const tailAc = 7.15 + tailY * Math.tan(8 * Math.PI / 180) + 0.25 * tailMac;
    const volume = tailArea * (tailAc - wingAc) / (18 * mac);
    const wingSlope = (2 * Math.PI) / (1 + (2 * Math.PI) / (Math.PI * 0.8 * 8));
    const neutralPoint = wingAc + mac * 0.9 * (4.2 / wingSlope) * 0.65 * volume;
    expect(result.horizontalTailVolume).toBeCloseTo(volume, 10);
    expect(result.neutralPointXM).toBeCloseTo(neutralPoint, 10);
    const cg = (600 * 3.7 + 180 * 0.9 + 250 * 3.1 + 170 * 2.8) / 1200;
    expect(result.staticMargin).toBeCloseTo((neutralPoint - cg) / mac, 10);
  });

  it('matches analytical elliptical root shear and moment', () => {
    const result = calculateWingBeam(defaultDesign, 1001); const totalLift = 3.8 * 1200 * 9.80665;
    expect(result.rootShearN).toBeCloseTo(totalLift / 2, -1);
    expect(result.rootMomentNm).toBeCloseTo(totalLift * 12 / (3 * Math.PI), -1);
    expect(result.tipDeflectionM).toBeGreaterThan(0);
  });

  it('caps the maneuver envelope at supplied aerodynamic and structural limits', () => {
    const result = calculatePerformance(defaultDesign); const last = result.maneuverEnvelope.at(-1)!;
    expect(last.speedMs).toBe(80);
    expect(last.positiveLoadFactor).toBeLessThanOrEqual(3.8);
    expect(last.negativeLoadFactor).toBeGreaterThanOrEqual(-1.52);
    expect(result.maneuverEnvelope[0].positiveLoadFactor).toBe(0);
  });
});
