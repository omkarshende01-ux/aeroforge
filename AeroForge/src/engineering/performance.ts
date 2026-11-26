import type { AircraftDesign } from '../domain/types';
import { effectiveDensityKgM3 } from './aerodynamics';
import { calculateMetrics } from './metrics';

const gravityMs2 = 9.80665;
export type ManeuverPoint = { speedMs: number; positiveLoadFactor: number; negativeLoadFactor: number };
export type PerformanceResult = { requiredLiftCoefficient: number; dragN: number; shaftPowerRequiredW: number; rateOfClimbMs: number; enduranceS: number; stillAirRangeM: number; rangeMarginM: number; maneuverEnvelope: ManeuverPoint[]; warnings: string[] };

export function calculatePerformance(design: AircraftDesign): PerformanceResult {
  const metrics = calculateMetrics(design); const fc = design.flightCondition; const propulsion = design.propulsion; const warnings: string[] = [];
  let rho = 0; try { rho = effectiveDensityKgM3(design); } catch { warnings.push('Atmosphere input is outside the implemented range.'); }
  const valid = design.massKg > 0 && metrics.wingAreaM2 > 0 && rho > 0 && fc.speedMs > 0 && fc.oswaldEfficiency > 0 && fc.cd0 >= 0 && fc.clMax > 0 && fc.clMin < 0 && design.mission.maxOperatingSpeedMs > 0 && design.structure.loadFactor > 0 && design.structure.negativeLoadFactor < 0 && propulsion.shaftPowerW >= 0 && propulsion.propulsiveEfficiency > 0 && propulsion.propulsiveEfficiency <= 1 && propulsion.usableShaftEnergyJ >= 0 && propulsion.reserveFraction >= 0 && propulsion.reserveFraction < 1;
  if (!valid) { warnings.push('Performance inputs are invalid.'); return { requiredLiftCoefficient: 0, dragN: 0, shaftPowerRequiredW: 0, rateOfClimbMs: 0, enduranceS: 0, stillAirRangeM: 0, rangeMarginM: -design.mission.requiredRangeM, maneuverEnvelope: [], warnings }; }
  const weightN = design.massKg * gravityMs2; const q = 0.5 * rho * fc.speedMs ** 2;
  const requiredLiftCoefficient = weightN / (q * metrics.wingAreaM2);
  const cd = fc.cd0 + requiredLiftCoefficient ** 2 / (Math.PI * fc.oswaldEfficiency * metrics.aspectRatio);
  const dragN = q * metrics.wingAreaM2 * cd; const propulsivePowerRequiredW = dragN * fc.speedMs;
  const shaftPowerRequiredW = propulsivePowerRequiredW / propulsion.propulsiveEfficiency;
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
