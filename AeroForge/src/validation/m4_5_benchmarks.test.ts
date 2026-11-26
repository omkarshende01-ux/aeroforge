import { describe, expect, it } from 'vitest';
import { defaultDesign, type AircraftDesign } from '../domain/types';
import { standardAtmosphere } from '../engineering/atmosphere';
import { analyzeAircraftConstraints, evaluateConstraintPoint, type PowerConstraintCurve } from '../engineering/constraints';
import {
  calculatePreliminarySizing,
  calculateEnergyStorageMass,
  calculateSizedGeometryAndPower,
  type PreliminarySizingInputs,
} from '../engineering/preliminarySizing';
import { convertFromSi, convertToSi } from '../engineering/units';
import fixture from './fixtures/m4-5-benchmarks.json';

const analytical = fixture.analyticalCase;
const input = analytical.inputs;
const expected = analytical.expected;

function benchmarkDesign(): AircraftDesign {
  return {
    ...defaultDesign,
    wing: { ...defaultDesign.wing, spanM: input.spanM, rootChordM: 2, taperRatio: 0.5 },
    flightCondition: {
      ...defaultDesign.flightCondition,
      clMax: input.clMax,
      cd0: input.cd0,
      oswaldEfficiency: input.oswaldEfficiency,
    },
    mission: {
      ...defaultDesign.mission,
      payloadKg: input.payloadMassKg,
      requiredRangeM: input.requiredRangeM,
      cruiseSpeedMs: input.cruiseSpeedMs,
      cruiseAltitudeM: input.atmosphereAltitudeM,
      serviceCeilingM: input.serviceCeilingM,
      maximumStallSpeedMs: input.maximumStallSpeedMs,
      minimumClimbRateMs: input.minimumClimbRateMs,
    },
    propulsion: { ...defaultDesign.propulsion, propulsiveEfficiency: input.propulsiveEfficiency },
  };
}

function sizingInputs(kind: 'electric' | 'fuel'): PreliminarySizingInputs {
  return {
    designPoint: { wingLoadingNm2: input.wingLoadingNm2, shaftPowerLoadingWPerN: input.installedShaftPowerLoadingWPerN },
    initialTakeoffMassKg: 1200,
    airframeMassKg: input.airframeMassKg,
    propulsionMassKg: input.propulsionMassKg,
    fixedEquipmentMassKg: input.fixedEquipmentMassKg,
    reserveFraction: input.reserveFraction,
    dampingFactor: 0.5,
    convergenceToleranceKg: 1e-8,
    maximumIterations: 500,
    propulsionModel: kind === 'electric'
      ? { kind, batteryUsableShaftSpecificEnergyJPerKg: input.batteryUsableShaftSpecificEnergyJPerKg }
      : { kind, brakeSpecificFuelConsumptionKgPerJ: input.brakeSpecificFuelConsumptionKgPerJ },
  };
}

function interpolate(curve: PowerConstraintCurve, wingLoadingNm2: number): number {
  const upperIndex = curve.points.findIndex((point) => point.wingLoadingNm2 >= wingLoadingNm2);
  if (upperIndex <= 0) return curve.points[0].shaftPowerLoadingWPerN;
  const lower = curve.points[upperIndex - 1]; const upper = curve.points[upperIndex];
  const ratio = (wingLoadingNm2 - lower.wingLoadingNm2) / (upper.wingLoadingNm2 - lower.wingLoadingNm2);
  return lower.shaftPowerLoadingWPerN + ratio * (upper.shaftPowerLoadingWPerN - lower.shaftPowerLoadingWPerN);
}

