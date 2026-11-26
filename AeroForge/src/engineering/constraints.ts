import { AIRCRAFT_DESIGN_SCHEMA_VERSION, type EngineeringResultContract } from '../domain/contracts';
import type { AircraftDesign } from '../domain/types';
import { calculateMassProperties } from './massProperties';
import { calculateMetrics } from './metrics';
import { validateMissionRequirements } from './mission';
import { calculateLevelFlightPower } from './performance';
import { standardAtmosphere } from './atmosphere';

export const CONSTRAINT_ANALYSIS_MODEL_VERSION = '1.0.0';
export const serviceCeilingClimbRateMs = 100 * 0.3048 / 60;

export type PowerConstraintId = 'cruise-power' | 'minimum-climb' | 'service-ceiling';
export type SizingConstraintId = 'stall-speed' | PowerConstraintId | 'takeoff-distance';
export type ConstraintEvaluationStatus = 'pass' | 'fail' | 'not-evaluated';
export type ConstraintOverallStatus = 'feasible' | 'infeasible' | 'indeterminate' | 'invalid';

export type ConstraintPoint = {
  wingLoadingNm2: number;
  shaftPowerLoadingWPerN: number;
};

export type ConstraintCurvePoint = ConstraintPoint;

export type PowerConstraintCurve = {
  id: PowerConstraintId;
  label: string;
  points: ConstraintCurvePoint[];
};

export type ConstraintDefinition = {
  id: SizingConstraintId;
  label: string;
  status: 'evaluated' | 'not-evaluated';
  criterion: string;
  limitation?: string;
};

export type ConstraintMargin = {
  id: SizingConstraintId;
  label: string;
  status: ConstraintEvaluationStatus;
  margin?: number;
  required?: number;
  unit: 'N/m²' | 'W/N' | '—';
  limitation?: string;
};

export type ConstraintPointEvaluation = {
  point: ConstraintPoint;
  constraints: ConstraintMargin[];
  governingConstraint?: SizingConstraintId;
  evaluatedFeasible: boolean;
  overallStatus: ConstraintOverallStatus;
};

export type ConstraintIntersection = {
  first: PowerConstraintId;
  second: PowerConstraintId;
  point: ConstraintPoint;
};

export type ConstraintAnalysisResult = {
  contract: EngineeringResultContract;
  domain: { minWingLoadingNm2: number; maxWingLoadingNm2: number; minShaftPowerLoadingWPerN: number; maxShaftPowerLoadingWPerN: number };
  constraints: ConstraintDefinition[];
  stallWingLoadingLimitNm2?: number;
  curves: PowerConstraintCurve[];
  feasibleBoundary: ConstraintCurvePoint[];
  intersections: ConstraintIntersection[];
  hasEvaluatedFeasibleRegion: boolean;
  currentPoint?: ConstraintPoint;
  currentEvaluation?: ConstraintPointEvaluation;
};

const gravityMs2 = 9.80665;
const minimumWingLoadingNm2 = 100;
const maximumWingLoadingNm2 = 3_000;
const maximumShaftPowerLoadingWPerN = 30;
const stationCount = 81;

function resultContract(design: AircraftDesign, validity: EngineeringResultContract['validity'], warnings: string[]): EngineeringResultContract {
  return {
    schemaVersion: AIRCRAFT_DESIGN_SCHEMA_VERSION,
    designRevision: design.revision,
    modelId: 'aircraft-constraint-analysis',
    modelVersion: CONSTRAINT_ANALYSIS_MODEL_VERSION,
    validity,
    assumptions: [
      'Conventional subsonic aircraft with a parabolic drag polar.',
      'Installed shaft power is fully available at altitude; no engine or motor derating map is implemented.',
      'Propulsive efficiency is constant and converts installed shaft power to propulsive power.',
      'Cruise and climb use the requested cruise true airspeed and ISA density.',
      'Service ceiling uses the minimum-power point and the FAA 100 ft/min climb criterion.',
      'The plotted domain is 100–3000 N/m² and 0–30 W/N; absence of a region applies only to this domain.',
    ],
    warnings,
    sources: [
      { title: 'AeroForge Phase 2/3 analytical aerodynamics and performance models', reference: 'docs/ENGINEERING_MODELS.md' },
      { title: 'FAA Airplane Flying Handbook glossary — service ceiling definition', reference: 'https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/20_afh_glossary.pdf' },
    ],
  };
}

