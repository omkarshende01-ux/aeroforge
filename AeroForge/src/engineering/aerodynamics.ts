import type { AircraftDesign } from '../domain/types';
import { calculateMetrics } from './metrics';
import { standardAtmosphere } from './atmosphere';

export type SpanLoadStation = { spanPositionM: number; liftPerSpanNm: number };
export type AerodynamicResult = {
  densityKgM3: number;
  dynamicPressurePa: number;
  mach: number;
  finiteWingLiftSlopePerRad: number;
  liftCoefficient: number;
  inducedDragCoefficient: number;
  dragCoefficient: number;
  liftN: number;
  dragN: number;
  liftToDrag: number | undefined;
  spanLoad: SpanLoadStation[];
  warnings: string[];
  model: 'linear-finite-wing-plus-parabolic-drag';
};

export function effectiveDensityKgM3(design: AircraftDesign): number {
  return design.flightCondition.densitySource === 'isa'
    ? standardAtmosphere(design.flightCondition.altitudeM).densityKgM3
    : design.flightCondition.densityKgM3;
}

export function ellipticalSpanLoad(totalLiftN: number, spanM: number, stationCount = 41): SpanLoadStation[] {
  if (spanM <= 0 || stationCount < 3) return [];
  return Array.from({ length: stationCount }, (_, index) => {
    const spanPositionM = -spanM / 2 + spanM * index / (stationCount - 1);
    const normalized = 2 * spanPositionM / spanM;
    const liftPerSpanNm = 4 * totalLiftN / (Math.PI * spanM) * Math.sqrt(Math.max(0, 1 - normalized * normalized));
    return { spanPositionM, liftPerSpanNm };
  });
}

export function calculateAerodynamics(design: AircraftDesign): AerodynamicResult {
  const metrics = calculateMetrics(design);
  const fc = design.flightCondition;
  const warnings: string[] = [];
  let densityKgM3 = 0;
  let speedOfSoundMs = 340.294;
  try {
    if (fc.densitySource === 'isa') {
      const atmosphere = standardAtmosphere(fc.altitudeM);
      densityKgM3 = atmosphere.densityKgM3;
      speedOfSoundMs = atmosphere.speedOfSoundMs;
    } else {
      densityKgM3 = fc.densityKgM3;
      warnings.push('Manual density selected; Mach uses sea-level standard speed of sound.');
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : 'Invalid atmosphere input.');
  }
  const valid = metrics.wingAreaM2 > 0 && metrics.aspectRatio > 0 && densityKgM3 > 0 && fc.speedMs >= 0 && fc.sectionLiftSlopePerRad > 0 && fc.oswaldEfficiency > 0 && fc.cd0 >= 0;
  if (fc.speedMs < 0) warnings.push('Airspeed cannot be negative.');
  if (fc.sectionLiftSlopePerRad <= 0) warnings.push('Section lift slope must be positive.');
  if (fc.oswaldEfficiency <= 0) warnings.push('Oswald efficiency must be positive.');
  if (fc.cd0 < 0) warnings.push('CD0 cannot be negative.');
  if (!valid) return { densityKgM3, dynamicPressurePa: 0, mach: 0, finiteWingLiftSlopePerRad: 0, liftCoefficient: 0, inducedDragCoefficient: 0, dragCoefficient: 0, liftN: 0, dragN: 0, liftToDrag: undefined, spanLoad: [], warnings, model: 'linear-finite-wing-plus-parabolic-drag' };

  const finiteWingLiftSlopePerRad = fc.sectionLiftSlopePerRad /
    (1 + fc.sectionLiftSlopePerRad / (Math.PI * fc.oswaldEfficiency * metrics.aspectRatio));
  const alphaEffectiveRad = (fc.angleOfAttackDeg - fc.zeroLiftAngleDeg) * Math.PI / 180;
  const liftCoefficient = finiteWingLiftSlopePerRad * alphaEffectiveRad;
  const inducedDragCoefficient = liftCoefficient ** 2 / (Math.PI * fc.oswaldEfficiency * metrics.aspectRatio);
  const dragCoefficient = fc.cd0 + inducedDragCoefficient;
  const dynamicPressurePa = 0.5 * densityKgM3 * fc.speedMs ** 2;
  const liftN = dynamicPressurePa * metrics.wingAreaM2 * liftCoefficient;
  const dragN = dynamicPressurePa * metrics.wingAreaM2 * dragCoefficient;
  const liftToDrag = dragCoefficient > 0 ? liftCoefficient / dragCoefficient : undefined;
  const mach = speedOfSoundMs > 0 ? fc.speedMs / speedOfSoundMs : 0;
  if (fc.clMax > 0 && Math.abs(liftCoefficient) > fc.clMax) warnings.push('Calculated |CL| exceeds supplied CLmax; the linear pre-stall model is outside its declared range.');
  if (mach > 0.3) warnings.push('Compressibility is not modeled; use this result only at Mach 0.3 or below.');
  if (Math.abs(design.wing.sweepDeg) > 0.01) warnings.push('Finite-wing lift slope does not include a sweep correction.');
  return { densityKgM3, dynamicPressurePa, mach, finiteWingLiftSlopePerRad, liftCoefficient, inducedDragCoefficient, dragCoefficient, liftN, dragN, liftToDrag, spanLoad: ellipticalSpanLoad(liftN, design.wing.spanM), warnings, model: 'linear-finite-wing-plus-parabolic-drag' };
}
