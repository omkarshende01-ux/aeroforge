import type { AircraftDesign } from '../domain/types';
import { calculateMassProperties } from './massProperties';
import { calculateMetrics } from './metrics';
import { calculateWingReferenceProperties } from './wingGeometry';
import { calculateEmpennageReferenceProperties } from './tailGeometry';

export type StabilityResult = { tailAreaM2: number; verticalTailAreaM2: number; horizontalTailVolume: number; verticalTailVolume: number; horizontalTailArmM: number; verticalTailArmM: number; neutralPointXM: number | undefined; staticMargin: number | undefined; warnings: string[] };

export function calculateStability(design: AircraftDesign): StabilityResult {
  const metrics = calculateMetrics(design); const mass = calculateMassProperties(design); const input = design.stability; const warnings = [...mass.warnings]; const empennage = calculateEmpennageReferenceProperties(design);
  const wingAcXM = calculateWingReferenceProperties(design.wing).meanAerodynamicChordQuarterChordXM;
  const tailAreaM2 = empennage.horizontal.projectedAreaM2; const tailArmM = empennage.horizontalTailMomentArmM;
  const wingLiftSlope = design.flightCondition.sectionLiftSlopePerRad / (1 + design.flightCondition.sectionLiftSlopePerRad / (Math.PI * design.flightCondition.oswaldEfficiency * metrics.aspectRatio));
  const valid = metrics.wingAreaM2 > 0 && metrics.macM > 0 && tailAreaM2 > 0 && tailArmM > 0 && input.tailLiftSlopePerRad > 0 && wingLiftSlope > 0 && input.tailEfficiency > 0 && input.downwashGradient >= 0 && input.downwashGradient < 1 && mass.centerOfGravityXM !== undefined;
  const base = { tailAreaM2, verticalTailAreaM2: empennage.vertical.projectedAreaM2, horizontalTailVolume: empennage.horizontalTailVolumeCoefficient, verticalTailVolume: empennage.verticalTailVolumeCoefficient, horizontalTailArmM: tailArmM, verticalTailArmM: empennage.verticalTailMomentArmM };
  if (!valid) { warnings.push('Static-stability inputs are invalid.'); return { ...base, horizontalTailVolume: 0, neutralPointXM: undefined, staticMargin: undefined, warnings }; }
  const horizontalTailVolume = empennage.horizontalTailVolumeCoefficient;
  const neutralPointXM = wingAcXM + metrics.macM * input.tailEfficiency * (input.tailLiftSlopePerRad / wingLiftSlope) * (1 - input.downwashGradient) * horizontalTailVolume;
  const staticMargin = (neutralPointXM - mass.centerOfGravityXM!) / metrics.macM;
  if (staticMargin <= 0) warnings.push('Static margin is nonpositive under the supplied neutral-point model.');
  return { ...base, horizontalTailVolume, neutralPointXM, staticMargin, warnings };
}
