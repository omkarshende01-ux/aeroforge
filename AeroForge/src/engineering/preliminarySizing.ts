import { AIRCRAFT_DESIGN_SCHEMA_VERSION, type EngineeringResultContract } from '../domain/contracts';
import type { AircraftDesign } from '../domain/types';
import { analyzeAircraftConstraints, evaluateConstraintPoint, type ConstraintPoint, type ConstraintPointEvaluation } from './constraints';
import { calculateMassProperties } from './massProperties';
import { calculateMetrics } from './metrics';
import { validateMissionRequirements } from './mission';
import { calculateLevelFlightPower } from './performance';
import { standardAtmosphere } from './atmosphere';

export const PRELIMINARY_SIZING_MODEL_VERSION = '1.0.0';
export const gravityMs2 = 9.80665;

export type SizingPropulsionModel =
  | { kind: 'electric'; batteryUsableShaftSpecificEnergyJPerKg: number }
  | { kind: 'fuel'; brakeSpecificFuelConsumptionKgPerJ: number };

export type PreliminarySizingInputs = {
  designPoint: ConstraintPoint;
  initialTakeoffMassKg: number;
  airframeMassKg: number;
  propulsionMassKg: number;
  fixedEquipmentMassKg: number;
  reserveFraction: number;
  dampingFactor: number;
  convergenceToleranceKg: number;
  maximumIterations: number;
  propulsionModel: SizingPropulsionModel;
};

export type SizingIteration = {
  iteration: number;
  massEstimateKg: number;
  targetMassKg: number;
  residualKg: number;
  missionShaftEnergyJ: number;
  energyStorageMassKg: number;
};

export type PreliminarySizingStatus = 'converged' | 'non-converged' | 'infeasible' | 'incomplete';

export type PreliminarySizingResult = {
  contract: EngineeringResultContract;
  status: PreliminarySizingStatus;
  missionStatus: 'infeasible' | 'indeterminate';
  statusDetail: string;
  designPointEvaluation?: ConstraintPointEvaluation;
  iterations: SizingIteration[];
  finalTakeoffMassKg?: number;
  requiredWingAreaM2?: number;
  requiredInstalledShaftPowerW?: number;
  requiredCruiseShaftPowerW?: number;
  missionShaftEnergyJ?: number;
  reserveShaftEnergyJ?: number;
  totalShaftEnergyCapacityJ?: number;
  energyStorageMassKg?: number;
  emptyMassKg?: number;
  payloadMassKg?: number;
  massBalanceResidualKg?: number;
  energyBalanceResidualJ?: number;
  energyMassFraction?: number;
};

export type SizingSensitivityResult = {
  primary: PreliminarySizingResult;
  alternate: PreliminarySizingResult;
  convergedMassDifferenceKg?: number;
  insensitiveToInitialGuess: boolean;
};

export type SizedGeometryAndPower = {
  weightN: number;
  requiredWingAreaM2: number;
  requiredInstalledShaftPowerW: number;
};

/** Direct dimensional conversion from takeoff mass and an M4.3 loading design point. */
export function calculateSizedGeometryAndPower(massKg: number, designPoint: ConstraintPoint): SizedGeometryAndPower {
  if (!finitePositive(massKg) || !finitePositive(designPoint.wingLoadingNm2) || !finitePositive(designPoint.shaftPowerLoadingWPerN)) {
    throw new RangeError('Mass and loading design point must be finite and positive.');
  }
  const weightN = massKg * gravityMs2;
  return {
    weightN,
    requiredWingAreaM2: weightN / designPoint.wingLoadingNm2,
    requiredInstalledShaftPowerW: designPoint.shaftPowerLoadingWPerN * weightN,
  };
}

function contract(design: AircraftDesign, validity: EngineeringResultContract['validity'], warnings: string[]): EngineeringResultContract {
  return {
    schemaVersion: AIRCRAFT_DESIGN_SCHEMA_VERSION,
    designRevision: design.revision,
    modelId: 'iterative-preliminary-aircraft-sizing',
    modelVersion: PRELIMINARY_SIZING_MODEL_VERSION,
    validity,
    assumptions: [
      'Conventional subsonic aircraft and the M4.3 parabolic-polar constraint model apply.',
      'Cruise is steady, level, still-air flight at the requested speed and ISA altitude.',
      'Cruise shaft power is integrated over range divided by true airspeed; climb, takeoff, descent, taxi, wind, and loiter energy are not modeled.',
      'Airframe, propulsion, fixed-equipment masses, battery effective shaft-specific energy, and fuel brake-specific consumption are explicit user-supplied assumptions.',
      'Fuel burn does not reduce the aerodynamic design mass during the constant-mass cruise estimate.',
      'Reserve is a fraction of total stored energy or fuel capacity and is unavailable to the nominal mission.',
      'Damped fixed-point iteration closes takeoff mass against fixed masses, payload, and mission energy storage mass.',
    ],
    warnings,
    sources: [
      { title: 'AeroForge M4.3 aircraft constraint analysis', reference: 'src/engineering/constraints.ts' },
      { title: 'AeroForge analytical level-flight power model', reference: 'src/engineering/performance.ts' },
      { title: 'User-supplied sizing assumptions', reference: 'Sizing workspace inputs; no aircraft-specific empirical database is integrated.' },
    ],
  };
}

