import type { AircraftDesign } from '../domain/types';
import { calculateMassProperties } from './massProperties';
import { calculateMetrics } from './metrics';

export type StabilityResult = { tailAreaM2: number; horizontalTailVolume: number; neutralPointXM: number | undefined; staticMargin: number | undefined; warnings: string[] };

function quarterChordStation(rootLeadingEdgeXM: number, spanM: number, rootChordM: number, taperRatio: number, sweepDeg: number): number {
  const mac = (2 / 3) * rootChordM * (1 + taperRatio + taperRatio ** 2) / (1 + taperRatio);
  const macSpanStation = spanM / 6 * (1 + 2 * taperRatio) / (1 + taperRatio);
  return rootLeadingEdgeXM + macSpanStation * Math.tan(sweepDeg * Math.PI / 180) + 0.25 * mac;
}

export function calculateStability(design: AircraftDesign): StabilityResult {
  const metrics = calculateMetrics(design); const mass = calculateMassProperties(design); const input = design.stability; const tail = design.horizontalTail; const warnings = [...mass.warnings];
  const wingAcXM = quarterChordStation(design.wing.rootLeadingEdgeXM, design.wing.spanM, design.wing.rootChordM, design.wing.taperRatio, design.wing.sweepDeg);
  const tailAcXM = quarterChordStation(tail.rootLeadingEdgeXM, tail.spanM, tail.rootChordM, tail.taperRatio, tail.sweepDeg);
  const tailAreaM2 = tail.spanM * tail.rootChordM * (1 + tail.taperRatio) / 2; const tailArmM = tailAcXM - wingAcXM;
  const wingLiftSlope = design.flightCondition.sectionLiftSlopePerRad / (1 + design.flightCondition.sectionLiftSlopePerRad / (Math.PI * design.flightCondition.oswaldEfficiency * metrics.aspectRatio));
  const valid = metrics.wingAreaM2 > 0 && metrics.macM > 0 && tailAreaM2 > 0 && tailArmM > 0 && input.tailLiftSlopePerRad > 0 && wingLiftSlope > 0 && input.tailEfficiency > 0 && input.downwashGradient >= 0 && input.downwashGradient < 1 && mass.centerOfGravityXM !== undefined;
  if (!valid) { warnings.push('Static-stability inputs are invalid.'); return { tailAreaM2, horizontalTailVolume: 0, neutralPointXM: undefined, staticMargin: undefined, warnings }; }
  const horizontalTailVolume = tailAreaM2 * tailArmM / (metrics.wingAreaM2 * metrics.macM);
  const neutralPointXM = wingAcXM + metrics.macM * input.tailEfficiency * (input.tailLiftSlopePerRad / wingLiftSlope) * (1 - input.downwashGradient) * horizontalTailVolume;
  const staticMargin = (neutralPointXM - mass.centerOfGravityXM!) / metrics.macM;
  if (staticMargin <= 0) warnings.push('Static margin is nonpositive under the supplied neutral-point model.');
  return { tailAreaM2, horizontalTailVolume, neutralPointXM, staticMargin, warnings };
}
