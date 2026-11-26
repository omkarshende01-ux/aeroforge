import { describe, expect, it } from 'vitest';
import { AIRCRAFT_DESIGN_SCHEMA_VERSION } from '../domain/contracts';
import { defaultDesign } from '../domain/types';
import { standardAtmosphere } from './atmosphere';
import {
  analyzeAircraftConstraints,
  evaluateConstraintPoint,
  findConstraintIntersections,
  serviceCeilingClimbRateMs,
  type PowerConstraintCurve,
} from './constraints';

function interpolate(curve: PowerConstraintCurve, wingLoadingNm2: number): number {
  const upperIndex = curve.points.findIndex((point) => point.wingLoadingNm2 >= wingLoadingNm2);
  if (upperIndex <= 0) return curve.points[0].shaftPowerLoadingWPerN;
  const lower = curve.points[upperIndex - 1]; const upper = curve.points[upperIndex];
  const fraction = (wingLoadingNm2 - lower.wingLoadingNm2) / (upper.wingLoadingNm2 - lower.wingLoadingNm2);
  return lower.shaftPowerLoadingWPerN + fraction * (upper.shaftPowerLoadingWPerN - lower.shaftPowerLoadingWPerN);
}

describe('M4.3 aircraft constraint analysis', () => {
  it('matches the independently calculated maximum stall wing loading', () => {
    const result = analyzeAircraftConstraints(defaultDesign);
    const rho0 = standardAtmosphere(0).densityKgM3;
    const expected = 0.5 * rho0 * defaultDesign.mission.maximumStallSpeedMs ** 2 * defaultDesign.flightCondition.clMax;
    expect(result.stallWingLoadingLimitNm2).toBeCloseTo(expected, 10);
  });

  it('matches independent cruise shaft-power and excess-power climb benchmarks', () => {
    const result = analyzeAircraftConstraints(defaultDesign);
    const cruiseCurve = result.curves.find((curve) => curve.id === 'cruise-power')!;
    const climbCurve = result.curves.find((curve) => curve.id === 'minimum-climb')!;
    const stationIndex = 30;
    const wingLoading = cruiseCurve.points[stationIndex].wingLoadingNm2;
    const rho = standardAtmosphere(defaultDesign.mission.cruiseAltitudeM).densityKgM3;
    const q = 0.5 * rho * defaultDesign.mission.cruiseSpeedMs ** 2;
    const cl = wingLoading / q;
    const area = 18; const aspectRatio = 12 ** 2 / area;
    const k = 1 / (Math.PI * defaultDesign.flightCondition.oswaldEfficiency * aspectRatio);
    const cd = defaultDesign.flightCondition.cd0 + k * cl ** 2;
    const dragToWeight = q * cd / wingLoading;
    const cruiseExpected = defaultDesign.mission.cruiseSpeedMs * dragToWeight / defaultDesign.propulsion.propulsiveEfficiency;
    const climbExpected = cruiseExpected + defaultDesign.mission.minimumClimbRateMs / defaultDesign.propulsion.propulsiveEfficiency;
    expect(cruiseCurve.points[stationIndex].shaftPowerLoadingWPerN).toBeCloseTo(cruiseExpected, 10);
    expect(climbCurve.points[stationIndex].shaftPowerLoadingWPerN).toBeCloseTo(climbExpected, 10);
  });

  it('uses the 100 ft/min service-ceiling climb criterion', () => {
    expect(serviceCeilingClimbRateMs).toBeCloseTo(0.508, 12);
    const result = analyzeAircraftConstraints(defaultDesign);
    expect(result.constraints.find((constraint) => constraint.id === 'service-ceiling')?.status).toBe('evaluated');
    expect(result.curves.some((curve) => curve.id === 'service-ceiling')).toBe(true);
  });

  it('passes exact constraint boundaries and fails immediately outside them', () => {
    const result = analyzeAircraftConstraints(defaultDesign);
    const wingLoading = result.feasibleBoundary[Math.floor(result.feasibleBoundary.length / 2)].wingLoadingNm2;
    const required = Math.max(...result.curves.map((curve) => interpolate(curve, wingLoading)));
    const onPowerBoundary = evaluateConstraintPoint(result, { wingLoadingNm2: wingLoading, shaftPowerLoadingWPerN: required });
    const belowPowerBoundary = evaluateConstraintPoint(result, { wingLoadingNm2: wingLoading, shaftPowerLoadingWPerN: required - 0.01 });
    expect(onPowerBoundary.evaluatedFeasible).toBe(true);
    expect(onPowerBoundary.overallStatus).toBe('indeterminate');
    expect(belowPowerBoundary.overallStatus).toBe('infeasible');
    const stallLimit = result.stallWingLoadingLimitNm2!;
    expect(evaluateConstraintPoint(result, { wingLoadingNm2: stallLimit, shaftPowerLoadingWPerN: 30 }).constraints[0].status).toBe('pass');
    expect(evaluateConstraintPoint(result, { wingLoadingNm2: stallLimit + 0.01, shaftPowerLoadingWPerN: 30 }).constraints[0].status).toBe('fail');
  });

  it('finds interpolated intersections between power constraints', () => {
    const curves: PowerConstraintCurve[] = [
      { id: 'cruise-power', label: 'A', points: [{ wingLoadingNm2: 100, shaftPowerLoadingWPerN: 5 }, { wingLoadingNm2: 200, shaftPowerLoadingWPerN: 10 }] },
      { id: 'minimum-climb', label: 'B', points: [{ wingLoadingNm2: 100, shaftPowerLoadingWPerN: 10 }, { wingLoadingNm2: 200, shaftPowerLoadingWPerN: 5 }] },
    ];
    const found = findConstraintIntersections(curves);
    expect(found).toHaveLength(1);
    expect(found[0].point.wingLoadingNm2).toBeCloseTo(150);
    expect(found[0].point.shaftPowerLoadingWPerN).toBeCloseTo(7.5);
  });

  it('reports no evaluated feasible region for an excessive climb requirement', () => {
    const design = { ...defaultDesign, mission: { ...defaultDesign.mission, minimumClimbRateMs: 50 } };
    const result = analyzeAircraftConstraints(design);
    expect(result.hasEvaluatedFeasibleRegion).toBe(false);
    expect(result.feasibleBoundary).toHaveLength(0);
  });

  it('rejects invalid inputs and preserves the versioned result contract', () => {
    const invalid = { ...defaultDesign, propulsion: { ...defaultDesign.propulsion, propulsiveEfficiency: 0 } };
    expect(analyzeAircraftConstraints(invalid).contract.validity).toBe('invalid');
    const result = analyzeAircraftConstraints(defaultDesign);
    expect(defaultDesign.schemaVersion).toBe(AIRCRAFT_DESIGN_SCHEMA_VERSION);
    expect(result.contract.schemaVersion).toBe(AIRCRAFT_DESIGN_SCHEMA_VERSION);
    expect(result.contract.designRevision).toBe(defaultDesign.revision);
    expect(result.contract.modelVersion).toBeTruthy();
    expect(result.contract.sources.length).toBeGreaterThan(0);
  });

  it('never declares overall feasibility while takeoff remains unevaluated', () => {
    const result = analyzeAircraftConstraints(defaultDesign);
    expect(result.constraints.find((constraint) => constraint.id === 'takeoff-distance')?.status).toBe('not-evaluated');
    expect(result.currentEvaluation?.overallStatus).not.toBe('feasible');
  });
});
