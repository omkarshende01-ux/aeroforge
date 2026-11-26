import type { AircraftDesign } from '../domain/types';
import { effectiveDensityKgM3 } from './aerodynamics';
import { calculateMetrics } from './metrics';

const gravityMs2 = 9.80665;
export type ManeuverPoint = { speedMs: number; positiveLoadFactor: number; negativeLoadFactor: number };
export type PerformanceResult = { requiredLiftCoefficient: number; dragN: number; shaftPowerRequiredW: number; rateOfClimbMs: number; enduranceS: number; stillAirRangeM: number; rangeMarginM: number; maneuverEnvelope: ManeuverPoint[]; warnings: string[] };
export type LevelFlightPowerInput = {
  wingLoadingNm2: number;
  speedMs: number;
  densityKgM3: number;
  cd0: number;
  oswaldEfficiency: number;
  aspectRatio: number;
  propulsiveEfficiency: number;
};
export type LevelFlightPowerResult = {
  dynamicPressurePa: number;
  requiredLiftCoefficient: number;
  dragCoefficient: number;
  dragToWeight: number;
  propulsivePowerLoadingWPerN: number;
  shaftPowerLoadingWPerN: number;
};

/** Level-flight parabolic-polar power balance shared by performance and sizing constraints. */
export function calculateLevelFlightPower(input: LevelFlightPowerInput): LevelFlightPowerResult {
  const { wingLoadingNm2, speedMs, densityKgM3, cd0, oswaldEfficiency, aspectRatio, propulsiveEfficiency } = input;
  if (wingLoadingNm2 <= 0 || speedMs <= 0 || densityKgM3 <= 0 || cd0 < 0 || oswaldEfficiency <= 0 || aspectRatio <= 0 || propulsiveEfficiency <= 0 || propulsiveEfficiency > 1) {
    throw new RangeError('Level-flight power inputs are outside their physical bounds.');
  }
  const dynamicPressurePa = 0.5 * densityKgM3 * speedMs ** 2;
  const requiredLiftCoefficient = wingLoadingNm2 / dynamicPressurePa;
  const inducedFactor = 1 / (Math.PI * oswaldEfficiency * aspectRatio);
  const dragCoefficient = cd0 + inducedFactor * requiredLiftCoefficient ** 2;
  const dragToWeight = dynamicPressurePa * dragCoefficient / wingLoadingNm2;
  const propulsivePowerLoadingWPerN = speedMs * dragToWeight;
  const shaftPowerLoadingWPerN = propulsivePowerLoadingWPerN / propulsiveEfficiency;
  return { dynamicPressurePa, requiredLiftCoefficient, dragCoefficient, dragToWeight, propulsivePowerLoadingWPerN, shaftPowerLoadingWPerN };
}

export function calculatePerformance(design: AircraftDesign): PerformanceResult {
  const metrics = calculateMetrics(design); const fc = design.flightCondition; const propulsion = design.propulsion; const warnings: string[] = [];
  let rho = 0; try { rho = effectiveDensityKgM3(design); } catch { warnings.push('Atmosphere input is outside the implemented range.'); }
  const valid = design.massKg > 0 && metrics.wingAreaM2 > 0 && rho > 0 && fc.speedMs > 0 && fc.oswaldEfficiency > 0 && fc.cd0 >= 0 && fc.clMax > 0 && fc.clMin < 0 && design.mission.maxOperatingSpeedMs > 0 && design.structure.loadFactor > 0 && design.structure.negativeLoadFactor < 0 && propulsion.shaftPowerW >= 0 && propulsion.propulsiveEfficiency > 0 && propulsion.propulsiveEfficiency <= 1 && propulsion.usableShaftEnergyJ >= 0 && propulsion.reserveFraction >= 0 && propulsion.reserveFraction < 1;
  if (!valid) { warnings.push('Performance inputs are invalid.'); return { requiredLiftCoefficient: 0, dragN: 0, shaftPowerRequiredW: 0, rateOfClimbMs: 0, enduranceS: 0, stillAirRangeM: 0, rangeMarginM: -design.mission.requiredRangeM, maneuverEnvelope: [], warnings }; }
  const weightN = design.massKg * gravityMs2;
  const levelFlight = calculateLevelFlightPower({
    wingLoadingNm2: weightN / metrics.wingAreaM2,
    speedMs: fc.speedMs,
    densityKgM3: rho,
    cd0: fc.cd0,
    oswaldEfficiency: fc.oswaldEfficiency,
    aspectRatio: metrics.aspectRatio,
    propulsiveEfficiency: propulsion.propulsiveEfficiency,
  });
  const requiredLiftCoefficient = levelFlight.requiredLiftCoefficient;
  const dragN = levelFlight.dragToWeight * weightN;
  const propulsivePowerRequiredW = levelFlight.propulsivePowerLoadingWPerN * weightN;
  const shaftPowerRequiredW = levelFlight.shaftPowerLoadingWPerN * weightN;
  const propulsivePowerAvailableW = propulsion.shaftPowerW * propulsion.propulsiveEfficiency;
  const rateOfClimbMs = (propulsivePowerAvailableW - propulsivePowerRequiredW) / weightN;
  const usableEnergyJ = propulsion.usableShaftEnergyJ * (1 - propulsion.reserveFraction);
  const enduranceS = shaftPowerRequiredW > 0 ? usableEnergyJ / shaftPowerRequiredW : 0;
  const stillAirRangeM = enduranceS * fc.speedMs; const rangeMarginM = stillAirRangeM - design.mission.requiredRangeM;
  const maneuverEnvelope = Array.from({ length: 21 }, (_, index) => { const speedMs = design.mission.maxOperatingSpeedMs * index / 20; const stationQ = 0.5 * rho * speedMs ** 2; const positiveAerodynamicLimit = stationQ * metrics.wingAreaM2 * fc.clMax / weightN; const negativeAerodynamicLimit = stationQ * metrics.wingAreaM2 * fc.clMin / weightN; return { speedMs, positiveLoadFactor: Math.min(design.structure.loadFactor, positiveAerodynamicLimit), negativeLoadFactor: Math.max(design.structure.negativeLoadFactor, negativeAerodynamicLimit) }; });
  if (requiredLiftCoefficient > fc.clMax) warnings.push('Level-flight CL exceeds supplied CLmax at this speed and density.');
  if (rateOfClimbMs < design.mission.minimumClimbRateMs) warnings.push('Calculated climb rate is below the mission requirement.');
  if (rangeMarginM < 0) warnings.push('Calculated still-air range is below the mission requirement.');
  warnings.push('Maneuver envelope excludes gusts, compressibility and dynamic effects.');
  return { requiredLiftCoefficient, dragN, shaftPowerRequiredW, rateOfClimbMs, enduranceS, stillAirRangeM, rangeMarginM, maneuverEnvelope, warnings };
}