function incomplete(design: AircraftDesign, detail: string, warnings: string[] = []): PreliminarySizingResult {
  return {
    contract: contract(design, 'invalid', [detail, ...warnings]),
    status: 'incomplete',
    missionStatus: 'indeterminate',
    statusDetail: detail,
    iterations: [],
  };
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function validateInputs(design: AircraftDesign, inputs: PreliminarySizingInputs): string[] {
  const errors = Object.values(validateMissionRequirements(design.mission).errors).filter((message): message is string => message !== undefined);
  const point = inputs.designPoint;
  if (!finitePositive(point.wingLoadingNm2) || !finitePositive(point.shaftPowerLoadingWPerN)) errors.push('The selected W/S and installed shaft P/W must be finite and positive.');
  if (!finitePositive(inputs.initialTakeoffMassKg)) errors.push('Initial takeoff mass must be finite and positive.');
  if (![inputs.airframeMassKg, inputs.propulsionMassKg, inputs.fixedEquipmentMassKg].every((value) => Number.isFinite(value) && value >= 0)) errors.push('Fixed component masses must be finite and nonnegative.');
  if (!Number.isFinite(inputs.reserveFraction) || inputs.reserveFraction < 0 || inputs.reserveFraction >= 1) errors.push('Reserve fraction must be in [0, 1).');
  if (!Number.isFinite(inputs.dampingFactor) || inputs.dampingFactor <= 0 || inputs.dampingFactor > 1) errors.push('Damping factor must be in (0, 1].');
  if (!finitePositive(inputs.convergenceToleranceKg)) errors.push('Convergence tolerance must be finite and positive.');
  if (!Number.isInteger(inputs.maximumIterations) || inputs.maximumIterations < 1 || inputs.maximumIterations > 500) errors.push('Maximum iterations must be an integer from 1 to 500.');
  if (inputs.propulsionModel.kind === 'electric' && !finitePositive(inputs.propulsionModel.batteryUsableShaftSpecificEnergyJPerKg)) errors.push('Effective battery shaft-specific energy is required for electric sizing.');
  if (inputs.propulsionModel.kind === 'fuel' && !finitePositive(inputs.propulsionModel.brakeSpecificFuelConsumptionKgPerJ)) errors.push('Brake-specific fuel consumption is required for fuel sizing.');
  return errors;
}

export function calculateEnergyStorageMass(model: SizingPropulsionModel, missionShaftEnergyJ: number, reserveFraction: number): number {
  const nominalFraction = 1 - reserveFraction;
  return model.kind === 'electric'
    ? missionShaftEnergyJ / (model.batteryUsableShaftSpecificEnergyJPerKg * nominalFraction)
    : missionShaftEnergyJ * model.brakeSpecificFuelConsumptionKgPerJ / nominalFraction;
}

function usableMissionEnergy(model: SizingPropulsionModel, storageMassKg: number, reserveFraction: number): number {
  return model.kind === 'electric'
    ? storageMassKg * model.batteryUsableShaftSpecificEnergyJPerKg * (1 - reserveFraction)
    : storageMassKg / model.brakeSpecificFuelConsumptionKgPerJ * (1 - reserveFraction);
}

export function createDefaultSizingInputs(design: AircraftDesign, designPoint: ConstraintPoint): PreliminarySizingInputs {
  const massProperties = calculateMassProperties(design);
  const effectiveBatterySpecificEnergy = design.massModel.energyMassKg > 0
    ? design.propulsion.usableShaftEnergyJ / design.massModel.energyMassKg
    : 0;
  return {
    designPoint,
    initialTakeoffMassKg: massProperties.accountedMassKg > 0 ? massProperties.accountedMassKg : design.massKg,
    airframeMassKg: design.massModel.airframeMassKg,
    propulsionMassKg: design.massModel.propulsionMassKg,
    fixedEquipmentMassKg: 0,
    reserveFraction: design.propulsion.reserveFraction,
    dampingFactor: 0.5,
    convergenceToleranceKg: 0.1,
    maximumIterations: 100,
    propulsionModel: { kind: 'electric', batteryUsableShaftSpecificEnergyJPerKg: effectiveBatterySpecificEnergy },
  };
}

export function calculatePreliminarySizing(design: AircraftDesign, inputs: PreliminarySizingInputs): PreliminarySizingResult {
  const errors = validateInputs(design, inputs);
  if (errors.length > 0) return incomplete(design, errors.join(' '));

  const constraints = analyzeAircraftConstraints(design);
  if (constraints.contract.validity === 'invalid') return incomplete(design, 'The M4.3 constraint model is invalid for the current design.', constraints.contract.warnings);
  const { designPoint } = inputs;
  if (designPoint.wingLoadingNm2 < constraints.domain.minWingLoadingNm2 || designPoint.wingLoadingNm2 > constraints.domain.maxWingLoadingNm2 ||
      designPoint.shaftPowerLoadingWPerN < constraints.domain.minShaftPowerLoadingWPerN || designPoint.shaftPowerLoadingWPerN > constraints.domain.maxShaftPowerLoadingWPerN) {
    return incomplete(design, 'The selected design point is outside the validated M4.3 plotting domain.');
  }
  const pointEvaluation = evaluateConstraintPoint(constraints, designPoint);
  if (!pointEvaluation.evaluatedFeasible) {
    return {
      contract: contract(design, 'partial', ['The selected design point violates at least one evaluated M4.3 constraint.']),
      status: 'infeasible', missionStatus: 'infeasible', statusDetail: 'Select a point that satisfies every evaluated sizing constraint.',
      designPointEvaluation: pointEvaluation, iterations: [],
    };
  }

  const metrics = calculateMetrics(design);
  if (!finitePositive(metrics.aspectRatio)) return incomplete(design, 'The current wing aspect ratio is required by the shared aerodynamic model.');
  let densityKgM3: number;
  try { densityKgM3 = standardAtmosphere(design.mission.cruiseAltitudeM).densityKgM3; }
  catch { return incomplete(design, 'Cruise altitude is outside the implemented ISA model.'); }

  let cruisePowerLoadingWPerN: number;
  try {
    cruisePowerLoadingWPerN = calculateLevelFlightPower({
      wingLoadingNm2: designPoint.wingLoadingNm2,
      speedMs: design.mission.cruiseSpeedMs,
      densityKgM3,
      cd0: design.flightCondition.cd0,
      oswaldEfficiency: design.flightCondition.oswaldEfficiency,
      aspectRatio: metrics.aspectRatio,
      propulsiveEfficiency: design.propulsion.propulsiveEfficiency,
    }).shaftPowerLoadingWPerN;
  } catch {
    return incomplete(design, 'The shared cruise-power model rejected the current aerodynamic or propulsion inputs.');
  }

  const missionDurationS = design.mission.requiredRangeM / design.mission.cruiseSpeedMs;
  const energyPerMassJPerKg = cruisePowerLoadingWPerN * gravityMs2 * missionDurationS;
  const energyMassFraction = inputs.propulsionModel.kind === 'electric'
    ? energyPerMassJPerKg / (inputs.propulsionModel.batteryUsableShaftSpecificEnergyJPerKg * (1 - inputs.reserveFraction))
    : energyPerMassJPerKg * inputs.propulsionModel.brakeSpecificFuelConsumptionKgPerJ / (1 - inputs.reserveFraction);
  if (!Number.isFinite(energyMassFraction) || energyMassFraction < 0 || energyMassFraction >= 1) {
    return {
      contract: contract(design, 'partial', ['Mission energy storage would equal or exceed takeoff mass under the supplied assumptions.']),
      status: 'infeasible', missionStatus: 'infeasible', statusDetail: 'No positive finite mass closure exists because the mission energy mass fraction is at least one.',
      designPointEvaluation: pointEvaluation, iterations: [], energyMassFraction,
    };
  }

  const fixedEmptyMassKg = inputs.airframeMassKg + inputs.propulsionMassKg + inputs.fixedEquipmentMassKg;
  const payloadMassKg = design.mission.payloadKg;
  const iterations: SizingIteration[] = [];
  let massEstimateKg = inputs.initialTakeoffMassKg;
  let converged = false;
  let finalTargetMassKg = Number.NaN;
  let finalMissionEnergyJ = Number.NaN;
  let finalEnergyMassKg = Number.NaN;

  for (let iteration = 1; iteration <= inputs.maximumIterations; iteration += 1) {
    const missionShaftEnergyJ = energyPerMassJPerKg * massEstimateKg;
    const energyStorageMassKg = calculateEnergyStorageMass(inputs.propulsionModel, missionShaftEnergyJ, inputs.reserveFraction);
    const targetMassKg = fixedEmptyMassKg + payloadMassKg + energyStorageMassKg;
    const residualKg = targetMassKg - massEstimateKg;
    iterations.push({ iteration, massEstimateKg, targetMassKg, residualKg, missionShaftEnergyJ, energyStorageMassKg });
    finalTargetMassKg = targetMassKg;
    finalMissionEnergyJ = missionShaftEnergyJ;
    finalEnergyMassKg = energyStorageMassKg;
    if (![targetMassKg, residualKg, energyStorageMassKg].every(Number.isFinite) || targetMassKg <= 0 || energyStorageMassKg < 0) break;
    if (Math.abs(residualKg) <= inputs.convergenceToleranceKg) { converged = true; break; }
    massEstimateKg += inputs.dampingFactor * residualKg;
    if (!Number.isFinite(massEstimateKg) || massEstimateKg <= 0 || massEstimateKg > 1e9) break;
  }

  const finalMassKg = converged ? finalTargetMassKg : massEstimateKg;
  const finalMissionShaftEnergyJResolved = energyPerMassJPerKg * finalMassKg;
  const finalEnergyStorageMassKgResolved = calculateEnergyStorageMass(inputs.propulsionModel, finalMissionShaftEnergyJResolved, inputs.reserveFraction);
  const massResidualKg = fixedEmptyMassKg + payloadMassKg + finalEnergyStorageMassKgResolved - finalMassKg;
  const totalShaftCapacityJ = finalMissionShaftEnergyJResolved / (1 - inputs.reserveFraction);
  const reserveShaftEnergyJ = totalShaftCapacityJ - finalMissionShaftEnergyJResolved;
  const energyResidualJ = usableMissionEnergy(inputs.propulsionModel, finalEnergyStorageMassKgResolved, inputs.reserveFraction) - finalMissionShaftEnergyJResolved;
  const warnings = [
    'Takeoff distance remains unevaluated; mass convergence does not establish mission feasibility.',
    'Mission energy includes cruise only and excludes takeoff, climb, descent, taxi, loiter, wind, and propulsion derating.',
  ];
  if (!converged) warnings.unshift('The fixed-point iteration did not meet the requested mass tolerance.');
  const sizedGeometryAndPower = calculateSizedGeometryAndPower(finalMassKg, designPoint);

  return {
    contract: contract(design, converged ? 'partial' : 'invalid', warnings),
    status: converged ? 'converged' : 'non-converged',
    missionStatus: 'indeterminate',
    statusDetail: converged ? 'Mass and cruise-energy bookkeeping converged; mandatory takeoff remains unevaluated.' : 'Iteration limit or numerical guard reached before mass closure.',
    designPointEvaluation: pointEvaluation,
    iterations,
    finalTakeoffMassKg: finalMassKg,
    requiredWingAreaM2: sizedGeometryAndPower.requiredWingAreaM2,
    requiredInstalledShaftPowerW: sizedGeometryAndPower.requiredInstalledShaftPowerW,
    requiredCruiseShaftPowerW: cruisePowerLoadingWPerN * finalMassKg * gravityMs2,
    missionShaftEnergyJ: finalMissionShaftEnergyJResolved,
    reserveShaftEnergyJ,
    totalShaftEnergyCapacityJ: totalShaftCapacityJ,
    energyStorageMassKg: finalEnergyStorageMassKgResolved,
    emptyMassKg: fixedEmptyMassKg,
    payloadMassKg,
    massBalanceResidualKg: massResidualKg,
    energyBalanceResidualJ: energyResidualJ,
    energyMassFraction,
  };
}

export function calculateSizingSensitivity(design: AircraftDesign, inputs: PreliminarySizingInputs, alternateInitialMassKg: number): SizingSensitivityResult {
  const primary = calculatePreliminarySizing(design, inputs);
  const alternate = calculatePreliminarySizing(design, { ...inputs, initialTakeoffMassKg: alternateInitialMassKg });
  const convergedMassDifferenceKg = primary.finalTakeoffMassKg !== undefined && alternate.finalTakeoffMassKg !== undefined
    ? Math.abs(primary.finalTakeoffMassKg - alternate.finalTakeoffMassKg)
    : undefined;
  return {
    primary,
    alternate,
    convergedMassDifferenceKg,
    insensitiveToInitialGuess: primary.status === 'converged' && alternate.status === 'converged' && convergedMassDifferenceKg !== undefined && convergedMassDifferenceKg <= Math.max(inputs.convergenceToleranceKg * 2, 0.01),
  };
}
