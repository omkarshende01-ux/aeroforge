import { describe, expect, it } from 'vitest';
import { defaultDesign } from '../domain/types';
import { analyzeAircraftConstraints, type ConstraintPoint } from './constraints';
import {
  calculatePreliminarySizing,
  calculateSizingSensitivity,
  createDefaultSizingInputs,
  gravityMs2,
  type PreliminarySizingInputs,
} from './preliminarySizing';

function feasiblePoint(): ConstraintPoint {
  const constraints = analyzeAircraftConstraints(defaultDesign);
  const boundary = constraints.feasibleBoundary[Math.floor(constraints.feasibleBoundary.length / 2)];
  return { wingLoadingNm2: boundary.wingLoadingNm2, shaftPowerLoadingWPerN: boundary.shaftPowerLoadingWPerN + 1 };
}

function electricInputs(): PreliminarySizingInputs {
  return {
    designPoint: feasiblePoint(),
    initialTakeoffMassKg: 1_000,
    airframeMassKg: 500,
    propulsionMassKg: 120,
    fixedEquipmentMassKg: 30,
    reserveFraction: 0.2,
    dampingFactor: 0.55,
    convergenceToleranceKg: 1e-7,
    maximumIterations: 500,
    propulsionModel: { kind: 'electric', batteryUsableShaftSpecificEnergyJPerKg: 3.6e6 },
  };
}

describe('M4.4 iterative preliminary aircraft sizing', () => {
  it('produces a traceable result from the existing design defaults without modifying geometry', () => {
    const constraints = analyzeAircraftConstraints(defaultDesign);
    const inputs = createDefaultSizingInputs(defaultDesign, constraints.currentPoint!);
    const result = calculatePreliminarySizing(defaultDesign, inputs);
    expect(result.status).toBe('converged');
    expect(result.contract.designRevision).toBe(defaultDesign.revision);
    expect(result.contract.sources.length).toBeGreaterThan(0);
    expect(defaultDesign.wing.stations.at(-1)?.spanPositionM).toBe(6);
  });

  it('closes the component mass balance and reports signed residuals', () => {
    const inputs = electricInputs();
    const result = calculatePreliminarySizing(defaultDesign, inputs);
    expect(result.status).toBe('converged');
    expect(result.finalTakeoffMassKg).toBeCloseTo(inputs.airframeMassKg + inputs.propulsionMassKg + inputs.fixedEquipmentMassKg + defaultDesign.mission.payloadKg + result.energyStorageMassKg!, 6);
    expect(Math.abs(result.massBalanceResidualKg!)).toBeLessThan(inputs.convergenceToleranceKg);
    expect(Math.abs(result.energyBalanceResidualJ!)).toBeLessThan(1e-5);
    expect(result.missionStatus).toBe('indeterminate');
  });

  it('calculates wing area and installed shaft power directly from the selected loadings', () => {
    const inputs = electricInputs();
    const result = calculatePreliminarySizing(defaultDesign, inputs);
    const weightN = result.finalTakeoffMassKg! * gravityMs2;
    expect(result.requiredWingAreaM2).toBeCloseTo(weightN / inputs.designPoint.wingLoadingNm2, 10);
    expect(result.requiredInstalledShaftPowerW).toBeCloseTo(weightN * inputs.designPoint.shaftPowerLoadingWPerN, 10);
    expect(result.requiredInstalledShaftPowerW!).toBeGreaterThanOrEqual(result.requiredCruiseShaftPowerW!);
  });

  it('performs independent electric energy and reserve bookkeeping', () => {
    const inputs = electricInputs();
    const result = calculatePreliminarySizing(defaultDesign, inputs);
    const durationS = defaultDesign.mission.requiredRangeM / defaultDesign.mission.cruiseSpeedMs;
    expect(result.missionShaftEnergyJ).toBeCloseTo(result.requiredCruiseShaftPowerW! * durationS, 5);
    const expectedBatteryMass = result.missionShaftEnergyJ! / (inputs.propulsionModel.kind === 'electric' ? inputs.propulsionModel.batteryUsableShaftSpecificEnergyJPerKg * (1 - inputs.reserveFraction) : 1);
    expect(result.energyStorageMassKg).toBeCloseTo(expectedBatteryMass, 8);
    expect(result.totalShaftEnergyCapacityJ).toBeCloseTo(result.missionShaftEnergyJ! / (1 - inputs.reserveFraction), 8);
  });

  it('uses brake-specific fuel consumption for the distinct fuel model', () => {
    const electric = electricInputs();
    const bsfcKgPerJ = 0.25 / 3.6e6;
    const inputs: PreliminarySizingInputs = { ...electric, propulsionModel: { kind: 'fuel', brakeSpecificFuelConsumptionKgPerJ: bsfcKgPerJ } };
    const result = calculatePreliminarySizing(defaultDesign, inputs);
    expect(result.status).toBe('converged');
    expect(result.energyStorageMassKg).toBeCloseTo(result.missionShaftEnergyJ! * bsfcKgPerJ / (1 - inputs.reserveFraction), 8);
    expect(Math.abs(result.energyBalanceResidualJ!)).toBeLessThan(1e-5);
  });

  it('converges to the same solution from separated initial mass estimates', () => {
    const inputs = electricInputs();
    const sensitivity = calculateSizingSensitivity(defaultDesign, inputs, 4_000);
    expect(sensitivity.primary.status).toBe('converged');
    expect(sensitivity.alternate.status).toBe('converged');
    expect(sensitivity.insensitiveToInitialGuess).toBe(true);
    expect(sensitivity.convergedMassDifferenceKg).toBeLessThan(inputs.convergenceToleranceKg * 2);
  });

  it('reports non-convergence when the iteration budget is insufficient', () => {
    const result = calculatePreliminarySizing(defaultDesign, { ...electricInputs(), maximumIterations: 1, convergenceToleranceKg: 1e-12 });
    expect(result.status).toBe('non-converged');
    expect(result.iterations).toHaveLength(1);
  });

  it('rejects physically impossible energy fractions and infeasible design points', () => {
    const impossible = electricInputs();
    impossible.propulsionModel = { kind: 'electric', batteryUsableShaftSpecificEnergyJPerKg: 1_000 };
    expect(calculatePreliminarySizing(defaultDesign, impossible).status).toBe('infeasible');
    const constraintFailure = { ...electricInputs(), designPoint: { wingLoadingNm2: 2_000, shaftPowerLoadingWPerN: 0.1 } };
    expect(calculatePreliminarySizing(defaultDesign, constraintFailure).status).toBe('infeasible');
  });

  it('returns incomplete for missing propulsion properties and invalid controls', () => {
    const missingFuel: PreliminarySizingInputs = { ...electricInputs(), propulsionModel: { kind: 'fuel', brakeSpecificFuelConsumptionKgPerJ: 0 } };
    expect(calculatePreliminarySizing(defaultDesign, missingFuel).status).toBe('incomplete');
    expect(calculatePreliminarySizing(defaultDesign, { ...electricInputs(), maximumIterations: 0 }).status).toBe('incomplete');
    expect(calculatePreliminarySizing(defaultDesign, { ...electricInputs(), designPoint: { wingLoadingNm2: Number.NaN, shaftPowerLoadingWPerN: 2 } }).status).toBe('incomplete');
  });
});
