import { describe, expect, it } from 'vitest';
import { defaultDesign, type WingStation } from '../domain/types';
import { calculateMassProperties } from './massProperties';
import { calculatePerformance } from './performance';
import { calculateStability } from './stability';
import { calculateWingBeam } from './structures';
import { standardAtmosphere } from './atmosphere';

function independentReference(stations: WingStation[], symmetryFactor: number) {
  let halfArea = 0; let chordSquared = 0; let quarterMoment = 0;
  stations.slice(0, -1).forEach((from, index) => {
    const to = stations[index + 1]; const span = to.spanPositionM - from.spanPositionM;
    halfArea += span * (from.chordM + to.chordM) / 2;
    chordSquared += span * (from.chordM ** 2 + from.chordM * to.chordM + to.chordM ** 2) / 3;
    const fromQuarter = from.leadingEdgeXM + 0.25 * from.chordM; const toQuarter = to.leadingEdgeXM + 0.25 * to.chordM;
    quarterMoment += span * (2 * from.chordM * fromQuarter + from.chordM * toQuarter + to.chordM * fromQuarter + 2 * to.chordM * toQuarter) / 6;
  });
  return { areaM2: symmetryFactor * halfArea, macM: chordSquared / halfArea, quarterChordXM: quarterMoment / halfArea };
}

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
    const result = calculateStability(defaultDesign); const wing = independentReference(defaultDesign.wing.stations, 2); const tail = independentReference(defaultDesign.horizontalTail.stations, 2);
    const volume = tail.areaM2 * (tail.quarterChordXM - wing.quarterChordXM) / (wing.areaM2 * wing.macM);
    const wingSlope = (2 * Math.PI) / (1 + (2 * Math.PI) / (Math.PI * 0.8 * 8));
    const neutralPoint = wing.quarterChordXM + wing.macM * 0.9 * (4.2 / wingSlope) * 0.65 * volume;
    expect(result.horizontalTailVolume).toBeCloseTo(volume, 10);
    expect(result.neutralPointXM).toBeCloseTo(neutralPoint, 10);
    const cg = (600 * 3.7 + 180 * 0.9 + 250 * 3.1 + 170 * 2.8) / 1200;
    expect(result.staticMargin).toBeCloseTo((neutralPoint - cg) / wing.macM, 10);
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