function emptyResult(design: AircraftDesign, warnings: string[]): ConstraintAnalysisResult {
  const constraints: ConstraintDefinition[] = [
    { id: 'stall-speed', label: 'Maximum stall speed', status: 'not-evaluated', criterion: 'W/S ≤ ½ρV²CLmax', limitation: 'Analysis inputs are invalid.' },
    { id: 'cruise-power', label: 'Cruise shaft power', status: 'not-evaluated', criterion: 'Pshaft/W ≥ V(D/W)/ηp', limitation: 'Analysis inputs are invalid.' },
    { id: 'minimum-climb', label: 'Minimum rate of climb', status: 'not-evaluated', criterion: 'Pshaft/W ≥ [V(D/W)+ROC]/ηp', limitation: 'Analysis inputs are invalid.' },
    { id: 'service-ceiling', label: 'Service ceiling', status: 'not-evaluated', criterion: 'Best ROC ≥ 100 ft/min', limitation: 'Analysis inputs are invalid.' },
    { id: 'takeoff-distance', label: 'Maximum takeoff distance', status: 'not-evaluated', criterion: 'Takeoff distance ≤ requirement', limitation: 'No defensible takeoff model is implemented.' },
  ];
  return {
    contract: resultContract(design, 'invalid', warnings),
    domain: { minWingLoadingNm2: minimumWingLoadingNm2, maxWingLoadingNm2: maximumWingLoadingNm2, minShaftPowerLoadingWPerN: 0, maxShaftPowerLoadingWPerN: maximumShaftPowerLoadingWPerN },
    constraints,
    curves: [],
    feasibleBoundary: [],
    intersections: [],
    hasEvaluatedFeasibleRegion: false,
  };
}

function interpolateCurve(curve: PowerConstraintCurve, wingLoadingNm2: number): number | undefined {
  const points = curve.points;
  if (points.length === 0 || wingLoadingNm2 < points[0].wingLoadingNm2 || wingLoadingNm2 > points.at(-1)!.wingLoadingNm2) return undefined;
  const upperIndex = points.findIndex((point) => point.wingLoadingNm2 >= wingLoadingNm2);
  if (upperIndex <= 0) return points[0].shaftPowerLoadingWPerN;
  const lower = points[upperIndex - 1]; const upper = points[upperIndex];
  const fraction = (wingLoadingNm2 - lower.wingLoadingNm2) / (upper.wingLoadingNm2 - lower.wingLoadingNm2);
  return lower.shaftPowerLoadingWPerN + fraction * (upper.shaftPowerLoadingWPerN - lower.shaftPowerLoadingWPerN);
}

export function findConstraintIntersections(curves: PowerConstraintCurve[]): ConstraintIntersection[] {
  const found: ConstraintIntersection[] = [];
  for (let firstIndex = 0; firstIndex < curves.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < curves.length; secondIndex += 1) {
      const first = curves[firstIndex]; const second = curves[secondIndex];
      for (let index = 1; index < Math.min(first.points.length, second.points.length); index += 1) {
        const previousDifference = first.points[index - 1].shaftPowerLoadingWPerN - second.points[index - 1].shaftPowerLoadingWPerN;
        const difference = first.points[index].shaftPowerLoadingWPerN - second.points[index].shaftPowerLoadingWPerN;
        if (previousDifference === 0 || previousDifference * difference < 0) {
          const fraction = previousDifference === difference ? 0 : previousDifference / (previousDifference - difference);
          const wingLoadingNm2 = first.points[index - 1].wingLoadingNm2 + fraction * (first.points[index].wingLoadingNm2 - first.points[index - 1].wingLoadingNm2);
          const required = interpolateCurve(first, wingLoadingNm2);
          if (required !== undefined) found.push({ first: first.id, second: second.id, point: { wingLoadingNm2, shaftPowerLoadingWPerN: required } });
        }
      }
    }
  }
  return found;
}

