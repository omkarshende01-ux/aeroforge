import type { AircraftDesign, MissionRequirements } from '../domain/types';
import { calculateMetrics } from './metrics';
import { calculatePerformance } from './performance';

export type MissionRequirementId =
  | 'aircraft-category'
  | 'payload'
  | 'range'
  | 'cruise-speed'
  | 'cruise-altitude'
  | 'stall-speed'
  | 'takeoff-distance'
  | 'climb-rate'
  | 'design-objective';

export type RequirementStatus = 'pass' | 'fail' | 'not-evaluated';

export type MissionConstraintEvaluation = {
  id: MissionRequirementId;
  label: string;
  status: RequirementStatus;
  actual?: number;
  required?: number;
  margin?: number;
  unit?: string;
  criterion: string;
  limitation?: string;
};

export type MissionValidationResult = {
  valid: boolean;
  errors: Partial<Record<keyof MissionRequirements, string>>;
};

export type MissionFeasibilityResult = {
  evaluations: MissionConstraintEvaluation[];
  passCount: number;
  failCount: number;
  notEvaluatedCount: number;
  validation: MissionValidationResult;
  analysisWarnings: string[];
};

type NumericMissionField = Exclude<keyof MissionRequirements, 'aircraftCategory' | 'designObjective'>;

export const missionBounds: Record<NumericMissionField, { min: number; max: number }> = {
  payloadKg: { min: 0, max: 100_000 },
  requiredRangeM: { min: 1_000, max: 20_000_000 },
  cruiseSpeedMs: { min: 5, max: 250 },
  cruiseAltitudeM: { min: 0, max: 11_000 },
  serviceCeilingM: { min: 0, max: 11_000 },
  maximumStallSpeedMs: { min: 5, max: 120 },
  maximumTakeoffDistanceM: { min: 10, max: 5_000 },
  minimumClimbRateMs: { min: 0, max: 50 },
  maxOperatingSpeedMs: { min: 10, max: 300 },
};

const categoryValues = ['light-aircraft', 'uncrewed-aircraft', 'glider', 'transport'];
const objectiveValues = ['balanced', 'minimum-mass', 'maximum-range', 'minimum-energy'];

