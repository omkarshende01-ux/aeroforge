import type { AircraftDesign } from '../domain/types';

const gravityMs2 = 9.80665;
export type BeamStation = { spanPositionM: number; loadNm: number; shearN: number; momentNm: number; deflectionM: number };
export type StructureResult = { rootShearN: number; rootMomentNm: number; rootStressPa: number; tipDeflectionM: number; safetyFactor: number | undefined; stations: BeamStation[]; warnings: string[] };

export function calculateWingBeam(design: AircraftDesign, stationCount = 101): StructureResult {
  const input = design.structure; const halfSpan = design.wing.spanM / 2; const totalLiftN = input.loadFactor * design.massKg * gravityMs2; const warnings: string[] = [];
  const valid = halfSpan > 0 && design.massKg > 0 && input.loadFactor > 0 && input.elasticModulusPa > 0 && input.secondMomentM4 > 0 && input.outerFiberM > 0 && input.allowableStressPa > 0 && stationCount >= 3;
  if (!valid) { warnings.push('Wing-beam inputs are invalid.'); return { rootShearN: 0, rootMomentNm: 0, rootStressPa: 0, tipDeflectionM: 0, safetyFactor: undefined, stations: [], warnings }; }
  const dy = halfSpan / (stationCount - 1); const stations: BeamStation[] = Array.from({ length: stationCount }, (_, index) => { const y = index * dy; const loadNm = 4 * totalLiftN / (Math.PI * design.wing.spanM) * Math.sqrt(Math.max(0, 1 - (y / halfSpan) ** 2)); return { spanPositionM: y, loadNm, shearN: 0, momentNm: 0, deflectionM: 0 }; });
  for (let index = stationCount - 2; index >= 0; index -= 1) { const next = stations[index + 1]; const current = stations[index]; current.shearN = next.shearN + 0.5 * (current.loadNm + next.loadNm) * dy; current.momentNm = next.momentNm + 0.5 * (current.shearN + next.shearN) * dy; }
  let slope = 0; for (let index = 1; index < stationCount; index += 1) { const previous = stations[index - 1]; const current = stations[index]; const previousCurvature = previous.momentNm / (input.elasticModulusPa * input.secondMomentM4); const currentCurvature = current.momentNm / (input.elasticModulusPa * input.secondMomentM4); const nextSlope = slope + 0.5 * (previousCurvature + currentCurvature) * dy; current.deflectionM = previous.deflectionM + 0.5 * (slope + nextSlope) * dy; slope = nextSlope; }
  const rootStressPa = stations[0].momentNm * input.outerFiberM / input.secondMomentM4; const safetyFactor = rootStressPa > 0 ? input.allowableStressPa / rootStressPa : undefined;
  if (safetyFactor !== undefined && safetyFactor < 1) warnings.push('Calculated root bending stress exceeds the supplied allowable stress.');
  warnings.push('Beam uses a rigid-root Euler-Bernoulli model with constant EI and an elliptical limit-load distribution.');
  return { rootShearN: stations[0].shearN, rootMomentNm: stations[0].momentNm, rootStressPa, tipDeflectionM: stations.at(-1)?.deflectionM ?? 0, safetyFactor, stations, warnings };
}