export function evaluateConstraintPoint(result: ConstraintAnalysisResult, point: ConstraintPoint): ConstraintPointEvaluation {
  if (result.contract.validity === 'invalid' || result.stallWingLoadingLimitNm2 === undefined) {
    return { point, constraints: result.constraints.map((constraint) => ({ id: constraint.id, label: constraint.label, status: 'not-evaluated', unit: '—', limitation: constraint.limitation })), evaluatedFeasible: false, overallStatus: 'invalid' };
  }
  const stallMargin = result.stallWingLoadingLimitNm2 - point.wingLoadingNm2;
  const margins: ConstraintMargin[] = [{
    id: 'stall-speed', label: 'Maximum stall speed', status: stallMargin >= 0 ? 'pass' : 'fail',
    margin: stallMargin, required: result.stallWingLoadingLimitNm2, unit: 'N/m²',
  }];
  for (const constraint of result.constraints.filter((item) => item.id !== 'stall-speed')) {
    if (constraint.status === 'not-evaluated') {
      margins.push({ id: constraint.id, label: constraint.label, status: 'not-evaluated', unit: '—', limitation: constraint.limitation });
      continue;
    }
    const curve = result.curves.find((item) => item.id === constraint.id);
    const required = curve ? interpolateCurve(curve, point.wingLoadingNm2) : undefined;
    if (required === undefined) {
      margins.push({ id: constraint.id, label: constraint.label, status: 'not-evaluated', unit: '—', limitation: 'Point lies outside the validated diagram domain.' });
      continue;
    }
    const margin = point.shaftPowerLoadingWPerN - required;
    margins.push({ id: constraint.id, label: constraint.label, status: margin >= -1e-10 ? 'pass' : 'fail', margin, required, unit: 'W/N' });
  }
  const failed = margins.some((margin) => margin.status === 'fail');
  const mandatoryUnevaluated = margins.some((margin) => margin.status === 'not-evaluated');
  const evaluatedFeasible = !failed && margins.some((margin) => margin.status === 'pass');
  let governingConstraint: SizingConstraintId | undefined;
  if (stallMargin < 0) governingConstraint = 'stall-speed';
  else {
    const requiredPowerMargins = margins.filter((margin): margin is ConstraintMargin & { required: number } => margin.unit === 'W/N' && margin.required !== undefined);
    governingConstraint = requiredPowerMargins.sort((first, second) => second.required - first.required)[0]?.id;
  }
  return {
    point,
    constraints: margins,
    governingConstraint,
    evaluatedFeasible,
    overallStatus: failed ? 'infeasible' : mandatoryUnevaluated ? 'indeterminate' : evaluatedFeasible ? 'feasible' : 'invalid',
  };
}