export function validateMissionRequirements(mission: MissionRequirements): MissionValidationResult {
  const errors: MissionValidationResult['errors'] = {};
  if (!categoryValues.includes(mission.aircraftCategory)) errors.aircraftCategory = 'Select a supported aircraft category.';
  if (!objectiveValues.includes(mission.designObjective)) errors.designObjective = 'Select a supported design objective.';
  for (const [field, bounds] of Object.entries(missionBounds) as [NumericMissionField, { min: number; max: number }][]) {
    const value = mission[field];
    if (!Number.isFinite(value)) errors[field] = 'Enter a finite number.';
    else if (value < bounds.min || value > bounds.max) errors[field] = `Must be between ${bounds.min} and ${bounds.max} in SI units.`;
  }
  if (mission.maxOperatingSpeedMs <= mission.maximumStallSpeedMs) {
    errors.maxOperatingSpeedMs = 'Maximum operating speed must exceed maximum stall speed.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

function countByStatus(evaluations: MissionConstraintEvaluation[], status: RequirementStatus): number {
  return evaluations.filter((evaluation) => evaluation.status === status).length;
}

export function evaluateMissionFeasibility(design: AircraftDesign): MissionFeasibilityResult {
  const mission = design.mission;
  const validation = validateMissionRequirements(mission);
  const notEvaluated = (id: MissionRequirementId, label: string, criterion: string, limitation: string): MissionConstraintEvaluation =>
    ({ id, label, status: 'not-evaluated', criterion, limitation });

  if (!validation.valid) {
    const evaluations: MissionConstraintEvaluation[] = [
      notEvaluated('aircraft-category', 'Aircraft category', 'Context', 'Mission inputs must be valid before feasibility is evaluated.'),
      notEvaluated('payload', 'Payload', 'Current payload ≥ required payload', 'Mission inputs must be valid before feasibility is evaluated.'),
      notEvaluated('range', 'Range', 'Still-air range ≥ required range', 'Mission inputs must be valid before feasibility is evaluated.'),
      notEvaluated('cruise-speed', 'Cruise speed', 'Level flight at requested cruise point', 'Mission inputs must be valid before feasibility is evaluated.'),
      notEvaluated('cruise-altitude', 'Cruise altitude', 'Atmosphere and point performance at requested altitude', 'Mission inputs must be valid before feasibility is evaluated.'),
      notEvaluated('stall-speed', 'Maximum stall speed', 'Calculated sea-level stall speed ≤ maximum', 'Mission inputs must be valid before feasibility is evaluated.'),
      notEvaluated('takeoff-distance', 'Maximum takeoff distance', 'Calculated takeoff distance ≤ maximum', 'No takeoff ground-roll model is implemented.'),
      notEvaluated('climb-rate', 'Minimum climb rate', 'Calculated climb rate ≥ minimum', 'Mission inputs must be valid before feasibility is evaluated.'),
      notEvaluated('design-objective', 'Design objective', 'Optimization objective', 'Optimization is outside Phase 4A.'),
    ];
    return { evaluations, passCount: 0, failCount: 0, notEvaluatedCount: evaluations.length, validation, analysisWarnings: [] };
  }

  const cruiseDesign: AircraftDesign = {
    ...design,
    flightCondition: {
      ...design.flightCondition,
      altitudeM: mission.cruiseAltitudeM,
      densitySource: 'isa',
      speedMs: mission.cruiseSpeedMs,
    },
  };
  const seaLevelDesign: AircraftDesign = {
    ...design,
    flightCondition: { ...design.flightCondition, altitudeM: 0, densitySource: 'isa' },
  };
  const performance = calculatePerformance(cruiseDesign);
  const metrics = calculateMetrics(seaLevelDesign);
  const performanceInvalid = performance.warnings.includes('Performance inputs are invalid.');
  const attachedLevelFlightInvalid = performance.requiredLiftCoefficient > design.flightCondition.clMax;
  const performanceUsable = !performanceInvalid && !attachedLevelFlightInvalid;
  const cruiseSupported = performanceUsable && performance.rateOfClimbMs >= 0;
  const payloadMargin = design.massModel.payloadMassKg - mission.payloadKg;
  const stallMargin = metrics.stallSpeedMs === undefined ? undefined : mission.maximumStallSpeedMs - metrics.stallSpeedMs;
  const climbMargin = performanceUsable ? performance.rateOfClimbMs - mission.minimumClimbRateMs : undefined;
  const rangeMargin = cruiseSupported ? performance.stillAirRangeM - mission.requiredRangeM : undefined;
  const cruiseLimitation = performanceInvalid
    ? 'Performance inputs are invalid at the requested cruise point.'
    : 'Required lift exceeds supplied CLmax at the requested cruise point; the attached-flow model is outside its declared range.';

  const evaluations: MissionConstraintEvaluation[] = [
    notEvaluated('aircraft-category', 'Aircraft category', 'Configuration context', 'Category-specific regulatory and statistical constraints are not implemented.'),
    {
      id: 'payload', label: 'Payload', status: payloadMargin >= 0 ? 'pass' : 'fail',
      actual: design.massModel.payloadMassKg, required: mission.payloadKg, margin: payloadMargin, unit: 'kg',
      criterion: 'Current modeled payload ≥ required payload',
    },
    rangeMargin === undefined
      ? notEvaluated('range', 'Range', 'Still-air range ≥ required range', 'Range is not evaluated when the requested cruise point cannot sustain level flight or performance inputs are invalid.')
      : {
        id: 'range', label: 'Range', status: rangeMargin >= 0 ? 'pass' : 'fail',
        actual: performance.stillAirRangeM, required: mission.requiredRangeM, margin: rangeMargin, unit: 'm',
        criterion: 'Energy-based still-air range at requested cruise point ≥ required range',
      },
    performanceUsable ? {
      id: 'cruise-speed', label: 'Cruise speed', status: cruiseSupported ? 'pass' : 'fail',
      actual: mission.cruiseSpeedMs, required: mission.cruiseSpeedMs,
      margin: performance.rateOfClimbMs, unit: 'm/s',
      criterion: 'Existing point-performance model can sustain level flight at requested speed and altitude',
      limitation: 'Margin is excess climb capability at the requested cruise point, not maximum-speed margin.',
    } : notEvaluated('cruise-speed', 'Cruise speed', 'Level flight at requested cruise point', cruiseLimitation),
    performanceUsable ? {
      id: 'cruise-altitude', label: 'Cruise altitude', status: cruiseSupported ? 'pass' : 'fail',
      actual: mission.cruiseAltitudeM, required: mission.cruiseAltitudeM,
      margin: performance.rateOfClimbMs, unit: 'm/s',
      criterion: 'Existing ISA point-performance model can sustain level flight at requested altitude and speed',
      limitation: 'This is a single-point check, not a service-ceiling calculation.',
    } : notEvaluated('cruise-altitude', 'Cruise altitude', 'Atmosphere and point performance at requested altitude', cruiseLimitation),
    stallMargin === undefined
      ? notEvaluated('stall-speed', 'Maximum stall speed', 'Sea-level stall speed ≤ maximum', 'Stall speed inputs are invalid.')
      : {
        id: 'stall-speed', label: 'Maximum stall speed', status: stallMargin >= 0 ? 'pass' : 'fail',
        actual: metrics.stallSpeedMs, required: mission.maximumStallSpeedMs, margin: stallMargin, unit: 'm/s',
        criterion: 'Calculated 1-g sea-level true stall speed ≤ maximum',
        limitation: 'CLmax is supplied; AeroForge does not predict stall aerodynamics.',
      },
    notEvaluated('takeoff-distance', 'Maximum takeoff distance', 'Calculated takeoff distance ≤ maximum', 'No takeoff ground-roll, thrust-versus-speed, or obstacle-clearance model is implemented.'),
    climbMargin === undefined
      ? notEvaluated('climb-rate', 'Minimum climb rate', 'Calculated climb rate ≥ minimum', 'Performance inputs are invalid.')
      : {
        id: 'climb-rate', label: 'Minimum climb rate', status: climbMargin >= 0 ? 'pass' : 'fail',
        actual: performance.rateOfClimbMs, required: mission.minimumClimbRateMs, margin: climbMargin, unit: 'm/s',
        criterion: 'Excess-power climb at requested cruise speed and altitude ≥ minimum',
        limitation: 'This is a point climb estimate, not an optimized climb schedule.',
      },
    notEvaluated('design-objective', 'Design objective', 'Optimization objective', 'The objective is recorded for future trade studies; optimization is outside Phase 4A.'),
  ];

  return {
    evaluations,
    passCount: countByStatus(evaluations, 'pass'),
    failCount: countByStatus(evaluations, 'fail'),
    notEvaluatedCount: countByStatus(evaluations, 'not-evaluated'),
    validation,
    analysisWarnings: [...new Set([...performance.warnings, ...metrics.warnings])],
  };
}