describe('M4.5 independent analytical verification', () => {
  it('matches the independently tabulated 1976 standard-atmosphere case', () => {
    const actual = standardAtmosphere(input.atmosphereAltitudeM);
    expect(actual.temperatureK).toBeCloseTo(expected.temperatureK, 10);
    expect(actual.pressurePa).toBeCloseTo(expected.pressurePa, 7);
    expect(actual.densityKgM3).toBeCloseTo(expected.densityKgM3, 10);
    expect(actual.speedOfSoundMs).toBeCloseTo(expected.speedOfSoundMs, 9);
  });

  it('matches independently derived stall, cruise, climb and service-ceiling constraints', () => {
    const result = analyzeAircraftConstraints(benchmarkDesign());
    expect(result.stallWingLoadingLimitNm2).toBeCloseTo(expected.stallWingLoadingLimitNm2, 3);
    const cruise = interpolate(result.curves.find((curve) => curve.id === 'cruise-power')!, input.wingLoadingNm2);
    const climb = interpolate(result.curves.find((curve) => curve.id === 'minimum-climb')!, input.wingLoadingNm2);
    const ceiling = interpolate(result.curves.find((curve) => curve.id === 'service-ceiling')!, input.wingLoadingNm2);
    expect(Math.abs(cruise / expected.cruiseShaftPowerLoadingWPerN - 1)).toBeLessThan(5e-4);
    expect(Math.abs(climb / expected.climbShaftPowerLoadingWPerN - 1)).toBeLessThan(5e-4);
    expect(Math.abs(ceiling / expected.serviceCeilingShaftPowerLoadingWPerN - 1)).toBeLessThan(5e-4);
    const point = evaluateConstraintPoint(result, sizingInputs('electric').designPoint);
    expect(point.evaluatedFeasible).toBe(true);
    expect(point.overallStatus).toBe('indeterminate');
    expect(point.constraints.find((constraint) => constraint.id === 'takeoff-distance')?.status).toBe('not-evaluated');
  });

  it('closes the independent electric mass, geometry, power, energy and reserve case', () => {
    const result = calculatePreliminarySizing(benchmarkDesign(), sizingInputs('electric'));
    expect(result.status).toBe('converged');
    expect(result.finalTakeoffMassKg).toBeCloseTo(expected.electricTakeoffMassKg, 6);
    expect(result.energyStorageMassKg).toBeCloseTo(expected.electricBatteryMassKg, 6);
    expect(result.missionShaftEnergyJ).toBeCloseTo(expected.electricMissionShaftEnergyJ, 1);
    expect(result.reserveShaftEnergyJ).toBeCloseTo(expected.electricReserveShaftEnergyJ, 1);
    expect(result.requiredWingAreaM2).toBeCloseTo(expected.electricWingAreaM2, 7);
    expect(result.requiredInstalledShaftPowerW).toBeCloseTo(expected.electricInstalledShaftPowerW, 2);
    expect(Math.abs(result.massBalanceResidualKg!)).toBeLessThan(1e-8);
    expect(Math.abs(result.energyBalanceResidualJ!)).toBeLessThan(1e-6);
    expect(result.missionStatus).toBe('indeterminate');
  });

  it('closes the independent fuel mass, geometry, power, energy and reserve case', () => {
    const result = calculatePreliminarySizing(benchmarkDesign(), sizingInputs('fuel'));
    expect(result.status).toBe('converged');
    expect(result.finalTakeoffMassKg).toBeCloseTo(expected.fuelTakeoffMassKg, 6);
    expect(result.energyStorageMassKg).toBeCloseTo(expected.fuelMassKg, 6);
    expect(result.missionShaftEnergyJ).toBeCloseTo(expected.fuelMissionShaftEnergyJ, 1);
    expect(result.reserveShaftEnergyJ).toBeCloseTo(expected.fuelReserveShaftEnergyJ, 1);
    expect(result.requiredWingAreaM2).toBeCloseTo(expected.fuelWingAreaM2, 7);
    expect(result.requiredInstalledShaftPowerW).toBeCloseTo(expected.fuelInstalledShaftPowerW, 2);
  });
});