export function analyzeAircraftConstraints(design: AircraftDesign): ConstraintAnalysisResult {
  const validation = validateMissionRequirements(design.mission);
  const metrics = calculateMetrics(design);
  const mass = calculateMassProperties(design);
  const inputValid = validation.valid && design.schemaVersion === AIRCRAFT_DESIGN_SCHEMA_VERSION && design.revision >= 0 &&
    design.massKg > 0 && metrics.wingAreaM2 > 0 && metrics.aspectRatio > 0 && design.flightCondition.clMax > 0 &&
    design.flightCondition.cd0 >= 0 && design.flightCondition.oswaldEfficiency > 0 &&
    design.propulsion.propulsiveEfficiency > 0 && design.propulsion.propulsiveEfficiency <= 1;
  if (!inputValid) {
    return emptyResult(design, ['Constraint analysis inputs or schema version are invalid.', ...Object.values(validation.errors), ...metrics.warnings, ...mass.warnings]);
  }

  const cruiseAtmosphere = standardAtmosphere(design.mission.cruiseAltitudeM);
  const ceilingAtmosphere = standardAtmosphere(design.mission.serviceCeilingM);
  const cruiseMach = design.mission.cruiseSpeedMs / cruiseAtmosphere.speedOfSoundMs;
  if (cruiseMach > 0.3) return emptyResult(design, ['Requested cruise condition exceeds Mach 0.3; the incompressible drag model is outside its declared range.']);

  const inducedFactor = 1 / (Math.PI * design.flightCondition.oswaldEfficiency * metrics.aspectRatio);
  const minimumPowerLiftCoefficient = Math.sqrt(3 * design.flightCondition.cd0 / inducedFactor);
  const serviceCeilingSupported = Number.isFinite(minimumPowerLiftCoefficient) && minimumPowerLiftCoefficient > 0 && minimumPowerLiftCoefficient <= design.flightCondition.clMax;
  const cruiseLiftLimitNm2 = 0.5 * cruiseAtmosphere.densityKgM3 * design.mission.cruiseSpeedMs ** 2 * design.flightCondition.clMax;
  const ceilingMachLimitNm2 = 0.5 * ceilingAtmosphere.densityKgM3 * (0.3 * ceilingAtmosphere.speedOfSoundMs) ** 2 * minimumPowerLiftCoefficient;
  const domainMax = Math.min(maximumWingLoadingNm2, cruiseLiftLimitNm2, serviceCeilingSupported ? ceilingMachLimitNm2 : maximumWingLoadingNm2);
  if (domainMax <= minimumWingLoadingNm2) return emptyResult(design, ['No validated wing-loading domain remains at the requested cruise and service-ceiling conditions.']);

  const stallDensity = standardAtmosphere(0).densityKgM3;
  const stallWingLoadingLimitNm2 = 0.5 * stallDensity * design.mission.maximumStallSpeedMs ** 2 * design.flightCondition.clMax;
  const curves: PowerConstraintCurve[] = [
    { id: 'cruise-power', label: 'Cruise shaft power', points: [] },
    { id: 'minimum-climb', label: 'Minimum rate of climb', points: [] },
  ];
  if (serviceCeilingSupported) curves.push({ id: 'service-ceiling', label: 'Service ceiling', points: [] });

  for (let index = 0; index < stationCount; index += 1) {
    const wingLoadingNm2 = minimumWingLoadingNm2 + (domainMax - minimumWingLoadingNm2) * index / (stationCount - 1);
    const cruise = calculateLevelFlightPower({
      wingLoadingNm2,
      speedMs: design.mission.cruiseSpeedMs,
      densityKgM3: cruiseAtmosphere.densityKgM3,
      cd0: design.flightCondition.cd0,
      oswaldEfficiency: design.flightCondition.oswaldEfficiency,
      aspectRatio: metrics.aspectRatio,
      propulsiveEfficiency: design.propulsion.propulsiveEfficiency,
    });
    curves[0].points.push({ wingLoadingNm2, shaftPowerLoadingWPerN: cruise.shaftPowerLoadingWPerN });
    curves[1].points.push({ wingLoadingNm2, shaftPowerLoadingWPerN: cruise.shaftPowerLoadingWPerN + design.mission.minimumClimbRateMs / design.propulsion.propulsiveEfficiency });
    if (serviceCeilingSupported) {
      const ceilingSpeedMs = Math.sqrt(2 * wingLoadingNm2 / (ceilingAtmosphere.densityKgM3 * minimumPowerLiftCoefficient));
      const ceiling = calculateLevelFlightPower({
        wingLoadingNm2,
        speedMs: ceilingSpeedMs,
        densityKgM3: ceilingAtmosphere.densityKgM3,
        cd0: design.flightCondition.cd0,
        oswaldEfficiency: design.flightCondition.oswaldEfficiency,
        aspectRatio: metrics.aspectRatio,
        propulsiveEfficiency: design.propulsion.propulsiveEfficiency,
      });
      curves[2].points.push({ wingLoadingNm2, shaftPowerLoadingWPerN: ceiling.shaftPowerLoadingWPerN + serviceCeilingClimbRateMs / design.propulsion.propulsiveEfficiency });
    }
  }

  const constraints: ConstraintDefinition[] = [
    { id: 'stall-speed', label: 'Maximum stall speed', status: 'evaluated', criterion: 'W/S ≤ ½ρ0Vs,max²CLmax' },
    { id: 'cruise-power', label: 'Cruise shaft power', status: 'evaluated', criterion: 'Pshaft/W ≥ V(D/W)/ηp' },
    { id: 'minimum-climb', label: 'Minimum rate of climb', status: 'evaluated', criterion: 'Pshaft/W ≥ [V(D/W)+ROCmin]/ηp' },
    serviceCeilingSupported
      ? { id: 'service-ceiling', label: 'Service ceiling', status: 'evaluated', criterion: 'Best ROC at required altitude ≥ 100 ft/min' }
      : { id: 'service-ceiling', label: 'Service ceiling', status: 'not-evaluated', criterion: 'Best ROC at required altitude ≥ 100 ft/min', limitation: 'Minimum-power lift coefficient exceeds supplied CLmax.' },
    { id: 'takeoff-distance', label: 'Maximum takeoff distance', status: 'not-evaluated', criterion: 'Takeoff distance ≤ requirement', limitation: 'No ground-roll, thrust-versus-speed, rolling-resistance, rotation, or obstacle-clearance model exists.' },
  ];

  const feasibleBoundary = curves[0].points.flatMap((point) => {
    if (point.wingLoadingNm2 > stallWingLoadingLimitNm2) return [];
    const requirements = curves.map((curve) => interpolateCurve(curve, point.wingLoadingNm2)).filter((value): value is number => value !== undefined);
    if (requirements.length !== curves.length) return [];
    const required = Math.max(...requirements);
    return required <= maximumShaftPowerLoadingWPerN ? [{ wingLoadingNm2: point.wingLoadingNm2, shaftPowerLoadingWPerN: required }] : [];
  });
  const warnings = [
    ...mass.warnings,
    'Installed shaft power is assumed constant with altitude because no propulsion derating map is available.',
    'Takeoff distance is mandatory but not evaluated; overall feasibility cannot be declared when evaluated constraints pass.',
  ];
  if (!serviceCeilingSupported) warnings.push('Service ceiling is not evaluated because the minimum-power point lies beyond supplied CLmax.');
  const result: ConstraintAnalysisResult = {
    contract: resultContract(design, 'partial', warnings),
    domain: { minWingLoadingNm2: minimumWingLoadingNm2, maxWingLoadingNm2: domainMax, minShaftPowerLoadingWPerN: 0, maxShaftPowerLoadingWPerN: maximumShaftPowerLoadingWPerN },
    constraints,
    stallWingLoadingLimitNm2,
    curves,
    feasibleBoundary,
    intersections: findConstraintIntersections(curves),
    hasEvaluatedFeasibleRegion: feasibleBoundary.length > 1,
  };
  const currentPoint = {
    wingLoadingNm2: metrics.wingLoadingNm2,
    shaftPowerLoadingWPerN: design.propulsion.shaftPowerW / (design.massKg * gravityMs2),
  };
  result.currentPoint = currentPoint;
  result.currentEvaluation = evaluateConstraintPoint(result, currentPoint);
  return result;
}