describe('M4.5 convergence and robustness verification', () => {
  it('converges from multiple initial masses and relaxation factors', () => {
    const masses: number[] = [];
    for (const initialTakeoffMassKg of [250, 900, 5000]) {
      for (const dampingFactor of [0.2, 0.5, 1]) {
        const result = calculatePreliminarySizing(benchmarkDesign(), { ...sizingInputs('electric'), initialTakeoffMassKg, dampingFactor });
        expect(result.status).toBe('converged');
        masses.push(result.finalTakeoffMassKg!);
      }
    }
    expect(Math.max(...masses) - Math.min(...masses)).toBeLessThan(2e-8);
  });

  it('honors convergence tolerances and returns explicit non-convergence', () => {
    for (const convergenceToleranceKg of [1, 0.1, 0.001]) {
      const result = calculatePreliminarySizing(benchmarkDesign(), { ...sizingInputs('electric'), convergenceToleranceKg });
      expect(result.status).toBe('converged');
      expect(Math.abs(result.massBalanceResidualKg!)).toBeLessThanOrEqual(convergenceToleranceKg);
    }
    const stopped = calculatePreliminarySizing(benchmarkDesign(), { ...sizingInputs('electric'), maximumIterations: 1, convergenceToleranceKg: 1e-12 });
    expect(stopped.status).toBe('non-converged');
  });

  it('rejects impossible fractions and infeasible points while preserving unsupported takeoff', () => {
    const impossible = calculatePreliminarySizing(benchmarkDesign(), {
      ...sizingInputs('electric'),
      propulsionModel: { kind: 'electric', batteryUsableShaftSpecificEnergyJPerKg: 1000 },
    });
    expect(impossible.status).toBe('infeasible');
    const badPoint = calculatePreliminarySizing(benchmarkDesign(), {
      ...sizingInputs('electric'), designPoint: { wingLoadingNm2: 2000, shaftPowerLoadingWPerN: 0.1 },
    });
    expect(badPoint.status).toBe('infeasible');
    expect(calculatePreliminarySizing(benchmarkDesign(), sizingInputs('electric')).missionStatus).toBe('indeterminate');
  });

  it('handles extreme valid range inputs and is invariant to aviation-unit round trips', () => {
    const shortMission = benchmarkDesign();
    shortMission.mission = { ...shortMission.mission, requiredRangeM: 1000 };
    expect(calculatePreliminarySizing(shortMission, sizingInputs('electric')).status).toBe('converged');
    const longMission = benchmarkDesign();
    longMission.mission = { ...longMission.mission, requiredRangeM: 20_000_000 };
    expect(calculatePreliminarySizing(longMission, sizingInputs('electric')).status).toBe('infeasible');

    const roundTripped = sizingInputs('electric');
    roundTripped.initialTakeoffMassKg = convertToSi(convertFromSi(roundTripped.initialTakeoffMassKg, 'mass', 'aviation'), 'mass', 'aviation');
    roundTripped.designPoint = {
      wingLoadingNm2: convertToSi(convertFromSi(roundTripped.designPoint.wingLoadingNm2, 'wingLoading', 'aviation'), 'wingLoading', 'aviation'),
      shaftPowerLoadingWPerN: convertToSi(convertFromSi(roundTripped.designPoint.shaftPowerLoadingWPerN, 'shaftPowerLoading', 'aviation'), 'shaftPowerLoading', 'aviation'),
    };
    roundTripped.propulsionModel = { kind: 'electric', batteryUsableShaftSpecificEnergyJPerKg: convertToSi(convertFromSi(input.batteryUsableShaftSpecificEnergyJPerKg, 'specificEnergy', 'aviation'), 'specificEnergy', 'aviation') };
    const baseline = calculatePreliminarySizing(benchmarkDesign(), sizingInputs('electric'));
    const converted = calculatePreliminarySizing(benchmarkDesign(), roundTripped);
    expect(converted.finalTakeoffMassKg).toBeCloseTo(baseline.finalTakeoffMassKg!, 10);
    expect(converted.requiredWingAreaM2).toBeCloseTo(baseline.requiredWingAreaM2!, 10);
    expect(converted.requiredInstalledShaftPowerW).toBeCloseTo(baseline.requiredInstalledShaftPowerW!, 5);
  });
});

describe('M4.5 published NASA TERA sanity check', () => {
  it('reproduces published wing area and motor power from independently derived loadings', () => {
    const published = fixture.publishedCase;
    const massKg = convertToSi(published.inputs.maximumTakeoffWeightLb, 'mass', 'aviation');
    const areaM2 = convertToSi(published.inputs.wingAreaFt2, 'area', 'aviation');
    expect(massKg).toBeCloseTo(published.independentlyDerived.maximumTakeoffMassKg, 10);
    expect(areaM2).toBeCloseTo(published.independentlyDerived.wingAreaM2, 10);
    const sized = calculateSizedGeometryAndPower(massKg, {
      wingLoadingNm2: published.independentlyDerived.wingLoadingNm2,
      shaftPowerLoadingWPerN: published.independentlyDerived.installedShaftPowerLoadingWPerN,
    });
    expect(sized.requiredWingAreaM2).toBeCloseTo(areaM2, 10);
    expect(sized.requiredInstalledShaftPowerW).toBeCloseTo(published.inputs.motorPowerKw * 1000, 5);
  });

  it('reproduces NASA simple-battery specific-energy arithmetic', () => {
    const published = fixture.publishedBatteryArithmetic;
    const capacityJ = published.publishedCapacityKWh * 3.6e6;
    const effectiveSpecificEnergyJPerKg = published.specificEnergyWhPerKg * 3600;
    const massKg = calculateEnergyStorageMass({ kind: 'electric', batteryUsableShaftSpecificEnergyJPerKg: effectiveSpecificEnergyJPerKg }, capacityJ, 0);
    expect(massKg).toBeCloseTo(published.batteryMassKg, 12);
  });
});
